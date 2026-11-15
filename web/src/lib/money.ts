const CENTS_PER_PESO = 100

const pesos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })

/** Amounts travel as integer cents; people read whole Colombian pesos. */
export const formatCop = (amountInCents: number): string =>
  `$${pesos.format(Math.round(amountInCents / CENTS_PER_PESO))}`
