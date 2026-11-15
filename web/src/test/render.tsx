import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { Provider } from 'react-redux'
import type { CheckoutApi } from '../api/checkout-api'
import type { Product } from '../api/types'
import type { ProductsState } from '../store/products.slice'
import { createAppStore } from '../store/store'
import type { RootState } from '../store/store'

export const headphones: Product = {
  id: 'prod-1',
  name: 'Aurora Wireless Headphones',
  description: 'Over-ear headphones with noise cancelling.',
  priceInCents: 45_990_000,
  stock: 12,
  imageUrl: '/products/aurora-headphones.webp',
}

/** The product already loaded, for screens that do not load it themselves. */
export const readyProducts = (
  items: Product[] = [headphones],
): ProductsState => ({ items, status: 'ready', error: null })

/** A fake API: every call answers from memory unless a test overrides it. */
export const fakeApi = (overrides: Partial<CheckoutApi> = {}): CheckoutApi => ({
  getProducts: jest.fn().mockResolvedValue({ ok: true, data: [headphones] }),
  getProduct: jest.fn().mockResolvedValue({ ok: true, data: headphones }),
  getPaymentSummary: jest.fn(),
  createTransaction: jest.fn(),
  getTransaction: jest.fn(),
  ...overrides,
})

/** Renders a component connected to a real store and a fake API. */
export const renderWithStore = (
  ui: ReactElement,
  options: { api?: CheckoutApi; state?: Partial<RootState> } = {},
) => {
  const api = options.api ?? fakeApi()
  const store = createAppStore(api, options.state)
  // As a wrapper, the store also survives a `rerender` of the component.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )
  return { store, api, ...render(ui, { wrapper }) }
}
