import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CheckoutApi } from '../../api/checkout-api'
import type { PaymentGateway } from '../../api/gateway'
import { initialCheckoutState } from '../../store/checkout.slice'
import type { CheckoutState } from '../../store/checkout.slice'
import {
  fakeApi,
  fakeGateway,
  drone,
  readyProducts,
  renderWithStore,
  summaryForOne,
} from '../../test/render'
import { SummaryBackdrop } from './SummaryBackdrop'

const onSummary: CheckoutState = {
  ...initialCheckoutState,
  step: 'summary',
  productId: drone.id,
  quantity: 1,
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

const renderSummary = (
  options: {
    checkout?: CheckoutState
    api?: CheckoutApi
    gateway?: PaymentGateway
  } = {},
) =>
  renderWithStore(<SummaryBackdrop />, {
    api: options.api,
    gateway: options.gateway,
    state: {
      checkout: options.checkout ?? onSummary,
      products: readyProducts(),
    },
  })

/** The row of the breakdown that holds a given concept. */
const row = async (label: string) =>
  (await screen.findByText(label)).closest('div') as HTMLElement

const payButton = () => screen.findByRole('button', { name: /^Pay / })
const acceptEverything = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(
    await screen.findByRole('checkbox', { name: /terms and conditions/ }),
  )
  await user.click(screen.getByRole('checkbox', { name: /personal data/ }))
}

const failure = (message: string) => ({
  ok: false as const,
  error: { status: 409, code: 'INSUFFICIENT_STOCK', message },
})

describe('SummaryBackdrop', () => {
  it('opens as a dialog over the page', () => {
    renderSummary()

    expect(
      screen.getByRole('dialog', { name: 'Payment summary' }),
    ).toBeInTheDocument()
  })

  it('says it is calculating while the amounts arrive', () => {
    renderSummary({
      api: fakeApi({ getPaymentSummary: () => new Promise(() => undefined) }),
    })

    expect(screen.getByRole('status')).toHaveTextContent('Calculating your total')
    expect(screen.queryByRole('button', { name: /^Pay / })).toBeNull()
  })

  describe('the amounts', () => {
    it('breaks the total down into product, base fee and delivery fee', async () => {
      renderSummary()

      expect(await row('Glide Camera Drone × 1')).toHaveTextContent(
        '$459.900',
      )
      expect(await row('Base fee')).toHaveTextContent('$3.000')
      expect(await row('Delivery fee')).toHaveTextContent('$12.000')
      expect(await row('Total')).toHaveTextContent('$474.900')
    })

    it('uses the amounts calculated by the API, not its own sums', async () => {
      const { api } = renderSummary({
        checkout: { ...onSummary, quantity: 2 },
        api: fakeApi({
          getPaymentSummary: jest.fn().mockResolvedValue({
            ok: true,
            data: {
              ...summaryForOne,
              quantity: 2,
              subtotalInCents: 91_980_000,
              totalInCents: 93_480_000,
            },
          }),
        }),
      })

      expect(await row('Glide Camera Drone × 2')).toHaveTextContent(
        '$919.800',
      )
      expect(await row('Total')).toHaveTextContent('$934.800')
      expect(api.getPaymentSummary).toHaveBeenCalledWith(drone.id, 2)
    })
  })

  it('reminds where the order goes and which card pays', async () => {
    renderSummary()

    expect(await screen.findByText('Ana Maria Perez')).toBeInTheDocument()
    expect(
      screen.getByText('Calle 10 # 20-30, Medellin, Antioquia'),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Visa' })).toBeInTheDocument()
    expect(screen.getByText('•••• 4242')).toBeInTheDocument()
  })

  describe('accepting the conditions', () => {
    it('links to the documents of the payment processor in a new tab', async () => {
      renderSummary()

      const terms = await screen.findByRole('link', {
        name: 'terms and conditions',
      })
      expect(terms).toHaveAttribute('href', 'https://gateway.test/terms.pdf')
      expect(terms).toHaveAttribute('target', '_blank')
      expect(terms).toHaveAttribute('rel', 'noopener noreferrer')
      expect(
        screen.getByRole('link', { name: 'processing of my personal data' }),
      ).toHaveAttribute('href', 'https://gateway.test/personal-data.pdf')
    })

    it('cannot pay before both are accepted', async () => {
      const user = userEvent.setup()
      renderSummary()

      expect(await payButton()).toBeDisabled()
      await user.click(
        screen.getByRole('checkbox', { name: /terms and conditions/ }),
      )
      expect(await payButton()).toBeDisabled()
      await user.click(screen.getByRole('checkbox', { name: /personal data/ }))
      expect(await payButton()).toBeEnabled()
    })
  })

  describe('paying', () => {
    it('shows the total on the payment button', async () => {
      renderSummary()

      expect(await payButton()).toHaveTextContent('Pay $474.900')
    })

    it('sends the purchase and moves on to the payment status', async () => {
      const user = userEvent.setup()
      const { store, api } = renderSummary()
      await acceptEverything(user)

      await user.click(await payButton())

      expect(store.getState().checkout.step).toBe('status')
      expect(api.createTransaction).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          productId: drone.id,
          quantity: 1,
          payment: expect.objectContaining({
            cardToken: 'tok_test_1',
            acceptanceToken: 'acc-token',
            personalDataAuthToken: 'data-token',
          }),
        }),
      )
    })
  })

  describe('when the total cannot be calculated', () => {
    const failing = () =>
      fakeApi({
        getPaymentSummary: jest
          .fn()
          .mockResolvedValueOnce(failure('Not enough units in stock.'))
          .mockResolvedValue({ ok: true, data: summaryForOne }),
      })

    it('explains the problem and offers no payment', async () => {
      renderSummary({ api: failing() })

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Not enough units in stock.',
      )
      expect(screen.queryByRole('button', { name: /^Pay / })).toBeNull()
    })

    it('lets the customer try again', async () => {
      const user = userEvent.setup()
      renderSummary({ api: failing() })

      await user.click(await screen.findByRole('button', { name: 'Try again' }))

      expect(await row('Total')).toHaveTextContent('$474.900')
    })

    it('also explains when the payment processor cannot be reached', async () => {
      renderSummary({
        gateway: fakeGateway({
          getAcceptance: jest
            .fn()
            .mockResolvedValue(
              failure('The payment processor is not available.'),
            ),
        }),
      })

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'The payment processor is not available.',
      )
    })
  })

  describe('going back', () => {
    it('returns to the details and forgets the card token', async () => {
      const user = userEvent.setup()
      const { store } = renderSummary()

      await user.click(screen.getByRole('button', { name: 'Back to details' }))

      expect(store.getState().checkout).toMatchObject({
        step: 'details',
        cardToken: null,
        card: null,
      })
    })

    it('does the same with the Escape key', () => {
      const { store } = renderSummary()

      fireEvent(screen.getByRole('dialog'), new Event('cancel'))

      expect(store.getState().checkout.step).toBe('details')
    })
  })

  it('shows nothing without the details of the purchase', () => {
    renderSummary({ checkout: { ...onSummary, customer: null } })

    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
