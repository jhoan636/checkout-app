import {
  checkoutReducer,
  checkoutStarted,
  MAX_UNITS_PER_PURCHASE,
  productSelected,
  quantityChanged,
} from './checkout.slice'
import type { CheckoutState } from './checkout.slice'

const initial: CheckoutState = { step: 'product', productId: null, quantity: 1 }

describe('checkout slice', () => {
  it('starts on the product step with one unit', () => {
    expect(checkoutReducer(undefined, { type: 'init' })).toEqual(initial)
  })

  it('selects a product and goes back to one unit', () => {
    const state = checkoutReducer(
      { ...initial, productId: 'prod-1', quantity: 4 },
      productSelected('prod-2'),
    )

    expect(state).toEqual({ step: 'product', productId: 'prod-2', quantity: 1 })
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
})
