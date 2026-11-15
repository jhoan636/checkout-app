import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { renderWithStore } from './test/render'

const productTitle = (name: string) =>
  screen.findByRole('heading', { level: 2, name })

describe('App', () => {
  it('shows the store heading', () => {
    renderWithStore(<App />)

    expect(
      screen.getByRole('heading', { name: 'Product Checkout' }),
    ).toBeInTheDocument()
  })

  it('opens on the product page', async () => {
    renderWithStore(<App />)

    expect(await productTitle('Aurora Wireless Headphones')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Pay with credit card' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the payment details when the customer decides to pay', async () => {
    const user = userEvent.setup()
    renderWithStore(<App />)
    await productTitle('Aurora Wireless Headphones')

    await user.click(screen.getByRole('button', { name: 'Pay with credit card' }))

    expect(
      screen.getByRole('dialog', { name: 'Payment details' }),
    ).toBeInTheDocument()
  })

  it('keeps the product page behind the payment details', async () => {
    const user = userEvent.setup()
    renderWithStore(<App />)
    await productTitle('Aurora Wireless Headphones')
    await user.click(screen.getByRole('button', { name: 'Pay with credit card' }))

    await user.click(screen.getByRole('button', { name: 'Close' }))

    expect(await productTitle('Aurora Wireless Headphones')).toBeInTheDocument()
  })

  it('starts at the top when another product is shown', async () => {
    const user = userEvent.setup()
    renderWithStore(<App />)
    await productTitle('Aurora Wireless Headphones')
    jest.mocked(window.scrollTo).mockClear()

    await user.click(
      screen.getByRole('button', { name: /Nimbus Mechanical Keyboard/ }),
    )

    expect(window.scrollTo).toHaveBeenCalledWith(0, 0)
  })
})
