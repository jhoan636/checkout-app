import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fakeApi, headphones, renderWithStore } from '../../test/render'
import { ProductsGate } from './ProductsGate'

const renderGate = (api = fakeApi()) =>
  renderWithStore(
    <ProductsGate>
      <p>Store content</p>
    </ProductsGate>,
    { api },
  )

describe('ProductsGate', () => {
  it('shows a loading state while the products arrive', () => {
    renderGate(fakeApi({ getProducts: () => new Promise(() => undefined) }))

    expect(screen.getByRole('status')).toHaveTextContent('Loading products')
    expect(screen.queryByText('Store content')).toBeNull()
  })

  it('shows the store once the products are ready', async () => {
    renderGate()

    expect(await screen.findByText('Store content')).toBeInTheDocument()
  })

  it('loads the products only once', async () => {
    const { api, rerender } = renderGate()
    await screen.findByText('Store content')

    rerender(
      <ProductsGate>
        <p>Store content</p>
      </ProductsGate>,
    )

    expect(api.getProducts).toHaveBeenCalledTimes(1)
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
      renderGate(failing())

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Check your connection and try again.',
      )
    })

    it('lets the customer try again', async () => {
      const user = userEvent.setup()
      renderGate(failing())

      await user.click(await screen.findByRole('button', { name: 'Try again' }))

      expect(await screen.findByText('Store content')).toBeInTheDocument()
    })
  })

  it('says so when the store has no products', async () => {
    renderGate(
      fakeApi({
        getProducts: jest.fn().mockResolvedValue({ ok: true, data: [] }),
      }),
    )

    await waitFor(() =>
      expect(
        screen.getByText('No products available right now.'),
      ).toBeInTheDocument(),
    )
    expect(screen.queryByText('Store content')).toBeNull()
  })
})
