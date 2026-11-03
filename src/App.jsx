import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import AdminApp from './Admin.jsx'
import { API_BASE, apiFetch, apiPatch } from './api.js'

const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)

const services = [
  { id: 'flight', icon: '✈', label: 'Vé máy bay' },
  { id: 'hotel', icon: '◆', label: 'Khách sạn' },
  { id: 'combo', icon: '✦', label: 'Combo tiết kiệm' },
  { id: 'activity', icon: '◎', label: 'Vui chơi' },
  { id: 'car', icon: '↗', label: 'Đưa đón sân bay' },
  { id: 'bus', icon: '▣', label: 'Xe khách' },
  { id: 'train', icon: '═', label: 'Tàu hỏa' },
  { id: 'insurance', icon: '◇', label: 'Bảo hiểm' },
]

const navItems = [
  { id: 'home', label: 'Trang chủ' },
  { id: 'flight', label: 'Vé máy bay' },
  { id: 'hotel', label: 'Khách sạn' },
  { id: 'combo', label: 'Combo' },
  { id: 'bookings', label: 'Đặt chỗ của tôi' },
]

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

const destinations = [
  ['Đà Nẵng', 'Biển xanh, resort đẹp', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80'],
  ['Phú Quốc', 'Thiên đường nghỉ dưỡng', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80'],
  ['Đà Lạt', 'Không khí se lạnh', 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80'],
  ['Bangkok', 'Ăn chơi mua sắm', 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=900&q=80'],
]

const collections = [
  {
    title: 'Resort biển riêng tư',
    text: 'Không gian nghỉ dưỡng cao cấp, bữa sáng riêng và dịch vụ đưa đón tận nơi.',
    image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1100&q=90',
  },
  {
    title: 'City break cuối tuần',
    text: 'Khách sạn trung tâm, lịch trình ngắn ngày và ưu đãi linh hoạt.',
    image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1100&q=90',
  },
  {
    title: 'Retreat giữa thiên nhiên',
    text: 'Villa yên tĩnh, trải nghiệm wellness và không gian tái tạo năng lượng.',
    image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1100&q=90',
  },
]

const toISO = (date) => date.toISOString().slice(0, 10)
const defaultDepart = toISO(new Date(Date.now() + 7 * 86400000))
const defaultReturn = toISO(new Date(Date.now() + 10 * 86400000))
const todayISO = toISO(new Date())

const KNOWN_PAGES = ['home', 'flight', 'hotel', 'combo', 'checkout', 'rooms', 'checkout-hotel', 'bookings', 'admin']

const pageFromHash = () => {
  const raw = window.location.hash.replace(/^#\/?/, '').trim()
  if (!raw) return 'home'
  // Khu vực quản trị có route con (#/admin/bookings, #/admin/login...)
  if (raw === 'admin' || raw.startsWith('admin/')) return 'admin'
  return KNOWN_PAGES.includes(raw) ? raw : 'notfound'
}

// Dữ liệu phòng dự phòng khi API chết — tiện nghi khác nhau từng phòng (không hard-code chung).
const localRooms = hotels.flatMap((hotel) => hotel.id === 'hotel-1' ? [
  { id: 'room-hotel-1-1', hotelId: 'hotel-1', name: 'Phòng Deluxe Giáp Biển', price: 1850000, bedType: 'Giường king', sizeSqm: 35, maxAdults: 2, maxChildren: 1, breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00', amenities: ['Giường king', 'Điều hòa', 'TV màn hình phẳng', 'Tủ lạnh mini', 'Vòi hoa sen', 'Khăn tắm', 'Wi-Fi miễn phí', 'Két sắt'], images: [] },
  { id: 'room-hotel-1-2', hotelId: 'hotel-1', name: 'Phòng Suite View Biển', price: 2650000, bedType: 'Giường king + giường phụ', sizeSqm: 55, maxAdults: 3, maxChildren: 2, breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00', amenities: ['Giường king', 'Phòng khách riêng', 'Bồn tắm', 'Minibar', 'Wi-Fi miễn phí', 'Ấm đun nước'], images: [] },
] : hotel.id === 'hotel-2' ? [
  { id: 'room-hotel-2-1', hotelId: 'hotel-2', name: 'Phòng Standard View Núi', price: 990000, bedType: 'Giường queen', sizeSqm: 22, maxAdults: 2, maxChildren: 1, breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00', amenities: ['Giường queen', 'Điều hòa', 'TV', 'Vòi hoa sen', 'Wi-Fi miễn phí', 'Bàn làm việc'], images: [] },
  { id: 'room-hotel-2-2', hotelId: 'hotel-2', name: 'Phòng Family Giữa Mây', price: 1450000, bedType: '1 giường king + 1 giường đơn', sizeSqm: 35, maxAdults: 3, maxChildren: 2, breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00', amenities: ['Giường king + giường đơn', 'Tủ lạnh', 'Ấm đun nước', 'Két sắt', 'Wi-Fi miễn phí'], images: [] },
] : [
  { id: 'room-hotel-3-1', hotelId: 'hotel-3', name: 'Phòng Deluxe Phố Cổ', price: 1250000, bedType: 'Giường king', sizeSqm: 26, maxAdults: 2, maxChildren: 1, breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00', amenities: ['Giường king', 'Điều hòa', 'TV màn hình phẳng', 'Tủ lạnh', 'Vòi hoa sen', 'Wi-Fi miễn phí'], images: [] },
  { id: 'room-hotel-3-2', hotelId: 'hotel-3', name: 'Phòng Junior Suite Hồ Gươm', price: 1750000, bedType: 'Giường king', sizeSqm: 40, maxAdults: 3, maxChildren: 2, breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00', amenities: ['Phòng khách riêng', 'Bồn tắm', 'Minibar', 'Két sắt', 'Wi-Fi miễn phí', 'Áo choàng tắm'], images: [] },
])

// Chọn phòng / khách sạn đang xem — lưu sessionStorage để refresh không mất (theo tab).
const ROOM_SEL_KEY = 'may-an-nhien-room-sel'
const HOTEL_SEL_KEY = 'may-an-nhien-hotel-sel'
const loadRoomSelection = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(ROOM_SEL_KEY))
    if (saved && typeof saved.hotelId === 'string' && typeof saved.roomId === 'string') return saved
  } catch { /* dữ liệu hỏng: bỏ qua */ }
  return null
}
const loadHotelSelection = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(HOTEL_SEL_KEY))
    if (typeof saved === 'string' && saved) return saved
  } catch { /* dữ liệu hỏng: bỏ qua */ }
  return null
}

const nightsBetween = (start, end) => {
  const n = Math.round((Date.parse(end) - Date.parse(start)) / 86400000)
  return Number.isFinite(n) ? n : 0
}

// Phân nhóm + icon cho tiện nghi phòng — chỉ hiển thị mục có trong dữ liệu.
const AMENITY_GROUPS = [
  { name: 'Giường và nội thất', icon: '🛏️', test: [/giường/i, /bàn làm việc/i, /tủ quần áo/i, /phòng khách/i, /sofa/i] },
  { name: 'Thiết bị', icon: '❄️', test: [/điều hòa/i, /^tv/i, /tv /i, /tivi/i, /tủ lạnh/i, /minibar/i, /máy sấy/i] },
  { name: 'Phòng tắm', icon: '🚿', test: [/vòi hoa sen/i, /bồn tắm/i, /khăn/i, /áo choàng/i, /đồ vệ sinh/i] },
  { name: 'Kết nối', icon: '📶', test: [/wi-?fi/i, /internet/i] },
  { name: 'Tiện ích khác', icon: '🔑', test: [/.*/] },
]
const amenityIcon = (name) => {
  const rules = [
    [/wi-?fi/i, '📶'], [/điều hòa/i, '❄️'], [/^tv|tv /i, '📺'], [/giường/i, '🛏️'],
    [/vòi hoa sen/i, '🚿'], [/bồn tắm/i, '🛁'], [/khăn|áo choàng/i, '🧺'], [/két/i, '🔒'],
    [/ấm đun/i, '☕'], [/tủ lạnh|minibar/i, '🧊'], [/máy sấy/i, '💨'],
    [/bàn làm việc/i, '🪑'], [/phòng khách/i, '🛋️'],
  ]
  for (const [re, icon] of rules) if (re.test(name)) return icon
  return '✓'
}
const groupAmenities = (amenities) => {
  const buckets = AMENITY_GROUPS.map((group) => ({ ...group, items: [] }))
  for (const item of amenities || []) {
    const target = buckets.find((bucket) => bucket.test.some((re) => re.test(item)))
    ;(target || buckets[buckets.length - 1]).items.push(item)
  }
  return buckets.filter((bucket) => bucket.items.length > 0 && bucket.name !== 'Tiện ích khác')
    .concat(buckets.filter((bucket) => bucket.name === 'Tiện ích khác' && bucket.items.length > 0))
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^(0|\+84)\d{8,10}$/

const PAYMENT_METHODS = [
  { id: 'atm', label: 'Thẻ ATM nội địa' },
  { id: 'wallet', label: 'Ví điện tử (MoMo, ZaloPay)' },
  { id: 'card', label: 'Thẻ quốc tế' },
]

// Tính phần trăm giảm giá: mỗi mã chỉ áp đúng loại dịch vụ của nó.
// Ưu tiên dữ liệu từ database (rate + appliesTo do admin quản lý); fallback luật cũ.
const getPromoRate = (promoItem, item) => {
  if (!promoItem || !item) return 0
  const isFlight = Boolean(item.airline)
  const isCombo = typeof item.id === 'string' && item.id.startsWith('combo')
  const service = isFlight ? 'flight' : isCombo ? 'combo' : 'hotel'
  if (Number.isFinite(promoItem.rate) && Array.isArray(promoItem.appliesTo)) {
    return promoItem.appliesTo.includes(service) ? promoItem.rate : 0
  }
  if (promoItem.id === 'p3') return isCombo ? 0.25 : 0
  if (promoItem.id === 'p2') return isFlight || isCombo ? 0.08 : 0
  return isFlight ? 0 : 0.12
}

// Đọc dữ liệu localStorage có kiểm tra kiểu để tránh crash khi dữ liệu hỏng
// Key lưu đơn theo tài khoản: khách dùng key chung, user đã đăng nhập dùng key riêng
const bookingsKey = (email) => (email ? `may-an-nhien-bookings:${email}` : 'may-an-nhien-bookings')

// Bản sao cục bộ đơn hàng tải từ server (không ghi đè key cũ của bản trước).
const syncedBookingsKey = (email) => (email ? `may-an-nhien-bookings:synced:${email}` : 'may-an-nhien-bookings:synced')
// Đánh dấu đã nhập đơn cũ vào database — dữ liệu gốc GIỮ NGUYÊN, không xóa.
const legacyImportedKey = (email) => `${bookingsKey(email)}:imported-v1`

const loadBookings = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key))
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry) => entry && typeof entry === 'object' && typeof entry.code === 'string' && typeof entry.title === 'string')
      .map((entry) => ({
        ...entry,
        status: entry.status === 'Đã hủy' ? 'Đã hủy' : 'Đã xác nhận',
        traveler: {
          name: String(entry.traveler?.name || '—'),
          phone: String(entry.traveler?.phone || '—'),
          email: String(entry.traveler?.email || ''),
        },
        passengers: Number(entry.passengers) > 0 ? Number(entry.passengers) : 1,
        promo: String(entry.promo || 'Không dùng'),
        total: Number.isFinite(Number(entry.total)) ? Number(entry.total) : 0,
        createdAt: String(entry.createdAt || ''),
      }))
  } catch {
    return []
  }
}

// Key phiên bản mới: không đọc lại dữ liệu mẫu/khách từ các bản cũ
const TRAVELER_KEY = 'may-an-nhien-traveler:v2'

const loadTraveler = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(TRAVELER_KEY))
    if (saved && typeof saved === 'object' && typeof saved.name === 'string' && typeof saved.phone === 'string' && typeof saved.email === 'string') {
      return {
        name: saved.name.slice(0, 60),
        phone: saved.phone.slice(0, 15),
        email: saved.email.slice(0, 80),
      }
    }
  } catch {
    // dữ liệu hỏng: dùng mặc định
  }
  // Không điền sẵn thông tin cá nhân mẫu — người dùng tự nhập
  return { name: '', phone: '', email: '' }
}

const loadSession = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('may-an-nhien-session'))
    if (saved && typeof saved.email === 'string' && typeof saved.name === 'string') return saved
  } catch {
    // dữ liệu hỏng: coi như chưa đăng nhập
  }
  return null
}

const CatalogCtx = createContext(null)

function App() {
  const [page, setPage] = useState(() => pageFromHash())
  const [service, setService] = useState('flight')
  const [tripType, setTripType] = useState('Khứ hồi')
  const [keyword, setKeyword] = useState('Đà Nẵng')
  const [selectedItem, setSelectedItem] = useState(null)
  const [promo, setPromo] = useState(promos[0])
  const [passengers, setPassengers] = useState(2)
  const [toast, setToast] = useState('')
  const [filters, setFilters] = useState({ promoOnly: false, freeCancel: false, highRating: false, central: false, maxPrice: 5000000 })
  const [dates, setDates] = useState({ depart: defaultDepart, ret: defaultReturn })
  const [appliedSearch, setAppliedSearch] = useState(null)
  const toastTimer = useRef(null)
  const [bookings, setBookings] = useState(() => loadBookings(bookingsKey(loadSession()?.email)))
  const [traveler, setTraveler] = useState(loadTraveler)
  const [session, setSession] = useState(loadSession)
  const [loginOpen, setLoginOpen] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)
  // Chọn phòng (trang #/rooms + #/checkout-hotel): lưu theo tab để refresh không mất.
  const [selectedHotelId, setSelectedHotelId] = useState(loadHotelSelection)
  const [selectedRoomIds, setSelectedRoomIds] = useState(loadRoomSelection)
  const [catalog, setCatalog] = useState({ flights, hotels, promos, rooms: localRooms })
  const [catalogStatus, setCatalogStatus] = useState('loading')
  const [catalogNonce, setCatalogNonce] = useState(0)

  useEffect(() => {
    // Chỉ ghi bản sao vào key MỚI — không đụng tới dữ liệu đơn hàng của bản cũ.
    try {
      if (session?.email) {
        localStorage.setItem(syncedBookingsKey(session.email), JSON.stringify(bookings))
      }
    } catch {
      // bộ nhớ đầy / bị chặn: bỏ qua, dữ liệu chính vẫn nằm ở server
    }
  }, [bookings, session])

  useEffect(() => {
    localStorage.setItem(TRAVELER_KEY, JSON.stringify(traveler))
  }, [traveler])

  useEffect(() => {
    localStorage.setItem('may-an-nhien-session', JSON.stringify(session))
    if (!session) localStorage.removeItem('may-an-nhien-session')
  }, [session])

  // Lưu lựa chọn theo tab (sessionStorage): refresh trang vẫn còn khách sạn/phòng đã chọn.
  useEffect(() => {
    if (selectedHotelId) sessionStorage.setItem(HOTEL_SEL_KEY, JSON.stringify(selectedHotelId))
    else sessionStorage.removeItem(HOTEL_SEL_KEY)
  }, [selectedHotelId])
  useEffect(() => {
    if (selectedRoomIds) sessionStorage.setItem(ROOM_SEL_KEY, JSON.stringify(selectedRoomIds))
    else sessionStorage.removeItem(ROOM_SEL_KEY)
  }, [selectedRoomIds])

  // Id -> đối tượng: catalog tải xong mới resolve được (fallback cục bộ nếu API chết).
  const roomsSource = (Array.isArray(catalog.rooms) && catalog.rooms.length > 0) ? catalog.rooms : localRooms
  const roomSelection = useMemo(() => {
    if (!selectedRoomIds) return null
    const hotel = catalog.hotels.find((h) => h.id === selectedRoomIds.hotelId)
    const room = roomsSource.find((r) => r.id === selectedRoomIds.roomId)
    if (!hotel || !room || room.hotelId !== hotel.id) return null
    return { hotel, room }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomIds, catalog])

  const selectedHotel = useMemo(
    () => catalog.hotels.find((h) => h.id === selectedHotelId) || null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedHotelId, catalog],
  )

  const selectedHotelRooms = useMemo(
    () => roomsSource.filter((r) => r.hotelId === selectedHotelId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedHotelId, catalog],
  )

  // Đồng bộ trang với hash URL (#/hotel, #/flight...) + bắt route lạ (404)
  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    // Khu vực admin tự quản lý hash con (#/admin/bookings) — không ghi đè về #/admin
    if (page === 'admin') return
    const target = `#/${page}`
    if (window.location.hash !== target) {
      window.location.hash = target
    }
  }, [page])

  // Tải catalog từ API (fallback dữ liệu cục bộ nếu máy chủ chết)
  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 5000)
    fetch(`${API_BASE}/api/catalog`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then((data) => {
        if (!active) return
        if (Array.isArray(data?.flights) && data.flights.length > 0 && Array.isArray(data?.hotels) && data.hotels.length > 0) {
          setCatalog({
            flights: data.flights,
            hotels: data.hotels,
            promos: Array.isArray(data.promos) && data.promos.length > 0 ? data.promos : promos,
            // Combo lấy từ database; không có (API cũ/lỗi) thì trang Combo tự suy ra
            combos: Array.isArray(data.combos) ? data.combos : null,
            rooms: Array.isArray(data.rooms) && data.rooms.length > 0 ? data.rooms : localRooms,
          })
        }
        setCatalogStatus('ready')
      })
      .catch(() => {
        if (active) setCatalogStatus('error')
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      active = false
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [catalogNonce])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const titles = {
      home: 'Mây An Nhiên - Đặt dịch vụ du lịch',
      flight: 'Vé máy bay - Mây An Nhiên',
      hotel: 'Khách sạn - Mây An Nhiên',
      combo: 'Combo du lịch - Mây An Nhiên',
      checkout: 'Thanh toán - Mây An Nhiên',
      rooms: 'Chọn phòng - Mây An Nhiên',
      'checkout-hotel': 'Thanh toán đặt phòng - Mây An Nhiên',
      bookings: 'Đặt chỗ của tôi - Mây An Nhiên',
      admin: 'Quản trị - Mây An Nhiên',
      notfound: '404 - Mây An Nhiên',
    }
    document.title = titles[page] || 'Mây An Nhiên'
  }, [page])

  const selectedPrice = useMemo(() => {
    if (!selectedItem) return 0
    const rate = getPromoRate(promo, selectedItem)
    return Math.round(selectedItem.price * (1 - rate))
  }, [selectedItem, promo])

  const catalogValue = useMemo(
    () => ({
      catalog,
      catalogStatus,
      retryCatalog: () => {
        setCatalogStatus('loading')
        setCatalogNonce((nonce) => nonce + 1)
      },
    }),
    [catalog, catalogStatus],
  )

  const notify = (message) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2800)
  }

  const chooseItem = (item, nextPage = 'checkout') => {
    setSelectedItem(item)
    setPage(nextPage)
    notify(`Đã chọn ${item.name || item.airline}. Vui lòng kiểm tra thông tin trước khi thanh toán.`)
  }

  // Luồng khách sạn: xem phòng trước -> chọn phòng -> trang thanh toán riêng của phòng.
  const openRooms = (hotel) => {
    setSelectedHotelId(hotel.id)
    setPage('rooms')
  }

  const openRoomCheckout = (hotel, room) => {
    setSelectedHotelId(hotel.id)
    setSelectedRoomIds({ hotelId: hotel.id, roomId: room.id })
    setPage('checkout-hotel')
    notify(`Đã chọn ${room.name} tại ${hotel.name}. Vui lòng kiểm tra thông tin trước khi thanh toán.`)
  }

  const clearRoomSelection = () => {
    setSelectedRoomIds(null)
    setSelectedHotelId(null)
  }

  const submitSearch = (event) => {
    event.preventDefault()
    const trimmed = keyword.trim()
    if (!trimmed) {
      notify('Vui lòng nhập điểm đến hoặc tên khách sạn.')
      return
    }
    // Validate ngày phía app (không dùng native min để tránh chặn im lặng)
    if (!dates.depart || dates.depart < todayISO) {
      notify('Ngày đi phải từ hôm nay trở về sau.')
      return
    }
    if (tripType !== 'Một chiều' && !dates.ret) {
      notify('Vui lòng chọn ngày về.')
      return
    }
    if (tripType !== 'Một chiều' && dates.ret < dates.depart) {
      notify('Ngày về phải sau ngày đi. Vui lòng chọn lại.')
      return
    }
    const targetPage = service === 'hotel' ? 'hotel' : service === 'combo' ? 'combo' : 'flight'
    setAppliedSearch({ keyword: trimmed, service, tripType, dates, passengers })
    setPage(targetPage)
    notify(`Đang tìm ${services.find((item) => item.id === service)?.label.toLowerCase()} cho "${trimmed}"`)
  }

  // Nạp lại danh sách đơn từ server (gọi được cả ngay sau login khi state chưa cập nhật)
  const refreshBookings = async (email = session?.email) => {
    if (!email) return []
    const res = await apiFetch('/api/bookings')
    if (!res.ok) return []
    const list = Array.isArray(res.data?.bookings) ? res.data.bookings : []
    setBookings(list)
    return list
  }

  // Nhập đơn hàng cũ (lưu localStorage ở bản trước) vào database.
  // DỮ LIỆU GỐC KHÔNG BỊ XÓA — chỉ đánh dấu đã nhập để khỏi gửi lại.
  const migrateLegacyBookings = async (email) => {
    if (!email) return
    try {
      if (localStorage.getItem(legacyImportedKey(email)) !== null) return
      const raw = localStorage.getItem(bookingsKey(email))
      const parsed = raw ? JSON.parse(raw) : []
      if (!Array.isArray(parsed) || parsed.length === 0) {
        localStorage.setItem(legacyImportedKey(email), '0')
        return
      }
      const res = await apiFetch('/api/bookings/import', { method: 'POST', body: { bookings: parsed } })
      if (res.ok) localStorage.setItem(legacyImportedKey(email), String(res.data?.imported ?? 0))
    } catch {
      // ngoại tuyến: giữ nguyên localStorage, lần đăng nhập sau sẽ nhập lại
    }
  }

  // Kiểm tra phiên THẬT với server (không tin role trong localStorage) + nạp đơn.
  useEffect(() => {
    const email = session?.email
    if (!email) return undefined
    let active = true
    ;(async () => {
      const res = await apiFetch('/api/auth/me')
      if (!active) return
      if (res.networkError) return // mất mạng: giữ nguyên phiên đang hiển thị
      if (!res.ok) {
        // Phiên bị thu hồi hoặc tài khoản bị vô hiệu hóa -> đăng xuất ngay
        setSession(null)
        setBookings([])
        return
      }
      const user = res.data?.user
      if (user) setSession((current) => (current ? { ...current, name: user.name, role: user.role } : current))
      await migrateLegacyBookings(email)
      await refreshBookings(email)
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.email])

  // Mở trang "Đặt chỗ của tôi" khi đã đăng nhập -> tải danh sách mới nhất từ server.
  useEffect(() => {
    if (page === 'bookings' && session?.email) refreshBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, session?.email])

  const logout = () => {
    setSession(null)
    setBookings([])
    notify('Bạn đã đăng xuất.')
    // Đăng xuất phía server (bỏ cookie phiên); lỗi mạng cũng không ảnh hưởng giao diện
    apiFetch('/api/auth/logout', { method: 'POST' })
  }

  const handleLogin = async (mail, password) => {
    setBookings([]) // không để dữ liệu của phiên trước hiển thị khi đổi người dùng
    const res = await apiFetch('/api/auth/login', { method: 'POST', body: { email: mail, password } })
    if (res.networkError) {
      // Mất kết nối máy chủ: cho phép xem ngoại tuyến — KHÔNG có quyền quản trị,
      // mọi API quản trị vẫn yêu cầu phiên thật phía server.
      const offlineSession = { email: mail, name: mail.split('@')[0], at: Date.now(), offline: true }
      setSession(offlineSession)
      setLoginOpen(false)
      notify(`Xin chào ${offlineSession.name}! (Chế độ ngoại tuyến)`)
      return null
    }
    if (!res.ok) return res.data?.error || 'Đăng nhập không thành công. Vui lòng thử lại.'
    const user = res.data.user
    const nextSession = { email: user.email, name: user.name, role: user.role, at: Date.now() }
    setSession(nextSession)
    setLoginOpen(false)
    notify(`Xin chào ${nextSession.name}! Bạn đã đăng nhập.`)
    await migrateLegacyBookings(nextSession.email)
    await refreshBookings(nextSession.email)
    return null
  }

  const handleRegister = async (data) => {
    const { email, name, phone, password } = data
    const res = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: { email, name, phone, password },
    })
    if (!res.ok) return res.data?.error || 'Đăng ký thất bại.'
    const user = res.data?.user
    if (!user) return 'Đăng ký thất bại.'
    const nextSession = { email: user.email, name: user.name, role: user.role, at: Date.now() }
    setSession(nextSession)
    setRegisterOpen(false)
    notify(`Chào mừng ${nextSession.name}! Bạn đã đăng ký và đăng nhập.`)
    await migrateLegacyBookings(nextSession.email)
    await refreshBookings(nextSession.email)
    return null
  }

  const requireLogin = () => {
    setLoginOpen(true)
    notify('Vui lòng đăng nhập để tiếp tục thanh toán.')
  }

  // Khu vực quản trị dùng bộ khung riêng — KHÔNG trộn menu admin vào giao diện người dùng
  if (page === 'admin') {
    return <AdminApp onExit={() => setPage('home')} />
  }

  return (
    <CatalogCtx.Provider value={catalogValue}>
    <div className="app-shell">
      {toast && <div className="toast">{toast}</div>}

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLogin={handleLogin}
      />
      <RegisterModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onRegister={handleRegister}
      />

      <div className="top-strip">
        <div className="container top-strip-inner">
          <span>☁️ Mây An Nhiên - nền tảng đặt dịch vụ du lịch Việt Nam</span>
          <b>Ưu đãi hôm nay: giảm đến 25%</b>
        </div>
      </div>

      <header className="header">
        <div className="header-inner">
          <button className="brand" onClick={() => setPage('home')} aria-label="Về trang chủ">
            <span className="brand-mark">✈</span>
            <span className="brand-text">Mây An Nhiên</span>
          </button>

          <nav className="nav">
            {navItems.map((item) => (
              <button
                key={item.id}
                className={page === item.id ? 'active' : ''}
                onClick={() => setPage(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="header-actions">
            <button className="plain-btn" onClick={() => notify('Website hiện hỗ trợ tiếng Việt.')}>🌐 VN</button>
            {session ? (
              <>
                <span className="user-chip" title={session.email}>👤 {session.name}</span>
                <button className="plain-btn" onClick={logout}>Đăng xuất</button>
              </>
            ) : (
              <>
                <button className="login-btn" onClick={() => setLoginOpen(true)}>Đăng nhập</button>
                <button
                  className="register-btn"
                  onClick={() => {
                    setLoginOpen(false)
                    setRegisterOpen(true)
                  }}
                >
                  Đăng ký
                </button>
              </>
            )}
            <button className="register-btn" onClick={() => setPage('bookings')}>Đặt chỗ của tôi</button>
          </div>
        </div>
      </header>

      {catalogStatus === 'error' && (
        <div className="data-error-banner" role="alert">
          <span>⚠️ Không tải được dữ liệu từ máy chủ. Đang dùng dữ liệu dự phòng.</span>
          <button onClick={catalogValue.retryCatalog}>Thử lại</button>
        </div>
      )}

      <main>
        {page === 'home' && (
          <>
            <section className="hero">
              <div className="hero-bg" />
              <div className="container hero-content">
                <div className="hero-copy">
                  <span className="eyebrow">Đặt chuyến đi an nhiên</span>
                  <h1>Vé máy bay, khách sạn và combo du lịch trong một nền tảng.</h1>
                  <p>
                    Tìm vé máy bay, khách sạn, combo tiết kiệm, hoạt động vui chơi và thanh toán
                    trong một quy trình rõ ràng, nhanh chóng và thân thiện với người dùng Việt Nam.
                  </p>
                  <div className="hero-badges">
                    <span>Giá minh bạch</span>
                    <span>Đặt nhanh</span>
                    <span>Hỗ trợ 24/7</span>
                  </div>
                </div>
                <HeroVisual />
                <SearchCard
                  service={service}
                  setService={setService}
                  tripType={tripType}
                  setTripType={setTripType}
                  keyword={keyword}
                  setKeyword={setKeyword}
                  passengers={passengers}
                  setPassengers={setPassengers}
                  dates={dates}
                  setDates={setDates}
                  onSubmit={submitSearch}
                />
              </div>
            </section>

            <ServiceDock service={service} setService={setService} setPage={setPage} notify={notify} />
            <TrustSection />
            <PromoSection promo={promo} setPromo={setPromo} />
            <CollectionSection />
            <DestinationSection />
            <ListingPreview title="Chuyến bay gợi ý hôm nay" type="flight" onChoose={chooseItem} />
            <ListingPreview title="Khách sạn nổi bật hôm nay" type="hotel" onChoose={openRooms} />
          </>
        )}

        {page === 'flight' && <FlightPage onChoose={chooseItem} filters={filters} setFilters={setFilters} search={appliedSearch} onClearSearch={() => setAppliedSearch(null)} />}
        {page === 'hotel' && <HotelPage onChoose={openRooms} filters={filters} setFilters={setFilters} search={appliedSearch} onClearSearch={() => setAppliedSearch(null)} />}
        {page === 'combo' && <ComboPage onChoose={chooseItem} search={appliedSearch} onClearSearch={() => setAppliedSearch(null)} />}
        {page === 'notfound' && <NotFoundPage onHome={() => setPage('home')} />}
        {page === 'checkout' && (
          <CheckoutPage
            selectedItem={selectedItem}
            promo={promo}
            setPromo={setPromo}
            selectedPrice={selectedPrice}
            passengers={passengers}
            setPassengers={setPassengers}
            traveler={traveler}
            setTraveler={setTraveler}
            dates={dates}
            tripType={tripType}
            destination={appliedSearch?.keyword || keyword}
            session={session}
            onBack={() => setPage('home')}
            onInvalid={notify}
            onRequireLogin={requireLogin}
            onPickService={(id) => setPage(id)}
            onPay={async (booking) => {
              // booking đã được server tạo (DB) — chỉ cập nhật state cục bộ
              setBookings((current) => [booking, ...current.filter((entry) => entry.code !== booking.code)])
              setPage('bookings')
              notify(`Đặt chỗ thành công! Mã đơn: ${booking.code}`)
            }}
          />
        )}
        {page === 'rooms' && (
          <RoomsPage
            hotel={selectedHotel}
            rooms={selectedHotelRooms}
            loading={catalogStatus === 'loading'}
            onBack={() => setPage('hotel')}
            onPick={openRoomCheckout}
          />
        )}
        {page === 'checkout-hotel' && (
          catalogStatus === 'loading' && !roomSelection ? (
            <section className="page container">
              <SkeletonList count={2} label="Đang tải thông tin phòng..." />
            </section>
          ) : roomSelection ? (
            <HotelCheckoutPage
              selection={roomSelection}
              dates={dates}
              session={session}
              traveler={traveler}
              setTraveler={setTraveler}
              onBack={() => setPage(selectedHotelId ? 'rooms' : 'hotel')}
              onInvalid={notify}
              onRequireLogin={requireLogin}
              onPay={(booking) => {
                setBookings((current) => [booking, ...current.filter((entry) => entry.code !== booking.code)])
                clearRoomSelection()
                setPage('bookings')
                notify(`Đặt chỗ thành công! Mã đơn: ${booking.code}`)
              }}
            />
          ) : (
            <section className="page container checkout-layout">
              <div className="checkout-main">
                <button className="back-btn" onClick={() => setPage('hotel')}>← Quay lại trang khách sạn</button>
                <div className="empty-bookings">
                  <span>🛏️</span>
                  <h2>Bạn chưa chọn phòng nào</h2>
                  <p>Hãy chọn khách sạn và loại phòng trước khi tiến hành thanh toán.</p>
                  <div className="empty-actions">
                    <button onClick={() => setPage('hotel')}>Chọn khách sạn</button>
                    <button onClick={() => setPage('home')}>Về trang chủ</button>
                  </div>
                </div>
              </div>
            </section>
          )
        )}
        {page === 'bookings' && (
          <BookingsPage
            bookings={bookings}
            onCancel={async (code) => {
              const res = await apiPatch(`/api/bookings/${encodeURIComponent(code)}/cancel`, {})
              if (!res.ok) {
                notify(res.networkError ? 'Không kết nối được máy chủ. Thử lại sau.'
                  : (res.data?.error || 'Không thể hủy đơn hàng.'))
                return
              }
              setBookings((current) => current.map((booking) => (
                booking.code === code ? { ...booking, status: 'Đã hủy' } : booking
              )))
              notify(`Đã hủy đặt chỗ ${code}`)
            }}
            onExplore={() => setPage('home')}
          />
        )}
      </main>

      <Footer onNavigate={setPage} />

      <nav className="mobile-bottom-nav">
        {navItems.map((item) => (
          <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => setPage(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>
      </div>
    </CatalogCtx.Provider>
  )
}

function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="visual-card visual-main">
        <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=90" alt="" />
        <div className="visual-caption">
          <span>Signature escape</span>
          <b>Đà Nẵng · 3 ngày 2 đêm</b>
        </div>
      </div>
      <div className="visual-card visual-small top">
        <img src="https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=600&q=90" alt="" />
      </div>
      <div className="visual-card visual-small bottom">
        <img src="https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=90" alt="" />
      </div>
      <div className="floating-stat">
        <strong>9.4</strong>
        <span>điểm hài lòng</span>
      </div>
    </div>
  )
}

function SearchCard({ service, setService, tripType, setTripType, keyword, setKeyword, passengers, setPassengers, dates, setDates, onSubmit }) {
  return (
    <form className="search-card" onSubmit={onSubmit}>
      <div className="search-services">
        {services.slice(0, 5).map((item) => (
          <button
            type="button"
            key={item.id}
            className={service === item.id ? 'active' : ''}
            onClick={() => setService(item.id)}
          >
            <span>{item.icon}</span>{item.label}
          </button>
        ))}
      </div>

      <div className="trip-toggle">
        {['Một chiều', 'Khứ hồi', 'Nhiều chặng'].map((item) => (
          <button type="button" key={item} className={tripType === item ? 'active' : ''} onClick={() => setTripType(item)}>
            {item}
          </button>
        ))}
      </div>

      <div className="form-grid">
        <label className="field wide">
          <span>{service === 'hotel' ? 'Thành phố / khách sạn' : 'Bạn muốn đi đâu?'}</span>
          <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Nhập điểm đến" maxLength={80} />
        </label>
        <label className="field">
          <span>Ngày đi</span>
          <input type="date" value={dates.depart} onChange={(event) => setDates({ ...dates, depart: event.target.value })} />
        </label>
        <label className="field">
          <span>Ngày về</span>
          <input type="date" value={dates.ret} disabled={tripType === 'Một chiều'} onChange={(event) => setDates({ ...dates, ret: event.target.value })} />
        </label>
        <label className="field">
          <span>Khách</span>
          <select value={passengers} onChange={(event) => setPassengers(Number(event.target.value))}>
            <option value="1">1 khách</option>
            <option value="2">2 khách</option>
            <option value="3">3 khách</option>
            <option value="4">4 khách</option>
          </select>
        </label>

        <button className="search-submit" type="submit">🔎 Tìm kiếm ngay</button>
      </div>
    </form>
  )
}

function ServiceDock({ service, setService, setPage, notify }) {
  const availablePages = ['flight', 'hotel', 'combo']

  return (
    <section className="container service-dock">
      {services.map((item) => (
        <button
          key={item.id}
          className={service === item.id ? 'active' : ''}
          onClick={() => {
            setService(item.id)
            if (availablePages.includes(item.id)) {
              setPage(item.id)
            } else {
              notify(`Tính năng "${item.label}" đang được hoàn thiện. Hiện bạn có thể đặt vé máy bay, khách sạn và combo.`)
            }
          }}
        >
          <span>{item.icon}</span>
          <b>{item.label}</b>
        </button>
      ))}
    </section>
  )
}

const fallbackBenefits = [
  ['🔒', 'Thanh toán bảo mật', 'Mô phỏng nhiều phương thức thanh toán và tóm tắt đơn hàng.'],
  ['📄', 'Quản lý đặt chỗ', 'Người dùng có thể xem dịch vụ đã chọn và thông tin khách hàng.'],
  ['🎯', 'Tìm kiếm nhanh', 'Tabs, bộ lọc, nhập điểm đến, ngày đi và số khách.'],
]

function TrustSection() {
  const [items, setItems] = useState(fallbackBenefits)
  const [status, setStatus] = useState('loading')
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let active = true
    fetch(`${API_BASE}/api/travel`)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json()
      })
      .then((data) => {
        if (active && Array.isArray(data?.benefits) && data.benefits.length > 0) {
          setItems(data.benefits.map((benefit) => [benefit.icon, benefit.title, benefit.text]))
          setStatus('ready')
        } else if (active) {
          setStatus('error')
        }
      })
      .catch(() => {
        if (active) setStatus('error')
      })
    return () => {
      active = false
    }
  }, [nonce])

  if (status === 'loading') {
    return (
      <section className="container trust-section">
        <SkeletonList count={3} label="Đang tải ưu đãi..." />
      </section>
    )
  }

  return (
    <section className="container trust-section">
      {status === 'error' && (
        <div className="data-error-strip" role="alert">
          <span>⚠️ Không tải được ưu đãi mới từ máy chủ.</span>
          <button onClick={() => { setStatus('loading'); setNonce((value) => value + 1) }}>Thử lại</button>
        </div>
      )}
      {items.map(([icon, title, text]) => (
        <article key={title}>
          <span>{icon}</span>
          <div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        </article>
      ))}
    </section>
  )
}

function PromoSection({ promo, setPromo }) {
  const { catalog } = useContext(CatalogCtx)

  return (
    <section className="container section-block">
      <div className="section-title">
        <div>
          <span>Ưu đãi</span>
          <h2>Mã khuyến mãi đang nổi bật</h2>
        </div>
        <button className="link-btn" onClick={() => setPromo(catalog.promos[0])}>Áp dụng mã tốt nhất</button>
      </div>
      <div className="promo-grid">
        {catalog.promos.map((item) => (
          <button key={item.id} className={`promo-card ${item.color} ${promo.id === item.id ? 'selected' : ''}`} onClick={() => setPromo(item)}>
            <span className="ticket-cut" />
            <small>Mã giảm giá</small>
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
            <b>{promo.id === item.id ? 'Đang áp dụng' : 'Dùng ngay'}</b>
          </button>
        ))}
      </div>
    </section>
  )
}

function CollectionSection() {
  const scrollToDestinations = () => document.querySelector('.destination-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section className="container section-block collection-section">
      <div className="section-title">
        <div>
          <span>Bộ sưu tập</span>
          <h2>Những hành trình được tuyển chọn</h2>
        </div>
        <button className="link-btn" onClick={scrollToDestinations}>Khám phá thêm</button>
      </div>
      <div className="collection-grid">
        {collections.map((item) => (
          <article className="collection-card" key={item.title}>
            <img src={item.image} alt={item.title} />
            <div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function DestinationSection() {
  return (
    <section className="container section-block">
      <div className="section-title">
        <div>
          <span>Khám phá</span>
          <h2>Điểm đến được tìm kiếm nhiều</h2>
        </div>
      </div>
      <div className="destination-grid">
        {destinations.map(([name, desc, image]) => (
          <article key={name} className="destination-card" style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,33,79,.75)), url(${image})` }}>
            <div>
              <h3>{name}</h3>
              <p>{desc}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

function ListingPreview({ title, type, onChoose }) {
  const { catalog, catalogStatus } = useContext(CatalogCtx)
  const list = type === 'flight' ? catalog.flights : catalog.hotels
  return (
    <section className="container section-block">
      <div className="section-title">
        <div>
          <span>Gợi ý</span>
          <h2>{title}</h2>
        </div>
      </div>
      <div className={type === 'flight' ? 'flight-list' : 'hotel-grid'}>
        {catalogStatus === 'loading'
          ? <SkeletonList count={2} />
          : list.map((item) => type === 'flight' ? <FlightCard key={item.id} flight={item} onChoose={onChoose} /> : <HotelCard key={item.id} hotel={item} onChoose={onChoose} />)}
      </div>
    </section>
  )
}

function SearchSummary({ search, onClear }) {
  if (!search) return null
  const dateText = search.tripType === 'Một chiều'
    ? search.dates.depart
    : `${search.dates.depart} → ${search.dates.ret}`

  return (
    <div className="search-summary">
      <div>
        <b>Kết quả cho "{search.keyword}"</b>
        <span>{search.tripType} · {dateText} · {search.passengers} khách</span>
      </div>
      <button type="button" onClick={onClear}>Xóa bộ tìm kiếm</button>
    </div>
  )
}

function ResultsCount({ count, unit }) {
  return <p className="results-count">{count} {unit} phù hợp với yêu cầu của bạn</p>
}

function FlightPage({ onChoose, filters, setFilters, search, onClearSearch }) {
  const { catalog, catalogStatus } = useContext(CatalogCtx)
  const keyword = (search?.keyword || '').trim().toLowerCase()
  const filteredFlights = catalog.flights.filter((flight) => (
    flight.price <= filters.maxPrice
    && (!filters.promoOnly || flight.hasPromo)
    && (!keyword || `${flight.from} ${flight.to} ${flight.airline}`.toLowerCase().includes(keyword))
  ))

  return (
    <section className="page container">
      <PageHero icon="✈️" title="Tìm vé máy bay giá tốt" text="So sánh chuyến bay, giờ bay, hãng bay và chọn vé phù hợp." />
      <SearchSummary search={search} onClear={onClearSearch} />
      <div className="content-layout">
        <FilterPanel filters={filters} setFilters={setFilters} />
        <div className="flight-list">
          {catalogStatus === 'loading' ? (
            <SkeletonList count={3} />
          ) : (
            <>
              <ResultsCount count={filteredFlights.length} unit="chuyến bay" />
              {filteredFlights.length > 0 ? filteredFlights.map((flight) => <FlightCard key={flight.id} flight={flight} onChoose={onChoose} />) : <EmptyResult text="Không có chuyến bay phù hợp. Hãy đổi điểm đến hoặc gỡ bộ lọc." />}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function HotelPage({ onChoose, filters, setFilters, search, onClearSearch }) {
  const { catalog, catalogStatus } = useContext(CatalogCtx)
  const keyword = (search?.keyword || '').trim().toLowerCase()
  const filteredHotels = catalog.hotels.filter((hotel) => (
    hotel.price <= filters.maxPrice
    && (!filters.promoOnly || hotel.hasPromo)
    && (!filters.freeCancel || hotel.perks.includes('Miễn phí hủy'))
    && (!filters.highRating || hotel.rating >= 8.5)
    && (!filters.central || hotel.perks.includes('Trung tâm') || hotel.location.includes('Trung tâm'))
    && (!keyword || `${hotel.name} ${hotel.location}`.toLowerCase().includes(keyword))
  ))

  return (
    <section className="page container">
      <PageHero icon="🏨" title="Khách sạn và resort nổi bật" text="Chọn phòng, xem tiện ích, đánh giá và đặt chỗ trực tuyến." />
      <SearchSummary search={search} onClear={onClearSearch} />
      <div className="content-layout">
        <FilterPanel filters={filters} setFilters={setFilters} />
        <div className="hotel-grid page-grid">
          {catalogStatus === 'loading' ? (
            <SkeletonList count={3} />
          ) : (
            <>
              <ResultsCount count={filteredHotels.length} unit="khách sạn" />
              {filteredHotels.length > 0 ? filteredHotels.map((hotel) => <HotelCard key={hotel.id} hotel={hotel} onChoose={onChoose} chooseLabel="Chọn phòng" />) : <EmptyResult text="Không có khách sạn phù hợp. Hãy thử từ khóa khác hoặc gỡ bộ lọc." />}
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function ComboPage({ onChoose, search, onClearSearch }) {
  const { catalog, catalogStatus } = useContext(CatalogCtx)
  const keyword = (search?.keyword || '').trim().toLowerCase()
  // Combo lấy từ database (admin quản lý); API chưa có -> tự suy ra như bản cũ
  const combos = (Array.isArray(catalog.combos) ? catalog.combos : catalog.hotels
    .map((hotel, index) => ({ ...hotel, id: `combo-${hotel.id}`, price: hotel.price + (catalog.flights[index]?.price || 0) - 450000, name: `Combo ${hotel.name} + vé bay` })))
    .filter((combo) => !keyword || `${combo.name} ${combo.location}`.toLowerCase().includes(keyword))

  return (
    <section className="page container">
      <PageHero icon="💙" title="Combo bay + khách sạn" text="Gói tiết kiệm cho chuyến đi trọn vẹn, có thể đặt ngay." />
      <SearchSummary search={search} onClear={onClearSearch} />
      <div className="hotel-grid page-grid">
        {catalogStatus === 'loading' ? (
          <SkeletonList count={3} />
        ) : (
          <>
            <ResultsCount count={combos.length} unit="combo" />
            {combos.length > 0 ? combos.map((combo) => <HotelCard key={combo.id} hotel={combo} onChoose={onChoose} />) : <EmptyResult text="Không có combo phù hợp với từ khóa hiện tại." />}
          </>
        )}
      </div>
    </section>
  )
}

function PageHero({ icon, title, text }) {
  return (
    <div className="page-hero">
      <span>{icon}</span>
      <div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  )
}

function FilterPanel({ filters, setFilters }) {
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }))

  return (
    <aside className="filter-panel">
      <h3>Bộ lọc</h3>
      <label><input type="checkbox" checked={filters.promoOnly} onChange={(event) => update('promoOnly', event.target.checked)} /> Có khuyến mãi</label>
      <label><input type="checkbox" checked={filters.freeCancel} onChange={(event) => update('freeCancel', event.target.checked)} /> Miễn phí hủy</label>
      <label><input type="checkbox" checked={filters.highRating} onChange={(event) => update('highRating', event.target.checked)} /> Đánh giá trên 8.5</label>
      <label><input type="checkbox" checked={filters.central} onChange={(event) => update('central', event.target.checked)} /> Gần trung tâm</label>
      <div className="range-box">
        <span>Giá tối đa: {formatCurrency(filters.maxPrice)}</span>
        <input type="range" min="500000" max="5000000" step="100000" value={filters.maxPrice} onChange={(event) => update('maxPrice', Number(event.target.value))} />
      </div>
    </aside>
  )
}

function EmptyResult({ text }) {
  return (
    <div className="empty-result">
      <strong>Không tìm thấy kết quả</strong>
      <p>{text}</p>
    </div>
  )
}

function FlightCard({ flight, onChoose }) {
  return (
    <article className="flight-card">
      <div className="airline-logo">{flight.logo}</div>
      <div className="flight-main">
        <div className="flight-top">
          <h3>{flight.airline}</h3>
          <span>{flight.tag}</span>
        </div>
        <div className="route-row">
          <div><b>{flight.depart}</b><small>{flight.from}</small></div>
          <div className="route-line"><span>{flight.duration}</span></div>
          <div><b>{flight.arrive}</b><small>{flight.to}</small></div>
        </div>
      </div>
      <div className="price-box">
        <small>/khách</small>
        <strong>{formatCurrency(flight.price)}</strong>
        <button onClick={() => onChoose(flight)}>Chọn vé</button>
      </div>
    </article>
  )
}

function HotelCard({ hotel, onChoose, chooseLabel = 'Đặt ngay' }) {
  return (
    <article className="hotel-card">
      <div className="hotel-image" style={{ backgroundImage: hotel.image }}>
        <span>{'★'.repeat(hotel.stars)}</span>
      </div>
      <div className="hotel-body">
        <div className="rating-row"><b>{hotel.rating}</b><span>Tuyệt vời</span></div>
        <h3>{hotel.name}</h3>
        <p>{hotel.location}</p>
        <div className="perk-row">
          {hotel.perks.map((perk) => <span key={perk}>{perk}</span>)}
        </div>
        <div className="hotel-bottom">
          <div><small>Từ</small><strong>{formatCurrency(hotel.price)}</strong></div>
          <button onClick={() => onChoose(hotel)}>{chooseLabel}</button>
        </div>
      </div>
    </article>
  )
}

function CheckoutPage({ selectedItem, promo, setPromo, selectedPrice, passengers, setPassengers, traveler, setTraveler, dates, tripType, destination, session, onBack, onInvalid, onRequireLogin, onPickService, onPay }) {
  const { catalog } = useContext(CatalogCtx)
  const [paying, setPaying] = useState(false)
  const [method, setMethod] = useState('atm')
  const payTimer = useRef(null)
  // Guard đồng bộ (ref) để chặn double-click ngay cả trước khi React re-render
  const payingRef = useRef(false)
  // Idempotency key cho lần thanh toán hiện tại — bấm đôi gửi cùng key, server không tạo trùng
  const payIdemRef = useRef(null)

  // Hủy timer nếu rời trang checkout trước khi thanh toán hoàn tất
  useEffect(() => () => window.clearTimeout(payTimer.current), [])

  if (!selectedItem) {
    return (
      <section className="page container checkout-layout">
        <div className="checkout-main">
          <button className="back-btn" onClick={onBack}>← Quay lại trang chủ</button>
          <div className="empty-bookings">
            <span>🧺</span>
            <h2>Bạn chưa chọn dịch vụ nào</h2>
            <p>Hãy chọn vé máy bay, khách sạn hoặc combo trước khi tiến hành thanh toán.</p>
            <div className="empty-actions">
              <button onClick={() => onPickService('flight')}>Chọn vé máy bay</button>
              <button onClick={() => onPickService('hotel')}>Chọn khách sạn</button>
              <button onClick={() => onPickService('combo')}>Xem combo</button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  const item = selectedItem
  const isFlight = Boolean(item.airline)
  const isCombo = item.id?.startsWith('combo')
  const basePrice = item.price * (isFlight ? passengers : 1)
  const finalPrice = (selectedPrice || item.price) * (isFlight ? passengers : 1)
  const discount = Math.max(basePrice - finalPrice, 0)
  const promoRate = getPromoRate(promo, item)
  const promoApplicable = promoRate > 0
  const methodLabel = PAYMENT_METHODS.find((entry) => entry.id === method)?.label || PAYMENT_METHODS[0].label
  const serviceName = isFlight ? 'Vé máy bay' : isCombo ? 'Combo du lịch' : 'Khách sạn'
  const dateLabel = isFlight ? ['Ngày bay', 'Giờ đến dự kiến'] : ['Nhận phòng', 'Trả phòng']

  const handlePayment = () => {
    if (paying || payingRef.current) return

    if (!session) {
      onRequireLogin()
      return
    }

    if (traveler.name.trim().length < 2) {
      onInvalid('Vui lòng nhập họ tên người đặt (tối thiểu 2 ký tự).')
      return
    }

    if (!PHONE_RE.test(traveler.phone.replace(/\s/g, ''))) {
      onInvalid('Số điện thoại chưa hợp lệ.')
      return
    }

    if (!EMAIL_RE.test(traveler.email.trim())) {
      onInvalid('Email chưa hợp lệ.')
      return
    }

    // Chống bấm trùng: set ref đồng bộ + vô hiệu hóa nút trong lúc "xử lý thanh toán"
    payingRef.current = true
    setPaying(true)
    window.clearTimeout(payTimer.current)
    if (!payIdemRef.current) {
      payIdemRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
    }
    const idempotencyKey = payIdemRef.current
    // Thanh toán MÔ PHỎNG (demo): giữ delay ~700ms rồi ghi đơn vào database.
    // Trạng thái chỉ do server quyết định — không "ghi nhận đã thanh toán thật" ở client.
    payTimer.current = window.setTimeout(async () => {
      const res = await apiFetch('/api/bookings', {
        method: 'POST',
        body: {
          serviceType: isFlight ? 'flight' : isCombo ? 'combo' : 'hotel',
          itemId: item.id,
          passengers,
          traveler: {
            name: traveler.name.trim(),
            phone: traveler.phone.trim(),
            email: traveler.email.trim(),
          },
          // Gửi MÃ voucher (code) — server tự kiểm tra hạn dùng/giới hạn/min_order và tự tính tiền.
          promoCode: promo?.code || promo?.title || null,
          paymentMethod: methodLabel,
          destination,
          tripType,
          dates,
          idempotencyKey,
        },
      })
      if (!res.ok) {
        payingRef.current = false
        payIdemRef.current = null
        setPaying(false)
        onInvalid(res.networkError
          ? 'Không kết nối được máy chủ. Vui lòng thử lại.'
          : (res.data?.error || 'Tạo đơn hàng thất bại. Vui lòng thử lại.'))
        return
      }
      payIdemRef.current = null
      onPay(res.data.booking)
    }, 700)
  }

  return (
    <section className="page container checkout-layout">
      <div className="checkout-main">
        <button className="back-btn" onClick={onBack}>← Quay lại trang chủ</button>
        <h1>Thanh toán đặt chỗ</h1>
        <p className="muted">Hoàn tất thông tin người đặt, áp dụng ưu đãi và xác nhận đơn hàng.</p>

        <div className="traveler-card">
          <h3>Thông tin chuyến đi</h3>
          <div className="trip-info-row">
            <span><small>Điểm đến</small><b>{destination}</b></span>
            <span><small>Hình thức</small><b>{tripType}</b></span>
            <span><small>{dateLabel[0]}</small><b>{dates.depart}</b></span>
            <span><small>{dateLabel[1]}</small><b>{tripType === 'Một chiều' ? '—' : dates.ret}</b></span>
          </div>
        </div>

        <div className="traveler-card">
          <h3>Thông tin người đặt</h3>
          <div className="form-grid checkout-form">
            <label className="field"><span>Họ tên</span><input value={traveler.name} maxLength={60} autoComplete="name" placeholder="VD: Họ và tên" onChange={(event) => setTraveler({ ...traveler, name: event.target.value })} /></label>
            <label className="field"><span>Số điện thoại</span><input value={traveler.phone} maxLength={15} inputMode="tel" autoComplete="tel" placeholder="VD: 0912 345 678" onChange={(event) => setTraveler({ ...traveler, phone: event.target.value })} /></label>
            <label className="field wide"><span>Email</span><input type="email" value={traveler.email} maxLength={80} autoComplete="email" placeholder="ban@email.com" onChange={(event) => setTraveler({ ...traveler, email: event.target.value })} /></label>
            <label className="field"><span>Số khách</span><select value={passengers} onChange={(event) => setPassengers(Number(event.target.value))}><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></select></label>
          </div>
        </div>

        <div className="traveler-card">
          <h3>Chọn mã giảm giá</h3>
          <div className="mini-promos">
            {catalog.promos.map((itemPromo) => {
              const applicable = getPromoRate(itemPromo, item) > 0
              return (
                <button
                  key={itemPromo.id}
                  className={`${promo.id === itemPromo.id ? 'active' : ''} ${applicable ? '' : 'ineligible'}`}
                  onClick={() => setPromo(itemPromo)}
                >
                  <b>{itemPromo.title}</b><span>{itemPromo.desc}</span>
                  {!applicable && <em>Không áp dụng cho {serviceName.toLowerCase()}</em>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="traveler-card">
          <h3>Phương thức thanh toán</h3>
          <div className="pay-methods">
            {PAYMENT_METHODS.map((entry) => (
              <button
                type="button"
                key={entry.id}
                className={method === entry.id ? 'active' : ''}
                onClick={() => setMethod(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside className="booking-summary">
        <h3>Tóm tắt chuyến đi</h3>
        <div className="summary-item">
          <span>Dịch vụ</span>
          <b>{serviceName}</b>
        </div>
        <div className="summary-name">{item.name || `${item.airline} ${item.from} - ${item.to}`}</div>
        <div className="summary-item"><span>Giá gốc</span><b>{formatCurrency(basePrice)}</b></div>
        <div className="summary-item"><span>Mã áp dụng</span><b>{promo.title}</b></div>
        {!promoApplicable && (
          <p className="promo-warning">Mã này không áp dụng cho {serviceName.toLowerCase()} nên giảm giá là 0đ.</p>
        )}
        <div className="summary-item"><span>Giảm giá</span><b className="discount-value">-{formatCurrency(discount)}</b></div>
        <div className="summary-item"><span>Ngày đi</span><b>{dates.depart}</b></div>
        <div className="summary-item"><span>Số khách</span><b>{passengers} khách</b></div>
        <div className="summary-item"><span>Thanh toán</span><b>{methodLabel}</b></div>
        <div className="summary-total"><span>Cần thanh toán</span><strong>{formatCurrency(finalPrice)}</strong></div>
        <button className="pay-btn" onClick={handlePayment} disabled={paying}>
          {paying ? 'Đang xử lý thanh toán…' : 'Xác nhận và thanh toán'}
        </button>
        {!session && <small className="pay-hint">Bạn cần đăng nhập để hoàn tất đặt chỗ.</small>}
        <small>Đơn đặt chỗ được lưu trong trình duyệt của bạn.</small>
      </aside>
    </section>
  )
}

// Ảnh phòng có dự phòng: ảnh hỏng/không có -> placeholder gradient của khách sạn (không vỡ ảnh).
function RoomImage({ src, fallback, alt, className = '' }) {
  const [failed, setFailed] = useState(!src)
  if (failed || !src) {
    return (
      <div className={`room-img-fallback ${className}`} style={{ backgroundImage: fallback }} role="img" aria-label={alt || 'ảnh phòng'}>
        <span>🏨</span>
      </div>
    )
  }
  return <img className={className} src={src} alt={alt || ''} loading="lazy" onError={() => setFailed(true)} />
}

// Thư viện ảnh phòng: ảnh lớn + thumbnail chọn được (1 ảnh -> chỉ ảnh lớn).
function RoomGallery({ hotel, room }) {
  const images = Array.isArray(room.images) ? room.images.filter(Boolean) : []
  const [active, setActive] = useState(0)
  if (images.length === 0) {
    return <RoomImage fallback={hotel.image} alt={room.name} className="room-gallery-main" />
  }
  return (
    <div className="room-gallery">
      <RoomImage src={images[Math.min(active, images.length - 1)]} fallback={hotel.image} alt={room.name} className="room-gallery-main" />
      {images.length > 1 && (
        <div className="room-gallery-thumbs">
          {images.map((img, index) => (
            <button key={img} type="button" className={index === active ? 'active' : ''} onClick={() => setActive(index)} aria-label={`Ảnh ${index + 1}`}>
              <RoomImage src={img} alt={`${room.name} ${index + 1}`} className="room-thumb-img" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// "Phòng có gì?" — nhóm icon theo dữ liệu tiện nghi của từng phòng.
function AmenityGroups({ amenities }) {
  const groups = groupAmenities(amenities)
  if (groups.length === 0) {
    return <p className="muted">Loại phòng này chưa có thông tin tiện nghi chi tiết.</p>
  }
  return (
    <div className="amenity-groups">
      {groups.map((group) => (
        <div key={group.name} className="amenity-group">
          <h4>{group.icon} {group.name}</h4>
          <ul>
            {group.items.map((item) => (
              <li key={item}><span className="amenity-ic">{amenityIcon(item)}</span>{item}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// Trang chọn phòng: danh sách phòng của khách sạn đã chọn (từ thẻ "Chọn phòng").
function RoomsPage({ hotel, rooms, loading, onBack, onPick }) {
  if (!hotel) {
    return (
      <section className="page container rooms-page">
        <div className="empty-bookings">
          <span>🛏️</span>
          <h2>Bạn chưa chọn khách sạn</h2>
          <p>Hãy chọn một khách sạn để xem danh sách phòng còn trống.</p>
          <div className="empty-actions">
            <button onClick={onBack}>Xem khách sạn</button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="page container rooms-page">
      <div className="rooms-head">
        <button className="back-btn" onClick={onBack}>← Xem tất cả khách sạn</button>
        <div className="hotel-strip" style={{ backgroundImage: hotel.image }}>
          <div className="hotel-strip-info">
            <span className="hotel-strip-stars">{'★'.repeat(hotel.stars)}</span>
            <h1>{hotel.name}</h1>
            <p>{hotel.location} · Đánh giá <b>{hotel.rating}</b>/10</p>
          </div>
        </div>
        <h2 className="rooms-title">Chọn phòng lưu trú</h2>
      </div>

      <div className="room-list">
        {loading ? (
          <SkeletonList count={2} label="Đang tải danh sách phòng..." />
        ) : rooms.length === 0 ? (
          <div className="empty-result">
            <strong>Chưa có phòng nào</strong>
            <p>Khách sạn này chưa có thông tin phòng. Vui lòng chọn khách sạn khác hoặc thử lại sau.</p>
          </div>
        ) : (
          rooms.map((room) => (
            <article key={room.id} className="room-card">
              <RoomImage src={room.images?.[0]} fallback={hotel.image} alt={room.name} className="room-card-img" />
              <div className="room-card-body">
                <div className="room-card-head">
                  <div>
                    <h3>{room.name}</h3>
                    <p className="room-beds">🛏 {room.bedType}{room.sizeSqm ? ` · ${room.sizeSqm} m²` : ''}</p>
                  </div>
                  <div className="room-card-badges">
                    {room.breakfast && <span className="badge ok">Ăn sáng</span>}
                    {room.freeCancellation && <span className="badge ok">Hoàn hủy</span>}
                  </div>
                </div>
                <p className="room-capacity">
                  Tối đa {room.maxAdults} người lớn{room.maxChildren > 0 ? ` + ${room.maxChildren} trẻ em` : ''} · Nhận từ {room.checkinTime} · Trả trước {room.checkoutTime}
                </p>
                <ul className="room-amenity-chips">
                  {(room.amenities || []).slice(0, 6).map((item) => (
                    <li key={item}>{amenityIcon(item)} {item}</li>
                  ))}
                  {(room.amenities || []).length > 6 && <li className="more">+{room.amenities.length - 6} tiện nghi</li>}
                </ul>
                <div className="room-card-bottom">
                  <div className="room-price">
                    <small>Giá mỗi đêm</small>
                    <strong>{formatCurrency(room.price)}</strong>
                  </div>
                  <button className="pick-room-btn" onClick={() => onPick(hotel, room)}>Đặt phòng</button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}


// Toàn bộ state + logic của trang thanh toán phòng khách sạn (tách riêng cho markup gọn).
// TIỀN và voucher đều kiểm tra lại phía backend — client chỉ hiển thị kết quả.
function useHotelStay({ hotel, room, dates, session, traveler, onInvalid, onRequireLogin, onPay }) {
  const firstCheckin = dates.depart >= todayISO ? dates.depart : todayISO
  const [checkin, setCheckin] = useState(firstCheckin)
  const [checkout, setCheckout] = useState(() => (dates.ret && dates.ret > firstCheckin ? dates.ret : defaultReturn))
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [roomsCount, setRoomsCount] = useState(1)
  const [fieldErrors, setFieldErrors] = useState({})
  const [voucherInput, setVoucherInput] = useState('')
  const [voucher, setVoucher] = useState({ status: 'idle' }) // idle | checking | applied | error
  const [method, setMethod] = useState('atm')
  const [paying, setPaying] = useState(false)
  const payTimer = useRef(null)
  const payingRef = useRef(false) // chặn bấm đôi đồng bộ trước khi React re-render
  const payIdemRef = useRef(null)

  // Rời trang checkout trong lúc "đang xử lý" -> hủy timer, không tạo đơn ma.
  useEffect(() => () => window.clearTimeout(payTimer.current), [])

  const nights = nightsBetween(checkin, checkout)
  const subtotal = nights >= 1 ? room.price * nights * roomsCount : 0

  let dateError = ''
  if (!checkin || checkin < todayISO) dateError = 'Ngày nhận phòng phải từ hôm nay trở về sau.'
  else if (!checkout || nights < 1) dateError = 'Ngày trả phòng phải sau ngày nhận phòng.'
  else if (nights > 30) dateError = 'Thời gian lưu trú tối đa 30 đêm.'

  const maxAdults = room.maxAdults * roomsCount
  const maxChildren = room.maxChildren * roomsCount
  const totalGuests = adults + children
  let capacityError = ''
  if (adults > maxAdults) capacityError = `Tối đa ${maxAdults} người lớn cho ${roomsCount} phòng (${room.maxAdults}/phòng).`
  else if (children > maxChildren) capacityError = `Tối đa ${maxChildren} trẻ em cho ${roomsCount} phòng.`
  else if (totalGuests < 1 || totalGuests > 9) capacityError = 'Tổng số khách phải từ 1 đến 9.'

  const applied = voucher.status === 'applied' ? voucher.data : null
  const discount = applied ? applied.discount : 0
  const total = Math.max(subtotal - discount, 0)
  const methodLabel = PAYMENT_METHODS.find((entry) => entry.id === method)?.label || PAYMENT_METHODS[0].label

  // Đổi ngày / số phòng -> GỌI LẠI backend kiểm tra voucher (điều kiện có thể thay đổi).
  useEffect(() => {
    if (subtotal <= 0 || voucher.status !== 'applied') return undefined
    let active = true
    apiFetch('/api/promos/validate', {
      method: 'POST',
      body: { code: voucher.data.code, serviceType: 'hotel', amount: subtotal },
    }).then((res) => {
      if (!active) return
      if (res.networkError) return // mất mạng: giữ kết quả cũ, không tự xóa
      if (!res.ok) {
        setVoucher({ status: 'idle' })
        onInvalid(`Mã voucher không còn hợp lệ: ${res.data?.error || 'kiểm tra lại điều kiện.'}`)
        return
      }
      setVoucher({
        status: 'applied',
        data: {
          code: res.data.voucher.code, description: res.data.voucher.description,
          rate: res.data.voucher.rate, discount: res.data.discount, total: res.data.total,
        },
      })
    })
    return () => { active = false }
    // Chạy lại đúng khi subtotal đổi; đọc voucher từ closure của lần render đó.
  }, [subtotal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Nhập tay + Enter / nút "Áp dụng" -> backend quyết định hợp lệ hay không.
  const applyVoucher = async () => {
    const code = voucherInput.trim()
    if (code.length < 2) {
      setVoucher({ status: 'error', error: 'Vui lòng nhập mã voucher.' })
      return
    }
    if (subtotal <= 0) {
      setVoucher({ status: 'error', error: 'Thông tin lưu trú chưa hợp lệ để áp dụng voucher.' })
      return
    }
    setVoucher({ status: 'checking' })
    const res = await apiFetch('/api/promos/validate', {
      method: 'POST',
      body: { code, serviceType: 'hotel', amount: subtotal },
    })
    if (res.networkError) {
      setVoucher({ status: 'error', error: 'Không kết nối được máy chủ. Vui lòng thử lại.' })
      return
    }
    if (!res.ok) {
      setVoucher({ status: 'error', error: res.data?.error || 'Mã voucher không hợp lệ.' })
      return
    }
    setVoucher({
      status: 'applied',
      data: {
        code: res.data.voucher.code, description: res.data.voucher.description,
        rate: res.data.voucher.rate, discount: res.data.discount, total: res.data.total,
      },
    })
  }

  const clearVoucher = () => {
    setVoucher({ status: 'idle' })
    setVoucherInput('')
  }

  // Lỗi hiển thị CẠNH từng ô nhập; giữ nguyên dữ liệu hợp lệ.
  const validateTraveler = () => {
    const errs = {}
    if (traveler.name.trim().length < 2) errs.name = 'Vui lòng nhập họ tên (tối thiểu 2 ký tự).'
    if (!PHONE_RE.test(traveler.phone.replace(/\s/g, ''))) errs.phone = 'Số điện thoại chưa hợp lệ.'
    if (!EMAIL_RE.test(traveler.email.trim())) errs.email = 'Email chưa hợp lệ.'
    setFieldErrors(errs)
    return errs
  }

  const handlePayment = () => {
    if (paying || payingRef.current) return
    // Login gate trước tiên (giống luồng vé bay/combo).
    if (!session) { onRequireLogin(); return }
    if (dateError) { onInvalid(dateError); return }
    if (capacityError) { onInvalid(capacityError); return }
    if (Object.keys(validateTraveler()).length > 0) {
      onInvalid('Vui lòng kiểm tra lại thông tin khách lưu trú.')
      return
    }

    payingRef.current = true
    setPaying(true)
    window.clearTimeout(payTimer.current)
    if (!payIdemRef.current) {
      payIdemRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
    }
    const idempotencyKey = payIdemRef.current
    const appliedVoucher = voucher.status === 'applied' ? voucher.data : null

    // Thanh toán MÔ PHỎNG (demo): delay ~700ms rồi ghi đơn; server tự tính lại toàn bộ tiền.
    payTimer.current = window.setTimeout(async () => {
      const res = await apiFetch('/api/bookings', {
        method: 'POST',
        body: {
          serviceType: 'hotel',
          itemId: hotel.id,
          passengers: totalGuests,
          traveler: {
            name: traveler.name.trim(),
            phone: traveler.phone.trim(),
            email: traveler.email.trim(),
          },
          promoCode: appliedVoucher ? appliedVoucher.code : null,
          strictVoucher: Boolean(appliedVoucher), // voucher đã chọn mà hết hiệu lực -> lỗi rõ ràng
          paymentMethod: methodLabel,
          destination: hotel.location,
          tripType: 'Lưu trú',
          dates: { depart: checkin, ret: checkout },
          room: { roomId: room.id, roomsCount, adults, children },
          idempotencyKey,
        },
      })
      if (!res.ok) {
        payingRef.current = false
        payIdemRef.current = null
        setPaying(false)
        // Voucher hết lượt/hết hạn giữa lúc đặt -> bỏ mã, người dùng nhập lại.
        if (appliedVoucher && res.status === 409) setVoucher({ status: 'idle' })
        onInvalid(res.networkError
          ? 'Không kết nối được máy chủ. Vui lòng thử lại.'
          : (res.data?.error || 'Tạo đơn hàng thất bại. Vui lòng thử lại.'))
        return
      }
      payIdemRef.current = null
      onPay(res.data.booking)
    }, 700)
  }

  return {
    checkin, setCheckin, checkout, setCheckout,
    adults, setAdults, children, setChildren, roomsCount, setRoomsCount,
    fieldErrors, validateTraveler,
    voucherInput, setVoucherInput, voucher, applyVoucher, clearVoucher,
    method, setMethod, methodLabel, paying, handlePayment,
    nights, dateError, capacityError, maxAdults, maxChildren, totalGuests,
    subtotal, discount, total,
  }
}

// Trang thanh toán RIÊNG cho đặt phòng khách sạn — 2 cột desktop, 1 cột mobile.
function HotelCheckoutPage({ selection, dates, session, traveler, setTraveler, onBack, onInvalid, onRequireLogin, onPay }) {
  const { hotel, room } = selection
  const stay = useHotelStay({ hotel, room, dates, session, traveler, onInvalid, onRequireLogin, onPay })
  const {
    checkin, setCheckin, checkout, setCheckout,
    adults, setAdults, children, setChildren, roomsCount, setRoomsCount,
    fieldErrors, voucherInput, setVoucherInput, voucher, applyVoucher, clearVoucher,
    method, setMethod, methodLabel, paying, handlePayment,
    nights, dateError, capacityError, maxAdults, maxChildren,
    subtotal, discount, total,
  } = stay
  const adultOptions = Array.from({ length: Math.max(maxAdults, 1) }, (_, i) => i + 1).filter((n) => n <= 9)
  const childOptions = Array.from({ length: maxChildren + 1 }, (_, i) => i).filter((n) => n <= 9)
  const safeNights = Math.max(nights, 0)

  return (
    <section className="page container hotel-checkout">
      <div className="hotel-checkout-layout">
        <div className="checkout-main">
          <button className="back-btn" onClick={onBack}>← Chọn lại phòng</button>
          <h1>Thanh toán đặt phòng</h1>
          <p className="muted">Kiểm tra thông tin phòng, nhập voucher và hoàn tất đặt chỗ.</p>

          <div className="traveler-card">
            <h3>Phòng đã chọn</h3>
            <RoomGallery hotel={hotel} room={room} />
            <div className="room-review-head">
              <div>
                <h4>{room.name}</h4>
                <p className="muted">{hotel.name} · {hotel.location}</p>
              </div>
              <div className="room-review-rating"><b>{hotel.rating}</b><span>{'★'.repeat(hotel.stars)}</span></div>
            </div>
            <div className="room-specs">
              <span>🛏 {room.bedType}</span>
              {room.sizeSqm ? <span>📐 {room.sizeSqm} m²</span> : null}
              <span>👥 Tối đa {room.maxAdults} người lớn{room.maxChildren > 0 ? ` + ${room.maxChildren} trẻ em` : ''}</span>
              <span>🕑 Nhận từ {room.checkinTime} · Trả trước {room.checkoutTime}</span>
            </div>
            <div className="room-conditions">
              {room.breakfast && <span className="badge ok">Ăn sáng kèm phòng</span>}
              {room.freeCancellation && <span className="badge ok">Hoàn hủy miễn phí</span>}
            </div>
            <div className="stay-grid">
              <label className="field"><span>Nhận phòng</span><input type="date" value={checkin} min={todayISO} onChange={(event) => setCheckin(event.target.value)} /></label>
              <label className="field"><span>Trả phòng</span><input type="date" value={checkout} onChange={(event) => setCheckout(event.target.value)} /></label>
              <label className="field"><span>Số phòng</span><select value={roomsCount} onChange={(event) => setRoomsCount(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <label className="field"><span>Người lớn</span><select value={adults} onChange={(event) => setAdults(Number(event.target.value))}>{adultOptions.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
              <label className="field"><span>Trẻ em</span><select value={children} onChange={(event) => setChildren(Number(event.target.value))}>{childOptions.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            </div>
            {dateError && <p className="field-error" role="alert">⚠ {dateError}</p>}
            {capacityError && <p className="field-error" role="alert">⚠ {capacityError}</p>}
            <div className="room-price-line">
              <span>{formatCurrency(room.price)} × {safeNights} đêm × {roomsCount} phòng</span>
              <b>{formatCurrency(subtotal)}</b>
            </div>
          </div>

          <div className="traveler-card">
            <h3>Phòng có gì? Tiện nghi trong phòng</h3>
            <AmenityGroups amenities={room.amenities} />
          </div>

          <div className="traveler-card">
            <h3>Thông tin khách lưu trú</h3>
            <div className="form-grid checkout-form">
              <label className="field"><span>Họ tên</span>
                <input value={traveler.name} maxLength={60} autoComplete="name" placeholder="VD: Họ và tên" onChange={(event) => setTraveler({ ...traveler, name: event.target.value })} />
                {fieldErrors.name && <em className="field-error">{fieldErrors.name}</em>}
              </label>
              <label className="field"><span>Số điện thoại</span>
                <input value={traveler.phone} maxLength={15} inputMode="tel" autoComplete="tel" placeholder="VD: 0912 345 678" onChange={(event) => setTraveler({ ...traveler, phone: event.target.value })} />
                {fieldErrors.phone && <em className="field-error">{fieldErrors.phone}</em>}
              </label>
              <label className="field wide"><span>Email</span>
                <input type="email" value={traveler.email} maxLength={80} autoComplete="email" placeholder="ban@email.com" onChange={(event) => setTraveler({ ...traveler, email: event.target.value })} />
                {fieldErrors.email && <em className="field-error">{fieldErrors.email}</em>}
              </label>
            </div>
          </div>

          <div className="traveler-card">
            <h3>Phương thức thanh toán</h3>
            <div className="pay-methods">
              {PAYMENT_METHODS.map((entry) => (
                <button type="button" key={entry.id} className={method === entry.id ? 'active' : ''} onClick={() => setMethod(entry.id)}>{entry.label}</button>
              ))}
            </div>
          </div>
        </div>
        <aside className="booking-summary">
          <h3>Tóm tắt thanh toán</h3>
          <div className="summary-item"><span>Khách sạn</span><b>{hotel.name}</b></div>
          <div className="summary-name">{room.name}</div>
          <div className="summary-item"><span>Giá phòng/đêm</span><b>{formatCurrency(room.price)}</b></div>
          <div className="summary-item"><span>Số đêm</span><b>{safeNights} đêm</b></div>
          <div className="summary-item"><span>Số phòng</span><b>{roomsCount}</b></div>
          <div className="summary-item"><span>Nhận / Trả</span><b>{checkin} → {checkout}</b></div>
          <div className="summary-item"><span>Tiền phòng</span><b>{formatCurrency(subtotal)}</b></div>

          <div className="voucher-box">
            <h4>Mã giảm giá / Voucher</h4>
            <div className="voucher-input-row">
              <input
                className="voucher-input"
                value={voucherInput}
                maxLength={24}
                placeholder="Nhập mã voucher của bạn"
                aria-label="Nhập mã voucher của bạn"
                onChange={(event) => setVoucherInput(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); applyVoucher() } }}
              />
              <button type="button" className="voucher-apply" onClick={applyVoucher} disabled={voucher.status === 'checking'}>
                {voucher.status === 'checking' ? 'Đang kiểm tra…' : 'Áp dụng'}
              </button>
            </div>
            {voucher.status === 'checking' && <p className="voucher-status muted">Đang kiểm tra mã voucher…</p>}
            {voucher.status === 'error' && <p className="voucher-status error" role="alert">⚠ {voucher.error}</p>}
            {voucher.status === 'applied' && (
              <div className="voucher-applied" role="status">
                <div>
                  <b>✓ {voucher.data.code}</b>
                  <span>{voucher.data.description}</span>
                  <small>Giảm {Math.round(voucher.data.rate * 100)}% cho đơn này</small>
                </div>
                <button type="button" className="voucher-clear" onClick={clearVoucher}>Đổi mã</button>
              </div>
            )}
            {voucher.status === 'idle' && <p className="voucher-hint muted">Nhập mã rồi bấm “Áp dụng” (hoặc Enter) để kiểm tra điều kiện.</p>}
          </div>

          <div className="summary-item"><span>Giảm giá voucher</span><b className="discount-value">{discount > 0 ? `-${formatCurrency(discount)}` : formatCurrency(0)}</b></div>
          <div className="summary-item"><span>Thanh toán</span><b>{methodLabel}</b></div>
          <div className="summary-total"><span>Tổng thanh toán</span><strong>{formatCurrency(total)}</strong></div>
          <button className="pay-btn" onClick={handlePayment} disabled={paying}>
            {paying ? 'Đang xử lý thanh toán…' : 'Xác nhận và thanh toán'}
          </button>
          {!session && <small className="pay-hint">Bạn cần đăng nhập để hoàn tất đặt chỗ.</small>}
          <small>Thanh toán là bản mô phỏng (demo) phục vụ đồ án — không kết nối cổng thanh toán thật.</small>
        </aside>
      </div>
    </section>
  )
}


function BookingsPage({ bookings, onCancel, onExplore }) {
  return (
    <section className="page container bookings-page">
      <PageHero icon="🧾" title="Đặt chỗ của tôi" text="Theo dõi các đơn vé máy bay, khách sạn và combo đã đặt trên Mây An Nhiên." />
      {bookings.length === 0 ? (
        <div className="empty-bookings">
          <span>☁️</span>
          <h2>Bạn chưa có đặt chỗ nào</h2>
          <p>Hãy chọn vé máy bay, khách sạn hoặc combo để bắt đầu chuyến đi an nhiên.</p>
          <button onClick={onExplore}>Khám phá dịch vụ</button>
        </div>
      ) : (
        <div className="booking-list">
          {bookings.map((booking) => (
            <article key={booking.code} className="booking-card">
              <div>
                <span className={`status-pill ${booking.status === 'Đã hủy' ? 'cancelled' : ''}`}>{booking.status}</span>
                <h3>{booking.title}</h3>
                <p>{booking.serviceName} · {booking.passengers} khách · Mã {booking.code}</p>
                {booking.roomName && (
                  <p className="booking-room">
                    Phòng: {booking.roomName} · {booking.nights} đêm · {booking.roomsCount} phòng · {booking.adults} người lớn{booking.children > 0 ? `, ${booking.children} trẻ em` : ''}
                  </p>
                )}
                <p>Người đặt: {booking.traveler.name} · {booking.traveler.phone}</p>
                {booking.dates && (
                  <p className="booking-route">
                    Lịch trình: {booking.destination || '—'} · {booking.dates.depart}
                    {booking.tripType !== 'Một chiều' && booking.dates.ret ? ` → ${booking.dates.ret}` : ''} · {booking.tripType || ''}
                  </p>
                )}
                <small>Ngày tạo: {booking.createdAt} · Mã ưu đãi: {booking.promo}{booking.paymentMethod ? ` · Thanh toán: ${booking.paymentMethod}` : ''}</small>
              </div>
              <div className="booking-actions">
                <strong>{formatCurrency(booking.total)}</strong>
                <button disabled={booking.status === 'Đã hủy'} onClick={() => onCancel(booking.code)}>
                  {booking.status === 'Đã hủy' ? 'Đã hủy' : 'Hủy đặt chỗ'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function SkeletonList({ count = 3, label = 'Đang tải dữ liệu...' }) {
  return (
    <div className="skeleton-wrap" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-block" key={index} />
      ))}
      <p className="skeleton-label">{label}</p>
    </div>
  )
}

function NotFoundPage({ onHome }) {
  return (
    <section className="page container notfound-page">
      <strong className="notfound-code">404</strong>
      <h1>Trang bạn tìm không tồn tại</h1>
      <p>Đường dẫn có thể đã bị đổi hoặc bạn nhập sai. Hãy quay lại trang chủ để tiếp tục hành trình.</p>
      <button onClick={onHome}>Về trang chủ</button>
    </section>
  )
}

function LoginModal({ open, onClose, onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    const mail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(mail)) {
      setError('Email không hợp lệ.')
      return
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }
    setBusy(true)
    try {
      // Gửi tới server xác thực thật — KHÔNG lưu mật khẩu ở localStorage
      const message = await onLogin(mail, password)
      if (message) {
        setError(message)
        return
      }
      setEmail('')
      setPassword('')
      setError('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-overlay" onClick={onClose} role="presentation">
      <div className="login-modal" role="dialog" aria-modal="true" aria-label="Đăng nhập" onClick={(event) => event.stopPropagation()}>
        <button className="login-close" onClick={onClose} aria-label="Đóng">✕</button>
        <span className="login-logo">✈</span>
        <h2>Đăng nhập Mây An Nhiên</h2>
        <p className="login-sub">Đăng nhập để đặt vé, khách sạn và theo dõi đơn hàng.</p>

        <form onSubmit={handleSubmit} noValidate>
          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              maxLength={80}
              autoComplete="email"
              placeholder="ban@email.com"
              onChange={(event) => { setEmail(event.target.value); setError('') }}
            />
          </label>

          <label className="login-field">
            <span>Mật khẩu</span>
            <span className="password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                maxLength={64}
                autoComplete="current-password"
                placeholder="Tối thiểu 6 ký tự"
                onChange={(event) => { setPassword(event.target.value); setError('') }}
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </span>
          </label>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="login-submit" type="submit" disabled={busy}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>

        <small className="login-note">Mật khẩu chỉ được gửi tới máy chủ Mây An Nhiên (cùng nguồn gốc) để đối soát và không bao giờ lưu ở trình duyệt.</small>
      </div>
    </div>
  )
}

function RegisterModal({ open, onClose, onRegister }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const PHONE_RE = /^(0|\+84)\d{8,10}$/

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setError('')
    const nameTrim = name.trim()
    const mail = email.trim().toLowerCase()
    const phoneTrim = phone.trim()
    if (!nameTrim) {
      setError('Vui lòng nhập họ và tên.')
      return
    }
    if (!EMAIL_RE.test(mail)) {
      setError('Email không hợp lệ.')
      return
    }
    if (phoneTrim && !PHONE_RE.test(phoneTrim)) {
      setError('Số điện thoại không hợp lệ.')
      return
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.')
      return
    }
    setBusy(true)
    try {
      const message = await onRegister({ email: mail, name: nameTrim, phone: phoneTrim, password })
      if (message) {
        setError(message)
        return
      }
      setName('')
      setEmail('')
      setPhone('')
      setPassword('')
      setConfirmPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-overlay" onClick={onClose} role="presentation">
      <div className="login-modal" role="dialog" aria-modal="true" aria-label="Đăng ký" onClick={(event) => event.stopPropagation()}>
        <button className="login-close" onClick={onClose} aria-label="Đóng">✕</button>
        <span className="login-logo">📝</span>
        <h2>Đăng ký Mây An Nhiên</h2>
        <p className="login-sub">Tạo tài khoản để đặt vé, khách sạn và theo dõi đơn hàng.</p>

        <form onSubmit={handleSubmit} noValidate>
          <label className="login-field">
            <span>Họ và tên</span>
            <input
              type="text"
              value={name}
              maxLength={60}
              autoComplete="name"
              placeholder="Nguyễn Văn An"
              onChange={(event) => { setName(event.target.value); setError('') }}
            />
          </label>

          <label className="login-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              maxLength={80}
              autoComplete="email"
              placeholder="ban@email.com"
              onChange={(event) => { setEmail(event.target.value); setError('') }}
            />
          </label>

          <label className="login-field">
            <span>Số điện thoại</span>
            <input
              type="tel"
              value={phone}
              maxLength={15}
              autoComplete="tel"
              placeholder="0912 345 678"
              onChange={(event) => { setPhone(event.target.value); setError('') }}
            />
          </label>

          <label className="login-field">
            <span>Mật khẩu</span>
            <span className="password-row">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                maxLength={64}
                autoComplete="new-password"
                placeholder="Tối thiểu 6 ký tự"
                onChange={(event) => { setPassword(event.target.value); setError('') }}
              />
              <button type="button" onClick={() => setShowPassword((visible) => !visible)}>
                {showPassword ? 'Ẩn' : 'Hiện'}
              </button>
            </span>
          </label>

          <label className="login-field">
            <span>Nhập lại mật khẩu</span>
            <span className="password-row">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                maxLength={64}
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu"
                onChange={(event) => { setConfirmPassword(event.target.value); setError('') }}
              />
              <button type="button" onClick={() => setShowConfirm((visible) => !visible)}>
                {showConfirm ? 'Ẩn' : 'Hiện'}
              </button>
            </span>
          </label>

          {error && <p className="login-error" role="alert">{error}</p>}

          <button className="register-btn" type="submit" disabled={busy}>
            {busy ? 'Đang đăng ký…' : 'Tạo tài khoản'}
          </button>
        </form>

        <p className="login-note">
          Đã có tài khoản?{' '}
          <button type="button" onClick={() => { setRegisterOpen(false); setLoginOpen(true) }} className="login-link">
            Đăng nhập ngay
          </button>
        </p>
        <small className="login-note">Mật khẩu được mã hóa trước khi lưu và không bao giờ hiển thị ở trình duyệt.</small>
      </div>
    </div>
  )
}

function Footer({ onNavigate }) {
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <span className="brand-mark">✈</span>
          <h3>Mây An Nhiên</h3>
          <p>
            Nền tảng đặt vé máy bay, khách sạn và combo du lịch với quy trình minh bạch,
            hỗ trợ 24/7 và ưu đãi mới mỗi ngày.
          </p>
          <div className="pay-chips">
            <span>VISA</span>
            <span>Mastercard</span>
            <span>JCB</span>
            <span>Momo</span>
            <span>ATM</span>
          </div>
        </div>

        <div className="footer-col">
          <h4>Dịch vụ</h4>
          <div className="footer-nav">
            <button onClick={() => onNavigate('flight')}>Vé máy bay</button>
            <button onClick={() => onNavigate('hotel')}>Khách sạn</button>
            <button onClick={() => onNavigate('combo')}>Combo du lịch</button>
            <button onClick={() => onNavigate('bookings')}>Đặt chỗ của tôi</button>
          </div>
        </div>

        <div className="footer-col">
          <h4>Hỗ trợ</h4>
          <div className="footer-nav static">
            <span>Trung tâm trợ giúp</span>
            <span>Chính sách hoàn hủy</span>
            <span>Điều khoản sử dụng</span>
            <span>Chính sách bảo mật</span>
          </div>
        </div>

        <div className="footer-col">
          <h4>Liên hệ</h4>
          <div className="footer-nav static">
            <span>Hotline: 1900 6868</span>
            <span>Email: hotro@mayan.vn</span>
            <span>Q.1, TP. Hồ Chí Minh</span>
            <span>Hỗ trợ 24/7</span>
          </div>
        </div>
      </div>

      <div className="footer-bottom container">
        <span>© 2026 Mây An Nhiên. Dự án website đặt dịch vụ du lịch.</span>
        <span>Giá đã bao gồm thuế và phí · Thanh toán bảo mật</span>
      </div>
    </footer>
  )
}

export default App