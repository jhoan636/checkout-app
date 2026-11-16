import type { ReactNode } from 'react'
import type { TransactionStatus } from '../../api/types'
import { formatCop } from '../../lib/money'
import { checkoutFinished } from '../../store/checkout.slice'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { loadProducts, selectProductById } from '../../store/products.slice'
import { checkPayment, pay } from '../../store/transaction.slice'
import './status.css'

type Tone = 'ok' | 'bad' | 'wait'

/** What to tell the customer for each final answer of the gateway. */
const RESULTS: Record<
  Exclude<TransactionStatus, 'PENDING'>,
  { tone: Tone; title: string; text: string }
> = {
  APPROVED: { tone: 'ok', title: 'Payment approved', text: '' },
  DECLINED: {
    tone: 'bad',
    title: 'Payment declined',
    text: 'Your card was not charged. You can try again with another card.',
  },
  ERROR: {
    tone: 'bad',
    title: 'Payment not completed',
    text: 'Something went wrong with the payment and your card was not charged.',
  },
  VOIDED: {
    tone: 'bad',
    title: 'Payment cancelled',
    text: 'The payment was cancelled and your card was not charged.',
  },
}

const ICONS: Record<Tone, string> = {
  ok: 'M6 12.5l4 4 8-9',
  bad: 'M7 7l10 10M17 7L7 17',
  wait: 'M12 7v5l3 2',
}

function StatusIcon({ tone }: { tone: Tone }) {
  return (
    <span className="status__icon" data-tone={tone} aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 24 24">
        <path
          d={ICONS[tone]}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function Result({
  tone,
  title,
  text,
  children,
}: {
  tone: Tone
  title: string
  text: string | null
  children: ReactNode
}) {
  return (
    <section className="status" aria-live="polite">
      <StatusIcon tone={tone} />
      <h2>{title}</h2>
      {text && <p className="status__text">{text}</p>}
      {children}
    </section>
  )
}

/** Fourth step of the checkout: how the payment ended. */
export function StatusPage() {
  const dispatch = useAppDispatch()
  const { productId, delivery } = useAppSelector((state) => state.checkout)
  const product = useAppSelector((state) => selectProductById(state, productId))
  const { transaction, phase, error, retryable } = useAppSelector(
    (state) => state.transaction,
  )

  // The stock is read again from the API, which is the one that changed it.
  const backToProduct = () => {
    dispatch(checkoutFinished())
    void dispatch(loadProducts())
  }

  const back = (
    <button type="button" className="button" onClick={backToProduct}>
      Back to the product
    </button>
  )

  const details = transaction && (
    <dl className="status__details">
      <div>
        <dt>{transaction.status === 'APPROVED' ? 'Total paid' : 'Total'}</dt>
        <dd>{formatCop(transaction.amountInCents)}</dd>
      </div>
      <div>
        <dt>Reference</dt>
        <dd>{transaction.reference}</dd>
      </div>
      {product && (
        <div>
          <dt>Product</dt>
          <dd>
            {product.name} × {transaction.quantity}
          </dd>
        </div>
      )}
    </dl>
  )

  if (phase === 'idle') {
    return null
  }

  if (phase === 'processing') {
    return (
      <section className="status" role="status">
        <span className="spinner" aria-hidden="true" />
        <h2>Processing your payment</h2>
        <p className="status__text">
          This takes a few seconds. Please keep this page open.
        </p>
      </section>
    )
  }

  if (phase === 'failed') {
    return (
      <Result tone="bad" title="We could not process the payment" text={error}>
        <div className="status__actions">
          {retryable && (
            <button
              type="button"
              className="button button--primary"
              onClick={() => void dispatch(pay())}
            >
              Try again
            </button>
          )}
          {/*
            While the outcome is unknown the only way forward is the same
            purchase again: starting a new one could charge the card twice.
          */}
          {!retryable && back}
        </div>
      </Result>
    )
  }

  if (phase === 'unconfirmed' || !transaction || transaction.status === 'PENDING') {
    return (
      <Result
        tone="wait"
        title="We are still confirming your payment"
        text="Your bank has not answered yet. Check again in a moment. Please do not start another purchase: this one may still be approved."
      >
        {details}
        <div className="status__actions">
          <button
            type="button"
            className="button button--primary"
            onClick={() => void dispatch(checkPayment())}
          >
            Check again
          </button>
        </div>
      </Result>
    )
  }

  const result = RESULTS[transaction.status]
  const text =
    transaction.status === 'APPROVED' && delivery
      ? `Your order will be delivered to ${[
          delivery.addressLine,
          delivery.city,
          delivery.region,
        ].join(', ')}.`
      : result.text

  return (
    <Result tone={result.tone} title={result.title} text={text}>
      {details}
      <div className="status__actions">
        <button
          type="button"
          className="button button--primary"
          onClick={backToProduct}
        >
          Back to the product
        </button>
      </div>
    </Result>
  )
}
