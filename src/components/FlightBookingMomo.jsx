// src/components/FlightBookingMomo.jsx — Mô hình đặt vé máy bay giống MoMo (tìm chặng, thanh giá theo ngày, bộ lọc hãng, chi tiết chuyến & chọn ghế).
import { useMemo, useState } from 'react'
import {
  AIRPORTS,
  BAGGAGE_OPTIONS,
  FLIGHT_SEAT_COLS,
  FLIGHT_SEAT_ROWS,
  OCCUPIED_FLIGHT_SEATS,
  SEAT_CLASSES,
  airportCodeOf,
  formatDateVN,
  formatVND,
} from '../data/extraServices.js'

const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

const shiftISO = (baseIso, offsetDays) => {
  const base = Date.parse(baseIso) || Date.now()
  const d = new Date(base + offsetDays * 86400000)
  return d.toISOString().slice(0, 10)
}

const parseDurationMins = (str) => {
  const m = /(\d+)h\s*(\d+)?m?/i.exec(String(str || ''))
  if (!m) return 999
  return Number(m[1]) * 60 + Number(m[2] || 0)
}

export function FlightBookingMomo({
  flights,
  loading,
  filters,
  setFilters,
  dates,
  setDates,
  tripType,
  setTripType,
  passengers,
  setPassengers,
  todayISO,
  search,
  onClearSearch,
  onChoose,
}) {
  const [fromCity, setFromCity] = useState('Tất cả')
  const [toCity, setToCity] = useState('Tất cả')
  const [cabinFilter, setCabinFilter] = useState('Phổ thông')
  const [airlineFilter, setAirlineFilter] = useState('Tất cả')
  const [sortBy, setSortBy] = useState('price')
  const [swapping, setSwapping] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  // Modal chọn hạng vé + sơ đồ ghế + hành lý kiểu MoMo
  const [pickingFlight, setPickingFlight] = useState(null)
  const [seatClassId, setSeatClassId] = useState('eco')
  const [baggageId, setBaggageId] = useState('bg-0')
  const [selectedSeat, setSelectedSeat] = useState('2A')

  const airlines = useMemo(
    () => ['Tất cả', ...Array.from(new Set(flights.map((f) => f.airline)))],
    [flights],
  )

  // Thanh chọn ngày 7 ngày kiểu MoMo
  const dateStrip = useMemo(() => {
    const base = dates.depart >= todayISO ? dates.depart : todayISO
    const minPrice = flights.reduce((min, f) => Math.min(min, f.price), Infinity)
    const safeMin = Number.isFinite(minPrice) ? minPrice : 1290000
    return [-2, -1, 0, 1, 2, 3, 4].map((offset) => {
      const iso = shiftISO(base, offset)
      const d = new Date(`${iso}T00:00:00`)
      const dayLabel = DAY_NAMES[d.getDay()]
      const shortDate = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
      const delta = ((Math.abs(offset * 7 + d.getDate()) % 4) - 1) * 50000
      const estFare = Math.max(890000, safeMin + delta)
      return { iso, dayLabel, shortDate, estFare, disabled: iso < todayISO }
    })
  }, [dates.depart, todayISO, flights])

  const keyword = (search?.keyword || '').trim().toLowerCase()

  const filteredFlights = useMemo(() => {
    const list = flights.filter((flight) => {
      if (flight.price > filters.maxPrice) return false
      if (filters.promoOnly && !flight.hasPromo) return false
      if (fromCity !== 'Tất cả' && flight.from !== fromCity) return false
      if (toCity !== 'Tất cả' && flight.to !== toCity) return false
      if (airlineFilter !== 'Tất cả' && flight.airline !== airlineFilter) return false
      if (keyword && !`${flight.from} ${flight.to} ${flight.airline}`.toLowerCase().includes(keyword)) return false
      return true
    })
    return [...list].sort((a, b) => {
      if (sortBy === 'depart') return String(a.depart).localeCompare(String(b.depart))
      if (sortBy === 'duration') return parseDurationMins(a.duration) - parseDurationMins(b.duration)
      return a.price - b.price
    })
  }, [flights, filters.maxPrice, filters.promoOnly, fromCity, toCity, airlineFilter, keyword, sortBy])

  const handleSwap = () => {
    setSwapping(true)
    const prevFrom = fromCity
    setFromCity(toCity)
    setToCity(prevFrom)
    window.setTimeout(() => setSwapping(false), 360)
  }

  const openSeatPicker = (flight) => {
    setPickingFlight(flight)
    setSeatClassId(cabinFilter === 'Thương gia' ? 'biz' : 'eco')
    setBaggageId('bg-0')
    setSelectedSeat('2A')
  }

  const confirmFlightPick = () => {
    if (!pickingFlight) return
    const chosenClass = SEAT_CLASSES.find((c) => c.id === seatClassId) || SEAT_CLASSES[0]
    const chosenBag = BAGGAGE_OPTIONS.find((b) => b.id === baggageId) || BAGGAGE_OPTIONS[0]
    onChoose({
      ...pickingFlight,
      selectedMeta: {
        seat: selectedSeat,
        seatClass: chosenClass.label,
        baggage: chosenBag.label,
        departDate: dates.depart,
        returnDate: tripType === 'Khứ hồi' ? dates.ret : null,
      },
    })
    setPickingFlight(null)
  }

  const activeSeatClass = SEAT_CLASSES.find((c) => c.id === seatClassId) || SEAT_CLASSES[0]
  const activeBaggage = BAGGAGE_OPTIONS.find((b) => b.id === baggageId) || BAGGAGE_OPTIONS[0]

  return (
    <section className="page container momo-flight-page">
      {/* Thanh bước đặt vé kiểu MoMo */}
      <div className="momo-steps" aria-label="Quy trình đặt vé">
        <span className="momo-step active"><b>1</b> Tìm & Chọn chuyến bay</span>
        <span className="momo-step-line" />
        <span className={`momo-step ${pickingFlight ? 'active' : ''}`}><b>2</b> Hạng vé & Chọn ghế</span>
        <span className="momo-step-line" />
        <span className="momo-step"><b>3</b> Thanh toán & Xuất vé</span>
      </div>

      {/* Hộp tìm kiếm chuyến bay kiểu MoMo */}
      <div className="momo-search-box">
        <div className="momo-search-top">
          <div className="momo-trip-pills">
            {['Một chiều', 'Khứ hồi'].map((mode) => (
              <button
                type="button"
                key={mode}
                className={`momo-pill-btn ${tripType === mode ? 'active' : ''}`}
                onClick={() => setTripType(mode)}
              >
                {mode === 'Khứ hồi' ? '⇄ Khứ hồi' : '→ Một chiều'}
              </button>
            ))}
          </div>
          <div className="momo-cabin-pills">
            {['Phổ thông', 'Thương gia'].map((cls) => (
              <button
                type="button"
                key={cls}
                className={`momo-pill-btn subtle ${cabinFilter === cls ? 'active' : ''}`}
                onClick={() => setCabinFilter(cls)}
              >
                💺 {cls}
              </button>
            ))}
          </div>
        </div>

        <div className="momo-route-grid">
          <label className="momo-field">
            <span>🛫 Điểm đi</span>
            <select value={fromCity} onChange={(e) => setFromCity(e.target.value)}>
              <option value="Tất cả">Tất cả sân bay đi</option>
              {AIRPORTS.map((a) => (
                <option key={a.code} value={a.city}>{a.city} ({a.code})</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className={`momo-swap-btn ${swapping ? 'spinning' : ''}`}
            onClick={handleSwap}
            title="Đổi chiều điểm đi / điểm đến"
            aria-label="Đổi chiều điểm đi và điểm đến"
          >
            ⇄
          </button>

          <label className="momo-field">
            <span>🛬 Điểm đến</span>
            <select value={toCity} onChange={(e) => setToCity(e.target.value)}>
              <option value="Tất cả">Tất cả sân bay đến</option>
              {AIRPORTS.map((a) => (
                <option key={a.code} value={a.city}>{a.city} ({a.code})</option>
              ))}
            </select>
          </label>

          <label className="momo-field">
            <span>📅 Ngày đi</span>
            <input
              type="date"
              value={dates.depart}
              min={todayISO}
              onChange={(e) => setDates({ ...dates, depart: e.target.value })}
            />
          </label>

          <label className={`momo-field ${tripType === 'Một chiều' ? 'is-disabled' : ''}`}>
            <span>📅 Ngày về</span>
            <input
              type="date"
              value={dates.ret}
              min={dates.depart || todayISO}
              disabled={tripType === 'Một chiều'}
              onChange={(e) => setDates({ ...dates, ret: e.target.value })}
            />
          </label>

          <label className="momo-field">
            <span>👥 Hành khách</span>
            <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n} hành khách</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Thanh giá theo ngày kiểu MoMo */}
      <div className="momo-date-strip" role="tablist" aria-label="Chọn ngày bay nhanh">
        {dateStrip.map((d) => (
          <button
            type="button"
            key={d.iso}
            disabled={d.disabled}
            className={`momo-date-chip ${dates.depart === d.iso ? 'active' : ''}`}
            onClick={() => setDates({ ...dates, depart: d.iso })}
          >
            <small>{d.dayLabel}, {d.shortDate}</small>
            <b>{(d.estFare / 1000).toLocaleString('vi-VN')}k</b>
          </button>
        ))}
      </div>

      {search && (
        <div className="search-summary">
          <div>
            <b>Kết quả cho "{search.keyword}"</b>
            <span>{tripType} · {formatDateVN(dates.depart)} · {passengers} khách</span>
          </div>
          <button type="button" onClick={onClearSearch}>Xóa bộ tìm kiếm</button>
        </div>
      )}

      {/* Thanh sắp xếp & lọc hãng nhanh */}
      <div className="momo-toolbar">
        <div className="momo-airlines">
          {airlines.map((air) => (
            <button
              type="button"
              key={air}
              className={`momo-filter-chip ${airlineFilter === air ? 'active' : ''}`}
              onClick={() => setAirlineFilter(air)}
            >
              {air}
            </button>
          ))}
        </div>
        <div className="momo-sort">
          <span>Sắp xếp:</span>
          {[
            ['price', 'Giá tốt nhất'],
            ['depart', 'Cất cánh sớm'],
            ['duration', 'Bay nhanh nhất'],
          ].map(([id, label]) => (
            <button
              type="button"
              key={id}
              className={`momo-sort-btn ${sortBy === id ? 'active' : ''}`}
              onClick={() => setSortBy(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="content-layout">
        <aside className="filter-panel">
          <h3>Bộ lọc chuyến bay</h3>
          <label>
            <input
              type="checkbox"
              checked={filters.promoOnly}
              onChange={(e) => setFilters((c) => ({ ...c, promoOnly: e.target.checked }))}
            /> Có khuyến mãi
          </label>
          <div className="range-box">
            <span>Giá tối đa: {formatVND(filters.maxPrice)}</span>
            <input
              type="range"
              min="500000"
              max="5000000"
              step="100000"
              value={filters.maxPrice}
              onChange={(e) => setFilters((c) => ({ ...c, maxPrice: Number(e.target.value) }))}
            />
          </div>
          {(fromCity !== 'Tất cả' || toCity !== 'Tất cả' || airlineFilter !== 'Tất cả') && (
            <button
              type="button"
              className="reset-filter-btn"
              onClick={() => { setFromCity('Tất cả'); setToCity('Tất cả'); setAirlineFilter('Tất cả') }}
            >
              ↺ Đặt lại chặng bay
            </button>
          )}
        </aside>

        <div className="flight-list">
          {loading ? (
            <div className="skeleton-wrap" aria-hidden="true">
              <div className="skeleton-block" />
              <div className="skeleton-block" />
              <p className="skeleton-label">Đang tìm chuyến bay tốt nhất...</p>
            </div>
          ) : (
            <>
              <p className="results-count">
                {filteredFlights.length} chuyến bay phù hợp · Ngày đi {formatDateVN(dates.depart)}
              </p>
              {filteredFlights.length > 0 ? filteredFlights.map((flight) => {
                const isExpanded = expandedId === flight.id
                return (
                  <article key={flight.id} className={`flight-card momo-flight-card ${isExpanded ? 'expanded' : ''}`}>
                    <div className="momo-flight-row">
                      <div className="airline-logo">{flight.logo}</div>
                      <div className="flight-main">
                        <div className="flight-top">
                          <div>
                            <h3>{flight.airline}</h3>
                            <small className="flight-code">{flight.id} · Airbus A321 · 🧳 7kg xách tay</small>
                          </div>
                          <span>{flight.tag}</span>
                        </div>
                        <div className="route-row">
                          <div>
                            <b>{flight.depart}</b>
                            <small>{flight.from} ({airportCodeOf(flight.from)})</small>
                          </div>
                          <div className="route-line momo-route-line">
                            <span>{flight.duration}</span>
                            <em className="route-plane" aria-hidden="true">✈</em>
                          </div>
                          <div>
                            <b>{flight.arrive}</b>
                            <small>{flight.to} ({airportCodeOf(flight.to)})</small>
                          </div>
                        </div>
                        <div className="momo-card-actions">
                          <button
                            type="button"
                            className="momo-detail-toggle"
                            onClick={() => setExpandedId(isExpanded ? null : flight.id)}
                          >
                            {isExpanded ? '▲ Thu gọn chi tiết' : '▼ Chi tiết chuyến bay & hành lý'}
                          </button>
                          {flight.hasPromo && <span className="momo-promo-tag">🔥 Áp dụng mã BAYNGAY (-8%)</span>}
                        </div>
                      </div>
                      <div className="price-box">
                        <small>/khách · Đã gồm thuế phí</small>
                        <strong>{formatVND(flight.price)}</strong>
                        <button type="button" onClick={() => openSeatPicker(flight)}>Chọn vé</button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="momo-flight-details">
                        <div>
                          <b>🛫 Lịch trình chi tiết ({formatDateVN(dates.depart)})</b>
                          <p>{flight.depart} · Khởi hành tại {flight.from} ({airportCodeOf(flight.from)})</p>
                          <p>{flight.arrive} · Hạ cánh tại {flight.to} ({airportCodeOf(flight.to)}) · Bay thẳng {flight.duration}</p>
                        </div>
                        <div>
                          <b>🧳 Quy định hành lý & Vé</b>
                          <p>✓ 07 kg hành lý xách tay miễn phí</p>
                          <p>✓ Chọn chỗ ngồi trực tuyến ngay bước tiếp theo</p>
                          <p>✓ Xuất vé điện tử tức thì qua Email & Đặt chỗ của tôi</p>
                        </div>
                      </div>
                    )}
                  </article>
                )
              }) : (
                <div className="empty-result">
                  <strong>Không có chuyến bay phù hợp</strong>
                  <p>Hãy thử đổi sân bay đi/đến hoặc nhấn "Đặt lại chặng bay" để xem tất cả chuyến.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modal chọn hạng vé, sơ đồ ghế & hành lý kiểu MoMo */}
      {pickingFlight && (
        <div className="login-overlay" onClick={() => setPickingFlight(null)} role="presentation">
          <div className="momo-seat-modal" role="dialog" aria-modal="true" aria-label="Chọn hạng vé và ghế ngồi" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="login-close" onClick={() => setPickingFlight(null)} aria-label="Đóng">✕</button>
            <div className="momo-modal-head">
              <span className="airline-logo">{pickingFlight.logo}</span>
              <div>
                <h3>{pickingFlight.airline} · {pickingFlight.id}</h3>
                <p>
                  {pickingFlight.from} ({airportCodeOf(pickingFlight.from)}) → {pickingFlight.to} ({airportCodeOf(pickingFlight.to)})
                  {' · '}Ngày {formatDateVN(dates.depart)} · {pickingFlight.depart} - {pickingFlight.arrive}
                </p>
              </div>
            </div>

            <div className="momo-modal-section">
              <h4>1. Chọn hạng vé</h4>
              <div className="momo-class-grid">
                {SEAT_CLASSES.map((cls) => (
                  <button
                    type="button"
                    key={cls.id}
                    className={`momo-class-card ${seatClassId === cls.id ? 'active' : ''}`}
                    onClick={() => setSeatClassId(cls.id)}
                  >
                    <b>{cls.label}</b>
                    <small>{cls.baggage}</small>
                    <small>{cls.changeFee}</small>
                    <strong>{cls.addon === 0 ? 'Giá gốc' : `+${formatVND(cls.addon)}`}</strong>
                  </button>
                ))}
              </div>
            </div>

            <div className="momo-modal-section">
              <h4>2. Chọn chỗ ngồi trên máy bay (Ghế đang chọn: <span className="seat-highlight">{selectedSeat}</span>)</h4>
              <div className="seat-legend">
                <span><i className="seat-box free" /> Còn trống</span>
                <span><i className="seat-box chosen" /> Đang chọn</span>
                <span><i className="seat-box taken" /> Đã đặt</span>
              </div>
              <div className="cabin-map">
                {FLIGHT_SEAT_ROWS.map((row) => (
                  <div className="cabin-row" key={row}>
                    <span className="cabin-row-num">{row}</span>
                    {FLIGHT_SEAT_COLS.map((col, idx) => {
                      const code = `${row}${col}`
                      const taken = OCCUPIED_FLIGHT_SEATS.has(code)
                      const chosen = selectedSeat === code
                      return (
                        <span key={code} className={idx === 3 ? 'aisle-gap' : ''}>
                          <button
                            type="button"
                            disabled={taken}
                            className={`seat-btn ${taken ? 'taken' : chosen ? 'chosen' : 'free'}`}
                            onClick={() => setSelectedSeat(code)}
                          >
                            {code}
                          </button>
                        </span>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            <div className="momo-modal-section">
              <h4>3. Hành lý ký gửi mua thêm</h4>
              <div className="baggage-chips">
                {BAGGAGE_OPTIONS.map((bg) => (
                  <button
                    type="button"
                    key={bg.id}
                    className={`momo-filter-chip ${baggageId === bg.id ? 'active' : ''}`}
                    onClick={() => setBaggageId(bg.id)}
                  >
                    {bg.label} {bg.price > 0 ? `(+${formatVND(bg.price)})` : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="momo-modal-foot">
              <div>
                <small>Giá vé cơ bản ({passengers} khách) · Ghế {selectedSeat} · {activeSeatClass.label}</small>
                <strong>{formatVND(pickingFlight.price * passengers)}</strong>
                {(activeSeatClass.addon > 0 || activeBaggage.price > 0) && (
                  <small className="addon-note">
                    (Tiện ích chọn thêm dự kiến: +{formatVND((activeSeatClass.addon + activeBaggage.price) * passengers)})
                  </small>
                )}
              </div>
              <button type="button" className="pay-btn" onClick={confirmFlightPick}>
                Tiếp tục thanh toán →
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
