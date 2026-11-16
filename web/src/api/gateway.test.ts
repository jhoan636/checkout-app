import { createPaymentGateway } from './gateway'

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response

const setup = (fetchMock: jest.Mock) =>
  createPaymentGateway(
    'https://gateway.test/v1/',
    'pub_test_key',
    fetchMock as unknown as typeof fetch,
  )

const card = {
  number: '4242424242424242',
  cvc: '123',
  expMonth: '12',
  expYear: '28',
  cardHolder: 'Ana Maria Perez',
}

describe('payment gateway client', () => {
  describe('tokenizeCard', () => {
    it('exchanges the card for a token using only the public key', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValue(jsonResponse(201, { data: { id: 'tok_test_1' } }))

      const result = await setup(fetchMock).tokenizeCard(card)

      expect(result).toEqual({ ok: true, data: { token: 'tok_test_1' } })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://gateway.test/v1/tokens/cards',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer pub_test_key',
          },
          body: JSON.stringify({
            number: '4242424242424242',
            cvc: '123',
            exp_month: '12',
            exp_year: '28',
            card_holder: 'Ana Maria Perez',
          }),
        }),
      )
    })

    it('says the card was not accepted when the gateway rejects it', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(422, {
          error: { type: 'INPUT_VALIDATION_ERROR', messages: { number: ['x'] } },
        }),
      )

      await expect(setup(fetchMock).tokenizeCard(card)).resolves.toEqual({
        ok: false,
        error: {
          status: 422,
          code: 'CARD_REJECTED',
          message: 'The card was not accepted. Check its details and try again.',
        },
      })
    })

    it('says the processor is unavailable for any other failure', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(500, {}))

      await expect(setup(fetchMock).tokenizeCard(card)).resolves.toEqual({
        ok: false,
        error: {
          status: 500,
          code: 'GATEWAY_UNAVAILABLE',
          message: 'The payment processor is not available. Try again in a moment.',
        },
      })
    })

    it('keeps the connection message when the request never leaves', async () => {
      const fetchMock = jest.fn().mockRejectedValue(new TypeError('offline'))

      const result = await setup(fetchMock).tokenizeCard(card)

      expect(result).toMatchObject({
        ok: false,
        error: { status: 0, code: 'NETWORK_ERROR' },
      })
    })

    it.each([[{}], [{ data: {} }], [{ data: { id: '' } }], [{ data: { id: 7 } }]])(
      'does not trust an answer without a token: %j',
      async (body) => {
        const fetchMock = jest.fn().mockResolvedValue(jsonResponse(201, body))

        await expect(setup(fetchMock).tokenizeCard(card)).resolves.toMatchObject({
          ok: false,
          error: { code: 'GATEWAY_UNAVAILABLE' },
        })
      },
    )
  })

  describe('getAcceptance', () => {
    const merchant = {
      data: {
        presigned_acceptance: {
          acceptance_token: 'acc-token',
          permalink: 'https://gateway.test/terms.pdf',
        },
        presigned_personal_data_auth: {
          acceptance_token: 'data-token',
          permalink: 'https://gateway.test/personal-data.pdf',
        },
      },
    }

    it('reads the acceptance tokens and the documents they refer to', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, merchant))

      const result = await setup(fetchMock).getAcceptance()

      expect(result).toEqual({
        ok: true,
        data: {
          acceptanceToken: 'acc-token',
          personalDataAuthToken: 'data-token',
          termsUrl: 'https://gateway.test/terms.pdf',
          personalDataUrl: 'https://gateway.test/personal-data.pdf',
        },
      })
      expect(fetchMock).toHaveBeenCalledWith(
        'https://gateway.test/v1/merchants/pub_test_key',
        expect.objectContaining({ method: 'GET' }),
      )
    })

    it('says the processor is unavailable when the request fails', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(404, {}))

      await expect(setup(fetchMock).getAcceptance()).resolves.toMatchObject({
        ok: false,
        error: { status: 404, code: 'GATEWAY_UNAVAILABLE' },
      })
    })

    it('does not trust an answer with a missing token', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: { presigned_acceptance: merchant.data.presigned_acceptance },
        }),
      )

      await expect(setup(fetchMock).getAcceptance()).resolves.toMatchObject({
        ok: false,
        error: { code: 'GATEWAY_UNAVAILABLE' },
      })
    })

    // The links end up in the page, so only real web addresses are allowed.
    it('does not trust a document link that is not https', async () => {
      const fetchMock = jest.fn().mockResolvedValue(
        jsonResponse(200, {
          data: {
            ...merchant.data,
            presigned_acceptance: {
              acceptance_token: 'acc-token',
              permalink: 'javascript:alert(1)',
            },
          },
        }),
      )

      await expect(setup(fetchMock).getAcceptance()).resolves.toMatchObject({
        ok: false,
        error: { code: 'GATEWAY_UNAVAILABLE' },
      })
    })
  })
})
