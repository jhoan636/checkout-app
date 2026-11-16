import { createHttp, REQUEST_TIMEOUT_MS } from './http'

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  }) as Response

const setup = (fetchMock: jest.Mock) =>
  createHttp('https://api.test', fetchMock as unknown as typeof fetch)

describe('createHttp', () => {
  it('returns the data of a successful GET', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { id: 1 }))

    await expect(setup(fetchMock).get('/products')).resolves.toEqual({
      ok: true,
      data: { id: 1 },
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/products',
      expect.objectContaining({ method: 'GET' }),
    )
  })

  it('posts JSON with extra headers', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(201, { id: 2 }))

    await setup(fetchMock).post('/transactions', { quantity: 1 }, {
      'Idempotency-Key': 'key-1',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.test/transactions',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'key-1' },
        body: '{"quantity":1}',
      }),
    )
  })

  it('returns the error code and message sent by the API', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(409, {
        statusCode: 409,
        error: 'INSUFFICIENT_STOCK',
        message: 'There are not enough units in stock.',
      }),
    )

    await expect(setup(fetchMock).get('/x')).resolves.toEqual({
      ok: false,
      error: {
        status: 409,
        code: 'INSUFFICIENT_STOCK',
        message: 'There are not enough units in stock.',
      },
    })
  })

  it('joins the list of validation messages into one', async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      jsonResponse(400, {
        statusCode: 400,
        error: 'Bad Request',
        message: ['quantity must not be less than 1', 'email must be an email'],
      }),
    )

    const result = await setup(fetchMock).get('/x')

    expect(result).toMatchObject({
      error: {
        code: 'Bad Request',
        message: 'quantity must not be less than 1. email must be an email',
      },
    })
  })

  it('reports HTTP_ERROR when the error body cannot be read', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not json')),
    })

    await expect(setup(fetchMock).get('/x')).resolves.toEqual({
      ok: false,
      error: {
        status: 502,
        code: 'HTTP_ERROR',
        message: 'The request could not be completed.',
      },
    })
  })

  it('reports NETWORK_ERROR when there is no connection', async () => {
    const fetchMock = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'))

    await expect(setup(fetchMock).get('/x')).resolves.toEqual({
      ok: false,
      error: {
        status: 0,
        code: 'NETWORK_ERROR',
        message: 'Check your connection and try again.',
      },
    })
  })

  describe('when the server does not answer', () => {
    /** A request that only ends when it is cancelled, like a hung server. */
    const hangingFetch = () =>
      jest.fn(
        (_url: string, init: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init.signal?.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError')),
            )
          }),
      )

    beforeEach(() => jest.useFakeTimers())
    afterEach(() => jest.useRealTimers())

    it('cancels the request and reports TIMEOUT', async () => {
      const result = setup(hangingFetch()).get('/products')

      await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS)

      await expect(result).resolves.toEqual({
        ok: false,
        error: {
          status: 0,
          code: 'TIMEOUT',
          message: 'The request took too long. Try again.',
        },
      })
    })

    it('keeps waiting until the time is over', async () => {
      const fetchMock = hangingFetch()
      const settled = jest.fn()
      void setup(fetchMock).get('/products').then(settled)

      await jest.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1)

      expect(settled).not.toHaveBeenCalled()
      expect(fetchMock.mock.calls[0][1].signal?.aborted).toBe(false)
    })

    it('leaves no timer running after an answer', async () => {
      const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, {}))

      await setup(fetchMock).get('/products')

      expect(jest.getTimerCount()).toBe(0)
    })
  })

  it('removes a trailing slash from the base URL', async () => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, {}))

    await createHttp('https://api.test/', fetchMock as unknown as typeof fetch).get(
      '/products',
    )

    expect(fetchMock.mock.calls[0][0]).toBe('https://api.test/products')
  })

  it('uses the browser fetch when none is given', async () => {
    const original = globalThis.fetch
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(200, { id: 1 }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      await expect(createHttp('https://api.test').get('/products')).resolves.toEqual({
        ok: true,
        data: { id: 1 },
      })
    } finally {
      globalThis.fetch = original
    }
  })
})
