import { DetailsModal } from './features/details/DetailsModal'
import { ProductPage } from './features/product/ProductPage'
import { ProductsGate } from './features/product/ProductsGate'
import { useAppSelector } from './store/hooks'

function App() {
  const step = useAppSelector((state) => state.checkout.step)

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
          <ProductPage />
          {step === 'details' && <DetailsModal />}
        </ProductsGate>
      </main>
    </div>
  )
}

export default App
