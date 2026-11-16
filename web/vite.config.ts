import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')

  return {
    plugins: [react()],
    // Read once here so the app code never touches import.meta.env directly.
    define: {
      __API_URL__: JSON.stringify(env.VITE_API_URL ?? 'http://localhost:3000'),
      __GATEWAY_URL__: JSON.stringify(env.VITE_GATEWAY_URL ?? ''),
      __GATEWAY_PUBLIC_KEY__: JSON.stringify(env.VITE_GATEWAY_PUBLIC_KEY ?? ''),
      // Redux DevTools show the whole state, so the production build has none.
      __DEV_TOOLS__: JSON.stringify(mode !== 'production'),
    },
  }
})
