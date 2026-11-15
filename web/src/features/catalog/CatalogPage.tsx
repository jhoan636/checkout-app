import type { Product } from '../../api/types'
import { ProductPhoto } from '../../components/ProductPhoto'
import { StockBadge } from '../../components/StockBadge'
import { formatCop } from '../../lib/money'
import { productSelected } from '../../store/checkout.slice'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import './catalog.css'

function ProductCard({
  product,
  eager,
  onOpen,
}: {
  product: Product
  eager: boolean
  onOpen: () => void
}) {
  return (
    <li>
      <button
        type="button"
        className="card"
        data-sold-out={product.stock === 0}
        onClick={onOpen}
      >
        <span className="card__frame">
          <ProductPhoto
            product={product}
            className="card__photo"
            eager={eager}
            decorative
          />
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
      </button>
    </li>
  )
}

/** The store: every product at a glance. Choosing one opens its page. */
export function CatalogPage() {
  const dispatch = useAppDispatch()
  const items = useAppSelector((state) => state.products.items)

  return (
    <section className="store">
      <header className="store__head">
        <h2>Store</h2>
        <p>
          {items.length} {items.length === 1 ? 'product' : 'products'}
        </p>
      </header>

      <ul className="store__list">
        {items.map((item, index) => (
          <ProductCard
            key={item.id}
            product={item}
            eager={index < 2}
            onOpen={() => dispatch(productSelected(item.id))}
          />
        ))}
      </ul>
    </section>
  )
}
