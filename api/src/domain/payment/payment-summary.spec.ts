import { err, ok } from '../shared/result';
import { calculatePaymentSummary, Fees } from './payment-summary';

const fees: Fees = { baseFeeInCents: 250_000, deliveryFeeInCents: 1_200_000 };

describe('calculatePaymentSummary', () => {
  it('adds the product amount, the base fee and the delivery fee', () => {
    expect(
      calculatePaymentSummary(
        { unitPriceInCents: 25_000_000, quantity: 2 },
        fees,
      ),
    ).toEqual(
      ok({
        subtotalInCents: 50_000_000,
        baseFeeInCents: 250_000,
        deliveryFeeInCents: 1_200_000,
        totalInCents: 51_450_000,
      }),
    );
  });

  it('charges the fees once, whatever the quantity', () => {
    const one = calculatePaymentSummary(
      { unitPriceInCents: 1_000_000, quantity: 1 },
      fees,
    );
    const three = calculatePaymentSummary(
      { unitPriceInCents: 1_000_000, quantity: 3 },
      fees,
    );

    expect(one).toMatchObject({ value: { totalInCents: 2_450_000 } });
    expect(three).toMatchObject({ value: { totalInCents: 4_450_000 } });
  });

  it('accepts fees of zero', () => {
    expect(
      calculatePaymentSummary(
        { unitPriceInCents: 1_000_000, quantity: 1 },
        { baseFeeInCents: 0, deliveryFeeInCents: 0 },
      ),
    ).toMatchObject({ value: { totalInCents: 1_000_000 } });
  });

  it.each([0, -1, 2.5])(
    'fails when the quantity is not a positive integer (%s)',
    (quantity) => {
      expect(
        calculatePaymentSummary(
          { unitPriceInCents: 1_000_000, quantity },
          fees,
        ),
      ).toEqual(err('INVALID_QUANTITY'));
    },
  );

  it.each([0, -500, 99.9])(
    'fails when the unit price is not a positive integer of cents (%s)',
    (unitPriceInCents) => {
      expect(
        calculatePaymentSummary({ unitPriceInCents, quantity: 1 }, fees),
      ).toEqual(err('INVALID_AMOUNT'));
    },
  );

  it.each([
    { baseFeeInCents: -1, deliveryFeeInCents: 0 },
    { baseFeeInCents: 0, deliveryFeeInCents: -1 },
    { baseFeeInCents: 10.5, deliveryFeeInCents: 0 },
  ])('fails when a fee is negative or has decimals (%o)', (badFees) => {
    expect(
      calculatePaymentSummary(
        { unitPriceInCents: 1_000_000, quantity: 1 },
        badFees,
      ),
    ).toEqual(err('INVALID_FEE'));
  });
});
