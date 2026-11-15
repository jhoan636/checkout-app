import type { Transaction } from '../api/types'
import {
  acceptance,
  approvedTransaction,
  fakeApi,
  fakeServices,
  summaryForOne,
} from '../test/render'
import { checkoutFinished, initialCheckoutState } from './checkout.slice'
import type { CheckoutState } from './checkout.slice'
import type { Services } from './services'
import { createAppStore } from './store'
import {
  checkPayment,
  MAX_CHECKS,
  pay,
  POLL_INTERVAL_MS,
} from './transaction.slice'

const pending: Transaction = { ...approvedTransaction, status: 'PENDING' }
const declined: Transaction = { ...approvedTransaction, status: 'DECLINED' }
const answer = (data: Transaction) => ({ ok: true as const, data })
const failure = (status: number, message: string) => ({
  ok: false as const,
  error: { status, code: 'SOME_ERROR', message },
})

const onSummary: CheckoutState = {
  ...initialCheckoutState,
  step: 'summary',
  productId: 'prod-1',
  quantity: 2,
  customer: {
    fullName: 'Ana Maria Perez',
    email: 'ana@example.com',
    phone: '3001234567',
  },
  delivery: {
    addressLine: 'Calle 10 # 20-30',
    city: 'Medellin',
    region: 'Antioquia',
  },
  card: { brand: 'visa', lastFour: '4242' },
  cardToken: 'tok_test_1',
}

const setup = (
  overrides: Partial<Services> = {},
  checkout: CheckoutState = onSummary,
) => {
  const services = fakeServices(overrides)
  const store = createAppStore(services, {
    checkout,
    payment: { summary: summaryForOne, acceptance, status: 'ready', error: null },
  })
  return { store, ...services }
}

describe('transaction slice', () => {
  it('starts with no payment', () => {
    expect(setup().store.getState().transaction).toEqual({
      id: null,
      transaction: null,
      phase: 'idle',
      error: null,
      retryable: false,
    })
  })

  describe('pay', () => {
    it('sends the purchase with the card token, never the card', async () => {
      const { store, api } = setup()

      await store.dispatch(pay())

      expect(api.createTransaction).toHaveBeenCalledWith(approvedTransaction.id, {
        productId: 'prod-1',
        quantity: 2,
        customer: onSummary.customer,
        delivery: onSummary.delivery,
        payment: {
          cardToken: 'tok_test_1',
          installments: 1,
          acceptanceToken: 'acc-token',
          personalDataAuthToken: 'data-token',
        },
      })
    })

    it('moves to the status screen and says it is processing', () => {
      const { store } = setup({
        api: fakeApi({ createTransaction: () => new Promise(() => undefined) }),
      })

      void store.dispatch(pay())

      expect(store.getState().checkout.step).toBe('status')
      expect(store.getState().transaction).toMatchObject({
        id: approvedTransaction.id,
        phase: 'processing',
      })
    })

    it('keeps the approved transaction', async () => {
      const { store } = setup()

      await store.dispatch(pay())

      expect(store.getState().transaction).toMatchObject({
        transaction: approvedTransaction,
        phase: 'settled',
        error: null,
      })
    })

    it('keeps a declined transaction as a final result too', async () => {
      const { store } = setup({
        api: fakeApi({
          createTransaction: jest.fn().mockResolvedValue(answer(declined)),
        }),
      })

      await store.dispatch(pay())

      expect(store.getState().transaction).toMatchObject({
        transaction: declined,
        phase: 'settled',
      })
    })

    it('does not send the same purchase twice while it is processing', () => {
      const { store, api } = setup({
        api: fakeApi({
          createTransaction: jest.fn(() => new Promise(() => undefined)),
        }),
      })

      void store.dispatch(pay())
      void store.dispatch(pay())

      expect(api.createTransaction).toHaveBeenCalledTimes(1)
    })

    it('does not pay without everything the purchase needs', async () => {
      const { store, api } = setup({}, { ...onSummary, cardToken: null })

      await store.dispatch(pay())

      expect(api.createTransaction).not.toHaveBeenCalled()
      expect(store.getState().transaction).toMatchObject({
        phase: 'failed',
        retryable: false,
      })
    })
  })

  describe('a payment the gateway has not resolved yet', () => {
    it('asks again after a pause until there is a final answer', async () => {
      const getTransaction = jest
        .fn()
        .mockResolvedValueOnce(answer(pending))
        .mockResolvedValue(answer(approvedTransaction))
      const { store, wait } = setup({
        api: fakeApi({
          createTransaction: jest.fn().mockResolvedValue(answer(pending)),
          getTransaction,
        }),
      })

      await store.dispatch(pay())

      expect(getTransaction).toHaveBeenCalledTimes(2)
      expect(getTransaction).toHaveBeenCalledWith(approvedTransaction.id)
      expect(wait).toHaveBeenCalledWith(POLL_INTERVAL_MS)
      expect(store.getState().transaction).toMatchObject({
        transaction: approvedTransaction,
        phase: 'settled',
      })
    })

    it('keeps asking when one of the checks fails', async () => {
      const getTransaction = jest
        .fn()
        .mockResolvedValueOnce(failure(0, 'Check your connection.'))
        .mockResolvedValue(answer(approvedTransaction))
      const { store } = setup({
        api: fakeApi({
          createTransaction: jest.fn().mockResolvedValue(answer(pending)),
          getTransaction,
        }),
      })

      await store.dispatch(pay())

      expect(store.getState().transaction.phase).toBe('settled')
    })

    it('stops after a while and says it is still not confirmed', async () => {
      const getTransaction = jest.fn().mockResolvedValue(answer(pending))
      const { store } = setup({
        api: fakeApi({
          createTransaction: jest.fn().mockResolvedValue(answer(pending)),
          getTransaction,
        }),
      })

      await store.dispatch(pay())

      expect(getTransaction).toHaveBeenCalledTimes(MAX_CHECKS)
      expect(store.getState().transaction).toMatchObject({
        transaction: pending,
        phase: 'unconfirmed',
      })
    })
  })

  describe('when the purchase cannot be sent', () => {
    it('explains a problem that trying again will not solve', async () => {
      const { store } = setup({
        api: fakeApi({
          createTransaction: jest
            .fn()
            .mockResolvedValue(failure(409, 'There are not enough units in stock.')),
        }),
      })

      await store.dispatch(pay())

      expect(store.getState().transaction).toMatchObject({
        phase: 'failed',
        error: 'There are not enough units in stock.',
        retryable: false,
      })
    })

    it.each([
      [0, 'the request never arrived'],
      [500, 'the server failed'],
      [503, 'the server was not available'],
    ])('offers to try again with status %s (%s)', async (status) => {
      const { store } = setup({
        api: fakeApi({
          createTransaction: jest.fn().mockResolvedValue(failure(status, 'Oops')),
        }),
      })

      await store.dispatch(pay())

      expect(store.getState().transaction).toMatchObject({
        phase: 'failed',
        retryable: true,
      })
    })

    it('tries again with the same id, so the customer is never charged twice', async () => {
      const createTransaction = jest
        .fn()
        .mockResolvedValueOnce(failure(0, 'Check your connection.'))
        .mockResolvedValue(answer(approvedTransaction))
      const { store, newId } = setup({ api: fakeApi({ createTransaction }) })

      await store.dispatch(pay())
      await store.dispatch(pay())

      expect(newId).toHaveBeenCalledTimes(1)
      expect(createTransaction.mock.calls[0][0]).toBe(approvedTransaction.id)
      expect(createTransaction.mock.calls[1][0]).toBe(approvedTransaction.id)
      expect(store.getState().transaction.phase).toBe('settled')
    })

    it('offers to try again when something unexpected happens', async () => {
      const { store } = setup({
        api: fakeApi({
          createTransaction: jest.fn().mockRejectedValue(new Error('boom')),
        }),
      })

      await store.dispatch(pay())

      expect(store.getState().transaction).toMatchObject({
        phase: 'failed',
        error: 'The payment could not be processed.',
        retryable: true,
      })
    })
  })

  describe('checkPayment', () => {
    const unconfirmed = async (getTransaction: jest.Mock) => {
      const context = setup({
        api: fakeApi({
          createTransaction: jest.fn().mockResolvedValue(answer(pending)),
          getTransaction,
        }),
      })
      await context.store.dispatch(pay())
      return context
    }

    it('finds the final answer of a payment that was still pending', async () => {
      const getTransaction = jest.fn().mockResolvedValue(answer(pending))
      const { store } = await unconfirmed(getTransaction)
      getTransaction.mockResolvedValue(answer(approvedTransaction))

      await store.dispatch(checkPayment())

      expect(store.getState().transaction).toMatchObject({
        transaction: approvedTransaction,
        phase: 'settled',
      })
    })

    it('stays unconfirmed, with what was known, when the check fails', async () => {
      const getTransaction = jest.fn().mockResolvedValue(answer(pending))
      const { store } = await unconfirmed(getTransaction)
      getTransaction.mockResolvedValue(failure(0, 'Check your connection.'))

      await store.dispatch(checkPayment())

      expect(store.getState().transaction).toMatchObject({
        transaction: pending,
        phase: 'unconfirmed',
      })
    })

    it('stays unconfirmed when something unexpected happens', async () => {
      const getTransaction = jest.fn().mockResolvedValue(answer(pending))
      const { store } = await unconfirmed(getTransaction)
      getTransaction.mockRejectedValue(new Error('boom'))

      await store.dispatch(checkPayment())

      expect(store.getState().transaction.phase).toBe('unconfirmed')
    })

    it('ends a payment the API never received, which was never charged', async () => {
      const getTransaction = jest.fn().mockResolvedValue(answer(pending))
      const { store } = await unconfirmed(getTransaction)
      getTransaction.mockResolvedValue(failure(404, 'The transaction does not exist.'))

      await store.dispatch(checkPayment())

      expect(store.getState().transaction).toMatchObject({
        phase: 'failed',
        error:
          'The payment was not sent, so your card was not charged. You can start again.',
        retryable: false,
      })
    })

    it('does nothing when there is no payment to check', async () => {
      const { store, api } = setup()

      await store.dispatch(checkPayment())

      expect(api.getTransaction).not.toHaveBeenCalled()
      expect(store.getState().transaction.phase).toBe('idle')
    })
  })

  it('forgets the payment when the checkout ends', async () => {
    const { store } = setup()
    await store.dispatch(pay())

    store.dispatch(checkoutFinished())

    expect(store.getState().transaction).toEqual({
      id: null,
      transaction: null,
      phase: 'idle',
      error: null,
      retryable: false,
    })
  })
})
