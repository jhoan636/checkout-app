import '@fontsource-variable/geist'
import '@fontsource/unbounded/700.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { createCheckoutApi } from './api/checkout-api'
import { createPaymentGateway } from './api/gateway'
import { createHttp } from './api/http'
import App from './App.tsx'
import { config } from './config'
import { newId, wait } from './lib/runtime'
import { createAppStore } from './store/store'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'

const store = createAppStore({
  api: createCheckoutApi(createHttp(config.apiUrl)),
  gateway: createPaymentGateway(config.gatewayUrl, config.gatewayPublicKey),
  newId,
  wait,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </StrictMode>,
)
