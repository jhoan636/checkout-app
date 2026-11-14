import { render, screen } from '@testing-library/react'
import App from './App'

describe('App', () => {
  it('shows the store heading', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: 'Product Checkout' }),
    ).toBeInTheDocument()
  })
})
