import { createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'

/** Same limit the API enforces. */
export const MAX_UNITS_PER_PURCHASE = 10

/** The checkout is a sequence of steps; the customer is always on one. */
export type CheckoutStep = 'product' | 'details' | 'summary' | 'status'

export interface CheckoutState {
  step: CheckoutStep
  productId: string | null
  quantity: number
}

const initialState: CheckoutState = {
  step: 'product',
  productId: null,
  quantity: 1,
}

const clampQuantity = (quantity: number): number => {
  if (!Number.isFinite(quantity)) {
    return 1
  }
  return Math.min(Math.max(Math.trunc(quantity), 1), MAX_UNITS_PER_PURCHASE)
}

const checkoutSlice = createSlice({
  name: 'checkout',
  initialState,
  reducers: {
    productSelected(state, action: PayloadAction<string>) {
      state.productId = action.payload
      state.quantity = 1
    },
    quantityChanged(state, action: PayloadAction<number>) {
      state.quantity = clampQuantity(action.payload)
    },
    checkoutStarted(state) {
      if (state.productId) {
        state.step = 'details'
      }
    },
  },
})

export const { productSelected, quantityChanged, checkoutStarted } =
  checkoutSlice.actions
export const checkoutReducer = checkoutSlice.reducer
