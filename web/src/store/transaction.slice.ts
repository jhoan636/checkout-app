import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { Transaction } from '../api/types'
import { checkoutFinished, paymentStarted } from './checkout.slice'
import type { CheckoutState } from './checkout.slice'
import type { PaymentState } from './payment.slice'
import type { Services } from './services'

/**
 * - processing: the answer is on its way.
 * - settled: the gateway gave a final answer (approved, declined...).
 * - unconfirmed: the gateway has not decided yet; the customer can check again.
 * - failed: the purchase could not even be sent.
 */
export type PaymentPhase =
  | 'idle'
  | 'processing'
  | 'settled'
  | 'unconfirmed'
  | 'failed'

export interface TransactionState {
  /**
   * Chosen by the browser before anything is sent, and reused on every retry:
   * it is the idempotency key, so the same purchase is never charged twice.
   */
  id: string | null
  transaction: Transaction | null
  phase: PaymentPhase
  error: string | null
  /** True when sending the same purchase again may work. */
  retryable: boolean
}

export const initialTransactionState: TransactionState = {
  id: null,
  transaction: null,
  phase: 'idle',
  error: null,
  retryable: false,
}

/** The gateway usually answers PENDING first and decides seconds later. */
export const POLL_INTERVAL_MS = 2_000
export const MAX_CHECKS = 10
/**
 * How many times an unknown payment is looked for before believing it was
 * never sent. The API stores a purchase the moment it receives it, so a
 * request that has not shown up after these checks is not coming.
 */
export const MAX_SEARCHES = 5

const FALLBACK_ERROR = 'The payment could not be processed.'
const NEVER_SENT =
  'The payment was not sent, so your card was not charged. You can start again.'

interface PayFailure {
  message: string
  retryable: boolean
}

interface ThunkConfig {
  state: {
    checkout: CheckoutState
    payment: PaymentState
    transaction: TransactionState
  }
  extra: Services
  rejectValue: PayFailure
}

/** Asks for the transaction again, with a pause, until its status is final. */
const waitForResult = async (
  transaction: Transaction,
  { api, wait }: Services,
): Promise<Transaction> => {
  let latest = transaction
  for (
    let check = 0;
    check < MAX_CHECKS && latest.status === 'PENDING';
    check += 1
  ) {
    await wait(POLL_INTERVAL_MS)
    const result = await api.getTransaction(latest.id)
    // A failed check is not an answer: the next one may get through.
    if (result.ok) {
      latest = result.data
    }
  }
  return latest
}

export const pay = createAsyncThunk<Transaction, void, ThunkConfig>(
  'transaction/pay',
  async (_, { getState, dispatch, extra, rejectWithValue }) => {
    const { checkout, payment, transaction } = getState()
    const { productId, quantity, customer, delivery, cardToken, installments } =
      checkout
    const { acceptance } = payment
    if (!productId || !customer || !delivery || !cardToken || !acceptance) {
      return rejectWithValue({ message: FALLBACK_ERROR, retryable: false })
    }

    let id = transaction.id
    if (!id) {
      id = extra.newId()
      dispatch(transactionSlice.actions.transactionStarted(id))
    }
    dispatch(paymentStarted())

    const result = await extra.api.createTransaction(id, {
      productId,
      quantity,
      customer,
      delivery,
      payment: {
        cardToken,
        installments,
        acceptanceToken: acceptance.acceptanceToken,
        personalDataAuthToken: acceptance.personalDataAuthToken,
      },
    })
    if (!result.ok) {
      const { status, message } = result.error
      // No answer or a server failure says nothing about the purchase itself.
      return rejectWithValue({ message, retryable: status === 0 || status >= 500 })
    }
    return waitForResult(result.data, extra)
  },
  {
    condition: (_, { getState }) =>
      getState().transaction.phase !== 'processing',
  },
)

/**
 * Reads a payment that may have been sent moments ago, for example right
 * before a refresh. "Not found" is not believed at once: the request to pay
 * may still be on its way, so it is looked for a few times.
 */
const findPayment = async (id: string, { api, wait }: Services) => {
  let result = await api.getTransaction(id)
  for (
    let search = 1;
    search < MAX_SEARCHES && !result.ok && result.error.status === 404;
    search += 1
  ) {
    await wait(POLL_INTERVAL_MS)
    result = await api.getTransaction(id)
  }
  return result
}

/**
 * Looks at a payment that may already exist, for example after a refresh.
 * A check that does not get through changes nothing; only the API saying
 * again and again "there is no such payment" ends it.
 */
export const checkPayment = createAsyncThunk<
  Transaction | null,
  void,
  ThunkConfig
>(
  'transaction/check',
  async (_, { getState, extra, rejectWithValue }) => {
    const { id, transaction } = getState().transaction
    const result = await findPayment(id as string, extra)
    if (result.ok) {
      return waitForResult(result.data, extra)
    }
    if (result.error.status === 404) {
      // The request to pay never reached the API, so nothing was charged.
      return rejectWithValue({ message: NEVER_SENT, retryable: false })
    }
    return transaction
  },
  {
    condition: (_, { getState }) => {
      const { id, phase } = getState().transaction
      return id !== null && phase !== 'processing'
    },
  },
)

const processing = (state: TransactionState) => {
  state.phase = 'processing'
  state.error = null
  state.retryable = false
}

const transactionSlice = createSlice({
  name: 'transaction',
  initialState: initialTransactionState,
  reducers: {
    transactionStarted(state, action: PayloadAction<string>) {
      state.id = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkoutFinished, () => initialTransactionState)
      .addCase(pay.pending, processing)
      .addCase(pay.fulfilled, (state, action) => {
        state.transaction = action.payload
        state.phase = action.payload.status === 'PENDING' ? 'unconfirmed' : 'settled'
      })
      .addCase(pay.rejected, (state, action) => {
        state.phase = 'failed'
        state.error = action.payload?.message ?? FALLBACK_ERROR
        state.retryable = action.payload?.retryable ?? true
      })
      .addCase(checkPayment.pending, processing)
      .addCase(checkPayment.fulfilled, (state, action) => {
        state.transaction = action.payload
        state.phase =
          action.payload && action.payload.status !== 'PENDING'
            ? 'settled'
            : 'unconfirmed'
      })
      .addCase(checkPayment.rejected, (state, action) => {
        if (action.payload) {
          state.phase = 'failed'
          state.error = action.payload.message
          state.retryable = action.payload.retryable
        } else {
          state.phase = 'unconfirmed'
        }
      })
  },
})

export const transactionReducer = transactionSlice.reducer
