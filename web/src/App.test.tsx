import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { fakeApi, headphones, renderWithStore } from './test/render'

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

  const fillDetails = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.type(screen.getByLabelText('Card number'), '4242424242424242')
    await user.type(screen.getByLabelText('Name on card'), 'Ana Maria Perez')
    await user.type(screen.getByLabelText('Expiry date'), '1299')
    await user.type(screen.getByLabelText('Security code'), '123')
    await user.type(screen.getByLabelText('Full name'), 'Ana Maria Perez')
    await user.type(screen.getByLabelText('Email'), 'ana@example.com')
    await user.type(screen.getByLabelText('Phone'), '3001234567')
    await user.type(screen.getByLabelText('Address'), 'Calle 10 # 20-30')
    await user.type(screen.getByLabelText('City'), 'Medellin')
    await user.type(screen.getByLabelText('State / Department'), 'Antioquia')
  }

  it('goes from the product to the payment summary', async () => {
    const user = userEvent.setup()
    renderWithStore(<App />)
    await productTitle('Aurora Wireless Headphones')
    await user.click(screen.getByRole('button', { name: 'Pay with credit card' }))

    await fillDetails(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByRole('dialog', { name: 'Payment summary' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Payment details' })).toBeNull()
    expect(
      await screen.findByRole('button', { name: 'Pay $474.900' }),
    ).toBeInTheDocument()
  })

  it('runs the whole checkout and comes back with the stock updated', async () => {
    const user = userEvent.setup()
    const getProducts = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, data: [headphones] })
      .mockResolvedValue({ ok: true, data: [{ ...headphones, stock: 11 }] })
    renderWithStore(<App />, { api: fakeApi({ getProducts }) })

    // 1. Product page
    await productTitle('Aurora Wireless Headphones')
    expect(screen.getByText('12 in stock')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Pay with credit card' }))

    // 2. Credit card and delivery info
    await fillDetails(user)
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    // 3. Summary
    await user.click(
      await screen.findByRole('checkbox', { name: /terms and conditions/ }),
    )
    await user.click(screen.getByRole('checkbox', { name: /personal data/ }))
    await user.click(screen.getByRole('button', { name: 'Pay $474.900' }))

    // 4. Final status
    expect(
      await screen.findByRole('heading', { name: 'Payment approved' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Back to the product' }))

    // 5. Product page, with one unit less
    await productTitle('Aurora Wireless Headphones')
    expect(screen.getByText('11 in stock')).toBeInTheDocument()
  })
})
