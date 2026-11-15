import { useEffect } from 'react'
import { CatalogPage } from './features/catalog/CatalogPage'
import { ProductsGate } from './features/catalog/ProductsGate'
import { DetailsModal } from './features/details/DetailsModal'
import { ProductPage } from './features/product/ProductPage'
import { useAppSelector } from './store/hooks'

function App() {
  const step = useAppSelector((state) => state.checkout.step)
  const page = step === 'catalog' ? 'catalog' : 'product'

  // A new page starts at the top, not where the previous one was scrolled.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [page])

  return (
    <div className="app">
      <header className="app__bar">
        <div className="app__bar-inner">
          <span className="app__logo">onda</span>
          <span className="app__secure">
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 3l7 3v5.5c0 4.4-2.9 7.9-7 9.5-4.1-1.6-7-5.1-7-9.5V6l7-3z"
                fill="currentColor"
              />
            </svg>
            Secure payment
          </span>
        </div>
      </header>
      <main className="app__main">
        <h1 className="visually-hidden">Product Checkout</h1>
        <ProductsGate>
          {page === 'catalog' ? <CatalogPage /> : <ProductPage />}
          {step === 'details' && <DetailsModal />}
        </ProductsGate>
      </main>
    </div>
  )
}

export default App
