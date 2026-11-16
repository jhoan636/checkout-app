import { useEffect } from 'react'
import { ProductPhoto } from '../../components/ProductPhoto'
import { StockBadge } from '../../components/StockBadge'
import { formatCop } from '../../lib/money'
import {
  checkoutStarted,
  MAX_UNITS_PER_PURCHASE,
  productSelected,
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

/**
 * The name is shown as a headline whose last word carries the accent colour.
 * The heading still reads as the plain name.
 */
function ProductName({ name }: { name: string }) {
  const words = name.trim().split(/\s+/)
  const last = words.pop()
  return (
    <h2 className="product__name">
      {words.length > 0 && `${words.join(' ')} `}
      <em>{last}</em>
    </h2>
  )
}

/** One product: what it is, what it costs, how many are left, and the way to pay. */
export function ProductPage() {
  const dispatch = useAppDispatch()
  const { productId, quantity } = useAppSelector((state) => state.checkout)
  // The store sells a single product.
  const product = useAppSelector((state) => state.products.items.at(0))

  // The checkout needs to know which product is being bought.
  useEffect(() => {
    if (product && product.id !== productId) {
      dispatch(productSelected(product.id))
    }
  }, [dispatch, product, productId])

  if (!product) {
    return null
  }

  const soldOut = product.stock === 0
  const max = Math.min(product.stock, MAX_UNITS_PER_PURCHASE)
  const units = Math.min(quantity, max)
  const total = product.priceInCents * units

  return (
    <section className="product">
      <div className="product__layout">
        <div className="product__intro">
          <p className="product__eyebrow">Featured product</p>
          <ProductName name={product.name} />
        </div>

        <div className="product__frame">
          <ProductPhoto product={product} className="product__photo" />
        </div>

        <div className="product__info">
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
