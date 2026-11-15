import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { Acceptance } from '../api/gateway'
import type { PaymentSummary } from '../api/types'
import type { CheckoutState } from './checkout.slice'
import type { Services } from './services'

export interface PaymentState {
  /** What the purchase costs, calculated by the API: never by the browser. */
  summary: PaymentSummary | null
  /** The gateway documents the customer must accept before paying. */
  acceptance: Acceptance | null
  status: 'idle' | 'loading' | 'ready' | 'failed'
  error: string | null
}

const initialState: PaymentState = {
  summary: null,
  acceptance: null,
  status: 'idle',
  error: null,
}

const FALLBACK_ERROR = 'The payment summary could not be loaded.'

/**
 * Everything the summary screen needs: the amounts from our API and the
 * acceptance documents from the gateway, asked for at the same time.
 */
export const loadQuote = createAsyncThunk<
  { summary: PaymentSummary; acceptance: Acceptance },
  void,
  { state: { checkout: CheckoutState }; extra: Services; rejectValue: string }
>('payment/loadQuote', async (_, { getState, extra, rejectWithValue }) => {
  const { productId, quantity } = getState().checkout
  if (!productId) {
    return rejectWithValue(FALLBACK_ERROR)
  }

  const [summary, acceptance] = await Promise.all([
    extra.api.getPaymentSummary(productId, quantity),
    extra.gateway.getAcceptance(),
  ])
  if (!summary.ok) {
    return rejectWithValue(summary.error.message)
  }
  if (!acceptance.ok) {
    return rejectWithValue(acceptance.error.message)
  }
  return { summary: summary.data, acceptance: acceptance.data }
})

const paymentSlice = createSlice({
  name: 'payment',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadQuote.pending, () => ({
        ...initialState,
        status: 'loading' as const,
      }))
      .addCase(loadQuote.fulfilled, (state, action) => {
        state.summary = action.payload.summary
        state.acceptance = action.payload.acceptance
        state.status = 'ready'
      })
      .addCase(loadQuote.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload ?? FALLBACK_ERROR
      })
  },
})

export const paymentReducer = paymentSlice.reducer
