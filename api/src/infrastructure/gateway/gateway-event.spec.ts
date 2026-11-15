import { err, ok } from '../../domain/shared/result';
import { parseGatewayEvent } from './gateway-event';

const secret = 'test_events_secret';

// Checksum computed outside this code with `sha256sum` over:
// gw-123 + APPROVED + 93480000 + 1763200000 + test_events_secret
const checksum =
  '13994374329722ae51b3b05063081dc816e3019a61bd39185a54e1cd56f5289a';

const event = (overrides: Record<string, unknown> = {}) => ({
  event: 'transaction.updated',
  data: {
    transaction: {
      id: 'gw-123',
      status: 'APPROVED',
      reference: 'ORDER-1',
      amount_in_cents: 93_480_000,
    },
  },
  timestamp: 1_763_200_000,
  signature: {
    checksum,
    properties: [
      'transaction.id',
      'transaction.status',
      'transaction.amount_in_cents',
    ],
  },
  ...overrides,
});

describe('parseGatewayEvent', () => {
  it('accepts a correctly signed event and extracts what the app needs', () => {
    expect(parseGatewayEvent(event(), secret)).toEqual(
      ok({
        gatewayTransactionId: 'gw-123',
        status: 'APPROVED',
        reference: 'ORDER-1',
        amountInCents: 93_480_000,
      }),
    );
  });

  it('accepts the checksum in upper case', () => {
    const upper = event({
      signature: { ...event().signature, checksum: checksum.toUpperCase() },
    });

    expect(parseGatewayEvent(upper, secret)).toMatchObject({ ok: true });
  });

  it('rejects an event signed with another secret', () => {
    expect(parseGatewayEvent(event(), 'wrong_secret')).toEqual(
      err('INVALID_SIGNATURE'),
    );
  });

  it('rejects an event whose status was changed after signing', () => {
    const tampered = event({
      data: {
        transaction: { ...event().data.transaction, status: 'DECLINED' },
      },
    });

    expect(parseGatewayEvent(tampered, secret)).toEqual(
      err('INVALID_SIGNATURE'),
    );
  });

  it('rejects an event whose amount was changed after signing', () => {
    const tampered = event({
      data: {
        transaction: { ...event().data.transaction, amount_in_cents: 100 },
      },
    });

    expect(parseGatewayEvent(tampered, secret)).toEqual(
      err('INVALID_SIGNATURE'),
    );
  });

  it.each([
    ['null', null],
    ['a string', 'transaction.updated'],
    ['an event without signature', { ...event(), signature: undefined }],
    ['an event without timestamp', { ...event(), timestamp: undefined }],
    [
      'properties that are not text',
      { ...event(), signature: { checksum, properties: [1, 2] } },
    ],
    [
      'an empty list of properties',
      { ...event(), signature: { checksum, properties: [] } },
    ],
    [
      'a property that does not exist',
      { ...event(), signature: { checksum, properties: ['transaction.nope'] } },
    ],
    [
      'a property that points to an object',
      { ...event(), signature: { checksum, properties: ['transaction'] } },
    ],
    [
      'a property that walks the prototype chain',
      {
        ...event(),
        signature: { checksum, properties: ['transaction.constructor.name'] },
      },
    ],
  ])('rejects %s as INVALID_SIGNATURE', (_label, body) => {
    expect(parseGatewayEvent(body, secret)).toEqual(err('INVALID_SIGNATURE'));
  });

  describe('with a valid signature', () => {
    // Signs whatever is sent, like the gateway would.
    const signed = (body: ReturnType<typeof event>) => {
      const { createHash } =
        jest.requireActual<typeof import('node:crypto')>('node:crypto');
      const tx = body.data.transaction as Record<string, unknown>;
      const values = body.signature.properties
        .map((path) => String(tx[path.replace('transaction.', '')]))
        .join('');
      return {
        ...body,
        signature: {
          ...body.signature,
          checksum: createHash('sha256')
            .update(`${values}${body.timestamp}${secret}`)
            .digest('hex'),
        },
      };
    };

    it('reports UNSUPPORTED_EVENT for other event types', () => {
      const other = signed(event({ event: 'nequi_token.updated' }));

      expect(parseGatewayEvent(other, secret)).toEqual(
        err('UNSUPPORTED_EVENT'),
      );
    });

    it('reports MALFORMED_EVENT when the reference is missing', () => {
      const body = event();
      const noReference = signed({
        ...body,
        data: {
          transaction: { ...body.data.transaction, reference: undefined },
        },
      } as unknown as ReturnType<typeof event>);

      expect(parseGatewayEvent(noReference, secret)).toEqual(
        err('MALFORMED_EVENT'),
      );
    });

    it('reports MALFORMED_EVENT for a status the app does not know', () => {
      const body = event();
      const weird = signed({
        ...body,
        data: { transaction: { ...body.data.transaction, status: 'WEIRD' } },
      });

      expect(parseGatewayEvent(weird, secret)).toEqual(err('MALFORMED_EVENT'));
    });
  });
});
