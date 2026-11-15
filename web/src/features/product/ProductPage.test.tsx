import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fakeApi, headphones, keyboard, renderWithStore } from '../../test/render'
import { ProductPage } from './ProductPage'

const product = (name: string) => screen.findByRole('heading', { name })

describe('ProductPage', () => {
  it('shows a loading state while the products arrive', () => {
    renderWithStore(<ProductPage />, {
      api: fakeApi({ getProducts: () => new Promise(() => undefined) }),
    })

    expect(screen.getByRole('status')).toHaveTextContent('Loading products')
  })

  it('shows the first product with its description, price and stock', async () => {
    renderWithStore(<ProductPage />)

    expect(await product('Aurora Wireless Headphones')).toBeInTheDocument()
    expect(
      screen.getByText('Over-ear headphones with noise cancelling.'),
    ).toBeInTheDocument()
    expect(screen.getByText('$459.900')).toBeInTheDocument()
    expect(screen.getByText('12 in stock')).toBeInTheDocument()
  })

  it('shows the product image with a description and its real size', async () => {
    renderWithStore(<ProductPage />)

    const image = await screen.findByRole('img', {
      name: 'Aurora Wireless Headphones',
    })
    expect(image).toHaveAttribute('src', '/products/aurora-headphones.webp')
    expect(image).toHaveAttribute('width')
    expect(image).toHaveAttribute('height')
  })

  it('keeps the page usable when the photo cannot be loaded', async () => {
    renderWithStore(<ProductPage />)
    const image = await screen.findByRole('img', {
      name: 'Aurora Wireless Headphones',
    })

    fireEvent.error(image)

    expect(
      screen.queryByRole('img', { name: 'Aurora Wireless Headphones' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Pay with credit card' }),
    ).toBeEnabled()
  })

  it('loads the products only once', async () => {
    const { api, rerender } = renderWithStore(<ProductPage />)
    await product('Aurora Wireless Headphones')

    rerender(<ProductPage />)

    expect(api.getProducts).toHaveBeenCalledTimes(1)
  })

  describe('choosing a product', () => {
    it('switches to another product', async () => {
      const user = userEvent.setup()
      renderWithStore(<ProductPage />)
      await product('Aurora Wireless Headphones')

      await user.click(
        screen.getByRole('button', { name: 'Nimbus Mechanical Keyboard' }),
      )

      expect(await product('Nimbus Mechanical Keyboard')).toBeInTheDocument()
      expect(screen.getByText('$389.500')).toBeInTheDocument()
      expect(screen.getByText('3 in stock')).toBeInTheDocument()
    })

    it('marks which product is selected', async () => {
      renderWithStore(<ProductPage />)
      await product('Aurora Wireless Headphones')

      expect(
        screen.getByRole('button', { name: 'Aurora Wireless Headphones' }),
      ).toHaveAttribute('aria-pressed', 'true')
      expect(
        screen.getByRole('button', { name: 'Nimbus Mechanical Keyboard' }),
      ).toHaveAttribute('aria-pressed', 'false')
    })
  })

  describe('quantity', () => {
    it('starts at one and cannot go lower', async () => {
      renderWithStore(<ProductPage />)
      await product('Aurora Wireless Headphones')

      expect(screen.getByLabelText('Quantity')).toHaveTextContent('1')
      expect(screen.getByRole('button', { name: 'Remove one unit' })).toBeDisabled()
    })

    it('increases and decreases', async () => {
      const user = userEvent.setup()
      renderWithStore(<ProductPage />)
      await product('Aurora Wireless Headphones')

      await user.click(screen.getByRole('button', { name: 'Add one unit' }))
      await user.click(screen.getByRole('button', { name: 'Add one unit' }))
      await user.click(screen.getByRole('button', { name: 'Remove one unit' }))

      expect(screen.getByLabelText('Quantity')).toHaveTextContent('2')
    })

    it('cannot go above the units in stock', async () => {
      const user = userEvent.setup()
      renderWithStore(<ProductPage />, { state: { checkout: {
        step: 'product', productId: keyboard.id, quantity: 3,
      } } })
      await product('Nimbus Mechanical Keyboard')

      expect(screen.getByRole('button', { name: 'Add one unit' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Add one unit' }))
      expect(screen.getByLabelText('Quantity')).toHaveTextContent('3')
    })

    it('goes back to one when another product is chosen', async () => {
      const user = userEvent.setup()
      renderWithStore(<ProductPage />)
      await product('Aurora Wireless Headphones')
      await user.click(screen.getByRole('button', { name: 'Add one unit' }))

      await user.click(
        screen.getByRole('button', { name: 'Nimbus Mechanical Keyboard' }),
      )

      expect(screen.getByLabelText('Quantity')).toHaveTextContent('1')
    })
  })

  describe('paying', () => {
    it('starts the checkout with the product and quantity chosen', async () => {
      const user = userEvent.setup()
      const { store } = renderWithStore(<ProductPage />)
      await product('Aurora Wireless Headphones')
      await user.click(screen.getByRole('button', { name: 'Add one unit' }))

      await user.click(
        screen.getByRole('button', { name: 'Pay with credit card' }),
      )

      expect(store.getState().checkout).toEqual({
        step: 'details',
        productId: headphones.id,
        quantity: 2,
      })
    })

    it('cannot pay for a product that is sold out', async () => {
      renderWithStore(<ProductPage />, {
        api: fakeApi({
          getProducts: jest.fn().mockResolvedValue({
            ok: true,
            data: [{ ...headphones, stock: 0 }],
          }),
        }),
      })
      await product('Aurora Wireless Headphones')

      expect(screen.getByText('Sold out')).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'Pay with credit card' }),
      ).toBeDisabled()
    })

    it('warns when only a few units are left', async () => {
      renderWithStore(<ProductPage />, { state: { checkout: {
        step: 'product', productId: keyboard.id, quantity: 1,
      } } })

      expect(await screen.findByText('3 in stock')).toHaveAttribute(
        'data-level',
        'low',
      )
    })
  })

  describe('when the products cannot be loaded', () => {
    const failing = () =>
      fakeApi({
        getProducts: jest
          .fn()
          .mockResolvedValueOnce({
            ok: false,
            error: {
              status: 0,
              code: 'NETWORK_ERROR',
              message: 'Check your connection and try again.',
            },
          })
          .mockResolvedValue({ ok: true, data: [headphones] }),
      })

    it('explains the problem', async () => {
      renderWithStore(<ProductPage />, { api: failing() })

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Check your connection and try again.',
      )
    })

    it('lets the customer try again', async () => {
      const user = userEvent.setup()
      renderWithStore(<ProductPage />, { api: failing() })

      await user.click(await screen.findByRole('button', { name: 'Try again' }))

      expect(await product('Aurora Wireless Headphones')).toBeInTheDocument()
    })
  })

  it('says so when the store has no products', async () => {
    renderWithStore(<ProductPage />, {
      api: fakeApi({
        getProducts: jest.fn().mockResolvedValue({ ok: true, data: [] }),
      }),
    })

    await waitFor(() =>
      expect(screen.getByText('No products available right now.')).toBeInTheDocument(),
    )
  })
})
