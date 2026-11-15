import { loadSnapshot, persistStore } from './persistence'
import type { SnapshotStorage } from './persistence'
import type { Services } from './services'
import { createAppStore } from './store'
import type { AppStore } from './store'
import { checkPayment } from './transaction.slice'

/**
 * Builds the store the app runs on: it starts from the progress saved in the
 * browser, if any, and keeps saving it.
 *
 * A payment sent before a refresh is not trusted from memory: its real
 * status is asked to the API again.
 */
export const startStore = (
  services: Services,
  storage: SnapshotStorage | undefined,
  now: () => number = Date.now,
): AppStore => {
  const store = createAppStore(
    services,
    storage ? loadSnapshot(storage, now()) : undefined,
  )
  if (storage) {
    persistStore(store, storage, now)
  }
  if (store.getState().checkout.step === 'status') {
    void store.dispatch(checkPayment())
  }
  return store
}
