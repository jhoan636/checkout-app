import type { CheckoutApi } from '../api/checkout-api'
import type { Product } from '../api/types'
import { loadProducts, selectProductById } from './products.slice'
import { fakeServices } from '../test/render'
import { createAppStore } from './store'

const headphones: Product = {
  id: 'prod-1',
  name: 'Aurora Wireless Headphones',
  description: 'Over-ear headphones',
  priceInCents: 45_990_000,
  stock: 12,
  imageUrl: '/products/aurora-headphones.webp',
}

const apiWith = (getProducts: CheckoutApi['getProducts']) =>
  ({ getProducts }) as CheckoutApi

const storeWith = (api: CheckoutApi) =>
  createAppStore(fakeServices({ api }))

describe('products slice', () => {
  it('starts empty and idle', () => {
    const store = storeWith(apiWith(jest.fn()))

    expect(store.getState().products).toEqual({
      items: [],
      status: 'idle',
      error: null,
    })
  })

  it('is loading while the products are requested', () => {
    const store = storeWith(
      apiWith(() => new Promise(() => undefined)),
    )

    void store.dispatch(loadProducts())

    expect(store.getState().products.status).toBe('loading')
  })

  it('stores the products when the API answers', async () => {
    const store = storeWith(
      apiWith(() => Promise.resolve({ ok: true, data: [headphones] })),
    )

    await store.dispatch(loadProducts())

    expect(store.getState().products).toEqual({
      items: [headphones],
      status: 'ready',
      error: null,
    })
  })

  it('keeps the error message when the API fails', async () => {
    const store = storeWith(
      apiWith(() =>
        Promise.resolve({
          ok: false,
          error: {
            status: 0,
            code: 'NETWORK_ERROR',
            message: 'Check your connection and try again.',
          },
        }),
      ),
    )

    await store.dispatch(loadProducts())

    expect(store.getState().products).toEqual({
      items: [],
      status: 'failed',
      error: 'Check your connection and try again.',
    })
  })

  it('clears a previous error when loading again', async () => {
    const getProducts = jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { status: 0, code: 'NETWORK_ERROR', message: 'Offline' },
      })
      .mockResolvedValueOnce({ ok: true, data: [headphones] })
    const store = storeWith(apiWith(getProducts))

    await store.dispatch(loadProducts())
    await store.dispatch(loadProducts())

    expect(store.getState().products).toMatchObject({
      status: 'ready',
      error: null,
    })
  })

  it('selects a product by id', async () => {
    const store = storeWith(
      apiWith(() => Promise.resolve({ ok: true, data: [headphones] })),
    )
    await store.dispatch(loadProducts())

    expect(selectProductById(store.getState(), 'prod-1')).toEqual(headphones)
    expect(selectProductById(store.getState(), 'nope')).toBeUndefined()
  })

  it('shows a general message when loading fails unexpectedly', async () => {
    const store = storeWith(
      apiWith(() => Promise.reject(new Error('boom'))),
    )

    await store.dispatch(loadProducts())

    expect(store.getState().products).toMatchObject({
      status: 'failed',
      error: 'The products could not be loaded.',
    })
  })
})

