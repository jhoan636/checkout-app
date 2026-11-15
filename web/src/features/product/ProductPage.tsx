import { useEffect, useState } from 'react'
import type { Product } from '../../api/types'
import { formatCop } from '../../lib/money'
import {
  checkoutStarted,
  MAX_UNITS_PER_PURCHASE,
  productSelected,
  quantityChanged,
} from '../../store/checkout.slice'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { loadProducts } from '../../store/products.slice'
import './product.css'

const LOW_STOCK = 3
/** Intrinsic size of the product photos; reserves the space before they load. */
const PHOTO_SIZE = 480

/** If the photo cannot load, the neutral frame stays as a clean fallback. */
function ProductPhoto({ product, eager }: { product: Product; eager: boolean }) {
  const [failed, setFailed] = useState(false)

  if (failed) {
    return null
  }
  return (
    <img
      className="card__photo"
      src={product.imageUrl}
      // Decorative here: the card already reads the product name aloud.
      alt=""
      width={PHOTO_SIZE}
      height={PHOTO_SIZE}
      decoding="async"
      // Only the first photos compete for bandwidth; the rest wait their turn.
      loading={eager ? 'eager' : 'lazy'}
      onError={() => setFailed(true)}
    />
  )
}

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="stock" data-level="none">
        Sold out
      </span>
    )
  }
  return (
    <span className="stock" data-level={stock <= LOW_STOCK ? 'low' : 'ok'}>
      {stock} in stock
    </span>
  )
}

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

function ProductCard({
  product,
  selected,
  quantity,
  eager,
  onSelect,
  onQuantity,
}: {
  product: Product
  selected: boolean
  quantity: number
  eager: boolean
  onSelect: () => void
  onQuantity: (quantity: number) => void
}) {
  const soldOut = product.stock === 0

  return (
    <li className="card" data-selected={selected} data-sold-out={soldOut}>
      <label className="card__main">
        <input
          type="radio"
          name="product"
          className="card__radio"
          checked={selected}
          disabled={soldOut}
          onChange={onSelect}
        />
        <span className="card__frame">
          <ProductPhoto product={product} eager={eager} />
        </span>
        <span className="card__body">
          <span className="card__name">{product.name}</span>
          <span className="card__description">{product.description}</span>
          <span className="card__row">
            <strong className="card__price">
              {formatCop(product.priceInCents)}
            </strong>
            <StockBadge stock={product.stock} />
          </span>
        </span>
      </label>

      {selected && (
        <div className="card__quantity">
          <span>Units</span>
          <QuantityStepper
            quantity={quantity}
            max={Math.min(product.stock, MAX_UNITS_PER_PURCHASE)}
            onChange={onQuantity}
          />
        </div>
      )}
    </li>
  )
}

export function ProductPage() {
  const dispatch = useAppDispatch()
  const { items, status, error } = useAppSelector((state) => state.products)
  const { productId, quantity } = useAppSelector((state) => state.checkout)

  useEffect(() => {
    if (status === 'idle') {
      void dispatch(loadProducts())
    }
  }, [dispatch, status])

  // The first product that can be bought is chosen for the customer.
  const fallback = items.find((item) => item.stock > 0)
  const chosen = items.find((item) => item.id === productId && item.stock > 0)
  const product = chosen ?? fallback

  useEffect(() => {
    if (product && product.id !== productId) {
      dispatch(productSelected(product.id))
    }
  }, [dispatch, product, productId])

  if (status === 'failed') {
    return (
      <section className="notice" role="alert">
        <h2>We couldn't load the store</h2>
        <p>{error}</p>
        <button
          type="button"
          className="button button--primary"
          onClick={() => void dispatch(loadProducts())}
        >
          Try again
        </button>
      </section>
    )
  }

  if (status !== 'ready') {
    return (
      <section className="notice" role="status">
        <span className="spinner" aria-hidden="true" />
        <p>Loading products</p>
      </section>
    )
  }

  if (items.length === 0) {
    return (
      <section className="notice">
        <p>No products available right now.</p>
      </section>
    )
  }

  const units = product
    ? Math.min(quantity, product.stock, MAX_UNITS_PER_PURCHASE)
    : 0
  const total = product ? product.priceInCents * units : 0

  return (
    <section className="store">
      <header className="store__head">
        <h2>Store</h2>
        <p>
          {items.length} {items.length === 1 ? 'product' : 'products'}
        </p>
      </header>

      <p className="store__note">Fees and delivery are shown before you pay.</p>

      <ul className="store__list" role="radiogroup" aria-label="Products">
        {items.map((item, index) => (
          <ProductCard
            key={item.id}
            product={item}
            selected={item.id === product?.id}
            quantity={units}
            eager={index < 2}
            onSelect={() => dispatch(productSelected(item.id))}
            onQuantity={(next) => dispatch(quantityChanged(next))}
          />
        ))}
      </ul>

      <footer className="bar">
        <div className="bar__inner">
          <div className="bar__total">
            <span>Total</span>
            <strong data-testid="total">{formatCop(total)}</strong>
          </div>
          <button
            type="button"
            className="button button--primary"
            disabled={!product}
            onClick={() => dispatch(checkoutStarted())}
          >
            Pay with credit card
          </button>
        </div>
      </footer>
    </section>
  )
}
