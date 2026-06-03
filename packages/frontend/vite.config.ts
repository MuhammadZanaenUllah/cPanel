import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // API + WebSocket terminal (ws:// upgrade handled automatically by Vite)
      '/cpanel': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,   // enable WebSocket proxying for /cpanel/terminal/ws
      },
      '/whm':       { target: 'http://localhost:3000', changeOrigin: true },
      '/dev-token': { target: 'http://localhost:3000', changeOrigin: true },
      '/admin':     { target: 'http://localhost:3000', changeOrigin: true },

      // Webmail — strip X-Frame-Options so iframe works in dev
      '/webmail': {
        target: 'http://localhost:2096',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            delete proxyRes.headers['x-frame-options'];
            delete proxyRes.headers['content-security-policy'];
          });
        },
      },
    },
  },
})
