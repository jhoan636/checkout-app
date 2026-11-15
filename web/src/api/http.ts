import type { ApiError, ApiResult } from './types'

export interface Http {
  get<T>(path: string): Promise<ApiResult<T>>
  post<T>(
    path: string,
    body: unknown,
    headers?: Record<string, string>,
  ): Promise<ApiResult<T>>
}

const NETWORK_ERROR: ApiError = {
  status: 0,
  code: 'NETWORK_ERROR',
  message: 'Check your connection and try again.',
}

const FALLBACK_MESSAGE = 'The request could not be completed.'

const readError = async (response: Response): Promise<ApiError> => {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown
    message?: unknown
  } | null

  // Validation errors arrive as a list of messages.
  const message = Array.isArray(body?.message)
    ? body.message.join('. ')
    : body?.message

  return {
    status: response.status,
    code: typeof body?.error === 'string' ? body.error : 'HTTP_ERROR',
    message: typeof message === 'string' ? message : FALLBACK_MESSAGE,
  }
}

/**
 * Small wrapper over fetch. Every outcome comes back as a value, so callers
 * handle failures explicitly instead of catching exceptions.
 */
export const createHttp = (
  baseUrl: string,
  httpFetch: typeof fetch = (...args) => fetch(...args),
): Http => {
  const root = baseUrl.replace(/\/+$/, '')

  const send = async <T>(path: string, init: RequestInit): Promise<ApiResult<T>> => {
    try {
      const response = await httpFetch(`${root}${path}`, init)
      if (!response.ok) {
        return { ok: false, error: await readError(response) }
      }
      return { ok: true, data: (await response.json()) as T }
    } catch {
      return { ok: false, error: NETWORK_ERROR }
    }
  }

  return {
    get: (path) => send(path, { method: 'GET' }),
    post: (path, body, headers = {}) =>
      send(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify(body),
      }),
  }
}
