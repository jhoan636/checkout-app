import { CardCharge } from '../../application/ports/payment-gateway';
import { err, ok } from '../../domain/shared/result';
import { GatewayConfig, HttpPaymentGateway } from './http-payment-gateway';
import { buildIntegritySignature } from './integrity-signature';

const config: GatewayConfig = {
  baseUrl: 'https://gateway.test/v1',
  privateKey: 'prv_test_key',
  integritySecret: 'test_integrity_secret',
  timeoutMs: 5_000,
};

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

const jsonResponse = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const approved = {
  data: { id: 'gw-123', status: 'APPROVED', reference: 'ORDER-0001' },
};

const gatewayWith = (fetchMock: jest.Mock) =>
  new HttpPaymentGateway(config, fetchMock);

const sentRequest = (fetchMock: jest.Mock) => {
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return {
    url,
    method: init.method,
    headers: init.headers as Record<string, string>,
    body: init.body ? (JSON.parse(init.body as string) as unknown) : undefined,
  };
};

describe('HttpPaymentGateway', () => {
  describe('createCardTransaction', () => {
    it('posts the charge with the private key and the integrity signature', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(jsonResponse(201, approved));

      await gatewayWith(fetchMock).createCardTransaction(charge);

      expect(sentRequest(fetchMock)).toEqual({
        url: 'https://gateway.test/v1/transactions',
        method: 'POST',
        headers: {
          authorization: 'Bearer prv_test_key',
          'content-type': 'application/json',
        },
        body: {
          amount_in_cents: 50_500_000,
          currency: 'COP',
          signature: buildIntegritySignature(charge, config.integritySecret),
          customer_email: 'buyer@example.com',
          reference: 'ORDER-0001',
          acceptance_token: 'acceptance-token',
          accept_personal_auth: 'personal-auth-token',
          payment_method: {
            type: 'CARD',
            token: 'tok_test_123',
            installments: 1,
          },
        },
      });
    });

    it('returns the gateway transaction on success', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(jsonResponse(201, approved));

      await expect(
        gatewayWith(fetchMock).createCardTransaction(charge),
      ).resolves.toEqual(
        ok({ id: 'gw-123', status: 'APPROVED', reference: 'ORDER-0001' }),
      );
    });

    it('keeps PENDING when the gateway has not decided yet', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(201, {
          data: { id: 'gw-123', status: 'PENDING', reference: 'ORDER-0001' },
        }),
      );

      await expect(
        gatewayWith(fetchMock).createCardTransaction(charge),
      ).resolves.toMatchObject({ value: { status: 'PENDING' } });
    });

    it.each([400, 401, 404, 422])(
      'reports GATEWAY_REJECTED when the gateway answers %s',
      async (status) => {
        const fetchMock = jest
          .fn()
          .mockResolvedValue(jsonResponse(status, { error: { type: 'X' } }));

        await expect(
          gatewayWith(fetchMock).createCardTransaction(charge),
        ).resolves.toEqual(err('GATEWAY_REJECTED'));
      },
    );

    it.each([500, 502, 503])(
      'reports GATEWAY_UNAVAILABLE when the gateway answers %s',
      async (status) => {
        const fetchMock = jest.fn().mockResolvedValue(jsonResponse(status, {}));

        await expect(
          gatewayWith(fetchMock).createCardTransaction(charge),
        ).resolves.toEqual(err('GATEWAY_UNAVAILABLE'));
      },
    );

    it('reports GATEWAY_UNAVAILABLE on a network error or timeout', async () => {
      const fetchMock = jest.fn().mockRejectedValue(new Error('timeout'));

      await expect(
        gatewayWith(fetchMock).createCardTransaction(charge),
      ).resolves.toEqual(err('GATEWAY_UNAVAILABLE'));
    });

    it('sets a timeout on the request', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(jsonResponse(201, approved));

      await gatewayWith(fetchMock).createCardTransaction(charge);

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(init.signal).toBeInstanceOf(AbortSignal);
    });

    it.each([
      ['a body that is not JSON', new Response('<html>', { status: 200 })],
      ['a body without data', jsonResponse(200, {})],
      ['a missing id', jsonResponse(200, { data: { status: 'APPROVED' } })],
      [
        'an unknown status',
        jsonResponse(200, {
          data: { id: 'gw-1', status: 'WEIRD', reference: 'ORDER-0001' },
        }),
      ],
    ])('reports GATEWAY_INVALID_RESPONSE for %s', async (_label, response) => {
      const fetchMock = jest.fn().mockResolvedValue(response);

      await expect(
        gatewayWith(fetchMock).createCardTransaction(charge),
      ).resolves.toEqual(err('GATEWAY_INVALID_RESPONSE'));
    });
  });

  describe('findTransaction', () => {
    it('queries the transaction by id with the private key', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(jsonResponse(200, approved));

      const result = await gatewayWith(fetchMock).findTransaction('gw-123');

      expect(result).toEqual(
        ok({ id: 'gw-123', status: 'APPROVED', reference: 'ORDER-0001' }),
      );
      expect(sentRequest(fetchMock)).toMatchObject({
        url: 'https://gateway.test/v1/transactions/gw-123',
        method: 'GET',
        headers: { authorization: 'Bearer prv_test_key' },
      });
    });

    it('escapes the id so it cannot change the request path', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(404, {}));

      await gatewayWith(fetchMock).findTransaction('../merchants/x');

      expect(sentRequest(fetchMock).url).toBe(
        'https://gateway.test/v1/transactions/..%2Fmerchants%2Fx',
      );
    });

    it('reports GATEWAY_UNAVAILABLE when the query fails', async () => {
      const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

      await expect(
        gatewayWith(fetchMock).findTransaction('gw-123'),
      ).resolves.toEqual(err('GATEWAY_UNAVAILABLE'));
    });
  });

  describe('findTransactionByReference', () => {
    const found = { data: [approved.data] };

    it('searches by reference with the private key', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, found));

      const result =
        await gatewayWith(fetchMock).findTransactionByReference('ORDER-0001');

      expect(result).toEqual(
        ok({ id: 'gw-123', status: 'APPROVED', reference: 'ORDER-0001' }),
      );
      expect(sentRequest(fetchMock)).toMatchObject({
        url: 'https://gateway.test/v1/transactions?reference=ORDER-0001',
        method: 'GET',
        headers: { authorization: 'Bearer prv_test_key' },
      });
    });

    it('answers null when the gateway has no charge with that reference', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(jsonResponse(200, { data: [] }));

      await expect(
        gatewayWith(fetchMock).findTransactionByReference('ORDER-0001'),
      ).resolves.toEqual(ok(null));
    });

    it('escapes the reference so it cannot add parameters to the query', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(jsonResponse(200, { data: [] }));

      await gatewayWith(fetchMock).findTransactionByReference('a&status=x');

      expect(sentRequest(fetchMock).url).toBe(
        'https://gateway.test/v1/transactions?reference=a%26status%3Dx',
      );
    });

    it.each([{ data: {} }, {}, null, { data: [{ id: 1 }] }])(
      'reports GATEWAY_INVALID_RESPONSE for an answer it cannot read: %j',
      async (body) => {
        const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, body));

        await expect(
          gatewayWith(fetchMock).findTransactionByReference('ORDER-0001'),
        ).resolves.toEqual(err('GATEWAY_INVALID_RESPONSE'));
      },
    );

    it('reports GATEWAY_UNAVAILABLE when the search fails', async () => {
      const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

      await expect(
        gatewayWith(fetchMock).findTransactionByReference('ORDER-0001'),
      ).resolves.toEqual(err('GATEWAY_UNAVAILABLE'));
    });
  });
});
