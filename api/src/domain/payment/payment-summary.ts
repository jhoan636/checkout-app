import { isNonNegativeInteger, isPositiveInteger } from '../shared/quantity';
import { err, ok, Result } from '../shared/result';

/** Charged once per purchase, on top of the product amount. */
export interface Fees {
  readonly baseFeeInCents: number;
  readonly deliveryFeeInCents: number;
}

export interface OrderLine {
  readonly unitPriceInCents: number;
  readonly quantity: number;
}

export interface PaymentSummary {
  readonly subtotalInCents: number;
  readonly baseFeeInCents: number;
  readonly deliveryFeeInCents: number;
  readonly totalInCents: number;
}

export type PaymentSummaryError =
  'INVALID_QUANTITY' | 'INVALID_AMOUNT' | 'INVALID_FEE';

/**
 * Single source of truth for what the customer pays. The backend always
 * recalculates it; an amount sent by the browser is never trusted.
 */
export const calculatePaymentSummary = (
  line: OrderLine,
  fees: Fees,
): Result<PaymentSummary, PaymentSummaryError> => {
  if (!isPositiveInteger(line.quantity)) {
    return err('INVALID_QUANTITY');
  }
  if (!isPositiveInteger(line.unitPriceInCents)) {
    return err('INVALID_AMOUNT');
  }
  if (
    !isNonNegativeInteger(fees.baseFeeInCents) ||
    !isNonNegativeInteger(fees.deliveryFeeInCents)
  ) {
    return err('INVALID_FEE');
  }

  const subtotalInCents = line.unitPriceInCents * line.quantity;
  return ok({
    subtotalInCents,
    baseFeeInCents: fees.baseFeeInCents,
    deliveryFeeInCents: fees.deliveryFeeInCents,
    totalInCents:
      subtotalInCents + fees.baseFeeInCents + fees.deliveryFeeInCents,
  });
};
