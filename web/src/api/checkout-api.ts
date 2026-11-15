import type { Http } from './http'
import type {
  ApiResult,
  NewTransaction,
  PaymentSummary,
  Product,
  Transaction,
} from './types'

/** Everything the web app asks of the checkout API. */
export interface CheckoutApi {
  getProducts(): Promise<ApiResult<Product[]>>
  getProduct(id: string): Promise<ApiResult<Product>>
  getPaymentSummary(
    productId: string,
    quantity: number,
  ): Promise<ApiResult<PaymentSummary>>
  /**
   * The idempotency key identifies the purchase: sending it again returns the
   * same transaction and never charges twice.
   */
  createTransaction(
    idempotencyKey: string,
    purchase: NewTransaction,
  ): Promise<ApiResult<Transaction>>
  getTransaction(id: string): Promise<ApiResult<Transaction>>
}

export const createCheckoutApi = (http: Http): CheckoutApi => ({
  getProducts: () => http.get('/products'),
  getProduct: (id) => http.get(`/products/${encodeURIComponent(id)}`),
  getPaymentSummary: (productId, quantity) =>
    http.get(
      `/products/${encodeURIComponent(productId)}/payment-summary?quantity=${quantity}`,
    ),
  createTransaction: (idempotencyKey, purchase) =>
    http.post('/transactions', purchase, { 'Idempotency-Key': idempotencyKey }),
  getTransaction: (id) => http.get(`/transactions/${encodeURIComponent(id)}`),
})
