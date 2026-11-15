import { digitsOnly } from '../../lib/card'
import {
  detailsRejected,
  detailsSubmitted,
  detailsSubmitting,
} from '../../store/checkout.slice'
import type { AppThunk } from '../../store/store'
import { toPurchaseDetails } from './validation'
import type { DetailsValues } from './validation'

/**
 * Exchanges the card for a token with the gateway and keeps only what is
 * safe to keep.
 *
 * It is a hand-written thunk on purpose: the card arrives as a plain function
 * argument, so it is never part of an action and cannot end up in the store,
 * in a log or in the Redux developer tools.
 */
export const submitDetails =
  (values: DetailsValues): AppThunk<Promise<void>> =>
  async (dispatch, _getState, { gateway }) => {
    dispatch(detailsSubmitting())

    const [expMonth, expYear] = values.expiry.split('/')
    const result = await gateway.tokenizeCard({
      number: digitsOnly(values.cardNumber),
      cvc: values.cvc,
      expMonth,
      expYear,
      cardHolder: values.cardHolder.trim(),
    })

    if (!result.ok) {
      dispatch(detailsRejected(result.error.message))
      return
    }
    dispatch(
      detailsSubmitted({
        ...toPurchaseDetails(values),
        cardToken: result.data.token,
      }),
    )
  }
