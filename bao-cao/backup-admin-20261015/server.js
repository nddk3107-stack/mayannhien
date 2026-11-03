import express from 'express'

const app = express()
// Có thể override bằng biến môi trường khi deploy (ví dụ Render/Railway)
const PORT = process.env.PORT || 3001

app.disable('x-powered-by')

// Security headers cơ bản cho mọi response
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  next()
})

// Dữ liệu catalog (nguồn dữ liệu chính cho frontend)
const flights = [
  {
    id: 'VN-184',
    airline: 'Vietnam Airlines',
    logo: 'VN',
    from: 'TP.HCM',
    to: 'Đà Nẵng',
    depart: '07:30',
    arrive: '08:50',
    duration: '1h 20m',
    price: 1290000,
    tag: 'Bay thẳng',
    hasPromo: true,
  },
  {
    id: 'VJ-642',
    airline: 'Vietjet Air',
    logo: 'VJ',
    from: 'TP.HCM',
    to: 'Hà Nội',
    depart: '10:15',
    arrive: '12:25',
    duration: '2h 10m',
    price: 1690000,
    tag: 'Giá tốt',
    hasPromo: true,
  },
  {
    id: 'QH-202',
    airline: 'Bamboo Airways',
    logo: 'QH',
    from: 'Hà Nội',
    to: 'Phú Quốc',
    depart: '14:40',
    arrive: '16:55',
    duration: '2h 15m',
    price: 1990000,
    tag: 'Có hành lý',
    hasPromo: false,
  },
]

const hotels = [
  {
    id: 'hotel-1',
    name: 'Marina Bay Đà Nẵng Resort',
    location: 'Biển Mỹ Khê, Đà Nẵng',
    rating: 9.2,
    stars: 5,
    price: 1850000,
    hasPromo: true,
    image: 'linear-gradient(180deg, rgba(6,24,44,.05), rgba(6,24,44,.55)), url(https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1100&q=90)',
    perks: ['Sát biển', 'Bữa sáng', 'Hồ bơi'],
  },
  {
    id: 'hotel-2',
    name: 'Sapa Cloud Boutique Hotel',
    location: 'Trung tâm Sa Pa',
    rating: 8.9,
    stars: 4,
    price: 990000,
    hasPromo: false,
    image: 'linear-gradient(180deg, rgba(6,24,44,.05), rgba(6,24,44,.58)), url(https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1100&q=90)',
    perks: ['View núi', 'Gần chợ', 'Miễn phí hủy'],
  },
  {
    id: 'hotel-3',
    name: 'Hanoi Old Quarter Stay',
    location: 'Phố cổ Hà Nội',
    rating: 9.0,
    stars: 4,
    price: 1250000,
    hasPromo: true,
    image: 'linear-gradient(180deg, rgba(6,24,44,.05), rgba(6,24,44,.58)), url(https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1100&q=90)',
    perks: ['Trung tâm', 'Family room', 'Ăn sáng'],
  },
]

const promos = [
  { id: 'p1', title: 'SALECUOITUAN', desc: 'Giảm thêm 12% cho khách sạn', color: 'blue' },
  { id: 'p2', title: 'BAYNGAY', desc: 'Mã vé máy bay nội địa từ 99K', color: 'orange' },
  { id: 'p3', title: 'COMBOHE', desc: 'Tiết kiệm đến 25% khi đặt combo', color: 'green' },
]

app.get('/api/travel', (req, res) => {
  res.json({
    hero: {
      title: 'Du lịch dễ dàng, chi phí tối ưu.',
      subtitle: 'Tìm kiếm khách sạn, vé máy bay, tour và trải nghiệm đáng nhớ cho mọi hành trình của bạn.',
      tabs: ['Khách sạn', 'Máy bay', 'Tour', 'Xe'],
    },
    promo: [
      { icon: '🏨', title: 'Khách sạn', text: 'Deal up to 50%' },
      { icon: '✈️', title: 'Máy bay', text: 'Giá tốt mọi ngày' },
      { icon: '🚐', title: 'Xe đưa đón', text: 'Dịch vụ tiện lợi' },
      { icon: '🎫', title: 'Tour', text: 'Combo tiết kiệm' },
    ],
    deals: [
      { name: 'The Sail Hotel', location: 'Đà Nẵng', rating: 4.9, discount: 35, price: 1490000, oldPrice: 2290000, desc: 'View biển, bữa sáng miễn phí, spa và hồ bơi.', gradient: 'linear-gradient(135deg, #a5f3fc, #60a5fa)' },
      { name: 'Hanoi City Stay', location: 'Hà Nội', rating: 4.8, discount: 28, price: 1190000, oldPrice: 1650000, desc: 'Phù hợp cho công tác hoặc nghỉ dưỡng ngắn ngày.', gradient: 'linear-gradient(135deg, #f9a8d4, #c084fc)' },
      { name: 'Nha Trang Escape', location: 'Khánh Hòa', rating: 4.7, discount: 42, price: 1990000, oldPrice: 3440000, desc: 'Vị trí đẹp, buổi tối lãng mạn và bể bơi ngoài trời.', gradient: 'linear-gradient(135deg, #86efac, #34d399)' },
    ],
    destinations: [
      { name: 'Phú Quốc', country: 'Việt Nam', airfare: 'Từ 1.290.000đ', gradient: 'linear-gradient(135deg, rgba(14,116,144,0.5), rgba(37,99,235,0.9))' },
      { name: 'Tokyo', country: 'Nhật Bản', airfare: 'Từ 8.490.000đ', gradient: 'linear-gradient(135deg, rgba(14,165,233,0.5), rgba(59,130,246,0.9))' },
      { name: 'Seoul', country: 'Hàn Quốc', airfare: 'Từ 7.990.000đ', gradient: 'linear-gradient(135deg, rgba(196,181,253,0.5), rgba(168,85,247,0.9))' },
      { name: 'Paris', country: 'Pháp', airfare: 'Từ 17.900.000đ', gradient: 'linear-gradient(135deg, rgba(251,146,60,0.5), rgba(239,68,68,0.9))' },
    ],
    experiences: [
      { category: 'Gợi ý', title: 'Đón sunrise trên núi', text: 'Đặt ngay để trải nghiệm khung cảnh tuyệt đẹp và trải nghiệm hướng dẫn viên.', gradient: 'linear-gradient(135deg, #dbeafe, #93c5fd)' },
      { category: 'Vui chơi', title: 'Tour biển và lặn', text: 'Điểm đến lý tưởng cho các cặp đôi và gia đình muốn khám phá.', gradient: 'linear-gradient(135deg, #cffafe, #67e8f9)' },
      { category: 'Ẩm thực', title: 'Food tour đường phố', text: 'Thưởng thức món ngon địa phương cùng trải nghiệm văn hóa.', gradient: 'linear-gradient(135deg, #fef3c7, #fbbf24)' },
    ],
    benefits: [
      { icon: '💳', title: 'Thanh toán an toàn', text: 'Đảm bảo giao dịch rõ ràng, tiện lợi và bảo mật cho mọi lần đặt.' },
      { icon: '🛎️', title: 'Hỗ trợ 24/7', text: 'Nhân viên hỗ trợ bạn mọi lúc để giải đáp và xử lý mọi nhu cầu.' },
      { icon: '🎁', title: 'Quà tặng & ưu đãi', text: 'Nhiều mã giảm giá và ưu đãi độc quyền dành cho khách hàng thân thiết.' },
    ],
  })
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) })
})

app.get('/api/catalog', (req, res) => {
  res.json({ flights, hotels, promos })
})

// 404 JSON cho mọi endpoint /api không tồn tại
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Không tìm thấy endpoint API.' })
})

// Error handler tập trung (Express yêu cầu đúng 4 tham số)
app.use((err, req, res, _next) => {
  console.error('[api-error]', err)
  res.status(500).json({ error: 'Lỗi máy chủ. Vui lòng thử lại.' })
})

app.listen(PORT, () => {
  console.log(`API travel running at http://localhost:${PORT}`)
})
