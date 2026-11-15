import { acceptance, fakeApi, fakeGateway, summaryForOne } from '../test/render'
import { initialCheckoutState } from './checkout.slice'
import { loadQuote } from './payment.slice'
import { createAppStore } from './store'

const failure = (message: string) => ({
  ok: false as const,
  error: { status: 409, code: 'SOME_ERROR', message },
})

const setup = (services: Partial<Parameters<typeof createAppStore>[0]> = {}) => {
  const api = services.api ?? fakeApi()
  const gateway = services.gateway ?? fakeGateway()
  const store = createAppStore(
    { api, gateway },
    {
      checkout: { ...initialCheckoutState, productId: 'prod-1', quantity: 2 },
    },
  )
  return { store, api, gateway }
}

describe('payment slice', () => {
  it('starts with nothing calculated', () => {
    expect(setup().store.getState().payment).toEqual({
      summary: null,
      acceptance: null,
      status: 'idle',
      error: null,
    })
  })

  it('asks the API what the chosen product and units cost', async () => {
    const { store, api } = setup()

    await store.dispatch(loadQuote())

    expect(api.getPaymentSummary).toHaveBeenCalledWith('prod-1', 2)
  })

  it('is loading while the answers arrive', () => {
    const { store } = setup({
      api: fakeApi({ getPaymentSummary: () => new Promise(() => undefined) }),
    })

    void store.dispatch(loadQuote())

    expect(store.getState().payment.status).toBe('loading')
  })

  it('keeps the amounts and the acceptance documents', async () => {
    const { store } = setup()

    await store.dispatch(loadQuote())

    expect(store.getState().payment).toEqual({
      summary: summaryForOne,
      acceptance,
      status: 'ready',
      error: null,
    })
  })

  it('forgets the previous amounts while new ones are calculated', async () => {
    const { store } = setup()
    await store.dispatch(loadQuote())

    void store.dispatch(loadQuote())

    expect(store.getState().payment).toMatchObject({
      summary: null,
      acceptance: null,
      status: 'loading',
    })
  })

  it('explains when the API cannot calculate the total', async () => {
    const { store } = setup({
      api: fakeApi({
        getPaymentSummary: jest
          .fn()
          .mockResolvedValue(failure('Not enough units in stock.')),
      }),
    })

    await store.dispatch(loadQuote())

    expect(store.getState().payment).toMatchObject({
      summary: null,
      status: 'failed',
      error: 'Not enough units in stock.',
    })
  })

  it('explains when the gateway cannot be reached', async () => {
    const { store } = setup({
      gateway: fakeGateway({
        getAcceptance: jest
          .fn()
          .mockResolvedValue(failure('The payment processor is not available.')),
      }),
    })

    await store.dispatch(loadQuote())

    expect(store.getState().payment).toMatchObject({
      status: 'failed',
      error: 'The payment processor is not available.',
    })
  })

  it('does not ask anything without a product', async () => {
    const api = fakeApi()
    const store = createAppStore({ api, gateway: fakeGateway() })

    await store.dispatch(loadQuote())

    expect(api.getPaymentSummary).not.toHaveBeenCalled()
    expect(store.getState().payment.status).toBe('failed')
  })

  it('shows a general message when something unexpected happens', async () => {
    const { store } = setup({
      api: fakeApi({
        getPaymentSummary: jest.fn().mockRejectedValue(new Error('boom')),
      }),
    })

    await store.dispatch(loadQuote())

    expect(store.getState().payment).toMatchObject({
      status: 'failed',
      error: 'The payment summary could not be loaded.',
    })
  })
})
