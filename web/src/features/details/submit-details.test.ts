import { initialCheckoutState } from '../../store/checkout.slice'
import { createAppStore } from '../../store/store'
import { fakeApi, fakeGateway } from '../../test/render'
import { submitDetails } from './submit-details'
import type { DetailsValues } from './validation'

const values: DetailsValues = {
  cardNumber: '4242 4242 4242 4242',
  cardHolder: '  Ana Maria Perez ',
  expiry: '12/28',
  cvc: '123',
  fullName: 'Ana Maria Perez',
  email: 'ana@example.com',
  phone: '300 123 4567',
  addressLine: 'Calle 10 # 20-30',
  city: 'Medellin',
  region: 'Antioquia',
  postalCode: '',
}

const setup = (gateway = fakeGateway()) => {
  const api = fakeApi()
  const store = createAppStore(
    { api, gateway },
    {
      checkout: { ...initialCheckoutState, step: 'details', productId: 'prod-1' },
    },
  )
  return { store, api, gateway }
}

describe('submitDetails', () => {
  it('sends the card to the gateway, in the shape it expects', async () => {
    const { store, gateway } = setup()

    await store.dispatch(submitDetails(values))

    expect(gateway.tokenizeCard).toHaveBeenCalledWith({
      number: '4242424242424242',
      cvc: '123',
      expMonth: '12',
      expYear: '28',
      cardHolder: 'Ana Maria Perez',
    })
  })

  it('never sends the card to our own API', async () => {
    const { store, api } = setup()

    await store.dispatch(submitDetails(values))

    for (const call of Object.values(api)) {
      expect(call).not.toHaveBeenCalled()
    }
  })

  it('waits while the gateway checks the card', () => {
    const { store } = setup(
      fakeGateway({ tokenizeCard: () => new Promise(() => undefined) }),
    )

    void store.dispatch(submitDetails(values))

    expect(store.getState().checkout).toMatchObject({
      step: 'details',
      submitting: true,
    })
  })

  it('keeps the token and the safe details, and moves to the summary', async () => {
    const { store } = setup()

    await store.dispatch(submitDetails(values))

    expect(store.getState().checkout).toMatchObject({
      step: 'summary',
      cardToken: 'tok_test_1',
      card: { brand: 'visa', lastFour: '4242' },
      customer: { fullName: 'Ana Maria Perez', phone: '3001234567' },
      delivery: { city: 'Medellin' },
      submitting: false,
    })
  })

  it('leaves no trace of the card in the store', async () => {
    const { store } = setup()

    await store.dispatch(submitDetails(values))

    const saved = JSON.stringify(store.getState())
    expect(saved).not.toContain('4242424242424242')
    expect(saved).not.toContain('4242 4242 4242 4242')
    expect(saved).not.toContain('"123"')
    expect(saved).not.toContain('12/28')
  })

  it('explains the problem when the card is not accepted', async () => {
    const { store } = setup(
      fakeGateway({
        tokenizeCard: jest.fn().mockResolvedValue({
          ok: false,
          error: {
            status: 422,
            code: 'CARD_REJECTED',
            message: 'The card was not accepted. Check its details and try again.',
          },
        }),
      }),
    )

    await store.dispatch(submitDetails(values))

    expect(store.getState().checkout).toMatchObject({
      step: 'details',
      cardToken: null,
      submitting: false,
      submitError: 'The card was not accepted. Check its details and try again.',
    })
  })
})
