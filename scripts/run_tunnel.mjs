// scripts/run_tunnel.mjs — Persistent localtunnel runner for SePay Webhook
import localtunnel from 'localtunnel'

const PORT = 3001
const SUBDOMAIN = 'mayan-sepay'

async function startTunnel() {
  console.log(`[tunnel] Đang kết nối localtunnel tới cổng ${PORT}...`)
  try {
    const tunnel = await localtunnel({ port: PORT, subdomain: SUBDOMAIN })
    console.log(`[tunnel] KẾT NỐI THÀNH CÔNG!`)
    console.log(`[tunnel] URL Webhook Công khai: ${tunnel.url}/api/payment/sepay/webhook`)
    console.log(`[tunnel] URL Đang trực tiếp chuyển tiếp đến http://localhost:${PORT}`)

    tunnel.on('close', () => {
      console.warn('[tunnel] Tunnel bị đóng, đang tự động kết nối lại sau 3s...')
      setTimeout(startTunnel, 3000)
    })

    tunnel.on('error', (err) => {
      console.error('[tunnel] Lỗi tunnel:', err.message)
      setTimeout(startTunnel, 3000)
    })
  } catch (err) {
    console.error('[tunnel] Lỗi khởi động tunnel:', err.message)
    setTimeout(startTunnel, 5000)
  }
}

startTunnel()
