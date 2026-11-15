/** Quantities and amounts in cents are always whole numbers above zero. */
export const isPositiveInteger = (value: number): boolean =>
  Number.isInteger(value) && value > 0;

/** Fees can be zero, but never negative or fractional. */
export const isNonNegativeInteger = (value: number): boolean =>
  Number.isInteger(value) && value >= 0;
