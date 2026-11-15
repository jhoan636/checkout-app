import '@fontsource-variable/geist'
import '@fontsource/unbounded/700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { createCheckoutApi } from './api/checkout-api'
import { createHttp } from './api/http'
import App from './App.tsx'
import { config } from './config'
import { createAppStore } from './store/store'
import './styles/tokens.css'
import './styles/base.css'

const store = createAppStore(createCheckoutApi(createHttp(config.apiUrl)))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
