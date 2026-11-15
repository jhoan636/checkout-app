import { createHttp } from './http'
import type { ApiError, ApiResult } from './types'

/** The card exactly as the gateway needs it. It only ever travels to the gateway. */
export interface CardData {
  number: string
  cvc: string
  expMonth: string
  expYear: string
  cardHolder: string
}

/**
 * Proof that the customer accepted the gateway's terms and its personal data
 * policy, plus the documents they were shown.
 */
export interface Acceptance {
  acceptanceToken: string
  personalDataAuthToken: string
  termsUrl: string
  personalDataUrl: string
}

/** What the web app asks of the payment gateway, straight from the browser. */
export interface PaymentGateway {
  /** Exchanges the card for a one-use token, so the card never reaches our API. */
  tokenizeCard(card: CardData): Promise<ApiResult<{ token: string }>>
  getAcceptance(): Promise<ApiResult<Acceptance>>
}

const CARD_REJECTED = 'The card was not accepted. Check its details and try again.'
const UNAVAILABLE = 'The payment processor is not available. Try again in a moment.'

/** The gateway's own messages are never shown: they are replaced by ours. */
const unavailable = (status: number): ApiError => ({
  status,
  code: 'GATEWAY_UNAVAILABLE',
  message: UNAVAILABLE,
})

const translate = (error: ApiError): ApiError => {
  if (error.status === 0) {
    return error
  }
  if (error.status === 422) {
    return { status: 422, code: 'CARD_REJECTED', message: CARD_REJECTED }
  }
  return unavailable(error.status)
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null

const httpsUrl = (value: unknown): string | null => {
  const url = text(value)
  return url?.startsWith('https://') ? url : null
}

interface Presigned {
  acceptance_token?: unknown
  permalink?: unknown
}

export const createPaymentGateway = (
  baseUrl: string,
  publicKey: string,
  httpFetch?: typeof fetch,
): PaymentGateway => {
  const http = createHttp(baseUrl, httpFetch)

  return {
    async tokenizeCard(card) {
      const result = await http.post<{ data?: { id?: unknown } }>(
        '/tokens/cards',
        {
          number: card.number,
          cvc: card.cvc,
          exp_month: card.expMonth,
          exp_year: card.expYear,
          card_holder: card.cardHolder,
        },
        // The public key is made for the browser; the private one never is.
        { Authorization: `Bearer ${publicKey}` },
      )
      if (!result.ok) {
        return { ok: false, error: translate(result.error) }
      }
      const token = text(result.data.data?.id)
      return token
        ? { ok: true, data: { token } }
        : { ok: false, error: unavailable(200) }
    },

    async getAcceptance() {
      const result = await http.get<{
        data?: {
          presigned_acceptance?: Presigned
          presigned_personal_data_auth?: Presigned
        }
      }>(`/merchants/${encodeURIComponent(publicKey)}`)
      if (!result.ok) {
        return { ok: false, error: translate(result.error) }
      }
      const terms = result.data.data?.presigned_acceptance
      const personalData = result.data.data?.presigned_personal_data_auth
      const acceptanceToken = text(terms?.acceptance_token)
      const personalDataAuthToken = text(personalData?.acceptance_token)
      const termsUrl = httpsUrl(terms?.permalink)
      const personalDataUrl = httpsUrl(personalData?.permalink)

      if (!acceptanceToken || !personalDataAuthToken || !termsUrl || !personalDataUrl) {
        return { ok: false, error: unavailable(200) }
      }
      return {
        ok: true,
        data: { acceptanceToken, personalDataAuthToken, termsUrl, personalDataUrl },
      }
    },
  }
}
