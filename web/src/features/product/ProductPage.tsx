import { useEffect } from 'react'
import { ProductPhoto } from '../../components/ProductPhoto'
import { StockBadge } from '../../components/StockBadge'
import { formatCop } from '../../lib/money'
import {
  catalogOpened,
  checkoutStarted,
  MAX_UNITS_PER_PURCHASE,
  quantityChanged,
} from '../../store/checkout.slice'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import './product.css'

function QuantityStepper({
  quantity,
  max,
  onChange,
}: {
  quantity: number
  max: number
  onChange: (quantity: number) => void
}) {
  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper__button"
        aria-label="Remove one unit"
        disabled={quantity <= 1}
        onClick={() => onChange(quantity - 1)}
      >
        −
      </button>
      <output className="stepper__value" aria-label="Quantity">
        {quantity}
      </output>
      <button
        type="button"
        className="stepper__button"
        aria-label="Add one unit"
        disabled={quantity >= max}
        onClick={() => onChange(quantity + 1)}
      >
        +
      </button>
    </div>
  )
}

/** One product: what it is, what it costs, how many are left, and the way to pay. */
export function ProductPage() {
  const dispatch = useAppDispatch()
  const { productId, quantity } = useAppSelector((state) => state.checkout)
  const product = useAppSelector((state) =>
    state.products.items.find((item) => item.id === productId),
  )

  // A product that is no longer in the store sends the customer back.
  useEffect(() => {
    if (!product) {
      dispatch(catalogOpened())
    }
  }, [dispatch, product])

  if (!product) {
    return null
  }

  const soldOut = product.stock === 0
  const max = Math.min(product.stock, MAX_UNITS_PER_PURCHASE)
  const units = Math.min(quantity, max)
  const total = product.priceInCents * units

  return (
    <section className="product">
      <button
        type="button"
        className="product__back"
        onClick={() => dispatch(catalogOpened())}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M15 5l-7 7 7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        All products
      </button>

      <div className="product__layout">
        <div className="product__frame">
          <ProductPhoto product={product} className="product__photo" eager />
        </div>

        <div className="product__info">
          <h2>{product.name}</h2>
          <div className="product__row">
            <strong className="product__price" data-testid="price">
              {formatCop(product.priceInCents)}
            </strong>
            <StockBadge stock={product.stock} />
          </div>
          <p className="product__description">{product.description}</p>

          {!soldOut && (
            <div className="product__quantity">
              <span>Units</span>
              <QuantityStepper
                quantity={units}
                max={max}
                onChange={(next) => dispatch(quantityChanged(next))}
              />
            </div>
          )}

          <p className="product__note">
            Fees and delivery are shown before you pay.
          </p>
        </div>
      </div>

      <footer className="bar">
        <div className="bar__inner">
          <div className="bar__total">
            <span>Total</span>
            <strong data-testid="total">{formatCop(total)}</strong>
          </div>
          <button
            type="button"
            className="button button--primary"
            disabled={soldOut}
            onClick={() => dispatch(checkoutStarted())}
          >
            Pay with credit card
          </button>
        </div>
      </footer>
    </section>
  )
}
