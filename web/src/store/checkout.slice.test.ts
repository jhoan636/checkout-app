import {
  checkoutReducer,
  checkoutStarted,
  detailsClosed,
  detailsSubmitted,
  initialCheckoutState,
  MAX_UNITS_PER_PURCHASE,
  productSelected,
  quantityChanged,
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

  it('does not change the product in the middle of a payment', () => {
    const paying = { ...initial, step: 'details' as const, productId: 'prod-1' }

    expect(checkoutReducer(paying, productSelected('prod-2'))).toEqual(paying)
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

    it('keeps the details and moves to the summary', () => {
      const state = checkoutReducer(onDetails, detailsSubmitted(details))

      expect(state).toMatchObject({ step: 'summary', ...details })
    })

    it('ignores details sent from another step', () => {
      const state = checkoutReducer(initial, detailsSubmitted(details))

      expect(state).toEqual(initial)
    })

    it('goes back to the product when the form is closed', () => {
      expect(checkoutReducer(onDetails, detailsClosed()).step).toBe('product')
    })

    it('remembers the contact details after going back', () => {
      const submitted = checkoutReducer(onDetails, detailsSubmitted(details))
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
})
