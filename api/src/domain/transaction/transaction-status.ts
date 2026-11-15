export const TRANSACTION_STATUSES = [
  'PENDING',
  'APPROVED',
  'DECLINED',
  'VOIDED',
  'ERROR',
] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** A final status never changes again. */
export const isFinal = (status: TransactionStatus): boolean =>
  status !== 'PENDING';

/** The status only moves forward: from PENDING to one of the final ones. */
export const canTransition = (
  from: TransactionStatus,
  to: TransactionStatus,
): boolean => from === 'PENDING' && isFinal(to);
