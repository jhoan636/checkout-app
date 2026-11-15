/** Quantities and amounts in cents are always whole numbers above zero. */
export const isPositiveInteger = (value: number): boolean =>
  Number.isInteger(value) && value > 0;
