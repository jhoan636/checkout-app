import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Product } from '../../api/types'
import { initialCheckoutState } from '../../store/checkout.slice'
import { headphones, keyboard, readyProducts, renderWithStore } from '../../test/render'
import { ProductPage } from './ProductPage'

const renderProduct = (
  product: Product = headphones,
  quantity = 1,
  items: Product[] = [headphones, keyboard],
) =>
  renderWithStore(<ProductPage />, {
    state: {
      products: readyProducts(items),
      checkout: {
        ...initialCheckoutState,
        step: 'product',
        productId: product.id,
        quantity,
      },
    },
  })

const payButton = () =>
  screen.getByRole('button', { name: 'Pay with credit card' })

describe('ProductPage', () => {
  describe('the product', () => {
    it('shows its name, description, price and units in stock', () => {
      renderProduct()

      expect(
        screen.getByRole('heading', { name: 'Aurora Wireless Headphones' }),
      ).toBeInTheDocument()
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

      fireEvent.error(screen.getByRole('img'))

      expect(screen.queryByRole('img')).toBeNull()
      expect(payButton()).toBeEnabled()
    })

    it('warns when only a few units are left', () => {
      renderProduct(keyboard)

      expect(screen.getByText('3 in stock')).toHaveAttribute('data-level', 'low')
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
      renderProduct(keyboard, 3)

      expect(screen.getByRole('button', { name: 'Add one unit' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Add one unit' }))
      expect(screen.getByLabelText('Quantity')).toHaveTextContent('3')
    })

    it('never shows more units than the stock allows', () => {
      // Stock can drop between the moment the units were chosen and now.
      renderProduct(keyboard, 8)

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
      const soldOut = { ...headphones, stock: 0 }
      renderProduct(soldOut, 1, [soldOut])

      expect(screen.getByText('Sold out')).toBeInTheDocument()
      expect(payButton()).toBeDisabled()
      expect(screen.getByTestId('total')).toHaveTextContent('$0')
      expect(screen.queryByLabelText('Quantity')).toBeNull()
    })
  })

  describe('leaving', () => {
    it('goes back to the catalogue', async () => {
      const user = userEvent.setup()
      const { store } = renderProduct()

      await user.click(screen.getByRole('button', { name: 'All products' }))

      expect(store.getState().checkout.step).toBe('catalog')
    })

    it('goes back to the catalogue when the product no longer exists', () => {
      const { store } = renderProduct({ ...headphones, id: 'gone' })

      expect(screen.queryByRole('heading')).toBeNull()
      expect(store.getState().checkout.step).toBe('catalog')
    })
  })
})
