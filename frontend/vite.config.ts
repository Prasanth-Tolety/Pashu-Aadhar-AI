import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['onnxruntime-web'],
  },
  assetsInclude: ['**/*.onnx'],
  server: {
    port: 3000,
    proxy: {
      '/upload-url': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/enroll': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
    headers: {
      // Required for SharedArrayBuffer used by ONNX WASM threads
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
