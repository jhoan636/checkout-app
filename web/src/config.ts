/**
 * Values injected at build time by Vite (see vite.config.ts). None of them is
 * secret: the gateway public key is designed to live in the browser.
 */
export const config = {
  apiUrl: __API_URL__,
  gatewayUrl: __GATEWAY_URL__,
  gatewayPublicKey: __GATEWAY_PUBLIC_KEY__,
  devTools: __DEV_TOOLS__,
}
