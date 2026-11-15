import { ProductPage } from './features/product/ProductPage'

function App() {
  return (
    <div className="app">
      <header className="app__bar">
        <span className="app__logo">onda</span>
      </header>
      <main className="app__main">
        <h1 className="visually-hidden">Product Checkout</h1>
        <ProductPage />
      </main>
    </div>
  )
}

export default App
