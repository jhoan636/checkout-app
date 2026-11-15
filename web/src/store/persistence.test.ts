import { fakeServices } from '../test/render'
import { initialCheckoutState } from './checkout.slice'
import type { CheckoutState } from './checkout.slice'
import {
  browserStorage,
  loadSnapshot,
  persistStore,
  SNAPSHOT_KEY,
  SNAPSHOT_TTL_MS,
} from './persistence'
import type { Snapshot } from './persistence'
import { createAppStore } from './store'

const NOW = 1_800_000_000_000
const TRANSACTION_ID = 'b6f1c2d4-0000-4000-8000-000000000001'

const customer = {
  fullName: 'Ana Maria Perez',
  email: 'ana@example.com',
  phone: '3001234567',
}
const delivery = {
  addressLine: 'Calle 10 # 20-30',
  city: 'Medellin',
  region: 'Antioquia',
}

const snapshot = (overrides: Partial<Snapshot> = {}): Snapshot => ({
  savedAt: NOW,
  step: 'details',
  productId: 'prod-1',
  quantity: 2,
  customer,
  delivery,
  transactionId: null,
  ...overrides,
})

/** A storage that lives in memory, like the browser's but observable. */
const memoryStorage = (initial?: unknown) => {
  const items = new Map<string, string>()
  if (initial !== undefined) {
    items.set(
      SNAPSHOT_KEY,
      typeof initial === 'string' ? initial : JSON.stringify(initial),
    )
  }
  return {
    items,
    getItem: jest.fn((key: string) => items.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      items.set(key, value)
    }),
    removeItem: jest.fn((key: string) => {
      items.delete(key)
    }),
  }
}

const restore = (stored?: unknown, now = NOW) =>
  loadSnapshot(memoryStorage(stored), now)

describe('persistence', () => {
  describe('loadSnapshot', () => {
    it('starts fresh when nothing was saved', () => {
      expect(restore()).toBeUndefined()
    })

    it('brings back the step, the units and the contact details', () => {
      expect(restore(snapshot())).toEqual({
        checkout: {
          ...initialCheckoutState,
          step: 'details',
          productId: 'prod-1',
          quantity: 2,
          customer,
          delivery,
        },
        transaction: {
          id: null,
          transaction: null,
          phase: 'idle',
          error: null,
          retryable: false,
        },
      })
    })

    it('never brings back anything about the card', () => {
      const restored = restore(snapshot({ step: 'summary' }))

      expect(restored?.checkout).toMatchObject({ card: null, cardToken: null })
    })

    // The card token only lives in memory, so the card has to be typed again.
    it('goes back to the details form from the summary', () => {
      expect(restore(snapshot({ step: 'summary' }))?.checkout?.step).toBe(
        'details',
      )
    })

    it('stays on the status of a payment that was already sent', () => {
      const restored = restore(
        snapshot({ step: 'status', transactionId: TRANSACTION_ID }),
      )

      expect(restored?.checkout?.step).toBe('status')
      expect(restored?.transaction?.id).toBe(TRANSACTION_ID)
    })

    it('goes back to the product when the status has no payment to show', () => {
      const restored = restore(snapshot({ step: 'status', transactionId: null }))

      expect(restored?.checkout?.step).toBe('product')
    })

    it('goes back to the product when the checkout has no product', () => {
      const restored = restore(snapshot({ productId: null }))

      expect(restored?.checkout?.step).toBe('product')
    })

    it('forgets a snapshot that is too old', () => {
      const storage = memoryStorage(snapshot())

      expect(loadSnapshot(storage, NOW + SNAPSHOT_TTL_MS + 1)).toBeUndefined()
      expect(storage.removeItem).toHaveBeenCalledWith(SNAPSHOT_KEY)
    })

    it('forgets a snapshot dated in the future', () => {
      expect(restore(snapshot(), NOW - 1)).toBeUndefined()
    })

    // Whatever is in the browser storage can be edited by hand: never trust it.
    it.each<[string, unknown]>([
      ['text that is not JSON', '{not json'],
      ['something that is not an object', 42],
      ['null', null],
      ['an unknown step', snapshot({ step: 'admin' as CheckoutState['step'] })],
      ['a quantity that is not a number', { ...snapshot(), quantity: '2' }],
      ['a quantity out of range', snapshot({ quantity: 99 })],
      ['a fractional quantity', snapshot({ quantity: 1.5 })],
      ['a product id that is not text', { ...snapshot(), productId: 7 }],
      ['a customer with a missing field', { ...snapshot(), customer: { fullName: 'A' } }],
      ['a customer that is not an object', { ...snapshot(), customer: 'Ana' }],
      ['a delivery with a wrong field', { ...snapshot(), delivery: { ...delivery, city: 5 } }],
      ['a postal code that is not text', { ...snapshot(), delivery: { ...delivery, postalCode: 5 } }],
      ['a field far too long', snapshot({ customer: { ...customer, fullName: 'A'.repeat(500) } })],
      ['a transaction id that is not a UUID', snapshot({ transactionId: '../admin' })],
      ['a date that is not a number', { ...snapshot(), savedAt: 'today' }],
    ])('discards %s', (_, stored) => {
      const storage = memoryStorage(stored)

      expect(loadSnapshot(storage, NOW)).toBeUndefined()
      expect(storage.removeItem).toHaveBeenCalledWith(SNAPSHOT_KEY)
    })

    it('accepts a delivery with a postal code', () => {
      const restored = restore(
        snapshot({ delivery: { ...delivery, postalCode: '050021' } }),
      )

      expect(restored?.checkout?.delivery?.postalCode).toBe('050021')
    })

    it('accepts a checkout that has no contact details yet', () => {
      const restored = restore(snapshot({ customer: null, delivery: null }))

      expect(restored?.checkout).toMatchObject({ customer: null, delivery: null })
    })

    it('starts fresh when the browser does not allow reading', () => {
      const storage = memoryStorage(snapshot())
      storage.getItem.mockImplementation(() => {
        throw new Error('blocked')
      })

      expect(loadSnapshot(storage, NOW)).toBeUndefined()
    })
  })

  describe('persistStore', () => {
    const onDetails: CheckoutState = {
      ...initialCheckoutState,
      step: 'details',
      productId: 'prod-1',
      quantity: 2,
      customer,
      delivery,
      card: { brand: 'visa', lastFour: '4242' },
      cardToken: 'tok_test_1',
    }

    const start = (checkout: CheckoutState = initialCheckoutState) => {
      const storage = memoryStorage()
      const store = createAppStore(fakeServices(), { checkout })
      persistStore(store, storage, () => NOW)
      return { store, storage }
    }
    const saved = (storage: ReturnType<typeof memoryStorage>) =>
      JSON.parse(storage.items.get(SNAPSHOT_KEY) as string) as Snapshot

    it('saves the checkout whenever it changes', () => {
      const { store, storage } = start(onDetails)

      store.dispatch({ type: 'checkout/quantityChanged', payload: 3 })

      expect(saved(storage)).toEqual({
        savedAt: NOW,
        step: 'details',
        productId: 'prod-1',
        quantity: 3,
        customer,
        delivery,
        transactionId: null,
      })
    })

    it('keeps the card, its token and the gateway answers out of the browser storage', () => {
      const { store, storage } = start(onDetails)

      store.dispatch({ type: 'checkout/quantityChanged', payload: 3 })

      const text = storage.items.get(SNAPSHOT_KEY) as string
      expect(text).not.toContain('tok_test_1')
      expect(text).not.toContain('4242')
      expect(text).not.toContain('visa')
    })

    it('saves the id of a payment that has been sent', () => {
      const { store, storage } = start(onDetails)

      store.dispatch({
        type: 'transaction/transactionStarted',
        payload: TRANSACTION_ID,
      })

      expect(saved(storage).transactionId).toBe(TRANSACTION_ID)
    })

    it('does not write again when nothing worth saving changed', () => {
      const { store, storage } = start(onDetails)
      store.dispatch({ type: 'checkout/quantityChanged', payload: 3 })
      storage.setItem.mockClear()

      store.dispatch({ type: 'checkout/detailsSubmitting' })
      store.dispatch({ type: 'something/else' })

      expect(storage.setItem).not.toHaveBeenCalled()
    })

    it('leaves nothing behind when no checkout is in progress', () => {
      const { store, storage } = start({ ...onDetails, step: 'status' })
      store.dispatch({ type: 'checkout/quantityChanged', payload: 3 })
      expect(storage.items.has(SNAPSHOT_KEY)).toBe(true)

      store.dispatch({ type: 'checkout/checkoutFinished' })

      expect(storage.items.has(SNAPSHOT_KEY)).toBe(false)
    })

    it('keeps working when the browser does not allow writing', () => {
      const { store, storage } = start(onDetails)
      storage.setItem.mockImplementation(() => {
        throw new Error('quota exceeded')
      })

      expect(() =>
        store.dispatch({ type: 'checkout/quantityChanged', payload: 3 }),
      ).not.toThrow()
    })
  })

  describe('browserStorage', () => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('is the storage of the browser', () => {
      expect(browserStorage()).toBe(window.localStorage)
    })

    it('is nothing when the browser blocks storage', () => {
      jest.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
        throw new Error('The operation is insecure.')
      })

      expect(browserStorage()).toBeUndefined()
    })
  })
})
