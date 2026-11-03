import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

// Base API cho production: để trống = cùng origin (đi qua reverse proxy).
// Có thể đặt qua biến môi trường VITE_API_BASE khi deploy.
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')

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

const createBookingCode = () => `MAN${Date.now().toString().slice(-7)}`
const createBookingTime = () => new Date().toLocaleString('vi-VN')
const toISO = (date) => date.toISOString().slice(0, 10)
const defaultDepart = toISO(new Date(Date.now() + 7 * 86400000))
const defaultReturn = toISO(new Date(Date.now() + 10 * 86400000))
const todayISO = toISO(new Date())

const KNOWN_PAGES = ['home', 'flight', 'hotel', 'combo', 'checkout', 'bookings']

const pageFromHash = () => {
  const raw = window.location.hash.replace(/^#\/?/, '').trim()
  if (!raw) return 'home'
  return KNOWN_PAGES.includes(raw) ? raw : 'notfound'
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^(0|\+84)\d{8,10}$/

const PAYMENT_METHODS = [
  { id: 'atm', label: 'Thẻ ATM nội địa' },
  { id: 'wallet', label: 'Ví điện tử (MoMo, ZaloPay)' },
  { id: 'card', label: 'Thẻ quốc tế' },
]

// Tính phần trăm giảm giá: mỗi mã chỉ áp đúng loại dịch vụ của nó
const getPromoRate = (promoItem, item) => {
  if (!promoItem || !item) return 0
  const isFlight = Boolean(item.airline)
  const isCombo = typeof item.id === 'string' && item.id.startsWith('combo')
  if (promoItem.id === 'p3') return isCombo ? 0.25 : 0
  if (promoItem.id === 'p2') return isFlight || isCombo ? 0.08 : 0
  return isFlight ? 0 : 0.12
}

// Đọc dữ liệu localStorage có kiểm tra kiểu để tránh crash khi dữ liệu hỏng
// Key lưu đơn theo tài khoản: khách dùng key chung, user đã đăng nhập dùng key riêng
const bookingsKey = (email) => (email ? `may-an-nhien-bookings:${email}` : 'may-an-nhien-bookings')

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
  const [catalog, setCatalog] = useState({ flights, hotels, promos })
  const [catalogStatus, setCatalogStatus] = useState('loading')
  const [catalogNonce, setCatalogNonce] = useState(0)

  useEffect(() => {
    localStorage.setItem(bookingsKey(session?.email), JSON.stringify(bookings))
  }, [bookings, session])

  useEffect(() => {
    localStorage.setItem(TRAVELER_KEY, JSON.stringify(traveler))
  }, [traveler])

  useEffect(() => {
    if (session) {
      localStorage.setItem('may-an-nhien-session', JSON.stringify(session))
    } else {
      localStorage.removeItem('may-an-nhien-session')
    }
  }, [session])

  // Đồng bộ trang với hash URL (#/hotel, #/flight...) + bắt route lạ (404)
  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
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
      bookings: 'Đặt chỗ của tôi - Mây An Nhiên',
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

  const logout = () => {
    setSession(null)
    setBookings(loadBookings(bookingsKey(null)))
    notify('Bạn đã đăng xuất.')
  }

  const requireLogin = () => {
    setLoginOpen(true)
    notify('Vui lòng đăng nhập để tiếp tục thanh toán.')
  }

  return (
    <CatalogCtx.Provider value={catalogValue}>
    <div className="app-shell">
      {toast && <div className="toast">{toast}</div>}

      <LoginModal
        open={loginOpen}
        onClose={() => setLoginOpen(false)}
        onLogin={(newSession) => {
          setSession(newSession)
          setBookings(loadBookings(bookingsKey(newSession.email)))
          setLoginOpen(false)
          notify(`Xin chào ${newSession.name}! Bạn đã đăng nhập.`)
        }}
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
              <button className="login-btn" onClick={() => setLoginOpen(true)}>Đăng nhập</button>
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
            <ListingPreview title="Khách sạn nổi bật hôm nay" type="hotel" onChoose={chooseItem} />
          </>
        )}

        {page === 'flight' && <FlightPage onChoose={chooseItem} filters={filters} setFilters={setFilters} search={appliedSearch} onClearSearch={() => setAppliedSearch(null)} />}
        {page === 'hotel' && <HotelPage onChoose={chooseItem} filters={filters} setFilters={setFilters} search={appliedSearch} onClearSearch={() => setAppliedSearch(null)} />}
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
            onPay={(booking) => {
              setBookings((current) => [booking, ...current])
              setPage('bookings')
              notify(`Đặt chỗ thành công! Mã đơn: ${booking.code}`)
            }}
          />
        )}
        {page === 'bookings' && (
          <BookingsPage
            bookings={bookings}
            onCancel={(code) => {
              setBookings((current) => current.map((booking) => booking.code === code ? { ...booking, status: 'Đã hủy' } : booking))
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
              {filteredHotels.length > 0 ? filteredHotels.map((hotel) => <HotelCard key={hotel.id} hotel={hotel} onChoose={onChoose} />) : <EmptyResult text="Không có khách sạn phù hợp. Hãy thử từ khóa khác hoặc gỡ bộ lọc." />}
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
  const combos = catalog.hotels
    .map((hotel, index) => ({ ...hotel, id: `combo-${hotel.id}`, price: hotel.price + (catalog.flights[index]?.price || 0) - 450000, name: `Combo ${hotel.name} + vé bay` }))
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

function HotelCard({ hotel, onChoose }) {
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
          <button onClick={() => onChoose(hotel)}>Đặt ngay</button>
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
    payTimer.current = window.setTimeout(() => {
      const code = createBookingCode()
      onPay({
        code,
        status: 'Đã xác nhận',
        createdAt: createBookingTime(),
        serviceName,
        title: item.name || `${item.airline} ${item.from} - ${item.to}`,
        traveler,
        passengers,
        promo: promo.title,
        total: finalPrice,
        destination,
        tripType,
        dates,
        paymentMethod: methodLabel,
      })
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

  if (!open) return null

  const handleSubmit = (event) => {
    event.preventDefault()
    const mail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(mail)) {
      setError('Email không hợp lệ.')
      return
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }
    // Demo đăng nhập: chỉ lưu phiên (email + tên) — KHÔNG lưu mật khẩu
    onLogin({ email: mail, name: mail.split('@')[0], at: Date.now() })
    setEmail('')
    setPassword('')
    setError('')
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

          <button className="login-submit" type="submit">Đăng nhập</button>
        </form>

        <small className="login-note">Bản demo: phiên đăng nhập chỉ lưu trên máy bạn, mật khẩu không được gửi hay lưu lại.</small>
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