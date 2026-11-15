import { bigintToNumber } from './bigint.transformer';

describe('bigintToNumber', () => {
  it('reads the text that postgres returns for BIGINT as a number', () => {
    expect(bigintToNumber.from('51450000')).toBe(51_450_000);
  });

  it('keeps null as null', () => {
    expect(bigintToNumber.from(null)).toBeNull();
  });

  it('writes the number unchanged', () => {
    expect(bigintToNumber.to(51_450_000)).toBe(51_450_000);
  });
});
