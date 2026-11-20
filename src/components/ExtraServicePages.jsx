// src/components/ExtraServicePages.jsx — 5 trang dịch vụ còn lại trên ServiceDock + modal Thanh toán an toàn & Hỗ trợ 24/7.
import { useState } from 'react'
import {
  ACTIVITIES,
  AIRPORTS,
  AIRPORT_CARS,
  BUS_TRIPS,
  INSURANCE_PLANS,
  TRAIN_TRIPS,
  formatDateVN,
  formatVND,
} from '../data/extraServices.js'

function ServiceHeader({ icon, title, text, onBack }) {
  return (
    <>
      <button type="button" className="back-btn" onClick={onBack}>← Quay lại trang chủ</button>
      <div className="page-hero">
        <span>{icon}</span>
        <div>
          <h1>{title}</h1>
          <p>{text}</p>
        </div>
      </div>
    </>
  )
}

/* =========================== 1. VUI CHƠI =========================== */
export function ActivityPage({ dates, setDates, passengers, setPassengers, todayISO, onChoose, onBack }) {
  const [city, setCity] = useState('Tất cả')
  const cities = ['Tất cả', ...Array.from(new Set(ACTIVITIES.map((a) => a.city)))]
  const list = ACTIVITIES.filter((a) => city === 'Tất cả' || a.city === city)

  return (
    <section className="page container extra-service-page">
      <ServiceHeader
        icon="🎡"
        title="Vui chơi & Trải nghiệm nổi bật"
        text="Đặt vé công viên giải trí, cáp treo, show diễn và tour trong ngày — nhận mã QR vào cổng nhanh."
        onBack={onBack}
      />

      <div className="extra-filter-bar">
        <div className="momo-airlines">
          {cities.map((c) => (
            <button
              type="button"
              key={c}
              className={`momo-filter-chip ${city === c ? 'active' : ''}`}
              onClick={() => setCity(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="extra-date-inputs">
          <label className="momo-field">
            <span>📅 Ngày tham quan</span>
            <input type="date" value={dates.depart} min={todayISO} onChange={(e) => setDates({ ...dates, depart: e.target.value })} />
          </label>
          <label className="momo-field">
            <span>🎟️ Số vé</span>
            <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} vé</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="hotel-grid page-grid">
        {list.map((act) => (
          <article key={act.id} className="hotel-card">
            <div className="hotel-image" style={{ backgroundImage: act.image }}>
              <span className="extra-badge">{act.tag}</span>
            </div>
            <div className="hotel-body">
              <div className="rating-row">
                <b>{act.rating}</b>
                <span>{act.reviews} đánh giá · ⏱ {act.duration}</span>
              </div>
              <h3>{act.name}</h3>
              <p>📍 {act.location} · Ngày {formatDateVN(dates.depart)}</p>
              <div className="perk-row">
                {act.perks.map((p) => <span key={p}>{p}</span>)}
              </div>
              <div className="hotel-bottom">
                <div>
                  <small>Từ / vé</small>
                  <strong>{formatVND(act.price)}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => onChoose({ ...act, selectedMeta: { visitDate: dates.depart, city: act.city } })}
                >
                  Đặt vé ngay
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ======================= 2. ĐƯA ĐÓN SÂN BAY ======================= */
export function AirportTransferPage({ dates, setDates, todayISO, onChoose, onBack }) {
  const [direction, setDirection] = useState('Đón tại sân bay')
  const [airport, setAirport] = useState(AIRPORTS[0].code)
  const [pickupTime, setPickupTime] = useState('09:30')
  const [address, setAddress] = useState('Trung tâm Quận 1')

  const selectedAirport = AIRPORTS.find((a) => a.code === airport) || AIRPORTS[0]

  return (
    <section className="page container extra-service-page">
      <ServiceHeader
        icon="🚐"
        title="Đưa đón sân bay riêng"
        text="Tài xế chờ sẵn tại sảnh, giá trọn gói minh bạch, theo dõi giờ hạ cánh tự động."
        onBack={onBack}
      />

      <div className="momo-search-box">
        <div className="momo-trip-pills" style={{ marginBottom: 14 }}>
          {['Đón tại sân bay', 'Tiễn ra sân bay'].map((mode) => (
            <button
              type="button"
              key={mode}
              className={`momo-pill-btn ${direction === mode ? 'active' : ''}`}
              onClick={() => setDirection(mode)}
            >
              {mode === 'Đón tại sân bay' ? '🛬 Đón tại sân bay' : '🛫 Tiễn ra sân bay'}
            </button>
          ))}
        </div>

        <div className="extra-car-grid">
          <label className="momo-field">
            <span>✈️ Sân bay</span>
            <select value={airport} onChange={(e) => setAirport(e.target.value)}>
              {AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
            </select>
          </label>
          <label className="momo-field">
            <span>📍 Địa chỉ đón / trả</span>
            <input value={address} maxLength={80} placeholder="Nhập địa chỉ khách sạn / nhà riêng" onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label className="momo-field">
            <span>📅 Ngày đón</span>
            <input type="date" value={dates.depart} min={todayISO} onChange={(e) => setDates({ ...dates, depart: e.target.value })} />
          </label>
          <label className="momo-field">
            <span>🕑 Giờ đón</span>
            <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="extra-cards-grid">
        {AIRPORT_CARS.map((car) => (
          <article key={car.id} className="extra-service-card">
            <div className="extra-card-top">
              <span className="extra-tag">{car.tag}</span>
              <span className="extra-cap">👥 Tối đa {car.seats} khách · 🧳 {car.luggage} hành lý</span>
            </div>
            <h3>{car.name}</h3>
            <p className="muted">{car.model} · {direction} ({selectedAirport.code}) → {address || 'Trung tâm'}</p>
            <div className="perk-row">
              {car.perks.map((p) => <span key={p}>✓ {p}</span>)}
            </div>
            <div className="hotel-bottom">
              <div>
                <small>Giá trọn gói / xe</small>
                <strong>{formatVND(car.price)}</strong>
              </div>
              <button
                type="button"
                onClick={() => onChoose({
                  ...car,
                  selectedMeta: { direction, airport: selectedAirport.name, address, pickupTime, departDate: dates.depart },
                })}
              >
                Đặt xe ngay
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/* =========================== 3. XE KHÁCH =========================== */
const BUS_SEATS = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4']
const BUS_TAKEN = new Set(['A2', 'B3'])

export function BusPage({ dates, setDates, passengers, setPassengers, todayISO, onChoose, onBack }) {
  const [routeFilter, setRouteFilter] = useState('Tất cả')
  const [pickingBus, setPickingBus] = useState(null)
  const [busSeat, setBusSeat] = useState('A1')

  const routes = ['Tất cả', ...Array.from(new Set(BUS_TRIPS.map((b) => `${b.from} → ${b.to}`)))]
  const list = BUS_TRIPS.filter((b) => routeFilter === 'Tất cả' || `${b.from} → ${b.to}` === routeFilter)

  return (
    <section className="page container extra-service-page">
      <ServiceHeader
        icon="🚌"
        title="Đặt vé xe khách & Limousine"
        text="Chọn tuyến xe uy tín, chọn giường nằm / cabin VIP trực tuyến và lên xe bằng mã vé điện tử."
        onBack={onBack}
      />

      <div className="extra-filter-bar">
        <div className="momo-airlines">
          {routes.map((r) => (
            <button
              type="button"
              key={r}
              className={`momo-filter-chip ${routeFilter === r ? 'active' : ''}`}
              onClick={() => setRouteFilter(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="extra-date-inputs">
          <label className="momo-field">
            <span>📅 Ngày đi</span>
            <input type="date" value={dates.depart} min={todayISO} onChange={(e) => setDates({ ...dates, depart: e.target.value })} />
          </label>
          <label className="momo-field">
            <span>👥 Số ghế</span>
            <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} ghế</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="flight-list">
        {list.map((bus) => (
          <article key={bus.id} className="flight-card momo-flight-card">
            <div className="momo-flight-row">
              <div className="airline-logo">🚌</div>
              <div className="flight-main">
                <div className="flight-top">
                  <div>
                    <h3>{bus.operator}</h3>
                    <small className="flight-code">{bus.busType} · ★ {bus.rating}</small>
                  </div>
                  <span>{bus.tag}</span>
                </div>
                <div className="route-row">
                  <div><b>{bus.depart}</b><small>{bus.from}</small></div>
                  <div className="route-line momo-route-line"><span>{bus.duration}</span></div>
                  <div><b>{bus.arrive}</b><small>{bus.to}</small></div>
                </div>
              </div>
              <div className="price-box">
                <small>/ghế · {formatDateVN(dates.depart)}</small>
                <strong>{formatVND(bus.price)}</strong>
                <button type="button" onClick={() => { setPickingBus(bus); setBusSeat('A1') }}>Chọn chỗ</button>
              </div>
            </div>
          </article>
        ))}
      </div>

      {pickingBus && (
        <div className="login-overlay" onClick={() => setPickingBus(null)} role="presentation">
          <div className="momo-seat-modal compact" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="login-close" onClick={() => setPickingBus(null)} aria-label="Đóng">✕</button>
            <h3>🚌 Chọn vị trí giường / ghế — {pickingBus.operator}</h3>
            <p className="muted">{pickingBus.from} → {pickingBus.to} · {formatDateVN(dates.depart)} ({pickingBus.depart})</p>
            <div className="bus-seat-grid">
              {BUS_SEATS.map((code) => {
                const taken = BUS_TAKEN.has(code)
                return (
                  <button
                    type="button"
                    key={code}
                    disabled={taken}
                    className={`seat-btn ${taken ? 'taken' : busSeat === code ? 'chosen' : 'free'}`}
                    onClick={() => setBusSeat(code)}
                  >
                    {code} ({code.startsWith('A') ? 'Tầng dưới' : 'Tầng trên'})
                  </button>
                )
              })}
            </div>
            <div className="momo-modal-foot">
              <div>
                <small>Vị trí đã chọn: <b>{busSeat}</b> · {passengers} vé</small>
                <strong>{formatVND(pickingBus.price * passengers)}</strong>
              </div>
              <button
                type="button"
                className="pay-btn"
                onClick={() => {
                  onChoose({ ...pickingBus, selectedMeta: { seat: busSeat, departDate: dates.depart } })
                  setPickingBus(null)
                }}
              >
                Tiếp tục thanh toán →
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

/* =========================== 4. TÀU HỎA =========================== */
export function TrainPage({ dates, setDates, passengers, setPassengers, todayISO, onChoose, onBack }) {
  const [routeFilter, setRouteFilter] = useState('Tất cả')
  const [selectedCoach, setSelectedCoach] = useState('Toa 4')
  const routes = ['Tất cả', ...Array.from(new Set(TRAIN_TRIPS.map((t) => `${t.from} → ${t.to}`)))]
  const list = TRAIN_TRIPS.filter((t) => routeFilter === 'Tất cả' || `${t.from} → ${t.to}` === routeFilter)

  return (
    <section className="page container extra-service-page">
      <ServiceHeader
        icon="🚆"
        title="Đặt vé tàu hỏa Đường sắt Việt Nam"
        text="Tra cứu giờ tàu SE / SP, chọn toa ngồi mềm hoặc giường nằm điều hòa, nhận vé điện tử ngay."
        onBack={onBack}
      />

      <div className="extra-filter-bar">
        <div className="momo-airlines">
          {routes.map((r) => (
            <button
              type="button"
              key={r}
              className={`momo-filter-chip ${routeFilter === r ? 'active' : ''}`}
              onClick={() => setRouteFilter(r)}
            >
              {r}
            </button>
          ))}
        </div>
        <div className="extra-date-inputs">
          <label className="momo-field">
            <span>📅 Ngày khởi hành</span>
            <input type="date" value={dates.depart} min={todayISO} onChange={(e) => setDates({ ...dates, depart: e.target.value })} />
          </label>
          <label className="momo-field">
            <span>🚃 Chọn toa ưu tiên</span>
            <select value={selectedCoach} onChange={(e) => setSelectedCoach(e.target.value)}>
              {['Toa 2', 'Toa 4', 'Toa 6', 'Toa 8'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="momo-field">
            <span>👥 Hành khách</span>
            <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} khách</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="flight-list">
        {list.map((train) => (
          <article key={train.id} className="flight-card momo-flight-card">
            <div className="momo-flight-row">
              <div className="airline-logo">{train.code}</div>
              <div className="flight-main">
                <div className="flight-top">
                  <div>
                    <h3>Tàu {train.code} · {train.cabin}</h3>
                    <small className="flight-code">Đường sắt Việt Nam · Ưu tiên {selectedCoach}</small>
                  </div>
                  <span>{train.tag}</span>
                </div>
                <div className="route-row">
                  <div><b>{train.depart}</b><small>{train.from}</small></div>
                  <div className="route-line momo-route-line"><span>{train.duration}</span></div>
                  <div><b>{train.arrive}</b><small>{train.to}</small></div>
                </div>
              </div>
              <div className="price-box">
                <small>/khách · {formatDateVN(dates.depart)}</small>
                <strong>{formatVND(train.price)}</strong>
                <button
                  type="button"
                  onClick={() => onChoose({ ...train, selectedMeta: { coach: selectedCoach, departDate: dates.depart } })}
                >
                  Chọn vé tàu
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/* =========================== 5. BẢO HIỂM =========================== */
export function InsurancePage({ dates, setDates, passengers, setPassengers, todayISO, onChoose, onBack }) {
  const [scope, setScope] = useState('Trong nước')

  return (
    <section className="page container extra-service-page">
      <ServiceHeader
        icon="🛡️"
        title="Bảo hiểm du lịch an tâm"
        text="Bảo vệ toàn diện cho chuyến đi: y tế khẩn cấp, trễ chuyến bay, mất hành lý và hủy chuyến."
        onBack={onBack}
      />

      <div className="momo-search-box" style={{ marginBottom: 24 }}>
        <div className="momo-trip-pills" style={{ marginBottom: 14 }}>
          {['Trong nước', 'Quốc tế'].map((s) => (
            <button
              type="button"
              key={s}
              className={`momo-pill-btn ${scope === s ? 'active' : ''}`}
              onClick={() => setScope(s)}
            >
              {s === 'Trong nước' ? '🇻🇳 Du lịch trong nước' : '🌏 Du lịch quốc tế'}
            </button>
          ))}
        </div>
        <div className="extra-car-grid">
          <label className="momo-field">
            <span>📅 Ngày bắt đầu</span>
            <input type="date" value={dates.depart} min={todayISO} onChange={(e) => setDates({ ...dates, depart: e.target.value })} />
          </label>
          <label className="momo-field">
            <span>📅 Ngày kết thúc</span>
            <input type="date" value={dates.ret} min={dates.depart || todayISO} onChange={(e) => setDates({ ...dates, ret: e.target.value })} />
          </label>
          <label className="momo-field">
            <span>👥 Số người được bảo hiểm</span>
            <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} người</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="insurance-grid">
        {INSURANCE_PLANS.map((plan) => (
          <article key={plan.id} className={`insurance-card ${plan.recommended ? 'recommended' : ''}`}>
            <div className="extra-card-top">
              <span className="extra-tag">{plan.tag}</span>
              <span className="muted">{scope}</span>
            </div>
            <h3>Gói {plan.tier}</h3>
            <div className="ins-price">
              <strong>{formatVND(plan.price)}</strong>
              <small>/người /chuyến</small>
            </div>
            <div className="ins-metrics">
              <div><span>Y tế & tai nạn</span><b>{plan.medical}</b></div>
              <div><span>Trễ chuyến bay</span><b>{plan.delay}</b></div>
              <div><span>Mất hành lý</span><b>{plan.baggage}</b></div>
              <div><span>Hủy chuyến đi</span><b>{plan.cancel}</b></div>
            </div>
            <ul className="ins-perks">
              {plan.perks.map((p) => <li key={p}>✓ {p}</li>)}
            </ul>
            <button
              type="button"
              className="pay-btn"
              onClick={() => onChoose({
                ...plan,
                selectedMeta: { scope, departDate: dates.depart, returnDate: dates.ret },
              })}
            >
              Mua gói {plan.tier}
            </button>
          </article>
        ))}
      </div>
    </section>
  )
}

/* ==================== MODAL THANH TOÁN AN TOÀN & HỖ TRỢ 24/7 ==================== */
export function TrustInfoModal({ activeModal, onClose }) {
  const [messages, setMessages] = useState([
    { from: 'bot', text: 'Xin chào! 👋 Đội ngũ hỗ trợ 24/7 Mây An Nhiên luôn sẵn sàng giúp bạn. Bạn cần hỗ trợ vấn đề gì?' },
  ])
  const [input, setInput] = useState('')

  if (!activeModal) return null

  const quickReplies = [
    'Chính sách hoàn hủy vé',
    'Thanh toán MoMo / ZaloPay',
    'Đổi ngày bay / nhận phòng',
    'Gặp nhân viên tư vấn',
  ]

  const sendReply = (text) => {
    const clean = text.trim()
    if (!clean) return
    let answer = 'Cảm ơn bạn đã nhắn tin! Yêu cầu của bạn đã được chuyển tới tư vấn viên (Hotline 1900 6868).'
    if (/hủy|hoàn/i.test(clean)) answer = 'Bạn có thể tự hủy đơn trực tiếp tại mục "Đặt chỗ của tôi". Các phòng có nhãn "Hoàn hủy miễn phí" được hoàn 100%.'
    else if (/momo|zalo|thanh toán/i.test(clean)) answer = 'Mây An Nhiên hỗ trợ tách riêng Ví MoMo, ZaloPay, Thẻ ngân hàng nội địa (ATM/NAPAS) và Thẻ quốc tế Visa/Mastercard.'
    else if (/đổi ngày/i.test(clean)) answer = 'Để đổi ngày bay hoặc ngày nhận phòng, vui lòng cung cấp mã đơn (MANxxxxxxx) hoặc gọi 1900 6868 để được đổi miễn phí.'
    setMessages((prev) => [...prev, { from: 'user', text: clean }, { from: 'bot', text: answer }])
    setInput('')
  }

  return (
    <div className="login-overlay" onClick={onClose} role="presentation">
      <div className="momo-seat-modal compact" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="login-close" onClick={onClose} aria-label="Đóng">✕</button>

        {activeModal === 'security' ? (
          <div className="trust-modal-body">
            <h3>🔒 Thanh toán an toàn & Bảo mật</h3>
            <p className="muted">Mọi giao dịch trên Mây An Nhiên đều được mã hóa và bảo vệ nhiều lớp.</p>
            <ul className="ins-perks">
              <li>✓ Hỗ trợ riêng biệt Ví MoMo, ZaloPay, Thẻ ATM nội địa & Visa/Mastercard</li>
              <li>✓ Phiên đăng nhập bảo vệ bằng HttpOnly Cookie & chống CSRF</li>
              <li>✓ Chống tạo trùng đơn hàng (Idempotency Key) khi bấm thanh toán</li>
              <li>✓ Hoàn tiền minh bạch theo chính sách từng hãng bay & khách sạn</li>
            </ul>
            <button type="button" className="pay-btn" onClick={onClose}>Đã hiểu</button>
          </div>
        ) : (
          <div className="trust-modal-body">
            <h3>🛎️ Hỗ trợ khách hàng 24/7</h3>
            <p className="muted">Hotline: <b>1900 6868</b> · Email: <b>hotro@mayan.vn</b></p>
            <div className="support-chat-box">
              {messages.map((m, idx) => (
                <div key={idx} className={`chat-bubble ${m.from}`}>{m.text}</div>
              ))}
            </div>
            <div className="support-quick-chips">
              {quickReplies.map((q) => (
                <button type="button" key={q} className="momo-filter-chip" onClick={() => sendReply(q)}>{q}</button>
              ))}
            </div>
            <form
              className="support-chat-form"
              onSubmit={(e) => { e.preventDefault(); sendReply(input) }}
            >
              <input
                value={input}
                maxLength={200}
                placeholder="Nhập câu hỏi của bạn..."
                onChange={(e) => setInput(e.target.value)}
              />
              <button type="submit" className="pay-btn">Gửi</button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
