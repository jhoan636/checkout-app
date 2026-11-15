import { screen } from '@testing-library/react'
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
})
