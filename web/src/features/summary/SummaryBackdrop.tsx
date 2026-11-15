import { useEffect, useState } from 'react'
import { BrandLogo } from '../../components/BrandLogo'
import { Modal } from '../../components/Modal'
import { formatCop } from '../../lib/money'
import { paymentStarted, summaryClosed } from '../../store/checkout.slice'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { loadQuote } from '../../store/payment.slice'
import { selectProductById } from '../../store/products.slice'
import './summary.css'

/**
 * Last look before paying: what is charged and why, where it goes and with
 * which card. It sits on a backdrop over the product page.
 */
export function SummaryBackdrop() {
  const dispatch = useAppDispatch()
  const { productId, customer, delivery, card } = useAppSelector(
    (state) => state.checkout,
  )
  const product = useAppSelector((state) => selectProductById(state, productId))
  const { summary, acceptance, status, error } = useAppSelector(
    (state) => state.payment,
  )
  const [acceptsTerms, setAcceptsTerms] = useState(false)
  const [acceptsDataPolicy, setAcceptsDataPolicy] = useState(false)

  // The amounts are always asked again: stock and prices may have changed.
  useEffect(() => {
    void dispatch(loadQuote())
  }, [dispatch])

  if (!product || !customer || !delivery || !card) {
    return null
  }

  const back = () => dispatch(summaryClosed())
  const ready = status === 'ready' && summary !== null && acceptance !== null

  return (
    <Modal className="summary" labelledBy="summary-title" onClose={back}>
      <header className="summary__head">
        <button
          type="button"
          className="summary__back"
          aria-label="Back to details"
          onClick={back}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M15 5l-7 7 7 7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <h2 id="summary-title">Payment summary</h2>
      </header>

      {status === 'failed' && (
        <div className="summary__state" role="alert">
          <p>{error}</p>
          <button
            type="button"
            className="button button--primary"
            onClick={() => void dispatch(loadQuote())}
          >
            Try again
          </button>
        </div>
      )}

      {!ready && status !== 'failed' && (
        <div className="summary__state" role="status">
          <span className="spinner" aria-hidden="true" />
          <p>Calculating your total</p>
        </div>
      )}

      {ready && (
        <>
          <div className="summary__body">
            <dl className="summary__amounts">
              <div className="summary__row">
                <dt>
                  {product.name} × {summary.quantity}
                </dt>
                <dd>{formatCop(summary.subtotalInCents)}</dd>
              </div>
              <div className="summary__row">
                <dt>Base fee</dt>
                <dd>{formatCop(summary.baseFeeInCents)}</dd>
              </div>
              <div className="summary__row">
                <dt>Delivery fee</dt>
                <dd>{formatCop(summary.deliveryFeeInCents)}</dd>
              </div>
              <div className="summary__row summary__row--total">
                <dt>Total</dt>
                <dd>{formatCop(summary.totalInCents)}</dd>
              </div>
            </dl>

            <div className="summary__facts">
              <section className="summary__fact">
                <h3>Deliver to</h3>
                <p>{customer.fullName}</p>
                <p className="summary__muted">
                  {[delivery.addressLine, delivery.city, delivery.region].join(', ')}
                </p>
              </section>
              <section className="summary__fact">
                <h3>Pay with</h3>
                <p className="summary__card">
                  <BrandLogo brand={card.brand} />
                  <span>•••• {card.lastFour}</span>
                </p>
              </section>
            </div>

            <fieldset className="summary__consent">
              <legend className="visually-hidden">Conditions of the payment</legend>
              <label>
                <input
                  type="checkbox"
                  checked={acceptsTerms}
                  onChange={(event) => setAcceptsTerms(event.target.checked)}
                />
                <span>
                  I accept the{' '}
                  <a href={acceptance.termsUrl} target="_blank" rel="noopener noreferrer">
                    terms and conditions
                  </a>
                </span>
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={acceptsDataPolicy}
                  onChange={(event) => setAcceptsDataPolicy(event.target.checked)}
                />
                <span>
                  I authorize the{' '}
                  <a
                    href={acceptance.personalDataUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    processing of my personal data
                  </a>
                </span>
              </label>
            </fieldset>
          </div>

          <footer className="summary__foot">
            <button
              type="button"
              className="button button--primary"
              disabled={!acceptsTerms || !acceptsDataPolicy}
              onClick={() => dispatch(paymentStarted())}
            >
              Pay {formatCop(summary.totalInCents)}
            </button>
          </footer>
        </>
      )}
    </Modal>
  )
}
