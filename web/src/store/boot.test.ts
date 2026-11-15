import { waitFor } from '@testing-library/react'
import { approvedTransaction, fakeApi, fakeServices } from '../test/render'
import { startStore } from './boot'
import { SNAPSHOT_KEY } from './persistence'
import type { Snapshot } from './persistence'

const NOW = 1_800_000_000_000

const memoryStorage = (snapshot?: Partial<Snapshot>) => {
  const items = new Map<string, string>()
  if (snapshot) {
    items.set(
      SNAPSHOT_KEY,
      JSON.stringify({
        savedAt: NOW,
        step: 'details',
        productId: 'prod-1',
        quantity: 2,
        customer: null,
        delivery: null,
        transactionId: null,
        ...snapshot,
      }),
    )
  }
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value)
    },
    removeItem: (key: string) => {
      items.delete(key)
    },
  }
}

describe('startStore', () => {
  it('starts fresh when nothing was saved', () => {
    const store = startStore(fakeServices(), memoryStorage(), () => NOW)

    expect(store.getState().checkout).toMatchObject({
      step: 'product',
      quantity: 1,
    })
  })

  it('continues where the customer was before the refresh', () => {
    const store = startStore(
      fakeServices(),
      memoryStorage({ step: 'details', quantity: 2 }),
      () => NOW,
    )

    expect(store.getState().checkout).toMatchObject({
      step: 'details',
      productId: 'prod-1',
      quantity: 2,
    })
  })

  it('keeps saving the progress from then on', () => {
    const storage = memoryStorage()
    const store = startStore(fakeServices(), storage, () => NOW)

    store.dispatch({ type: 'checkout/quantityChanged', payload: 4 })

    expect(JSON.parse(storage.items.get(SNAPSHOT_KEY) as string)).toMatchObject({
      quantity: 4,
    })
  })

  it('asks the API how a payment sent before the refresh ended', async () => {
    const api = fakeApi()
    const store = startStore(
      fakeServices({ api }),
      memoryStorage({ step: 'status', transactionId: approvedTransaction.id }),
      () => NOW,
    )

    expect(store.getState().transaction.phase).toBe('processing')
    await waitFor(() =>
      expect(store.getState().transaction).toMatchObject({
        transaction: approvedTransaction,
        phase: 'settled',
      }),
    )
    expect(api.getTransaction).toHaveBeenCalledWith(approvedTransaction.id)
  })

  it('does not ask about a payment when there is none', () => {
    const api = fakeApi()
    startStore(fakeServices({ api }), memoryStorage({ step: 'details' }), () => NOW)

    expect(api.getTransaction).not.toHaveBeenCalled()
  })

  it('still starts when the browser has no storage at all', () => {
    const store = startStore(fakeServices(), undefined, () => NOW)

    expect(store.getState().checkout.step).toBe('product')
    expect(() =>
      store.dispatch({ type: 'checkout/quantityChanged', payload: 2 }),
    ).not.toThrow()
  })
})
