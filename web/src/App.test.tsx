import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { renderWithStore } from './test/render'

describe('App', () => {
  it('shows the store heading', () => {
    renderWithStore(<App />)

    expect(
      screen.getByRole('heading', { name: 'Product Checkout' }),
    ).toBeInTheDocument()
  })

  it('opens on the catalogue', async () => {
    renderWithStore(<App />)

    expect(
      await screen.findByRole('button', { name: /Aurora Wireless Headphones/ }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pay with credit card' })).toBeNull()
  })

  it('goes from the catalogue to the product and then to the payment details', async () => {
    const user = userEvent.setup()
    renderWithStore(<App />)

    await user.click(
      await screen.findByRole('button', { name: /Aurora Wireless Headphones/ }),
    )
    expect(
      screen.getByRole('heading', { name: 'Aurora Wireless Headphones' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Pay with credit card' }))

    expect(
      screen.getByRole('dialog', { name: 'Payment details' }),
    ).toBeInTheDocument()
  })

  it('keeps the product page behind the payment details', async () => {
    const user = userEvent.setup()
    renderWithStore(<App />)
    await user.click(
      await screen.findByRole('button', { name: /Nimbus Mechanical Keyboard/ }),
    )
    await user.click(screen.getByRole('button', { name: 'Pay with credit card' }))

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(
      screen.getByRole('heading', { name: 'Nimbus Mechanical Keyboard' }),
    ).toBeInTheDocument()
  })

  it('starts each page at the top', async () => {
    const user = userEvent.setup()
    renderWithStore(<App />)
    const card = await screen.findByRole('button', {
      name: /Aurora Wireless Headphones/,
    })
    jest.mocked(window.scrollTo).mockClear()

    await user.click(card)

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })
})
