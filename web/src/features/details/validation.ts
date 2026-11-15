import {
  detectBrand,
  digitsOnly,
  isExpiryValid,
  isValidCardNumber,
} from '../../lib/card'
import type { CardBrand } from '../../lib/card'
import type { PurchaseDetails } from '../../store/checkout.slice'

/** What the customer types. Every value is text, exactly as shown. */
export interface DetailsValues {
  cardNumber: string
  cardHolder: string
  expiry: string
  cvc: string
  fullName: string
  email: string
  phone: string
  addressLine: string
  city: string
  region: string
  postalCode: string
}

export type DetailsField = keyof DetailsValues
export type DetailsErrors = Partial<Record<DetailsField, string>>

export const emptyDetails: DetailsValues = {
  cardNumber: '',
  cardHolder: '',
  expiry: '',
  cvc: '',
  fullName: '',
  email: '',
  phone: '',
  addressLine: '',
  city: '',
  region: '',
  postalCode: '',
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE = /^\+?\d{7,15}$/

const lengthBetween = (value: string, min: number, max: number): boolean => {
  const length = value.trim().length
  return length >= min && length <= max
}

const cleanPhone = (phone: string): string => phone.replace(/[\s()-]/g, '')

/**
 * One rule per field: it answers whether the value is acceptable. The limits
 * are the same ones the API enforces, so the customer finds out here first.
 */
const rules: Record<
  DetailsField,
  { message: string; passes: (value: string, now: Date) => boolean }
> = {
  cardNumber: {
    message: 'Enter a valid VISA or MasterCard number.',
    passes: (value) => isValidCardNumber(value),
  },
  cardHolder: {
    message: 'Enter the name as it appears on the card.',
    passes: (value) => lengthBetween(value, 5, 120),
  },
  expiry: {
    message: 'Enter a valid expiry date (MM/YY).',
    passes: (value, now) => isExpiryValid(value, now),
  },
  cvc: {
    message: 'Enter the 3 digits on the back of the card.',
    passes: (value) => /^\d{3}$/.test(value),
  },
  fullName: {
    message: 'Enter your full name.',
    passes: (value) => lengthBetween(value, 2, 120),
  },
  email: {
    message: 'Enter a valid email address.',
    passes: (value) => EMAIL.test(value.trim()) && value.trim().length <= 254,
  },
  phone: {
    message: 'Enter a phone number with 7 to 15 digits.',
    passes: (value) => PHONE.test(cleanPhone(value)),
  },
  addressLine: {
    message: 'Enter the delivery address.',
    passes: (value) => lengthBetween(value, 5, 200),
  },
  city: {
    message: 'Enter the city.',
    passes: (value) => lengthBetween(value, 2, 80),
  },
  region: {
    message: 'Enter the state or department.',
    passes: (value) => lengthBetween(value, 2, 80),
  },
  postalCode: {
    message: 'Enter a postal code with 3 to 12 characters.',
    // Optional: empty is fine.
    passes: (value) => value.trim() === '' || lengthBetween(value, 3, 12),
  },
}

/** Returns only the fields with a problem; an empty object means all good. */
export const validateDetails = (
  values: DetailsValues,
  now: Date,
): DetailsErrors => {
  const errors: DetailsErrors = {}
  for (const field of Object.keys(rules) as DetailsField[]) {
    if (!rules[field].passes(values[field], now)) {
      errors[field] = rules[field].message
    }
  }
  return errors
}

/**
 * What is safe to keep after the form: who buys, where it goes, and just
 * enough of the card to recognise it. The number, date and code stay out.
 */
export const toPurchaseDetails = (values: DetailsValues): PurchaseDetails => {
  const postalCode = values.postalCode.trim()
  return {
    customer: {
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      phone: cleanPhone(values.phone),
    },
    delivery: {
      addressLine: values.addressLine.trim(),
      city: values.city.trim(),
      region: values.region.trim(),
      ...(postalCode ? { postalCode } : {}),
    },
    card: {
      brand: detectBrand(values.cardNumber) as CardBrand,
      lastFour: digitsOnly(values.cardNumber).slice(-4),
    },
  }
}
