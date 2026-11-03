import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: true,
    // Proxy CHỈ dùng cho development. Ở production frontend gọi cùng origin
    // (đảo ngược proxy của server) hoặc đặt biến môi trường VITE_API_BASE.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
