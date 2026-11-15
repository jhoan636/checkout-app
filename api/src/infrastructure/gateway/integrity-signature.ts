import { createHash } from 'node:crypto';

export interface SignedFields {
  readonly reference: string;
  readonly amountInCents: number;
  readonly currency: string;
}

/**
 * Proves to the gateway that the amount was set by this backend and not
 * altered on the way: SHA-256 of reference + amount + currency + secret.
 */
export const buildIntegritySignature = (
  fields: SignedFields,
  integritySecret: string,
): string =>
  createHash('sha256')
    .update(
      `${fields.reference}${fields.amountInCents}${fields.currency}${integritySecret}`,
    )
    .digest('hex');
