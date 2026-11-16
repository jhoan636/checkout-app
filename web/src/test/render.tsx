import { act, render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { Provider } from 'react-redux'
import type { CheckoutApi } from '../api/checkout-api'
import type { Acceptance, PaymentGateway } from '../api/gateway'
import type { PaymentSummary, Product, Transaction } from '../api/types'
import type { ProductsState } from '../store/products.slice'
import type { Services } from '../store/services'
import { createAppStore } from '../store/store'
import type { RootState } from '../store/store'

export const drone: Product = {
  id: 'prod-1',
  name: 'Glide Camera Drone',
  description: 'A foldable camera drone with a stabilised gimbal.',
  priceInCents: 45_990_000,
  stock: 12,
  imageUrl: '/products/glide-drone.webp',
}

/** The product already loaded, for screens that do not load it themselves. */
export const readyProducts = (
  items: Product[] = [drone],
): ProductsState => ({ items, status: 'ready', error: null })

/** What one unit of the drone costs, fees included. */
export const summaryForOne: PaymentSummary = {
  productId: drone.id,
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

/** One unit of the drone, already paid. */
export const approvedTransaction: Transaction = {
  id: 'b6f1c2d4-0000-4000-8000-000000000001',
  reference: 'ORDER-TEST-0001',
  status: 'APPROVED',
  productId: drone.id,
  quantity: 1,
  unitPriceInCents: 45_990_000,
  baseFeeInCents: 300_000,
  deliveryFeeInCents: 1_200_000,
  amountInCents: 47_490_000,
  currency: 'COP',
  createdAt: '2026-11-15T20:00:00.000Z',
  updatedAt: '2026-11-15T20:00:05.000Z',
}

/** A fake API: every call answers from memory unless a test overrides it. */
export const fakeApi = (overrides: Partial<CheckoutApi> = {}): CheckoutApi => ({
  getProducts: jest.fn().mockResolvedValue({ ok: true, data: [drone] }),
  getProduct: jest.fn().mockResolvedValue({ ok: true, data: drone }),
  getPaymentSummary: jest
    .fn()
    .mockResolvedValue({ ok: true, data: summaryForOne }),
  createTransaction: jest
    .fn()
    .mockResolvedValue({ ok: true, data: approvedTransaction }),
  getTransaction: jest
    .fn()
    .mockResolvedValue({ ok: true, data: approvedTransaction }),
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

/** Everything the store needs, faked: no network, no waiting, a known id. */
export const fakeServices = (overrides: Partial<Services> = {}): Services => ({
  api: fakeApi(),
  gateway: fakeGateway(),
  newId: jest.fn(() => approvedTransaction.id),
  wait: jest.fn().mockResolvedValue(undefined),
  ...overrides,
})

/**
 * Lets the work a render started in the background finish. A test that only
 * looks at the first paint ends with it, so nothing updates the screen after
 * the test is over.
 */
export const settle = () =>
  act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))

/** Renders a component connected to a real store and fake services. */
export const renderWithStore = (
  ui: ReactElement,
  options: {
    api?: CheckoutApi
    gateway?: PaymentGateway
    state?: Partial<RootState>
  } = {},
) => {
  const services = fakeServices({
    ...(options.api ? { api: options.api } : {}),
    ...(options.gateway ? { gateway: options.gateway } : {}),
  })
  const { api, gateway } = services
  const store = createAppStore(services, options.state)
  // As a wrapper, the store also survives a `rerender` of the component.
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  )
  return { store, api, gateway, services, ...render(ui, { wrapper }) }
}
