import type { Customer, DeliveryAddress } from '../api/types'
import { initialCheckoutState, MAX_UNITS_PER_PURCHASE } from './checkout.slice'
import type { CheckoutStep } from './checkout.slice'
import type { AppStore, RootState } from './store'
import { initialTransactionState } from './transaction.slice'

/**
 * Progress of the checkout kept in the browser, so a refresh does not lose it.
 *
 * It holds only what is needed to continue: where the customer was, what
 * they were buying, their contact details and the id of a payment already
 * sent. The card, its token and everything the gateway answered stay out:
 * after a refresh the card is typed again and the payment is read from the API.
 */
export interface Snapshot {
  savedAt: number
  step: CheckoutStep
  productId: string | null
  quantity: number
  customer: Customer | null
  delivery: DeliveryAddress | null
  transactionId: string | null
}

export const SNAPSHOT_KEY = 'checkout:v1'
/** Contact details do not stay in the browser longer than this. */
export const SNAPSHOT_TTL_MS = 30 * 60 * 1000

export type SnapshotStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/** Some browsers throw on reading `localStorage` when storage is blocked. */
export const browserStorage = (): SnapshotStorage | undefined => {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const STEPS: CheckoutStep[] = ['product', 'details', 'summary', 'status']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_TEXT = 300

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_TEXT

const isCustomer = (value: unknown): value is Customer =>
  isRecord(value) &&
  isText(value.fullName) &&
  isText(value.email) &&
  isText(value.phone)

const isDelivery = (value: unknown): value is DeliveryAddress =>
  isRecord(value) &&
  isText(value.addressLine) &&
  isText(value.city) &&
  isText(value.region) &&
  (value.postalCode === undefined || isText(value.postalCode))

/**
 * Storage can be edited by hand, so every field is checked before it is
 * believed. Anything unexpected discards the whole snapshot.
 */
const isSnapshot = (value: unknown): value is Snapshot =>
  isRecord(value) &&
  typeof value.savedAt === 'number' &&
  STEPS.includes(value.step as CheckoutStep) &&
  (value.productId === null || isText(value.productId)) &&
  Number.isInteger(value.quantity) &&
  (value.quantity as number) >= 1 &&
  (value.quantity as number) <= MAX_UNITS_PER_PURCHASE &&
  (value.customer === null || isCustomer(value.customer)) &&
  (value.delivery === null || isDelivery(value.delivery)) &&
  (value.transactionId === null ||
    (typeof value.transactionId === 'string' && UUID.test(value.transactionId)))

/** Where the customer can really continue from, given what survived. */
const stepToResume = (snapshot: Snapshot): CheckoutStep => {
  if (!snapshot.productId) {
    return 'product'
  }
  if (snapshot.step === 'status') {
    return snapshot.transactionId ? 'status' : 'product'
  }
  // The summary needs the card token, which is never saved.
  return snapshot.step === 'summary' ? 'details' : snapshot.step
}

const read = (storage: SnapshotStorage, now: number): Snapshot | null => {
  const stored = storage.getItem(SNAPSHOT_KEY)
  if (stored === null) {
    return null
  }
  const value: unknown = JSON.parse(stored)
  const age = isSnapshot(value) ? now - value.savedAt : -1
  return isSnapshot(value) && age >= 0 && age <= SNAPSHOT_TTL_MS ? value : null
}

/** The state to start the store with, or nothing when there is no progress. */
export const loadSnapshot = (
  storage: SnapshotStorage,
  now: number,
): Partial<RootState> | undefined => {
  try {
    const snapshot = read(storage, now)
    if (!snapshot) {
      storage.removeItem(SNAPSHOT_KEY)
      return undefined
    }
    return {
      checkout: {
        ...initialCheckoutState,
        step: stepToResume(snapshot),
        productId: snapshot.productId,
        quantity: snapshot.quantity,
        customer: snapshot.customer,
        delivery: snapshot.delivery,
      },
      transaction: { ...initialTransactionState, id: snapshot.transactionId },
    }
  } catch {
    // Unreadable or blocked storage is the same as having nothing saved.
    try {
      storage.removeItem(SNAPSHOT_KEY)
    } catch {
      // Nothing else can be done; the app simply starts fresh.
    }
    return undefined
  }
}

const inProgress = ({ checkout }: RootState): boolean =>
  checkout.step !== 'product' ||
  checkout.quantity !== 1 ||
  checkout.customer !== null ||
  checkout.delivery !== null

/** Saves the progress after every change that is worth saving. */
export const persistStore = (
  store: AppStore,
  storage: SnapshotStorage,
  now: () => number = Date.now,
): void => {
  let previous = ''

  store.subscribe(() => {
    const state = store.getState()
    const { checkout, transaction } = state
    const progress = inProgress(state)
      ? {
          step: checkout.step,
          productId: checkout.productId,
          quantity: checkout.quantity,
          customer: checkout.customer,
          delivery: checkout.delivery,
          transactionId: transaction.id,
        }
      : null
    const content = JSON.stringify(progress)
    if (content === previous) {
      return
    }
    previous = content

    try {
      if (progress) {
        const snapshot: Snapshot = { savedAt: now(), ...progress }
        storage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
      } else {
        storage.removeItem(SNAPSHOT_KEY)
      }
    } catch {
      // A full or blocked storage must never break the purchase.
    }
  })
}
