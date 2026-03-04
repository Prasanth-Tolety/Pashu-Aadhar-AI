import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Forward API routes to the local mock server during development.
      // The frontend's VITE_API_BASE_URL should be left empty (or unset) so
      // that all API calls use relative paths and are captured by this proxy.
      // These paths match the API Gateway routes: GET /upload-url, POST /enroll.
      '/upload-url': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/enroll': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
