import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  BedDouble,
  Building2,
  Lock,
  MapPin,
  ReceiptText,
  X,
} from 'lucide-react'
import './styles/App.css'
import { CatalogCtx } from './data/CatalogContext.js'
import {
  services,
  navItems,
  flights,
  hotels,
  promos,
  localRooms,
  defaultDepart,
  defaultReturn,
  todayISO,
  pageFromHash,
  getPromoRate,
  loadBookings,
  loadSession,
  loadTraveler,
  loadHotelSelection,
  loadRoomSelection,
  bookingsKey,
  syncedBookingsKey,
  legacyImportedKey,
  HOTEL_SEL_KEY,
  ROOM_SEL_KEY,
  TRAVELER_KEY,
} from './data/constants.js'
import { API_BASE, apiFetch, apiPatch } from './services/api.js'
import { useRealtime } from './realtime/RealtimeContext.jsx'

// UI Components
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import { LoginModal, RegisterModal } from './components/AuthModals.jsx'
import FlightBookingMomo from './components/FlightBookingMomo.jsx'
import SepayModal from './components/SepayModal.jsx'
import HotelReviews from './components/HotelReviews.jsx'
import { PageHero, SkeletonList } from './components/SharedUI.jsx'

// Pages
import HomePage from './pages/HomePage.jsx'
import HotelPage from './pages/HotelPage.jsx'
import ComboPage from './pages/ComboPage.jsx'
import RoomsPage from './pages/RoomsPage.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import HotelCheckoutPage from './pages/HotelCheckoutPage.jsx'
import BookingsPage from './pages/BookingsPage.jsx'
import ProfilePage from './pages/ProfilePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import AdminApp from './pages/Admin.jsx'
import AiPlannerPage from './pages/AiPlannerPage.jsx'
import StaffScannerPage from './pages/StaffScannerPage.jsx'
import {
  ActivityPage,
  AirportTransferPage,
  BusPage,
  TrainPage,
  InsurancePage,
  TrustInfoModal,
} from './pages/ExtraServicePages.jsx'

export default function App() {
  const [page, setPage] = useState(() => pageFromHash())
  const [service, setService] = useState('hotel')
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
  const [trustModal, setTrustModal] = useState(null)
  const [reviewModalHotel, setReviewModalHotel] = useState(null)
  const [sepayBooking, setSepayBooking] = useState(null)
  const [selectedHotelId, setSelectedHotelId] = useState(loadHotelSelection)
  const [selectedRoomIds, setSelectedRoomIds] = useState(loadRoomSelection)
  const [catalog, setCatalog] = useState({ flights, hotels, promos, rooms: localRooms })
  const [catalogStatus, setCatalogStatus] = useState('loading')
  const [catalogNonce, setCatalogNonce] = useState(0)

  // Chế độ sáng / tối (Dark / Light mode)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('mayan_theme') || 'dark'
    } catch {
      return 'dark'
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('mayan_theme', theme)
    } catch {
      // storage blocked
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((curr) => {
      const next = curr === 'dark' ? 'light' : 'dark'
      notify(next === 'dark' ? 'Đã chuyển sang giao diện Tối' : 'Đã chuyển sang giao diện Sáng')
      return next
    })
  }

  // Hiệu ứng thanh Header bám dính khi cuộn trang
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Đóng Modal bằng phím ESC và scroll lock
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setLoginOpen(false)
        setRegisterOpen(false)
        setTrustModal(null)
        setReviewModalHotel(null)
        setSepayBooking(null)
      }
    }
    const isModalOpen = loginOpen || registerOpen || Boolean(trustModal) || Boolean(reviewModalHotel) || Boolean(sepayBooking)
    if (isModalOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [loginOpen, registerOpen, trustModal, reviewModalHotel, sepayBooking])

  const { subscribe } = useRealtime()

  // Lắng nghe sự kiện Real-Time
  useEffect(() => {
    const unsubBookingUpdated = subscribe('booking:updated', ({ booking }) => {
      if (!booking?.code) return
      setBookings((prev) =>
        prev.map((b) => (b.code === booking.code ? { ...b, ...booking } : b)),
      )
      notify(`Đơn ${booking.code} vừa được cập nhật: ${booking.status}`)
    })

    const unsubBookingCancelled = subscribe('booking:cancelled', ({ code }) => {
      if (!code) return
      setBookings((prev) =>
        prev.map((b) => (b.code === code ? { ...b, status: 'Đã hủy' } : b)),
      )
      notify(`Đơn ${code} đã bị hủy`)
    })

    const unsubCatalog = subscribe('catalog:updated', () => {
      setCatalogNonce((n) => n + 1)
    })

    const unsubAvatar = subscribe('user:avatar:updated', (payload) => {
      const data = payload?.data || payload
      if (data && (Number(data.userId) === Number(session?.id) || !data.userId)) {
        setSession((prev) => (prev ? { ...prev, avatarUrl: data.avatarUrl || '' } : prev))
      }
    })

    return () => {
      unsubBookingUpdated()
      unsubBookingCancelled()
      unsubCatalog()
      unsubAvatar?.()
    }
  }, [subscribe, session?.id])

  useEffect(() => {
    try {
      if (session?.email) {
        localStorage.setItem(syncedBookingsKey(session.email), JSON.stringify(bookings))
      }
    } catch {
      // storage quota
    }
  }, [bookings, session])

  useEffect(() => {
    localStorage.setItem(TRAVELER_KEY, JSON.stringify(traveler))
  }, [traveler])

  useEffect(() => {
    localStorage.setItem('may-an-nhien-session', JSON.stringify(session))
    if (!session) localStorage.removeItem('may-an-nhien-session')
  }, [session])

  useEffect(() => {
    if (selectedHotelId) sessionStorage.setItem(HOTEL_SEL_KEY, JSON.stringify(selectedHotelId))
    else sessionStorage.removeItem(HOTEL_SEL_KEY)
  }, [selectedHotelId])

  useEffect(() => {
    if (selectedRoomIds) sessionStorage.setItem(ROOM_SEL_KEY, JSON.stringify(selectedRoomIds))
    else sessionStorage.removeItem(ROOM_SEL_KEY)
  }, [selectedRoomIds])

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

  useEffect(() => {
    const onHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (page === 'admin') return
    const target = `#/${page}`
    if (window.location.hash !== target) {
      window.location.hash = target
    }
  }, [page])

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
    setReviewModalHotel(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const titles = {
      home: 'Mây An Nhiên - Đặt dịch vụ du lịch',
      flight: 'Vé máy bay - Mây An Nhiên',
      hotel: 'Khách sạn - Mây An Nhiên',
      combo: 'Combo du lịch - Mây An Nhiên',
      activity: 'Vui chơi & Trải nghiệm - Mây An Nhiên',
      car: 'Đưa đón sân bay - Mây An Nhiên',
      bus: 'Xe khách - Mây An Nhiên',
      train: 'Tàu hỏa - Mây An Nhiên',
      insurance: 'Bảo hiểm du lịch - Mây An Nhiên',
      checkout: 'Thanh toán - Mây An Nhiên',
      rooms: 'Chọn phòng - Mây An Nhiên',
      'checkout-hotel': 'Thanh toán đặt phòng - Mây An Nhiên',
      bookings: 'Đặt chỗ của tôi - Mây An Nhiên',
      profile: 'Hồ sơ cá nhân - Mây An Nhiên',
      'ai-planner': 'Lập lịch trình AI - Mây An Nhiên',
      'staff/scanner': 'Quét vé Lễ tân - Mây An Nhiên',
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
    if (event?.preventDefault) event.preventDefault()
    const trimmed = keyword.trim()
    if (!trimmed) {
      notify('Vui lòng nhập điểm đến hoặc tên khách sạn.')
      return
    }
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
    const targetPage = ['flight', 'hotel', 'combo', 'activity', 'car', 'bus', 'train', 'insurance'].includes(service)
      ? service
      : 'flight'
    setAppliedSearch({ keyword: trimmed, service, tripType, dates, passengers })
    setPage(targetPage)
    notify(`Đang tìm ${services.find((item) => item.id === service)?.label.toLowerCase()} cho "${trimmed}"`)
  }

  const refreshBookings = async (email = session?.email) => {
    if (!email) return []
    const res = await apiFetch('/api/bookings')
    if (!res.ok) return []
    const list = Array.isArray(res.data?.bookings) ? res.data.bookings : []
    setBookings(list)
    return list
  }

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
      // offline
    }
  }

  useEffect(() => {
    const email = session?.email
    if (!email || session?.offline) return undefined
    let active = true
    ;(async () => {
      const res = await apiFetch('/api/auth/me')
      if (!active) return
      if (res.networkError || res.status >= 500 || res.status === 0) return
      if (res.status === 401 || res.status === 403) {
        setSession(null)
        setBookings([])
        return
      }
      if (!res.ok) return
      const user = res.data?.user
      if (user) {
        setSession((current) =>
          current
            ? {
                ...current,
                name: user.name,
                role: user.role,
                avatarUrl: user.avatarUrl || user.avatar_url || '',
              }
            : current,
        )
      }
      await migrateLegacyBookings(email)
      await refreshBookings(email)
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.email])

  useEffect(() => {
    if (page === 'bookings' && session?.email) refreshBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, session?.email])

  const logout = () => {
    setSession(null)
    setBookings([])
    notify('Bạn đã đăng xuất.')
    apiFetch('/api/auth/logout', { method: 'POST' })
  }

  const handleLogin = async (mail, password) => {
    setBookings([])
    const res = await apiFetch('/api/auth/login', { method: 'POST', body: { email: mail, password } })
    if (res.networkError) {
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

  const handleSocialLogin = async ({ provider, email, name }) => {
    setBookings([])
    const res = await apiFetch('/api/auth/social', {
      method: 'POST',
      body: { provider, email, name },
    })
    if (res.networkError || res.status >= 500) {
      const offlineSession = { email, name: name || email.split('@')[0], provider, at: Date.now(), offline: true }
      setSession(offlineSession)
      setLoginOpen(false)
      setRegisterOpen(false)
      notify(`Xin chào ${offlineSession.name}! Đăng nhập bằng ${provider === 'google' ? 'Google' : 'Facebook'} thành công.`)
      return null
    }
    if (!res.ok) return res.data?.error || 'Đăng nhập liên kết không thành công.'
    const user = res.data.user
    const nextSession = { email: user.email, name: user.name, role: user.role, provider, at: Date.now() }
    setSession(nextSession)
    setLoginOpen(false)
    setRegisterOpen(false)
    notify(`Xin chào ${nextSession.name}! Đăng nhập bằng ${provider === 'google' ? 'Google' : 'Facebook'} thành công.`)
    await migrateLegacyBookings(nextSession.email)
    await refreshBookings(nextSession.email)
    return null
  }

  const handlePhoneLogin = async ({ phone, otp, name }) => {
    setBookings([])
    const res = await apiFetch('/api/auth/phone', {
      method: 'POST',
      body: { phone, otp, name },
    })
    if (res.networkError || res.status >= 500) {
      const digits = phone.replace(/\D/g, '')
      const offlineSession = {
        email: `sdt_${digits}@mayan.vn`,
        name: name || `Khách ${digits.slice(-4)}`,
        phone,
        provider: 'phone',
        at: Date.now(),
        offline: true,
      }
      setSession(offlineSession)
      setLoginOpen(false)
      setRegisterOpen(false)
      notify(`Xin chào ${offlineSession.name}! Xác thực SĐT thành công.`)
      return null
    }
    if (!res.ok) return res.data?.error || 'Xác thực số điện thoại thất bại.'
    const user = res.data.user
    const nextSession = { email: user.email, name: user.name, role: user.role, phone, provider: 'phone', at: Date.now() }
    setSession(nextSession)
    setLoginOpen(false)
    setRegisterOpen(false)
    notify(`Xin chào ${nextSession.name}! Đăng nhập bằng SĐT thành công.`)
    await migrateLegacyBookings(nextSession.email)
    await refreshBookings(nextSession.email)
    return null
  }

  const requireLogin = () => {
    setLoginOpen(true)
    notify('Vui lòng đăng nhập để tiếp tục thanh toán.')
  }

  const requireLoginForBookings = () => {
    setLoginOpen(true)
    notify('Vui lòng đăng nhập để xem đặt chỗ của bạn.')
  }

  if (page === 'admin') {
    return <AdminApp onExit={() => setPage('home')} />
  }

  return (
    <CatalogCtx.Provider value={catalogValue}>
      <div className={`app-shell theme-${theme}`} data-theme={theme}>
        {toast && <div className="toast">{toast}</div>}

        <LoginModal
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          onLogin={handleLogin}
          onSocialLogin={handleSocialLogin}
          onPhoneLogin={handlePhoneLogin}
          onSwitchToRegister={() => { setLoginOpen(false); setRegisterOpen(true) }}
        />
        <RegisterModal
          open={registerOpen}
          onClose={() => setRegisterOpen(false)}
          onRegister={handleRegister}
          onSocialLogin={handleSocialLogin}
          onSwitchToLogin={() => { setRegisterOpen(false); setLoginOpen(true) }}
        />
        <TrustInfoModal activeModal={trustModal} onClose={() => setTrustModal(null)} />
        <SepayModal
          isOpen={Boolean(sepayBooking)}
          booking={sepayBooking}
          onClose={() => setSepayBooking(null)}
          onSuccess={(updated) => {
            if (updated?.code) {
              setBookings((current) => current.map((b) => (b.code === updated.code ? { ...b, ...updated, status: 'Đã thanh toán', payment_status: 'paid' } : b)))
            }
          }}
          notify={notify}
        />
        {reviewModalHotel && (
          <div className="login-overlay" onClick={() => setReviewModalHotel(null)} role="presentation">
            <div className="review-modal-dialog" role="dialog" aria-modal="true" aria-label="Đánh giá và phản ánh khách sạn" onClick={(e) => e.stopPropagation()}>
              <button type="button" className="login-close" onClick={() => setReviewModalHotel(null)} aria-label="Đóng">
                <X size={18} strokeWidth={1.8} />
              </button>
              <div className="review-modal-hotel-head">
                <h3><Building2 size={20} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {reviewModalHotel.name}</h3>
                <p className="muted"><MapPin size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {reviewModalHotel.location} · Điểm {reviewModalHotel.rating}/10</p>
              </div>
              <HotelReviews hotelId={reviewModalHotel.id} session={session} compact />
            </div>
          </div>
        )}

        <Navbar
          page={page}
          setPage={(nextPage) => {
            if (['flight', 'hotel', 'combo', 'activity', 'car', 'bus', 'train', 'insurance'].includes(nextPage)) {
              setService(nextPage)
            }
            setPage(nextPage)
          }}
          session={session}
          theme={theme}
          toggleTheme={toggleTheme}
          scrolled={scrolled}
          onOpenLogin={() => setLoginOpen(true)}
          onOpenRegister={() => setRegisterOpen(true)}
          onLogout={logout}
          onNotify={notify}
        />

        {catalogStatus === 'error' && (
          <div className="data-error-banner" role="alert">
            <span><AlertTriangle size={16} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Không tải được dữ liệu từ máy chủ. Đang dùng dữ liệu dự phòng.</span>
            <button onClick={catalogValue.retryCatalog}>Thử lại</button>
          </div>
        )}

        <main>
          {page === 'home' && (
            <HomePage
              service={service}
              setService={setService}
              setPage={setPage}
              tripType={tripType}
              setTripType={setTripType}
              keyword={keyword}
              setKeyword={setKeyword}
              passengers={passengers}
              setPassengers={setPassengers}
              dates={dates}
              setDates={setDates}
              onSearch={submitSearch}
              promo={promo}
              setPromo={setPromo}
              onOpenSecurity={() => setTrustModal('security')}
              onOpenSupport={() => setTrustModal('support')}
              onOpenPromos={() => document.querySelector('#promo-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              onChooseItem={chooseItem}
              onOpenReviews={setReviewModalHotel}
            />
          )}

          {page === 'flight' && (
            <FlightBookingMomo
              flights={catalog.flights}
              loading={catalogStatus === 'loading'}
              filters={filters}
              setFilters={setFilters}
              dates={dates}
              setDates={setDates}
              tripType={tripType}
              setTripType={setTripType}
              passengers={passengers}
              setPassengers={setPassengers}
              todayISO={todayISO}
              search={appliedSearch}
              onClearSearch={() => setAppliedSearch(null)}
              onChoose={chooseItem}
            />
          )}

          {page === 'hotel' && (
            <HotelPage
              onChoose={openRooms}
              onOpenReviews={setReviewModalHotel}
              filters={filters}
              setFilters={setFilters}
              search={appliedSearch}
              onClearSearch={() => setAppliedSearch(null)}
            />
          )}

          {page === 'combo' && (
            <ComboPage
              onChoose={chooseItem}
              dates={dates}
              setDates={setDates}
              passengers={passengers}
              setPassengers={setPassengers}
              search={appliedSearch}
              onClearSearch={() => setAppliedSearch(null)}
            />
          )}

          {page === 'activity' && (
            <ActivityPage
              dates={dates}
              setDates={setDates}
              passengers={passengers}
              setPassengers={setPassengers}
              todayISO={todayISO}
              onChoose={chooseItem}
              onBack={() => setPage('home')}
            />
          )}

          {page === 'car' && (
            <AirportTransferPage
              dates={dates}
              setDates={setDates}
              todayISO={todayISO}
              onChoose={chooseItem}
              onBack={() => setPage('home')}
            />
          )}

          {page === 'bus' && (
            <BusPage
              dates={dates}
              setDates={setDates}
              passengers={passengers}
              setPassengers={setPassengers}
              todayISO={todayISO}
              onChoose={chooseItem}
              onBack={() => setPage('home')}
            />
          )}

          {page === 'train' && (
            <TrainPage
              dates={dates}
              setDates={setDates}
              passengers={passengers}
              setPassengers={setPassengers}
              todayISO={todayISO}
              onChoose={chooseItem}
              onBack={() => setPage('home')}
            />
          )}

          {page === 'insurance' && (
            <InsurancePage
              dates={dates}
              setDates={setDates}
              passengers={passengers}
              setPassengers={setPassengers}
              todayISO={todayISO}
              onChoose={chooseItem}
              onBack={() => setPage('home')}
            />
          )}

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
                setBookings((current) => [booking, ...current.filter((entry) => entry.code !== booking.code)])
                setPage('bookings')
                const isSepay = String(booking?.paymentMethod || '').toLowerCase().includes('sepay')
                  || String(booking?.paymentMethod || '').toLowerCase().includes('vietqr')
                  || booking?.status === 'Chờ thanh toán'
                if (isSepay) {
                  setSepayBooking(booking)
                  notify(`Đơn ${booking.code} đã được tạo! Quét mã VietQR để hoàn tất thanh toán.`)
                } else {
                  notify(`Đặt chỗ thành công! Mã đơn: ${booking.code}`)
                }
              }}
            />
          )}

          {page === 'rooms' && (
            <RoomsPage
              hotel={selectedHotel}
              rooms={selectedHotelRooms}
              loading={catalogStatus === 'loading'}
              session={session}
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
                  const isSepay = String(booking?.paymentMethod || '').toLowerCase().includes('sepay')
                    || String(booking?.paymentMethod || '').toLowerCase().includes('vietqr')
                    || booking?.status === 'Chờ thanh toán'
                  if (isSepay) {
                    setSepayBooking(booking)
                    notify(`Đơn ${booking.code} đã được tạo! Quét mã VietQR để hoàn tất thanh toán.`)
                  } else {
                    notify(`Đặt chỗ thành công! Mã đơn: ${booking.code}`)
                  }
                }}
              />
            ) : (
              <section className="page container checkout-layout">
                <div className="checkout-main">
                  <button className="back-btn" onClick={() => setPage('hotel')}>
                    <ArrowLeft size={16} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Quay lại trang khách sạn
                  </button>
                  <div className="empty-bookings">
                    <span><BedDouble size={36} strokeWidth={1.8} /></span>
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
            session ? (
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
                notify={notify}
                onOpenSepay={(b) => setSepayBooking(b)}
              />
            ) : (
              <section className="page container bookings-page">
                <PageHero icon={<ReceiptText size={28} strokeWidth={1.8} />} title="Đặt chỗ của tôi" text="Theo dõi các đơn vé máy bay, khách sạn và combo đã đặt trên Mây An Nhiên." />
                <div className="empty-bookings login-required">
                  <span><Lock size={36} strokeWidth={1.8} /></span>
                  <h2>Bạn cần đăng nhập</h2>
                  <p>Vui lòng đăng nhập để xem và quản lý các đặt chỗ của bạn.</p>
                  <div className="empty-actions">
                    <button className="login-required-btn" onClick={requireLoginForBookings}>Đăng nhập ngay</button>
                    <button onClick={() => setPage('home')}>Về trang chủ</button>
                  </div>
                </div>
              </section>
            )
          )}

          {page === 'profile' && (
            <ProfilePage
              session={session}
              onUpdateSession={(updated) => setSession((prev) => ({ ...prev, ...updated }))}
              onRequireLogin={() => setLoginOpen(true)}
              onBack={() => setPage('home')}
              notify={notify}
              onLogout={logout}
            />
          )}

          {page === 'staff/scanner' && (
            <StaffScannerPage
              session={session}
              onNavigate={(p) => setPage(p)}
            />
          )}

          {page === 'ai-planner' && (
            <AiPlannerPage
              session={session}
              onNavigate={(p) => setPage(p)}
              onChooseItem={chooseItem}
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

