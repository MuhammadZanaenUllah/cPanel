import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 2087,
    proxy: {
      '/whm': 'http://localhost:3000',
      '/dev-token': 'http://localhost:3000',
    }
  }
});
