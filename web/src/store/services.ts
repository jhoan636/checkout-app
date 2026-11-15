import type { CheckoutApi } from '../api/checkout-api'
import type { PaymentGateway } from '../api/gateway'

/**
 * Everything the store talks to outside the browser. Thunks receive it as
 * their "extra" argument, so tests swap both for fakes.
 */
export interface Services {
  /** Our own API: products, stock, payment summary and transactions. */
  api: CheckoutApi
  /** The payment gateway, used directly only to tokenize the card. */
  gateway: PaymentGateway
}
