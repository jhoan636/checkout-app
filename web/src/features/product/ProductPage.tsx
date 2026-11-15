import { useEffect } from 'react'
import type { Product } from '../../api/types'
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

/** The rest of the store, one tap away from the product being shown. */
function MoreProducts({
  products,
  onShow,
}: {
  products: Product[]
  onShow: (id: string) => void
}) {
  if (products.length === 0) {
    return null
  }
  return (
    <section className="more" aria-labelledby="more-products">
      <h3 id="more-products">More products</h3>
      <ul className="more__list">
        {products.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="more__item"
              onClick={() => onShow(item.id)}
            >
              <span className="more__frame">
                <ProductPhoto product={item} className="more__photo" decorative />
              </span>
              <span className="more__name">{item.name}</span>
              <span className="more__price">
                {item.stock === 0 ? 'Sold out' : formatCop(item.priceInCents)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** One product: what it is, what it costs, how many are left, and the way to pay. */
export function ProductPage() {
  const dispatch = useAppDispatch()
  const { productId, quantity } = useAppSelector((state) => state.checkout)
  const items = useAppSelector((state) => state.products.items)

  // Without a choice, the first product that can be bought is shown.
  const product =
    items.find((item) => item.id === productId) ??
    items.find((item) => item.stock > 0) ??
    items[0]

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

      <MoreProducts
        products={items.filter((item) => item.id !== product.id)}
        onShow={(id) => dispatch(productSelected(id))}
      />

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
