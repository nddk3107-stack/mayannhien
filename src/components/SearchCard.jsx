// src/components/SearchCard.jsx — Hộp tìm kiếm nổi đa dịch vụ Mây An Nhiên
import { useEffect, useRef, useState } from 'react'
import {
  Building2,
  Plane,
  TrainFront,
  Bus,
  CarTaxiFront,
  Gift,
  FerrisWheel,
  ShieldCheck,
  Home,
  Building,
  Sparkles,
  MapPin,
  ArrowLeftRight,
  Calendar,
  Users,
  Search,
} from 'lucide-react'

const SERVICE_TABS = [
  { id: 'hotel', Icon: Building2, label: 'Khách sạn' },
  { id: 'flight', Icon: Plane, label: 'Vé máy bay' },
  { id: 'train', Icon: TrainFront, label: 'Tàu hỏa' },
  { id: 'bus', Icon: Bus, label: 'Vé xe khách' },
  { id: 'car', Icon: CarTaxiFront, label: 'Đưa đón sân bay' },
  { id: 'combo', Icon: Gift, label: 'Combo tiết kiệm' },
  { id: 'activity', Icon: FerrisWheel, label: 'Hoạt động & Vui chơi' },
  { id: 'insurance', Icon: ShieldCheck, label: 'Bảo hiểm' },
]

const QUICK_ROUTES_BY_SERVICE = {
  flight: [
    { from: 'TP.HCM (SGN)', to: 'Đà Nẵng (DAD)', keyword: 'Đà Nẵng' },
    { from: 'Hà Nội (HAN)', to: 'Phú Quốc (PQC)', keyword: 'Phú Quốc' },
    { from: 'TP.HCM (SGN)', to: 'Hà Nội (HAN)', keyword: 'Hà Nội' },
    { from: 'Hà Nội (HAN)', to: 'Nha Trang (CXR)', keyword: 'Nha Trang' },
  ],
  train: [
    { from: 'Ga Sài Gòn', to: 'Ga Nha Trang', keyword: 'Nha Trang' },
    { from: 'Ga Hà Nội', to: 'Ga Lào Cai (Sapa)', keyword: 'Sapa' },
    { from: 'Ga Đà Nẵng', to: 'Ga Huế', keyword: 'Huế' },
  ],
  bus: [
    { from: 'TP.HCM', to: 'Đà Lạt', keyword: 'Đà Lạt' },
    { from: 'TP.HCM', to: 'Vũng Tàu', keyword: 'Vũng Tàu' },
    { from: 'Hà Nội', to: 'Hạ Long', keyword: 'Hạ Long' },
  ],
  combo: [
    { from: 'TP.HCM (SGN)', to: 'Phú Quốc', keyword: 'Phú Quốc' },
    { from: 'Hà Nội (HAN)', to: 'Đà Nẵng', keyword: 'Đà Nẵng' },
    { from: 'TP.HCM (SGN)', to: 'Nha Trang', keyword: 'Nha Trang' },
  ],
}

const QUICK_DESTINATIONS = ['Đà Nẵng', 'Phú Quốc', 'Đà Lạt', 'Nha Trang', 'Hội An', 'Sapa']

const HOTEL_SUB_TABS = [
  { id: 'all', label: 'Tất cả' },
  { id: 'hotel', Icon: Building2, label: 'Khách sạn' },
  { id: 'villa', Icon: Home, label: 'Biệt thự' },
  { id: 'apartment', Icon: Building, label: 'Căn hộ' },
]

const OTHER_SUB_TABS = {
  car: [
    { id: 'from_airport', Icon: Plane, label: 'Từ sân bay' },
    { id: 'to_airport', Icon: CarTaxiFront, label: 'Đến sân bay' },
    { id: 'hourly', Icon: Sparkles, label: 'Thuê xe theo giờ' },
  ],
  combo: [
    { id: 'flight_hotel', Icon: Plane, label: 'Máy bay + Khách sạn' },
    { id: 'resort_package', Icon: Sparkles, label: 'Gói nghỉ dưỡng trọn gói' },
  ],
  activity: [
    { id: 'all_act', label: 'Tất cả' },
    { id: 'theme_park', Icon: FerrisWheel, label: 'Công viên giải trí' },
    { id: 'day_tour', Icon: MapPin, label: 'Tour trong ngày' },
    { id: 'spa', Icon: Sparkles, label: 'Spa & Thư giãn' },
  ],
  insurance: [
    { id: 'intl', Icon: ShieldCheck, label: 'Du lịch quốc tế' },
    { id: 'dom', Icon: Building2, label: 'Du lịch trong nước' },
  ],
}

export function HeroVisual() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="visual-card visual-main">
        <img src="https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=1000&q=90" alt="" />
        <div className="visual-caption">
          <span>Signature escape</span>
          <b>Đà Nẵng · 3 ngày 2 đêm</b>
        </div>
      </div>
    </div>
  )
}

export function SearchCard({
  service,
  setService,
  tripType,
  setTripType,
  keyword,
  setKeyword,
  passengers,
  setPassengers,
  dates,
  setDates,
  onSubmit,
}) {
  const [fromCity, setFromCity] = useState('TP.HCM (SGN)')
  const [toCity, setToCity] = useState(keyword || 'Đà Nẵng (DAD)')
  const [swapping, setSwapping] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [adults, setAdults] = useState(passengers || 2)
  const [children, setChildren] = useState(0)
  const [infants, setInfants] = useState(0)
  const [seatClass, setSeatClass] = useState('Phổ thông')
  const [rooms, setRooms] = useState(1)
  const [hotelSubTab, setHotelSubTab] = useState('all')
  const [extraSubTab, setExtraSubTab] = useState({})
  const popoverRef = useRef(null)

  useEffect(() => {
    const handleOutside = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setPopoverOpen(false)
    }
    if (popoverOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [popoverOpen])

  const stripAirportCode = (s) => s ? s.replace(/\s*\([A-Z]{3}\)\s*/g, '').trim() : s

  const handleSwap = () => {
    setSwapping(true)
    const tmp = fromCity
    setFromCity(toCity)
    setToCity(tmp)
    setKeyword(stripAirportCode(tmp))
    window.setTimeout(() => setSwapping(false), 300)
  }

  const updateCounts = (nextAdults, nextChildren, nextInfants) => {
    const safeAdults = Math.max(1, nextAdults)
    const safeChildren = Math.max(0, nextChildren)
    const safeInfants = Math.max(0, nextInfants)
    setAdults(safeAdults)
    setChildren(safeChildren)
    setInfants(safeInfants)
    setPassengers(safeAdults + safeChildren)
  }

  const handleSubmit = (e) => {
    if (['flight', 'combo', 'bus', 'train'].includes(service)) {
      const cleanKeyword = keyword ? stripAirportCode(keyword) : ''
      if (!cleanKeyword && toCity) setKeyword(stripAirportCode(toCity))
      else if (cleanKeyword !== keyword) setKeyword(cleanKeyword)
    }
    onSubmit(e)
  }

  const isRouteService = ['flight', 'combo', 'bus', 'train'].includes(service)

  const col1Label = isRouteService
    ? 'Điểm khởi hành và điểm đến:'
    : service === 'hotel'
      ? 'Thành phố, địa điểm hoặc tên khách sạn:'
      : 'Điểm đến hoặc dịch vụ trải nghiệm:'

  const col2Label = service === 'hotel'
    ? 'Ngày nhận phòng và trả phòng'
    : 'Ngày khởi hành và ngày về'

  const col3Label = service === 'hotel'
    ? 'Khách và Phòng'
    : 'Hành khách và Hạng ghế'

  return (
    <form className="search-card mayan-search-card tvl-white-card" onSubmit={handleSubmit}>
      {/* 1. Hàng Pill Tabs dịch vụ Mây An Nhiên */}
      <div className="tvl-service-pills" role="tablist" aria-label="Loại hình dịch vụ">
        {SERVICE_TABS.map((item) => {
          const TabIcon = item.Icon
          return (
            <button
              type="button"
              key={item.id}
              role="tab"
              aria-selected={service === item.id}
              className={`tvl-service-pill ${service === item.id ? 'active' : ''}`}
              onClick={() => setService(item.id)}
            >
              <span className="tvl-pill-icon" aria-hidden="true">
                <TabIcon size={18} strokeWidth={1.8} />
              </span>
              <span className="tvl-pill-label">{item.label}</span>
            </button>
          )
        })}
      </div>

      {/* 2. Hàng Sub-category Chips dưới thanh Tab */}
      <div className="tvl-subcat-row">
        {service === 'hotel' && (
          <div className="tvl-subcat-chips">
            {HOTEL_SUB_TABS.map((sub) => {
              const SubIcon = sub.Icon
              return (
                <button
                  type="button"
                  key={sub.id}
                  className={`tvl-subcat-chip ${hotelSubTab === sub.id ? 'active' : ''}`}
                  onClick={() => setHotelSubTab(sub.id)}
                >
                  {SubIcon && <SubIcon size={15} strokeWidth={1.8} aria-hidden="true" />}
                  <span>{sub.label}</span>
                </button>
              )
            })}
          </div>
        )}

        {isRouteService && (
          <div className="tvl-subcat-chips">
            {['Một chiều', 'Khứ hồi', 'Nhiều chặng'].map((item) => (
              <button
                type="button"
                key={item}
                className={`tvl-subcat-chip ${tripType === item ? 'active' : ''}`}
                onClick={() => setTripType(item)}
              >
                {item}
              </button>
            ))}
            <span className="tvl-seat-hint">Hạng ghế: <b>{seatClass}</b></span>
          </div>
        )}

        {!isRouteService && service !== 'hotel' && OTHER_SUB_TABS[service] && (
          <div className="tvl-subcat-chips">
            {OTHER_SUB_TABS[service].map((sub, idx) => {
              const current = extraSubTab[service] || OTHER_SUB_TABS[service][0].id
              const SubIcon = sub.Icon
              return (
                <button
                  type="button"
                  key={sub.id || idx}
                  className={`tvl-subcat-chip ${current === sub.id ? 'active' : ''}`}
                  onClick={() => setExtraSubTab((prev) => ({ ...prev, [service]: sub.id }))}
                >
                  {SubIcon && <SubIcon size={15} strokeWidth={1.8} aria-hidden="true" />}
                  <span>{sub.label}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 3. Thanh Tìm Kiếm 3 Cột Liền Khối + Nút Kính Lúp Xanh Mây An Nhiên */}
      <div className="tvl-search-bar-wrap">
        <div className="tvl-labels-row">
          <span className="tvl-col-label">{col1Label}</span>
          <span className="tvl-col-label">{col2Label}</span>
          <span className="tvl-col-label">{col3Label}</span>
          <span className="tvl-col-label-spacer" aria-hidden="true" />
        </div>

        <div className="tvl-joined-bar">
          {/* Cột 1: Địa điểm / Tuyến đường */}
          <div className="tvl-bar-cell tvl-cell-location">
            <span className="tvl-cell-icon" aria-hidden="true">
              <MapPin size={18} strokeWidth={1.8} />
            </span>
            {isRouteService ? (
              <div className="tvl-route-inline">
                <input
                  type="text"
                  value={fromCity}
                  onChange={(e) => setFromCity(e.target.value)}
                  placeholder="Điểm đi (VD: TP.HCM)"
                  aria-label="Điểm khởi hành"
                  maxLength={60}
                />
                <button
                  type="button"
                  className="tvl-inline-swap"
                  onClick={handleSwap}
                  title="Đổi chiều điểm đi và điểm đến"
                  aria-label="Đổi chiều"
                >
                  <span style={{ display: 'inline-flex', transform: swapping ? 'rotate(180deg)' : 'none', transition: 'transform 0.25s ease' }}>
                    <ArrowLeftRight size={16} strokeWidth={1.8} />
                  </span>
                </button>
                <input
                  type="text"
                  value={toCity}
                  onChange={(e) => {
                    setToCity(e.target.value)
                    setKeyword(e.target.value)
                  }}
                  placeholder="Điểm đến (VD: Đà Nẵng)"
                  aria-label="Điểm đến"
                  maxLength={60}
                />
              </div>
            ) : (
              <input
                type="text"
                className="tvl-single-input"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="Thành phố, khách sạn, điểm đến"
                aria-label={col1Label}
                maxLength={80}
              />
            )}
          </div>

          {/* Cột 2: Ngày nhận phòng & trả phòng / Ngày đi & về */}
          <div className="tvl-bar-cell tvl-cell-dates">
            <span className="tvl-cell-icon" aria-hidden="true">
              <Calendar size={18} strokeWidth={1.8} />
            </span>
            <div className="tvl-dates-inline">
              <input
                type="date"
                value={dates.depart}
                onChange={(e) => setDates({ ...dates, depart: e.target.value })}
                aria-label={service === 'hotel' ? 'Ngày nhận phòng' : 'Ngày đi'}
              />
              <span className="tvl-date-sep">—</span>
              <input
                type="date"
                value={dates.ret}
                disabled={tripType === 'Một chiều' && isRouteService}
                onChange={(e) => setDates({ ...dates, ret: e.target.value })}
                aria-label={service === 'hotel' ? 'Ngày trả phòng' : 'Ngày về'}
              />
            </div>
          </div>

          {/* Cột 3: Khách và Phòng */}
          <div className="tvl-bar-cell tvl-cell-guests" ref={popoverRef}>
            <span className="tvl-cell-icon" aria-hidden="true">
              <Users size={18} strokeWidth={1.8} />
            </span>
            <button
              type="button"
              className="tvl-guests-trigger"
              onClick={() => setPopoverOpen(!popoverOpen)}
              aria-expanded={popoverOpen}
            >
              {service === 'hotel' ? (
                <span>{adults} người lớn, {children} Trẻ em, {rooms} phòng</span>
              ) : (
                <span>{adults} người lớn, {children} Trẻ em · {seatClass}</span>
              )}
            </button>

            {popoverOpen && (
              <div className="passenger-popover-dropdown tvl-popover">
                <div className="popover-row">
                  <div>
                    <b>Người lớn</b>
                    <small>Từ 12 tuổi trở lên</small>
                  </div>
                  <div className="counter-btns">
                    <button type="button" onClick={() => updateCounts(adults - 1, children, infants)} disabled={adults <= 1}>-</button>
                    <span>{adults}</span>
                    <button type="button" onClick={() => updateCounts(adults + 1, children, infants)} disabled={adults >= 8}>+</button>
                  </div>
                </div>

                <div className="popover-row">
                  <div>
                    <b>Trẻ em</b>
                    <small>Từ 2 - 11 tuổi</small>
                  </div>
                  <div className="counter-btns">
                    <button type="button" onClick={() => updateCounts(adults, children - 1, infants)} disabled={children <= 0}>-</button>
                    <span>{children}</span>
                    <button type="button" onClick={() => updateCounts(adults, children + 1, infants)} disabled={children >= 4}>+</button>
                  </div>
                </div>

                {service === 'hotel' ? (
                  <div className="popover-row">
                    <div>
                      <b>Phòng</b>
                      <small>Số lượng phòng nghỉ</small>
                    </div>
                    <div className="counter-btns">
                      <button type="button" onClick={() => setRooms(Math.max(1, rooms - 1))} disabled={rooms <= 1}>-</button>
                      <span>{rooms}</span>
                      <button type="button" onClick={() => setRooms(Math.min(5, rooms + 1))} disabled={rooms >= 5}>+</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="popover-row">
                      <div>
                        <b>Em bé</b>
                        <small>Dưới 2 tuổi</small>
                      </div>
                      <div className="counter-btns">
                        <button type="button" onClick={() => updateCounts(adults, children, infants - 1)} disabled={infants <= 0}>-</button>
                        <span>{infants}</span>
                        <button type="button" onClick={() => updateCounts(adults, children, infants + 1)} disabled={infants >= adults}>+</button>
                      </div>
                    </div>

                    <div className="popover-divider" />

                    <div className="seat-class-selector">
                      <b>Hạng ghế</b>
                      <div className="seat-class-pills">
                        {['Phổ thông', 'Phổ thông đặc biệt', 'Thương gia'].map((cls) => (
                          <button
                            type="button"
                            key={cls}
                            className={`seat-class-pill ${seatClass === cls ? 'active' : ''}`}
                            onClick={() => setSeatClass(cls)}
                          >
                            {cls}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                <div className="popover-foot">
                  <button type="button" className="popover-done-btn" onClick={() => setPopoverOpen(false)}>
                    Xong
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Nút Tìm Kiếm Xanh Mây An Nhiên với icon kính lúp */}
          <button
            type="submit"
            className="tvl-joined-search-btn"
            title="Tìm kiếm ngay"
            aria-label="Tìm kiếm"
          >
            <Search size={20} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>

        {/* Gợi ý chặng phổ biến / điểm đến nhanh */}
        <div className="tvl-quick-routes-bar" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginTop: '10px', fontSize: '0.82rem' }}>
          {isRouteService && QUICK_ROUTES_BY_SERVICE[service] ? (
            <>
              <span style={{ opacity: 0.75, fontWeight: 600 }}>Chặng phổ biến:</span>
              {QUICK_ROUTES_BY_SERVICE[service].map((route) => (
                <button
                  type="button"
                  key={`${route.from}-${route.to}`}
                  className="tvl-subcat-chip"
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  onClick={() => {
                    setFromCity(route.from)
                    setToCity(route.to)
                    setKeyword(route.keyword)
                  }}
                >
                  <span>{route.from}</span>
                  <ArrowLeftRight size={13} strokeWidth={1.8} aria-hidden="true" />
                  <span>{route.to}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <span style={{ opacity: 0.75, fontWeight: 600 }}>Điểm đến nổi bật:</span>
              {QUICK_DESTINATIONS.map((dest) => (
                <button
                  type="button"
                  key={dest}
                  className={`tvl-subcat-chip ${keyword === dest ? 'active' : ''}`}
                  style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                  onClick={() => setKeyword(dest)}
                >
                  <MapPin size={13} strokeWidth={1.8} aria-hidden="true" />
                  <span>{dest}</span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* 4. Dải đối tác đồng hành dưới đáy SearchCard */}
      <div className="tvl-trusted-strip">
        <span className="tvl-trusted-label">Đối tác chính thức</span>
        <div className="tvl-trusted-logos">
          <span className="tvl-partner-logo marriott">Marriott</span>
          <span className="tvl-partner-logo vna">VIETNAM AIRLINES</span>
          <span className="tvl-partner-logo vinpearl">VINPEARL</span>
          <span className="tvl-partner-logo accor">ACCOR</span>
        </div>
      </div>
    </form>
  )
}
