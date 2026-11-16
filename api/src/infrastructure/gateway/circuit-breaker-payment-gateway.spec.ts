import {
  CardCharge,
  GatewayError,
  GatewayTransaction,
} from '../../application/ports/payment-gateway';
import {
  FakePaymentGateway,
  FixedClock,
} from '../../application/testing/in-memory.fake';
import { err, ok, Result } from '../../domain/shared/result';
import {
  CircuitBreakerPaymentGateway,
  CircuitState,
} from './circuit-breaker-payment-gateway';

const charge: CardCharge = {
  reference: 'ORDER-0001',
  amountInCents: 50_500_000,
  currency: 'COP',
  customerEmail: 'buyer@example.com',
  cardToken: 'tok_test_123',
  installments: 1,
  acceptanceToken: 'acceptance-token',
  personalDataAuthToken: 'personal-auth-token',
};

const approved = ok<GatewayTransaction>({
  id: 'gw-1',
  status: 'APPROVED',
  reference: 'ORDER-0001',
});
const down = err<GatewayError>('GATEWAY_UNAVAILABLE');
const notCalled = err<GatewayError>('GATEWAY_NOT_CALLED');

const COOLDOWN_MS = 30_000;

const setup = () => {
  const inner = new FakePaymentGateway(approved);
  const clock = new FixedClock(new Date('2026-11-15T12:00:00Z'));
  const changes: CircuitState[] = [];
  const breaker = new CircuitBreakerPaymentGateway(
    inner,
    { failureThreshold: 3, cooldownMs: COOLDOWN_MS },
    clock,
    (state) => changes.push(state),
  );
  const pass = (milliseconds: number) => {
    clock.current = new Date(clock.current.getTime() + milliseconds);
  };
  const failTimes = async (times: number) => {
    inner.answer = down;
    for (let call = 0; call < times; call += 1) {
      await breaker.createCardTransaction(charge);
    }
  };
  return { inner, breaker, changes, pass, failTimes };
};

describe('CircuitBreakerPaymentGateway', () => {
  describe('while the gateway answers', () => {
    it('passes charges and queries through untouched', async () => {
      const { inner, breaker } = setup();

      await expect(breaker.createCardTransaction(charge)).resolves.toEqual(
        approved,
      );
      await expect(breaker.findTransaction('gw-1')).resolves.toEqual(approved);
      expect(inner.charges).toEqual([charge]);
      expect(inner.queries).toEqual(['gw-1']);
    });

    it('passes a search by reference through, found or not', async () => {
      const { inner, breaker } = setup();

      await expect(
        breaker.findTransactionByReference('ORDER-0001'),
      ).resolves.toEqual(ok(null));
      expect(inner.searches).toEqual(['ORDER-0001']);
    });

    it('stays closed below the failure threshold', async () => {
      const { inner, breaker, failTimes } = setup();

      await failTimes(2);
      await expect(breaker.createCardTransaction(charge)).resolves.toEqual(
        down,
      );
      expect(inner.charges).toHaveLength(3);
    });

    it('counts only failures in a row', async () => {
      const { inner, breaker, changes, failTimes } = setup();

      await failTimes(2);
      inner.answer = approved;
      await breaker.createCardTransaction(charge);
      await failTimes(2);

      expect(changes).toEqual([]);
    });

    it.each<GatewayError>(['GATEWAY_REJECTED', 'GATEWAY_INVALID_RESPONSE'])(
      'does not count %s as an outage: the gateway did answer',
      async (error) => {
        const { inner, breaker, changes } = setup();
        inner.answer = err(error);

        for (let call = 0; call < 5; call += 1) {
          await breaker.createCardTransaction(charge);
        }

        expect(inner.charges).toHaveLength(5);
        expect(changes).toEqual([]);
      },
    );
  });

  describe('once the gateway failed too many times in a row', () => {
    it('stops calling it and answers at once', async () => {
      const { inner, breaker, changes, failTimes } = setup();
      await failTimes(3);

      await expect(breaker.createCardTransaction(charge)).resolves.toEqual(
        notCalled,
      );
      await expect(breaker.findTransaction('gw-1')).resolves.toEqual(notCalled);
      await expect(
        breaker.findTransactionByReference('ORDER-0001'),
      ).resolves.toEqual(notCalled);
      expect(inner.searches).toHaveLength(0);
      expect(inner.charges).toHaveLength(3);
      expect(inner.queries).toHaveLength(0);
      expect(changes).toEqual(['OPEN']);
    });

    it('counts failed queries and failed charges together', async () => {
      const { inner, breaker, failTimes } = setup();
      await failTimes(2);
      await breaker.findTransaction('gw-1');

      await expect(breaker.createCardTransaction(charge)).resolves.toEqual(
        notCalled,
      );
      expect(inner.charges).toHaveLength(2);
    });

    it('keeps refusing until the cooldown is over', async () => {
      const { inner, breaker, pass, failTimes } = setup();
      await failTimes(3);
      inner.answer = approved;

      pass(COOLDOWN_MS - 1);

      await expect(breaker.createCardTransaction(charge)).resolves.toEqual(
        notCalled,
      );
    });
  });

  describe('after the cooldown', () => {
    it('lets one call through and closes again when it works', async () => {
      const { inner, breaker, changes, pass, failTimes } = setup();
      await failTimes(3);
      inner.answer = approved;
      pass(COOLDOWN_MS);

      await expect(breaker.createCardTransaction(charge)).resolves.toEqual(
        approved,
      );
      await expect(breaker.findTransaction('gw-1')).resolves.toEqual(approved);
      expect(changes).toEqual(['OPEN', 'CLOSED']);
    });

    it('opens again for a whole cooldown when that call fails', async () => {
      const { inner, breaker, changes, pass, failTimes } = setup();
      await failTimes(3);
      pass(COOLDOWN_MS);

      await expect(breaker.createCardTransaction(charge)).resolves.toEqual(
        down,
      );
      pass(COOLDOWN_MS - 1);
      await expect(breaker.createCardTransaction(charge)).resolves.toEqual(
        notCalled,
      );
      expect(inner.charges).toHaveLength(4);
      expect(changes).toEqual(['OPEN', 'OPEN']);
    });

    it('refuses other calls while the trial one is still waiting', async () => {
      const { inner, breaker, pass, failTimes } = setup();
      await failTimes(3);
      inner.answer = approved;
      pass(COOLDOWN_MS);
      let answerTrial: (
        answer: Result<GatewayTransaction, GatewayError>,
      ) => void = () => undefined;
      jest.spyOn(inner, 'findTransaction').mockReturnValueOnce(
        new Promise((resolve) => {
          answerTrial = resolve;
        }),
      );

      const trial = breaker.findTransaction('gw-1');
      await expect(breaker.createCardTransaction(charge)).resolves.toEqual(
        notCalled,
      );
      answerTrial(approved);

      await expect(trial).resolves.toEqual(approved);
      await expect(breaker.createCardTransaction(charge)).resolves.toEqual(
        approved,
      );
    });

    it('frees the trial slot even if the gateway adapter throws', async () => {
      const { inner, breaker, pass, failTimes } = setup();
      await failTimes(3);
      pass(COOLDOWN_MS);
      jest
        .spyOn(inner, 'findTransaction')
        .mockRejectedValueOnce(new Error('unexpected'));

      await expect(breaker.findTransaction('gw-1')).resolves.toEqual(down);
      pass(COOLDOWN_MS);
      inner.answer = approved;

      await expect(breaker.createCardTransaction(charge)).resolves.toEqual(
        approved,
      );
    });
  });
});
