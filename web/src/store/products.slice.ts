import { createAsyncThunk, createSlice } from '@reduxjs/toolkit'
import type { PayloadAction } from '@reduxjs/toolkit'
import type { CheckoutApi } from '../api/checkout-api'
import type { Product } from '../api/types'

export interface ProductsState {
  items: Product[]
  status: 'idle' | 'loading' | 'ready' | 'failed'
  error: string | null
}

const initialState: ProductsState = { items: [], status: 'idle', error: null }

/** The API arrives as the thunk "extra" argument, so tests pass a fake one. */
export const loadProducts = createAsyncThunk<
  Product[],
  void,
  { extra: CheckoutApi; rejectValue: string }
>('products/load', async (_, { extra: api, rejectWithValue }) => {
  const result = await api.getProducts()
  return result.ok ? result.data : rejectWithValue(result.error.message)
})

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    stockChanged(state, action: PayloadAction<{ id: string; stock: number }>) {
      const product = state.items.find((item) => item.id === action.payload.id)
      if (product) {
        product.stock = action.payload.stock
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadProducts.pending, (state) => {
        state.status = 'loading'
        state.error = null
      })
      .addCase(loadProducts.fulfilled, (state, action) => {
        state.status = 'ready'
        state.items = action.payload
      })
      .addCase(loadProducts.rejected, (state, action) => {
        state.status = 'failed'
        state.error = action.payload ?? 'The products could not be loaded.'
      })
  },
})

export const { stockChanged } = productsSlice.actions
export const productsReducer = productsSlice.reducer

export const selectProductById = (
  state: { products: ProductsState },
  id: string | null,
): Product | undefined => state.products.items.find((item) => item.id === id)
