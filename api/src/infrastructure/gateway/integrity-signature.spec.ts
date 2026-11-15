import { buildIntegritySignature } from './integrity-signature';

const input = {
  reference: 'ORDER-0001',
  amountInCents: 50_500_000,
  currency: 'COP',
} as const;

describe('buildIntegritySignature', () => {
  it('hashes reference + amount + currency + secret with SHA-256', () => {
    // Expected value computed outside this code with `sha256sum`.
    expect(buildIntegritySignature(input, 'test_integrity_secret')).toBe(
      '36ae382af1a46cba40000270d6d8bd3f49adc615601c45ee411a681fef073e7a',
    );
  });

  it('changes when the amount changes, so a tampered amount is rejected', () => {
    const original = buildIntegritySignature(input, 'test_integrity_secret');
    const tampered = buildIntegritySignature(
      { ...input, amountInCents: 100 },
      'test_integrity_secret',
    );

    expect(tampered).not.toBe(original);
  });

  it('changes when the secret changes', () => {
    expect(buildIntegritySignature(input, 'another_secret')).not.toBe(
      buildIntegritySignature(input, 'test_integrity_secret'),
    );
  });
});
