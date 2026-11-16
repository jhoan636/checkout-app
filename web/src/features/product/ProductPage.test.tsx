import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Product } from '../../api/types'
import { initialCheckoutState } from '../../store/checkout.slice'
import { drone, readyProducts, renderWithStore } from '../../test/render'
import { ProductPage } from './ProductPage'

const renderProduct = (
  options: {
    productId?: string | null
    quantity?: number
    items?: Product[]
  } = {},
) =>
  renderWithStore(<ProductPage />, {
    state: {
      products: readyProducts(options.items ?? [drone]),
      checkout: {
        ...initialCheckoutState,
        productId: options.productId ?? null,
        quantity: options.quantity ?? 1,
      },
    },
  })

const payButton = () =>
  screen.getByRole('button', { name: 'Pay with credit card' })
/** The same product with only three units left. */
const fewLeft: Product = { ...drone, stock: 3 }

const title = (name: string) => screen.getByRole('heading', { level: 2, name })

describe('ProductPage', () => {
  describe('the product', () => {
    it('shows its name, description, price and units in stock', () => {
      renderProduct()

      expect(title('Glide Camera Drone')).toBeInTheDocument()
      expect(
        screen.getByText('A foldable camera drone with a stabilised gimbal.'),
      ).toBeInTheDocument()
      expect(screen.getByTestId('price')).toHaveTextContent('$459.900')
      expect(screen.getByText('12 in stock')).toBeInTheDocument()
    })

    it('highlights the last word of the name', () => {
      renderProduct()

      const accent = title('Glide Camera Drone').querySelector('em')
      expect(accent).toHaveTextContent(/^Drone$/)
    })

    it('highlights a name of a single word as a whole', () => {
      renderProduct({ items: [{ ...drone, name: '  Glide ' }] })

      expect(title('Glide').querySelector('em')).toHaveTextContent(/^Glide$/)
    })

    it('shows its photo with a real size, so the page does not jump', () => {
      renderProduct()
      const image = screen.getByRole('img', { name: 'Glide Camera Drone' })

      expect(image).toHaveAttribute('src', '/products/glide-drone.webp')
      // The size of the file, so the reserved box has its proportions.
      expect(image).toHaveAttribute('width', '960')
      expect(image).toHaveAttribute('height', '433')
    })

    it('keeps the page usable when the photo cannot be loaded', () => {
      renderProduct()

      fireEvent.error(
        screen.getByRole('img', { name: 'Glide Camera Drone' }),
      )

      expect(
        screen.queryByRole('img', { name: 'Glide Camera Drone' }),
      ).toBeNull()
      expect(payButton()).toBeEnabled()
    })

    it('warns when only a few units are left', () => {
      renderProduct({ items: [fewLeft] })

      expect(screen.getByText('3 in stock')).toHaveAttribute('data-level', 'low')
    })
  })

  describe('the checkout state', () => {
    it('records which product is being bought', () => {
      const { store } = renderProduct()

      expect(store.getState().checkout.productId).toBe(drone.id)
    })

    it('keeps the units already chosen for the same product', () => {
      const { store } = renderProduct({ productId: drone.id, quantity: 4 })

      expect(store.getState().checkout.quantity).toBe(4)
      expect(screen.getByLabelText('Quantity')).toHaveTextContent('4')
    })

    it('shows nothing when the store has no product', () => {
      renderProduct({ items: [] })

      expect(screen.queryByRole('heading')).toBeNull()
    })
  })

  describe('quantity', () => {
    it('starts at one and cannot go lower', () => {
      renderProduct()

      expect(screen.getByLabelText('Quantity')).toHaveTextContent('1')
      expect(
        screen.getByRole('button', { name: 'Remove one unit' }),
      ).toBeDisabled()
    })

    it('changes the total as units are added and removed', async () => {
      const user = userEvent.setup()
      renderProduct()

      await user.click(screen.getByRole('button', { name: 'Add one unit' }))
      await user.click(screen.getByRole('button', { name: 'Add one unit' }))
      await user.click(screen.getByRole('button', { name: 'Remove one unit' }))

      expect(screen.getByLabelText('Quantity')).toHaveTextContent('2')
      expect(screen.getByTestId('total')).toHaveTextContent('$919.800')
    })

    it('cannot go above the units in stock', async () => {
      const user = userEvent.setup()
      renderProduct({ items: [fewLeft], productId: fewLeft.id, quantity: 3 })

      expect(screen.getByRole('button', { name: 'Add one unit' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Add one unit' }))
      expect(screen.getByLabelText('Quantity')).toHaveTextContent('3')
    })

    it('never shows more units than the stock allows', () => {
      // Stock can drop between the moment the units were chosen and now.
      renderProduct({ items: [fewLeft], productId: fewLeft.id, quantity: 8 })

      expect(screen.getByLabelText('Quantity')).toHaveTextContent('3')
      expect(screen.getByTestId('total')).toHaveTextContent('$1.379.700')
    })
  })

  describe('paying', () => {
    it('starts the checkout with the product and quantity chosen', async () => {
      const user = userEvent.setup()
      const { store } = renderProduct()
      await user.click(screen.getByRole('button', { name: 'Add one unit' }))

      await user.click(payButton())

      expect(store.getState().checkout).toMatchObject({
        step: 'details',
        productId: drone.id,
        quantity: 2,
      })
    })

    it('cannot pay for a product that is sold out', () => {
      renderProduct({ items: [{ ...drone, stock: 0 }] })

      expect(screen.getByText('Sold out')).toBeInTheDocument()
      expect(payButton()).toBeDisabled()
      expect(screen.getByTestId('total')).toHaveTextContent('$0')
      expect(screen.queryByLabelText('Quantity')).toBeNull()
    })
  })
})
