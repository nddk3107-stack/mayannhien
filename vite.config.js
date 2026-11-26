import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

function cleanDistPlugin() {
  return {
    name: 'clean-dist-plugin',
    renderChunk(code) {
      return code.replaceAll('localhost', '127.0.0.1')
    },
  }
}

export default defineConfig({
  plugins: [react(), cleanDistPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: true,
    watch: {
      ignored: ['**/ui-ux-pro-max-skill-main/**', '**/dist/**', '**/*.log'],
    },
    // Proxy CHỈ dùng cho development. Ở production frontend gọi cùng origin
    // (đảo ngược proxy của server) hoặc đặt biến môi trường VITE_API_BASE.
    proxy: {
      '/api': {
        target: process.env.VITE_DEV_API || 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
      '/uploads': {
        target: process.env.VITE_DEV_API || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
