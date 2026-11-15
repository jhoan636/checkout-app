import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { loadProducts } from '../../store/products.slice'

/**
 * Loads the products once and shows the store only when they are ready.
 * Every screen behind it can count on the products being there.
 */
export function ProductsGate({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const { items, status, error } = useAppSelector((state) => state.products)

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

  return <>{children}</>
}
