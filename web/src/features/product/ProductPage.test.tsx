import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { initialCheckoutState } from '../../store/checkout.slice'
import { fakeApi, headphones, keyboard, renderWithStore } from '../../test/render'
import { ProductPage } from './ProductPage'

const card = (name: string) => screen.findByRole('radio', { name: new RegExp(name) })
const cardOf = async (name: string) =>
  (await card(name)).closest('li') as HTMLElement
const payButton = () =>
  screen.getByRole('button', { name: 'Pay with credit card' })

describe('ProductPage', () => {
  it('shows a loading state while the products arrive', () => {
    renderWithStore(<ProductPage />, {
      api: fakeApi({ getProducts: () => new Promise(() => undefined) }),
    })

    expect(screen.getByRole('status')).toHaveTextContent('Loading products')
  })

  describe('the catalogue', () => {
    it('lists every product with its description, price and stock', async () => {
      renderWithStore(<ProductPage />)

      const first = within(await cardOf('Aurora Wireless Headphones'))
      expect(
        first.getByText('Over-ear headphones with noise cancelling.'),
      ).toBeInTheDocument()
      expect(first.getByText('$459.900')).toBeInTheDocument()
      expect(first.getByText('12 in stock')).toBeInTheDocument()

      const second = within(await cardOf('Nimbus Mechanical Keyboard'))
      expect(second.getByText('$389.500')).toBeInTheDocument()
      expect(second.getByText('3 in stock')).toBeInTheDocument()
    })

    it('says how many products there are', async () => {
      renderWithStore(<ProductPage />)

      expect(await screen.findByText('2 products')).toBeInTheDocument()
    })

    // The photo has an empty alt (the card names the product), so it is
    // found as an element rather than by an accessible role.
    it('shows each photo with its real size, so the page does not jump', async () => {
      renderWithStore(<ProductPage />)
      const image = (await cardOf('Aurora Wireless Headphones')).querySelector(
        'img',
      )

      expect(image).toHaveAttribute('src', '/products/aurora-headphones.webp')
      expect(image).toHaveAttribute('width')
      expect(image).toHaveAttribute('height')
      expect(image).toHaveAttribute('alt', '')
    })

    it('keeps the card usable when its photo cannot be loaded', async () => {
      renderWithStore(<ProductPage />)
      const item = await cardOf('Aurora Wireless Headphones')

      fireEvent.error(item.querySelector('img')!)

      expect(item.querySelector('img')).toBeNull()
      expect(payButton()).toBeEnabled()
    })

    it('warns when only a few units are left', async () => {
      renderWithStore(<ProductPage />)

      expect(await screen.findByText('3 in stock')).toHaveAttribute(
        'data-level',
        'low',
      )
    })

    it('loads the products only once', async () => {
      const { api, rerender } = renderWithStore(<ProductPage />)
      await card('Aurora Wireless Headphones')

      rerender(<ProductPage />)

      expect(api.getProducts).toHaveBeenCalledTimes(1)
    })
  })

  describe('choosing a product', () => {
    it('starts with the first available product chosen', async () => {
      renderWithStore(<ProductPage />)

      expect(await card('Aurora Wireless Headphones')).toBeChecked()
      expect(await card('Nimbus Mechanical Keyboard')).not.toBeChecked()
    })

    it('skips a sold-out product when choosing the first one', async () => {
      renderWithStore(<ProductPage />, {
        api: fakeApi({
          getProducts: jest.fn().mockResolvedValue({
            ok: true,
            data: [{ ...headphones, stock: 0 }, keyboard],
          }),
        }),
      })

      expect(await card('Nimbus Mechanical Keyboard')).toBeChecked()
    })

    it('chooses another product', async () => {
      const user = userEvent.setup()
      renderWithStore(<ProductPage />)

      await user.click(await card('Nimbus Mechanical Keyboard'))

      expect(await card('Nimbus Mechanical Keyboard')).toBeChecked()
      expect(screen.getByTestId('total')).toHaveTextContent('$389.500')
    })

    it('cannot choose a product that is sold out', async () => {
      renderWithStore(<ProductPage />, {
        api: fakeApi({
          getProducts: jest.fn().mockResolvedValue({
            ok: true,
            data: [headphones, { ...keyboard, stock: 0 }],
          }),
        }),
      })

      expect(await card('Nimbus Mechanical Keyboard')).toBeDisabled()
      expect(screen.getByText('Sold out')).toBeInTheDocument()
    })
  })

  describe('quantity', () => {
    it('starts at one and cannot go lower', async () => {
      renderWithStore(<ProductPage />)
      await card('Aurora Wireless Headphones')

      expect(screen.getByLabelText('Quantity')).toHaveTextContent('1')
      expect(
        screen.getByRole('button', { name: 'Remove one unit' }),
      ).toBeDisabled()
    })

    it('changes the total as units are added and removed', async () => {
      const user = userEvent.setup()
      renderWithStore(<ProductPage />)
      await card('Aurora Wireless Headphones')

      await user.click(screen.getByRole('button', { name: 'Add one unit' }))
      await user.click(screen.getByRole('button', { name: 'Add one unit' }))
      await user.click(screen.getByRole('button', { name: 'Remove one unit' }))

      expect(screen.getByLabelText('Quantity')).toHaveTextContent('2')
      expect(screen.getByTestId('total')).toHaveTextContent('$919.800')
    })

    it('cannot go above the units in stock', async () => {
      const user = userEvent.setup()
      renderWithStore(<ProductPage />, {
        state: {
          checkout: {
            ...initialCheckoutState,
            productId: keyboard.id,
            quantity: 3,
          },
        },
      })
      await card('Nimbus Mechanical Keyboard')

      expect(screen.getByRole('button', { name: 'Add one unit' })).toBeDisabled()
      await user.click(screen.getByRole('button', { name: 'Add one unit' }))
      expect(screen.getByLabelText('Quantity')).toHaveTextContent('3')
    })

    it('goes back to one when another product is chosen', async () => {
      const user = userEvent.setup()
      renderWithStore(<ProductPage />)
      await card('Aurora Wireless Headphones')
      await user.click(screen.getByRole('button', { name: 'Add one unit' }))

      await user.click(await card('Nimbus Mechanical Keyboard'))

      expect(screen.getByLabelText('Quantity')).toHaveTextContent('1')
    })
  })

  describe('paying', () => {
    it('starts the checkout with the product and quantity chosen', async () => {
      const user = userEvent.setup()
      const { store } = renderWithStore(<ProductPage />)
      await card('Aurora Wireless Headphones')
      await user.click(screen.getByRole('button', { name: 'Add one unit' }))

      await user.click(payButton())

      expect(store.getState().checkout).toMatchObject({
        step: 'details',
        productId: headphones.id,
        quantity: 2,
      })
    })

    it('cannot pay when every product is sold out', async () => {
      renderWithStore(<ProductPage />, {
        api: fakeApi({
          getProducts: jest.fn().mockResolvedValue({
            ok: true,
            data: [{ ...headphones, stock: 0 }],
          }),
        }),
      })
      await card('Aurora Wireless Headphones')

      expect(payButton()).toBeDisabled()
      expect(screen.getByTestId('total')).toHaveTextContent('$0')
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

      expect(await card('Aurora Wireless Headphones')).toBeInTheDocument()
    })
  })

  it('says so when the store has no products', async () => {
    renderWithStore(<ProductPage />, {
      api: fakeApi({
        getProducts: jest.fn().mockResolvedValue({ ok: true, data: [] }),
      }),
    })

    await waitFor(() =>
      expect(
        screen.getByText('No products available right now.'),
      ).toBeInTheDocument(),
    )
  })
})
