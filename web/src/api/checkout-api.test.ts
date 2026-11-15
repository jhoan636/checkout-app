import { createCheckoutApi } from './checkout-api'
import type { Http } from './http'
import type { NewTransaction } from './types'

const setup = () => {
  const http = {
    get: jest.fn().mockResolvedValue({ ok: true, data: 'answer' }),
    post: jest.fn().mockResolvedValue({ ok: true, data: 'answer' }),
  }
  return { http, api: createCheckoutApi(http as Http) }
}

const purchase: NewTransaction = {
  productId: 'prod-1',
  quantity: 2,
  customer: { fullName: 'Ana Gomez', email: 'ana@example.com', phone: '3001234567' },
  delivery: { addressLine: 'Calle 1 # 2-3', city: 'Bogota', region: 'Cundinamarca' },
  payment: {
    cardToken: 'tok_test_123',
    installments: 1,
    acceptanceToken: 'acceptance',
    personalDataAuthToken: 'personal',
  },
}

describe('checkout API', () => {
  it('lists the products', async () => {
    const { api, http } = setup()

    await expect(api.getProducts()).resolves.toEqual({ ok: true, data: 'answer' })
    expect(http.get).toHaveBeenCalledWith('/products')
  })

  it('reads one product', async () => {
    const { api, http } = setup()

    await api.getProduct('prod-1')

    expect(http.get).toHaveBeenCalledWith('/products/prod-1')
  })

  it('asks for the payment summary of a quantity', async () => {
    const { api, http } = setup()

    await api.getPaymentSummary('prod-1', 2)

    expect(http.get).toHaveBeenCalledWith(
      '/products/prod-1/payment-summary?quantity=2',
    )
  })

  it('creates a transaction with its idempotency key', async () => {
    const { api, http } = setup()

    await api.createTransaction('key-1', purchase)

    expect(http.post).toHaveBeenCalledWith('/transactions', purchase, {
      'Idempotency-Key': 'key-1',
    })
  })

  it('reads a transaction', async () => {
    const { api, http } = setup()

    await api.getTransaction('tx-1')

    expect(http.get).toHaveBeenCalledWith('/transactions/tx-1')
  })

  it('escapes ids so they cannot change the request path', async () => {
    const { api, http } = setup()

    await api.getTransaction('../products')

    expect(http.get).toHaveBeenCalledWith('/transactions/..%2Fproducts')
  })
})
