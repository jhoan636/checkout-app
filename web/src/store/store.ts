import { combineReducers, configureStore } from '@reduxjs/toolkit'
import type { CheckoutApi } from '../api/checkout-api'
import { productsReducer } from './products.slice'

const rootReducer = combineReducers({ products: productsReducer })

export type RootState = ReturnType<typeof rootReducer>

/**
 * Flux in one place: components dispatch actions, reducers produce the next
 * state, and components read it back through selectors. The API is injected
 * so every test can run against a fake one.
 */
export const createAppStore = (
  api: CheckoutApi,
  preloadedState?: Partial<RootState>,
) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: preloadedState as RootState | undefined,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ thunk: { extraArgument: api } }),
  })

export type AppStore = ReturnType<typeof createAppStore>
export type AppDispatch = AppStore['dispatch']
