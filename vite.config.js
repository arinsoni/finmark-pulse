import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Where /api/* is proxied. Default = a local backend (classic dev).
// `npm run live` sets this to the production API so you can run Pulse on your
// Mac against LIVE data with no hosting/SSH (see package.json).
const API_TARGET = process.env.PULSE_API_TARGET || 'http://localhost:5001'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: API_TARGET,
        changeOrigin: true,
        secure: true,
        cookieDomainRewrite: 'localhost',
        // The prod refresh cookie is Secure + SameSite=Strict — neither works on
        // http://localhost. Relax it for local dev so the 7-day session persists
        // (you log in once, then silent refresh — CAPTCHA login ~once a week).
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const sc = proxyRes.headers['set-cookie']
            if (sc) {
              proxyRes.headers['set-cookie'] = sc.map((c) =>
                c.replace(/;\s*Secure/gi, '').replace(/SameSite=Strict/gi, 'SameSite=Lax')
              )
            }
          })
        },
      },
    },
  },
})
