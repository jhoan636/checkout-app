import {
  canTransition,
  isFinal,
  TransactionStatus,
} from './transaction-status';

const finalStatuses: TransactionStatus[] = [
  'APPROVED',
  'DECLINED',
  'VOIDED',
  'ERROR',
];

describe('transaction status', () => {
  describe('isFinal', () => {
    it('PENDING is not final', () => {
      expect(isFinal('PENDING')).toBe(false);
    });

    it.each(finalStatuses)('%s is final', (status) => {
      expect(isFinal(status)).toBe(true);
    });
  });

  describe('canTransition', () => {
    it.each(finalStatuses)('PENDING can move to %s', (to) => {
      expect(canTransition('PENDING', to)).toBe(true);
    });

    it('PENDING cannot move to PENDING', () => {
      expect(canTransition('PENDING', 'PENDING')).toBe(false);
    });

    it.each(finalStatuses)('%s cannot move anywhere', (from) => {
      const targets: TransactionStatus[] = ['PENDING', ...finalStatuses];

      expect(targets.some((to) => canTransition(from, to))).toBe(false);
    });
  });
});
