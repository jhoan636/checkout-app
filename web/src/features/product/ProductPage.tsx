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
const PHOTO_SIZE = 960

/** `/products/aurora-headphones.webp` becomes `aurora-headphones`. */
const slugOf = (product: Product): string =>
  product.imageUrl.split('/').pop()?.replace(/\.\w+$/, '') ?? ''

/** If the photo cannot load, the coloured background stays as a clean fallback. */
function ProductPhoto({
  product,
  variant,
}: {
  product: Product
  variant: 'main' | 'thumb'
}) {
  const [failed, setFailed] = useState(false)
  const isMain = variant === 'main'

  if (failed) {
    return null
  }
  return (
    <img
      className={isMain ? 'product__photo' : 'switcher__photo'}
      src={product.imageUrl}
      // The thumbnail sits inside a button that already names the product.
      alt={isMain ? product.name : ''}
      width={PHOTO_SIZE}
      height={PHOTO_SIZE}
      decoding="async"
      loading={isMain ? 'eager' : 'lazy'}
      fetchPriority={isMain ? 'high' : 'auto'}
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

function ProductSwitcher({
  products,
  selectedId,
  onSelect,
}: {
  products: Product[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  return (
    <ul className="switcher" aria-label="Products">
      {products.map((product) => (
        <li key={product.id}>
          <button
            type="button"
            className="switcher__item"
            data-product={slugOf(product)}
            aria-label={product.name}
            aria-pressed={product.id === selectedId}
            onClick={() => onSelect(product.id)}
          >
            <ProductPhoto product={product} variant="thumb" />
          </button>
        </li>
      ))}
    </ul>
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

  if (status === 'failed') {
    return (
      <section className="notice" role="alert">
        <h2>We couldn't load the store</h2>
        <p>{error}</p>
        <button
          type="button"
          className="button"
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

  const product = items.find((item) => item.id === productId) ?? items[0]
  if (!product) {
    return (
      <section className="notice">
        <p>No products available right now.</p>
      </section>
    )
  }

  const maxUnits = Math.min(product.stock, MAX_UNITS_PER_PURCHASE)
  const soldOut = product.stock === 0

  const startCheckout = () => {
    // The first product is shown before the customer picks one explicitly.
    if (product.id !== productId) {
      dispatch(productSelected(product.id))
      dispatch(quantityChanged(quantity))
    }
    dispatch(checkoutStarted())
  }

  return (
    <section className="product" data-product={slugOf(product)}>
      <div className="product__stage">
        <ProductPhoto key={product.id} product={product} variant="main" />
      </div>

      <div className="product__panel">
        {items.length > 1 && (
          <ProductSwitcher
            products={items}
            selectedId={product.id}
            onSelect={(id) => dispatch(productSelected(id))}
          />
        )}

        <div className="product__meta">
          <StockBadge stock={product.stock} />
          {!soldOut && (
            <QuantityStepper
              quantity={Math.min(quantity, maxUnits)}
              max={maxUnits}
              onChange={(next) => dispatch(quantityChanged(next))}
            />
          )}
        </div>

        <h2 className="product__name">{product.name}</h2>
        <p className="product__description">{product.description}</p>

        <div className="dock">
          <div className="dock__price">
            <span className="dock__label">Each</span>
            <strong>{formatCop(product.priceInCents)}</strong>
          </div>
          <button
            type="button"
            className="button button--primary"
            disabled={soldOut}
            onClick={startCheckout}
          >
            Pay with credit card
          </button>
        </div>
      </div>
    </section>
  )
}
