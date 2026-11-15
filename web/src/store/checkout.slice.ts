import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { Customer, DeliveryAddress } from '../api/types'
import type { CardBrand } from '../lib/card'

/** Same limit the API enforces. */
export const MAX_UNITS_PER_PURCHASE = 10

/** The checkout is a sequence of steps; the customer is always on one. */
export type CheckoutStep =
  | 'catalog'
  | 'product'
  | 'details'
  | 'summary'
  | 'status'

/** Enough to recognise the card on screen. Never the number or the code. */
export interface CardSummary {
  brand: CardBrand
  lastFour: string
}

/** What the customer confirms on the details form. */
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
}

export const initialCheckoutState: CheckoutState = {
  step: 'catalog',
  productId: null,
  quantity: 1,
  customer: null,
  delivery: null,
  card: null,
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
    /** Choosing a product in the catalogue opens its page. */
    productSelected(state, action: PayloadAction<string>) {
      state.productId = action.payload
      state.quantity = 1
      state.step = 'product'
    },
    catalogOpened(state) {
      if (state.step === 'product') {
        state.step = 'catalog'
      }
    },
    quantityChanged(state, action: PayloadAction<number>) {
      state.quantity = clampQuantity(action.payload)
    },
    checkoutStarted(state) {
      if (state.step === 'product' && state.productId) {
        state.step = 'details'
      }
    },
    detailsSubmitted(state, action: PayloadAction<PurchaseDetails>) {
      if (state.step !== 'details') {
        return
      }
      state.customer = action.payload.customer
      state.delivery = action.payload.delivery
      state.card = action.payload.card
      state.step = 'summary'
    },
    /** Contact details are kept, so the form is not empty on the way back. */
    detailsClosed(state) {
      if (state.step === 'details') {
        state.step = 'product'
      }
    },
  },
})

export const {
  productSelected,
  catalogOpened,
  quantityChanged,
  checkoutStarted,
  detailsSubmitted,
  detailsClosed,
} = checkoutSlice.actions
export const checkoutReducer = checkoutSlice.reducer
