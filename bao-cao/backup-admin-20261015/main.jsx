import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Dọn dữ liệu test/QA còn sót trong localStorage trước khi render app.
// (Chạy mỗi lần mở trang — vô hại vì tài khoản demo thật không bị khớp.)
const isTestEmail = (email) => /qa[12]@example\.com/i.test(email || '')

try {
  const doomed = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith('may-an-nhien')) continue
    // Đơn của tài khoản test qa1/qa2
    if (key.startsWith('may-an-nhien-bookings:') && isTestEmail(key.slice('may-an-nhien-bookings:'.length))) {
      doomed.push(key)
    }
  }
  // Di tích từ version cũ: đơn test lưu chung key + key thông tin hành khách mẫu
  doomed.push('may-an-nhien-bookings')
  doomed.push('may-an-nhien-traveler')
  doomed.forEach((key) => localStorage.removeItem(key))

  // Phiên đăng nhập của tài khoản test
  const savedSession = JSON.parse(localStorage.getItem('may-an-nhien-session') || 'null')
  if (isTestEmail(savedSession?.email)) {
    localStorage.removeItem('may-an-nhien-session')
  }
} catch {
  // localStorage hỏng/không khả dụng: bỏ qua
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
