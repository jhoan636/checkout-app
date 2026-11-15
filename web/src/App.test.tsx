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

  it('opens on the product page', async () => {
    renderWithStore(<App />)

    expect(
      await screen.findByRole('radio', { name: /Aurora Wireless Headphones/ }),
    ).toBeInTheDocument()
  })

  it('opens the payment details when the customer decides to pay', async () => {
    const user = userEvent.setup()
    renderWithStore(<App />)
    await screen.findByRole('radio', { name: /Aurora Wireless Headphones/ })
    expect(screen.queryByRole('dialog')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Pay with credit card' }))

    expect(
      screen.getByRole('dialog', { name: 'Payment details' }),
    ).toBeInTheDocument()
  })
})
