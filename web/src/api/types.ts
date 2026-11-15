/** Shapes returned by the checkout API. Money is always integer cents. */

export interface Product {
  id: string
  name: string
  description: string
  priceInCents: number
  stock: number
  imageUrl: string
}

export interface PaymentSummary {
  productId: string
  quantity: number
  subtotalInCents: number
  baseFeeInCents: number
  deliveryFeeInCents: number
  totalInCents: number
}

export type TransactionStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'DECLINED'
  | 'VOIDED'
  | 'ERROR'

export interface Transaction {
  id: string
  reference: string
  status: TransactionStatus
  productId: string
  quantity: number
  unitPriceInCents: number
  baseFeeInCents: number
  deliveryFeeInCents: number
  amountInCents: number
  currency: string
  createdAt: string
  updatedAt: string
}

export interface Customer {
  fullName: string
  email: string
  phone: string
}

export interface DeliveryAddress {
  addressLine: string
  city: string
  region: string
  postalCode?: string
}

/** The card itself is never part of a purchase: only its token. */
export interface NewTransaction {
  productId: string
  quantity: number
  customer: Customer
  delivery: DeliveryAddress
  payment: {
    cardToken: string
    installments: number
    acceptanceToken: string
    personalDataAuthToken: string
  }
}

export interface ApiError {
  /** HTTP status, or 0 when the request never reached the server. */
  status: number
  /** Stable code for programs, such as INSUFFICIENT_STOCK. */
  code: string
  /** Explanation that can be shown to the customer. */
  message: string
}

/** A request either worked or failed; it never throws. */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError }
