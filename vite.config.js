import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

function cleanDistPlugin() {
  return {
    name: 'clean-dist-plugin',
    renderChunk(code) {
      return code.replaceAll('localhost', '127.0.0.1')
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    cleanDistPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Mây An Nhiên — Du lịch & Đặt chỗ',
        short_name: 'Mây An Nhiên',
        description: 'Nền tảng đặt vé máy bay, khách sạn, combo du lịch và lập lịch trình AI trực tuyến.',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        theme_color: '#0194F3',
        background_color: '#0B1120',
        lang: 'vi',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5175,
    strictPort: true,
    watch: {
      ignored: ['**/ui-ux-pro-max-skill-main/**', '**/dist/**', '**/*.log'],
    },
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
