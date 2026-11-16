import { combineReducers, configureStore } from '@reduxjs/toolkit'
import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit'
import { config } from '../config'
import { checkoutReducer } from './checkout.slice'
import { paymentReducer } from './payment.slice'
import { productsReducer } from './products.slice'
import type { Services } from './services'
import { transactionReducer } from './transaction.slice'

const rootReducer = combineReducers({
  products: productsReducer,
  checkout: checkoutReducer,
  payment: paymentReducer,
  transaction: transactionReducer,
})

export type RootState = ReturnType<typeof rootReducer>

/**
 * Flux in one place: components dispatch actions, reducers produce the next
 * state, and components read it back through selectors. The API and the
 * payment gateway are injected so every test can run against fake ones.
 */
export const createAppStore = (
  services: Services,
  preloadedState?: Partial<RootState>,
) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as RootState | undefined,
    // Off in production: the tools let anyone read and replay the state.
    devTools: config.devTools,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: services } }),
  })

export type AppStore = ReturnType<typeof createAppStore>
export type AppDispatch = AppStore['dispatch']

/** A thunk written by hand, for work whose input must stay out of any action. */
export type AppThunk<Result = void> = ThunkAction<
  Result,
  RootState,
  Services,
  UnknownAction
>
