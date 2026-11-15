import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { Provider } from 'react-redux'
import type { CheckoutApi } from '../api/checkout-api'
import type { Acceptance, PaymentGateway } from '../api/gateway'
import type { PaymentSummary, Product } from '../api/types'
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

/** What one unit of the headphones costs, fees included. */
export const summaryForOne: PaymentSummary = {
  productId: headphones.id,
  quantity: 1,
  subtotalInCents: 45_990_000,
  baseFeeInCents: 300_000,
  deliveryFeeInCents: 1_200_000,
  totalInCents: 47_490_000,
}

export const acceptance: Acceptance = {
  acceptanceToken: 'acc-token',
  personalDataAuthToken: 'data-token',
  termsUrl: 'https://gateway.test/terms.pdf',
  personalDataUrl: 'https://gateway.test/personal-data.pdf',
}

/** A fake API: every call answers from memory unless a test overrides it. */
export const fakeApi = (overrides: Partial<CheckoutApi> = {}): CheckoutApi => ({
  getProducts: jest.fn().mockResolvedValue({ ok: true, data: [headphones] }),
  getProduct: jest.fn().mockResolvedValue({ ok: true, data: headphones }),
  getPaymentSummary: jest
    .fn()
    .mockResolvedValue({ ok: true, data: summaryForOne }),
  createTransaction: jest.fn(),
  getTransaction: jest.fn(),
  ...overrides,
})

/** A fake gateway: it accepts every card unless a test says otherwise. */
export const fakeGateway = (
  overrides: Partial<PaymentGateway> = {},
): PaymentGateway => ({
  tokenizeCard: jest
    .fn()
    .mockResolvedValue({ ok: true, data: { token: 'tok_test_1' } }),
  getAcceptance: jest.fn().mockResolvedValue({ ok: true, data: acceptance }),
  ...overrides,
})

/** Renders a component connected to a real store, a fake API and a fake gateway. */
export const renderWithStore = (
  ui: ReactElement,
  options: {
    api?: CheckoutApi
    gateway?: PaymentGateway
    state?: Partial<RootState>
  } = {},
) => {
  const api = options.api ?? fakeApi()
  const gateway = options.gateway ?? fakeGateway()
  const store = createAppStore({ api, gateway }, options.state)
  // As a wrapper, the store also survives a `rerender` of the component.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )
  return { store, api, gateway, ...render(ui, { wrapper }) }
}
