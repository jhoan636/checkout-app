import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { Customer, DeliveryAddress } from '../api/types'
import type { CardBrand } from '../lib/card'

/** Same limit the API enforces. */
export const MAX_UNITS_PER_PURCHASE = 10

/** The checkout is a sequence of steps; the customer is always on one. */
export type CheckoutStep = 'product' | 'details' | 'summary' | 'status'

/** Enough to recognise the card on screen. Never the number or the code. */
export interface CardSummary {
  brand: CardBrand
  lastFour: string
}

/** What is kept from the details form once the card has been tokenized. */
export interface PurchaseDetails {
  customer: Customer
  delivery: DeliveryAddress
  card: CardSummary
}

export interface CheckoutState {
  step: CheckoutStep
  productId: string | null
  quantity: number
  customer: Customer | null
  delivery: DeliveryAddress | null
  card: CardSummary | null
  /**
   * One-use token the gateway gave in exchange for the card. It lives in
   * memory only and is useless without the private key our API holds.
   */
  cardToken: string | null
  /** True while the gateway is checking the card. */
  submitting: boolean
  submitError: string | null
}

export const initialCheckoutState: CheckoutState = {
  step: 'product',
  productId: null,
  quantity: 1,
  customer: null,
  delivery: null,
  card: null,
  cardToken: null,
  submitting: false,
  submitError: null,
}

const clampQuantity = (quantity: number): number => {
  if (!Number.isFinite(quantity)) {
    return 1
  }
  return Math.min(Math.max(Math.trunc(quantity), 1), MAX_UNITS_PER_PURCHASE)
}

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState: initialCheckoutState,
  reducers: {
    /**
     * The product on sale is not the one this checkout was about (first
     * visit, or progress saved for a product that is gone): start over with it.
     */
    productSelected(state, action: PayloadAction<string>) {
      if (state.step === 'status') {
        return state
      }
      return { ...initialCheckoutState, productId: action.payload }
    },
    quantityChanged(state, action: PayloadAction<number>) {
      state.quantity = clampQuantity(action.payload)
    },
    checkoutStarted(state) {
      if (state.step === 'product' && state.productId) {
        state.step = 'details'
      }
    },
    detailsSubmitting(state) {
      if (state.step === 'details') {
        state.submitting = true
        state.submitError = null
      }
    },
    detailsRejected(state, action: PayloadAction<string>) {
      if (state.submitting) {
        state.submitting = false
        state.submitError = action.payload
      }
    },
    /** Only an answer the form is still waiting for moves the checkout on. */
    detailsSubmitted(
      state,
      action: PayloadAction<PurchaseDetails & { cardToken: string }>,
    ) {
      if (state.step !== 'details' || !state.submitting) {
        return
      }
      state.customer = action.payload.customer
      state.delivery = action.payload.delivery
      state.card = action.payload.card
      state.cardToken = action.payload.cardToken
      state.submitting = false
      state.step = 'summary'
    },
    /** Contact details are kept, so the form is not empty on the way back. */
    detailsClosed(state) {
      if (state.step === 'details') {
        state.step = 'product'
        state.submitting = false
        state.submitError = null
      }
    },
    /** Going back needs the card again: its token is single use. */
    summaryClosed(state) {
      if (state.step === 'summary') {
        state.step = 'details'
        state.card = null
        state.cardToken = null
      }
    },
    paymentStarted(state) {
      if (state.step === 'summary' && state.cardToken) {
        state.step = 'status'
      }
    },
    /** Back to the product with nothing left of the purchase that ended. */
    checkoutFinished(state) {
      if (state.step !== 'status') {
        return state
      }
      return { ...initialCheckoutState, productId: state.productId }
    },
  },
})

export const {
  productSelected,
  quantityChanged,
  checkoutStarted,
  detailsSubmitting,
  detailsRejected,
  detailsSubmitted,
  detailsClosed,
  summaryClosed,
  paymentStarted,
  checkoutFinished,
} = checkoutSlice.actions
export const checkoutReducer = checkoutSlice.reducer
