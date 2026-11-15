import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Product } from '../../api/types'
import { initialCheckoutState } from '../../store/checkout.slice'
import { headphones, keyboard, readyProducts, renderWithStore } from '../../test/render'
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
      products: readyProducts(options.items ?? [headphones, keyboard]),
      checkout: {
        ...initialCheckoutState,
        productId: options.productId ?? null,
        quantity: options.quantity ?? 1,
      },
    },
  })

const payButton = () =>
  screen.getByRole('button', { name: 'Pay with credit card' })
const title = (name: string) => screen.getByRole('heading', { level: 2, name })

describe('ProductPage', () => {
  describe('the product', () => {
    it('shows its name, description, price and units in stock', () => {
      renderProduct()

      expect(title('Aurora Wireless Headphones')).toBeInTheDocument()
      expect(
        screen.getByText('Over-ear headphones with noise cancelling.'),
      ).toBeInTheDocument()
      expect(screen.getByTestId('price')).toHaveTextContent('$459.900')
      expect(screen.getByText('12 in stock')).toBeInTheDocument()
    })

    it('shows its photo with a real size, so the page does not jump', () => {
      renderProduct()
      const image = screen.getByRole('img', { name: 'Aurora Wireless Headphones' })

      expect(image).toHaveAttribute('src', '/products/aurora-headphones.webp')
      expect(image).toHaveAttribute('width')
      expect(image).toHaveAttribute('height')
    })

    it('keeps the page usable when the photo cannot be loaded', () => {
      renderProduct()

      fireEvent.error(
        screen.getByRole('img', { name: 'Aurora Wireless Headphones' }),
      )

      expect(
        screen.queryByRole('img', { name: 'Aurora Wireless Headphones' }),
      ).toBeNull()
      expect(payButton()).toBeEnabled()
    })

    it('warns when only a few units are left', () => {
      renderProduct({ productId: keyboard.id })

      expect(screen.getByText('3 in stock')).toHaveAttribute('data-level', 'low')
    })
  })

  describe('which product is shown', () => {
    it('starts with the first product that can be bought', () => {
      const { store } = renderProduct({
        items: [{ ...headphones, stock: 0 }, keyboard],
      })

      expect(title('Nimbus Mechanical Keyboard')).toBeInTheDocument()
      expect(store.getState().checkout.productId).toBe(keyboard.id)
    })

    it('keeps the product that was already chosen', () => {
      renderProduct({ productId: keyboard.id })

      expect(title('Nimbus Mechanical Keyboard')).toBeInTheDocument()
    })

    it('falls back to the first one when the chosen product no longer exists', () => {
      const { store } = renderProduct({ productId: 'gone' })

      expect(title('Aurora Wireless Headphones')).toBeInTheDocument()
      expect(store.getState().checkout.productId).toBe(headphones.id)
    })

    it('shows nothing when the store is empty', () => {
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
      renderProduct({ productId: keyboard.id, quantity: 3 })

      expect(screen.getByRole('button', { name: 'Add one unit' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Add one unit' }))
      expect(screen.getByLabelText('Quantity')).toHaveTextContent('3')
    })

    it('never shows more units than the stock allows', () => {
      // Stock can drop between the moment the units were chosen and now.
      renderProduct({ productId: keyboard.id, quantity: 8 })

      expect(screen.getByLabelText('Quantity')).toHaveTextContent('3')
      expect(screen.getByTestId('total')).toHaveTextContent('$1.168.500')
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
        productId: headphones.id,
        quantity: 2,
      })
    })

    it('cannot pay for a product that is sold out', () => {
      renderProduct({ items: [{ ...headphones, stock: 0 }] })

      expect(screen.getByText('Sold out')).toBeInTheDocument()
      expect(payButton()).toBeDisabled()
      expect(screen.getByTestId('total')).toHaveTextContent('$0')
      expect(screen.queryByLabelText('Quantity')).toBeNull()
    })
  })

  describe('other products of the store', () => {
    const others = () =>
      within(screen.getByRole('region', { name: 'More products' }))

    it('lists the rest of the products with their price', () => {
      renderProduct()

      const other = others().getByRole('button', {
        name: /Nimbus Mechanical Keyboard/,
      })
      expect(other).toHaveTextContent('$389.500')
      expect(
        others().queryByRole('button', { name: /Aurora Wireless Headphones/ }),
      ).toBeNull()
    })

    it('shows another product and goes back to one unit', async () => {
      const user = userEvent.setup()
      renderProduct({ quantity: 4 })

      await user.click(
        others().getByRole('button', { name: /Nimbus Mechanical Keyboard/ }),
      )

      expect(title('Nimbus Mechanical Keyboard')).toBeInTheDocument()
      expect(screen.getByLabelText('Quantity')).toHaveTextContent('1')
      expect(
        others().getByRole('button', { name: /Aurora Wireless Headphones/ }),
      ).toBeInTheDocument()
    })

    it('says when another product is sold out', () => {
      renderProduct({ items: [headphones, { ...keyboard, stock: 0 }] })

      expect(
        others().getByRole('button', { name: /Nimbus Mechanical Keyboard/ }),
      ).toHaveTextContent('Sold out')
    })

    it('is left out when the store has a single product', () => {
      renderProduct({ items: [headphones] })

      expect(screen.queryByRole('region', { name: 'More products' })).toBeNull()
    })
  })
})
