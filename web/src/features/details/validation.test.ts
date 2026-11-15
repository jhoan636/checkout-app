import { emptyDetails, toPurchaseDetails, validateDetails } from './validation'
import type { DetailsValues } from './validation'

const now = new Date(2026, 10, 15)

const valid: DetailsValues = {
  cardNumber: '4242 4242 4242 4242',
  cardHolder: 'Ana Maria Perez',
  expiry: '12/28',
  cvc: '123',
  fullName: 'Ana Maria Perez',
  email: 'ana@example.com',
  phone: '300 123 4567',
  addressLine: 'Calle 10 # 20-30',
  city: 'Medellin',
  region: 'Antioquia',
  postalCode: '',
}

describe('details validation', () => {
  it('starts with every field empty', () => {
    expect(Object.values(emptyDetails).every((value) => value === '')).toBe(true)
  })

  it('finds nothing wrong with complete, correct details', () => {
    expect(validateDetails(valid, now)).toEqual({})
  })

  it('asks for every required field when the form is empty', () => {
    const errors = validateDetails(emptyDetails, now)

    expect(Object.keys(errors).sort()).toEqual(
      [
        'addressLine',
        'cardHolder',
        'cardNumber',
        'city',
        'cvc',
        'email',
        'expiry',
        'fullName',
        'phone',
        'region',
      ].sort(),
    )
  })

  it.each<[keyof DetailsValues, string, string]>([
    ['cardNumber', '4242 4242 4242 4243', 'Enter a valid VISA or MasterCard number.'],
    ['cardHolder', 'Ana', 'Enter the name as it appears on the card.'],
    ['expiry', '10/26', 'Enter a valid expiry date (MM/YY).'],
    ['cvc', '12', 'Enter the 3 digits on the back of the card.'],
    ['fullName', 'A', 'Enter your full name.'],
    ['email', 'ana@', 'Enter a valid email address.'],
    ['phone', '12345', 'Enter a phone number with 7 to 15 digits.'],
    ['addressLine', 'Cll', 'Enter the delivery address.'],
    ['city', 'M', 'Enter the city.'],
    ['region', 'A', 'Enter the state or department.'],
    ['postalCode', '1', 'Enter a postal code with 3 to 12 characters.'],
  ])('explains what is wrong with %s', (field, value, message) => {
    expect(validateDetails({ ...valid, [field]: value }, now)).toEqual({
      [field]: message,
    })
  })

  it('accepts a phone with a country code and spaces', () => {
    expect(validateDetails({ ...valid, phone: '+57 300 123 4567' }, now)).toEqual(
      {},
    )
  })

  describe('toPurchaseDetails', () => {
    it('keeps the customer and the delivery address, cleaned up', () => {
      const details = toPurchaseDetails({
        ...valid,
        fullName: '  Ana Maria Perez ',
        phone: '+57 300 123 4567',
        postalCode: ' 050021 ',
      })

      expect(details.customer).toEqual({
        fullName: 'Ana Maria Perez',
        email: 'ana@example.com',
        phone: '+573001234567',
      })
      expect(details.delivery).toEqual({
        addressLine: 'Calle 10 # 20-30',
        city: 'Medellin',
        region: 'Antioquia',
        postalCode: '050021',
      })
    })

    it('leaves the postal code out when it is empty', () => {
      expect(toPurchaseDetails(valid).delivery).not.toHaveProperty('postalCode')
    })

    it('keeps only the brand and the last four digits of the card', () => {
      const details = toPurchaseDetails(valid)

      expect(details.card).toEqual({ brand: 'visa', lastFour: '4242' })
      expect(JSON.stringify(details)).not.toContain('4242424242424242')
      expect(JSON.stringify(details)).not.toContain('123"')
    })
  })
})
