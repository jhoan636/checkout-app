import {
  detectBrand,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  isExpiryValid,
  isValidCardNumber,
  passesLuhn,
} from './card'

describe('card rules', () => {
  describe('digitsOnly', () => {
    it('drops everything that is not a digit', () => {
      expect(digitsOnly('4242 4242-42a')).toBe('4242424242')
    })
  })

  describe('detectBrand', () => {
    it.each([
      ['4', 'visa'],
      ['4242 4242 4242 4242', 'visa'],
      ['51', 'mastercard'],
      ['5555 5555 5555 4444', 'mastercard'],
      ['2221', 'mastercard'],
      ['2720 99', 'mastercard'],
      ['27', 'mastercard'],
    ])('recognises %s as %s', (number, brand) => {
      expect(detectBrand(number)).toBe(brand)
    })

    it.each([[''], ['5'], ['50'], ['56'], ['2'], ['2220'], ['2721'], ['37']])(
      'does not recognise %s',
      (number) => {
        expect(detectBrand(number)).toBeNull()
      },
    )
  })

  describe('formatCardNumber', () => {
    it('groups the digits in blocks of four', () => {
      expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242')
    })

    it('ignores letters and never keeps more than 19 digits', () => {
      expect(formatCardNumber('42a42-4')).toBe('4242 4')
      expect(digitsOnly(formatCardNumber('4'.repeat(30)))).toHaveLength(19)
    })
  })

  describe('passesLuhn', () => {
    it('accepts a number with a correct check digit', () => {
      expect(passesLuhn('4242424242424242')).toBe(true)
    })

    it('rejects a number with one wrong digit', () => {
      expect(passesLuhn('4242424242424241')).toBe(false)
    })

    it('rejects an empty number', () => {
      expect(passesLuhn('')).toBe(false)
    })
  })

  describe('isValidCardNumber', () => {
    it.each([
      ['4242 4242 4242 4242'],
      ['4111 1111 1111 1111'],
      ['5555 5555 5555 4444'],
      ['2223 0031 2200 3222'],
    ])('accepts %s', (number) => {
      expect(isValidCardNumber(number)).toBe(true)
    })

    it('rejects a brand other than VISA or MasterCard', () => {
      // A well-formed number of another network.
      expect(isValidCardNumber('3782 822463 10005')).toBe(false)
    })

    it('rejects a number that is too short', () => {
      expect(isValidCardNumber('4242 4242 4242')).toBe(false)
    })

    it('rejects a number with a wrong check digit', () => {
      expect(isValidCardNumber('4242 4242 4242 4243')).toBe(false)
    })
  })

  describe('formatExpiry', () => {
    it.each([
      ['1', '1'],
      ['12', '12'],
      ['123', '12/3'],
      ['1228', '12/28'],
      ['12/28', '12/28'],
      ['12289', '12/28'],
    ])('turns %s into %s', (typed, shown) => {
      expect(formatExpiry(typed)).toBe(shown)
    })
  })

  describe('isExpiryValid', () => {
    const november2026 = new Date(2026, 10, 15)

    it('accepts the current month', () => {
      expect(isExpiryValid('11/26', november2026)).toBe(true)
    })

    it('accepts a later year', () => {
      expect(isExpiryValid('01/29', november2026)).toBe(true)
    })

    it('rejects last month', () => {
      expect(isExpiryValid('10/26', november2026)).toBe(false)
    })

    it('rejects a month that does not exist', () => {
      expect(isExpiryValid('13/28', november2026)).toBe(false)
      expect(isExpiryValid('00/28', november2026)).toBe(false)
    })

    it('rejects an incomplete date', () => {
      expect(isExpiryValid('12/2', november2026)).toBe(false)
    })
  })
})
