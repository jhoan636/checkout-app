/**
 * Card rules that run in the browser. They only help the customer type
 * correctly: the payment gateway is the one that really checks the card.
 */

export type CardBrand = 'visa' | 'mastercard'

const MAX_CARD_DIGITS = 19

export const digitsOnly = (value: string): string => value.replace(/\D/g, '')

/**
 * VISA starts with 4. MasterCard starts with 51-55 or 2221-2720.
 * With only two or three digits, 22-27 is treated as MasterCard so the logo
 * appears while the customer is still typing.
 */
export const detectBrand = (number: string): CardBrand | null => {
  const digits = digitsOnly(number)
  if (digits.startsWith('4')) {
    return 'visa'
  }
  if (digits.length < 2) {
    return null
  }
  const two = Number(digits.slice(0, 2))
  if (two >= 51 && two <= 55) {
    return 'mastercard'
  }
  if (digits.length >= 4) {
    const four = Number(digits.slice(0, 4))
    return four >= 2221 && four <= 2720 ? 'mastercard' : null
  }
  return two >= 22 && two <= 27 ? 'mastercard' : null
}

/** "4242424242424242" becomes "4242 4242 4242 4242". */
export const formatCardNumber = (value: string): string =>
  digitsOnly(value)
    .slice(0, MAX_CARD_DIGITS)
    .replace(/(\d{4})(?=\d)/g, '$1 ')

/**
 * Luhn check digit: catches a mistyped digit before the card is sent.
 * From the right, every second digit is doubled (minus 9 if above 9) and the
 * total must be a multiple of 10.
 */
export const passesLuhn = (number: string): boolean => {
  const digits = digitsOnly(number)
  if (digits.length === 0) {
    return false
  }
  let sum = 0
  for (let index = 0; index < digits.length; index += 1) {
    let digit = Number(digits[digits.length - 1 - index])
    if (index % 2 === 1) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }
    sum += digit
  }
  return sum % 10 === 0
}

const VALID_LENGTHS: Record<CardBrand, number[]> = {
  visa: [13, 16, 19],
  mastercard: [16],
}

export const isValidCardNumber = (number: string): boolean => {
  const digits = digitsOnly(number)
  const brand = detectBrand(digits)
  return (
    brand !== null &&
    VALID_LENGTHS[brand].includes(digits.length) &&
    passesLuhn(digits)
  )
}

/** "1228" becomes "12/28". */
export const formatExpiry = (value: string): string => {
  const digits = digitsOnly(value).slice(0, 4)
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits
}

/** A card is good until the last day of its expiry month. */
export const isExpiryValid = (value: string, now: Date): boolean => {
  const match = /^(\d{2})\/(\d{2})$/.exec(value)
  if (!match) {
    return false
  }
  const month = Number(match[1])
  const year = 2000 + Number(match[2])
  if (month < 1 || month > 12) {
    return false
  }
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1
  return year > currentYear || (year === currentYear && month >= currentMonth)
}
