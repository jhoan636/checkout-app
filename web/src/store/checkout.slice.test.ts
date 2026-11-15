import {
  checkoutFinished,
  checkoutReducer,
  checkoutStarted,
  detailsClosed,
  detailsRejected,
  detailsSubmitted,
  detailsSubmitting,
  initialCheckoutState,
  paymentStarted,
  MAX_UNITS_PER_PURCHASE,
  productSelected,
  quantityChanged,
  summaryClosed,
} from './checkout.slice'
import type { PurchaseDetails } from './checkout.slice'

const initial = initialCheckoutState

const details: PurchaseDetails = {
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
}

describe('checkout slice', () => {
  it('starts on the product page with one unit', () => {
    expect(checkoutReducer(undefined, { type: 'init' })).toEqual({
      step: 'product',
      productId: null,
      quantity: 1,
      customer: null,
      delivery: null,
      card: null,
      cardToken: null,
      submitting: false,
      submitError: null,
    })
  })

  it('shows another product and goes back to one unit', () => {
    const state = checkoutReducer(
      { ...initial, productId: 'prod-1', quantity: 4 },
      productSelected('prod-2'),
    )

    expect(state).toMatchObject({
      step: 'product',
      productId: 'prod-2',
      quantity: 1,
    })
  })

  it('starts the checkout over when it was about another product', () => {
    const stale = {
      ...initial,
      ...details,
      step: 'details' as const,
      productId: 'prod-1',
      quantity: 3,
    }

    expect(checkoutReducer(stale, productSelected('prod-2'))).toEqual({
      ...initial,
      productId: 'prod-2',
    })
  })

  it('does not touch a payment whose status is being shown', () => {
    const paid = { ...initial, step: 'status' as const, productId: 'prod-1' }

    expect(checkoutReducer(paid, productSelected('prod-2'))).toEqual(paid)
  })

  it('changes the quantity', () => {
    expect(checkoutReducer(initial, quantityChanged(3)).quantity).toBe(3)
  })

  it.each([
    [0, 1],
    [-5, 1],
    [2.7, 2],
    [MAX_UNITS_PER_PURCHASE + 1, MAX_UNITS_PER_PURCHASE],
    [Number.NaN, 1],
  ])('keeps the quantity within limits: %s becomes %s', (asked, kept) => {
    expect(checkoutReducer(initial, quantityChanged(asked)).quantity).toBe(kept)
  })

  it('moves to the details step when the checkout starts', () => {
    const state = checkoutReducer(
      { ...initial, productId: 'prod-1' },
      checkoutStarted(),
    )

    expect(state.step).toBe('details')
  })

  it('does not start a checkout without a product', () => {
    expect(checkoutReducer(initial, checkoutStarted()).step).toBe('product')
  })

  it('does not start a second checkout over the first one', () => {
    const onSummary = { ...initial, step: 'summary' as const, productId: 'prod-1' }

    expect(checkoutReducer(onSummary, checkoutStarted()).step).toBe('summary')
  })

  describe('details', () => {
    const onDetails = { ...initial, step: 'details' as const, productId: 'prod-1' }
    const waiting = { ...onDetails, submitting: true }
    const tokenized = { ...details, cardToken: 'tok_test_1' }

    it('waits while the card is being checked', () => {
      const state = checkoutReducer(
        { ...onDetails, submitError: 'Old problem' },
        detailsSubmitting(),
      )

      expect(state).toMatchObject({ submitting: true, submitError: null })
    })

    it('does not wait for a card outside the form', () => {
      expect(checkoutReducer(initial, detailsSubmitting())).toEqual(initial)
    })

    it('keeps the details and the card token, and moves to the summary', () => {
      const state = checkoutReducer(waiting, detailsSubmitted(tokenized))

      expect(state).toMatchObject({
        step: 'summary',
        ...details,
        cardToken: 'tok_test_1',
        submitting: false,
      })
    })

    it('ignores details sent from another step', () => {
      const state = checkoutReducer(initial, detailsSubmitted(tokenized))

      expect(state).toEqual(initial)
    })

    it('ignores an answer the form is no longer waiting for', () => {
      // The customer closed the form and opened it again in the meantime.
      const state = checkoutReducer(onDetails, detailsSubmitted(tokenized))

      expect(state).toEqual(onDetails)
    })

    it('explains why the card was not accepted and stays on the form', () => {
      const state = checkoutReducer(waiting, detailsRejected('Card not accepted'))

      expect(state).toMatchObject({
        step: 'details',
        submitting: false,
        submitError: 'Card not accepted',
      })
    })

    it('ignores a rejection nobody is waiting for', () => {
      expect(checkoutReducer(onDetails, detailsRejected('Late'))).toEqual(onDetails)
    })

    it('goes back to the product when the form is closed', () => {
      const state = checkoutReducer(
        { ...waiting, submitError: 'Card not accepted' },
        detailsClosed(),
      )

      expect(state).toMatchObject({
        step: 'product',
        submitting: false,
        submitError: null,
      })
    })

    it('remembers the contact details after going back', () => {
      const submitted = checkoutReducer(waiting, detailsSubmitted(tokenized))
      const state = checkoutReducer(
        { ...submitted, step: 'details' },
        detailsClosed(),
      )

      expect(state.customer).toEqual(details.customer)
      expect(state.delivery).toEqual(details.delivery)
    })

    it('does not close anything from another step', () => {
      const onSummary = { ...onDetails, step: 'summary' as const }

      expect(checkoutReducer(onSummary, detailsClosed()).step).toBe('summary')
    })
  })

  describe('summary', () => {
    const onSummary = {
      ...initial,
      ...details,
      step: 'summary' as const,
      productId: 'prod-1',
      cardToken: 'tok_test_1',
    }

    it('goes back to the form and forgets the card, which must be typed again', () => {
      const state = checkoutReducer(onSummary, summaryClosed())

      expect(state).toMatchObject({
        step: 'details',
        card: null,
        cardToken: null,
        customer: details.customer,
        delivery: details.delivery,
      })
    })

    it('does not go back from another step', () => {
      expect(checkoutReducer(initial, summaryClosed())).toEqual(initial)
    })

    it('moves to the status when the customer pays', () => {
      expect(checkoutReducer(onSummary, paymentStarted()).step).toBe('status')
    })

    it('does not pay without a card token', () => {
      const state = checkoutReducer(
        { ...onSummary, cardToken: null },
        paymentStarted(),
      )

      expect(state.step).toBe('summary')
    })

    it('does not pay from another step', () => {
      const state = checkoutReducer(
        { ...onSummary, step: 'details' },
        paymentStarted(),
      )

      expect(state.step).toBe('details')
    })
  })

  describe('finishing', () => {
    const onStatus = {
      ...initial,
      ...details,
      step: 'status' as const,
      productId: 'prod-1',
      quantity: 3,
      cardToken: 'tok_test_1',
    }

    it('goes back to the product and forgets the purchase', () => {
      expect(checkoutReducer(onStatus, checkoutFinished())).toEqual({
        ...initial,
        productId: 'prod-1',
      })
    })

    it('does not finish a checkout that is still in progress', () => {
      const onSummary = { ...onStatus, step: 'summary' as const }

      expect(checkoutReducer(onSummary, checkoutFinished())).toEqual(onSummary)
    })
  })
})
