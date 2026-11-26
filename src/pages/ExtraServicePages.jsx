// src/pages/ExtraServicePages.jsx — 5 trang dịch vụ mở rộng + modal Thanh toán an toàn & Hỗ trợ 24/7.
import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Briefcase,
  Bus,
  Calendar,
  CarTaxiFront,
  Check,
  Clock,
  FerrisWheel,
  Globe,
  Headset,
  Lock,
  MapPin,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  ShieldCheck,
  Star,
  Ticket,
  TrainFront,
  Users,
  X,
} from 'lucide-react'
import { apiFetch } from '../services/api.js'
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

function useLiveExtraServices(category, defaultItems) {
  const [items, setItems] = useState(defaultItems)
  useEffect(() => {
    let active = true
    apiFetch(`/api/extra-services?category=${category}`).then((res) => {
      if (active && res.ok && Array.isArray(res.data?.items) && res.data.items.length > 0) {
        setItems(res.data.items.map((it) => ({
          id: it.id,
          serviceType: it.category === 'tour' ? 'activity' : it.category === 'airport_transfer' ? 'car' : it.category,
          name: it.name,
          price: it.price,
          ...(it.metadata || {}),
        })))
      }
    }).catch(() => {})
    return () => { active = false }
  }, [category])
  return items
}

function ServiceHeader({ icon, categoryLabel, title, text, highlights = [], onBack }) {
  return (
    <>
      <nav className="man-breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="man-breadcrumb-link" onClick={onBack}>Trang chủ Mây An Nhiên</button>
        <span className="man-breadcrumb-sep">/</span>
        <span>Dịch vụ du lịch</span>
        <span className="man-breadcrumb-sep">/</span>
        <strong>{categoryLabel || title}</strong>
      </nav>
      <div className="page-hero man-extra-hero">
        <span>{icon}</span>
        <div className="man-extra-hero-body">
          <h1>{title}</h1>
          <p>{text}</p>
          {highlights.length > 0 && (
            <div className="man-extra-highlights">
              {highlights.map((h) => (
                <span key={h} className="man-extra-highlight-pill">
                  <Check size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {h}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/* =========================== 1. VUI CHƠI =========================== */
export function ActivityPage({ dates, setDates, passengers, setPassengers, todayISO, onChoose, onBack }) {
  const activities = useLiveExtraServices('tour', ACTIVITIES)
  const [city, setCity] = useState('Tất cả')
  const cities = ['Tất cả', ...Array.from(new Set(activities.map((a) => a.city)))]
  const list = activities.filter((a) => city === 'Tất cả' || a.city === city)

  return (
    <section className="page container extra-service-page">
      <ServiceHeader
        icon={<FerrisWheel size={28} strokeWidth={1.8} />}
        categoryLabel="Hoạt động & Vui chơi"
        title="Vui chơi & Trải nghiệm nổi bật"
        text="Đặt vé công viên giải trí, cáp treo, show diễn và tour trong ngày tại Mây An Nhiên — nhận mã QR vào cổng nhanh."
        highlights={['Vé điện tử QR vào cổng thẳng', 'Hoàn hủy linh hoạt', 'Ưu đãi độc quyền Mây An Nhiên']}
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
            <span><Calendar size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Ngày tham quan</span>
            <input type="date" value={dates.depart} min={todayISO} onChange={(e) => setDates({ ...dates, depart: e.target.value })} />
          </label>
          <label className="momo-field">
            <span><Ticket size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Số vé</span>
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
                <span>
                  {act.reviews} đánh giá · <Clock size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 2 }} /> {act.duration}
                </span>
              </div>
              <h3>{act.name}</h3>
              <p>
                <MapPin size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {act.location} · Ngày {formatDateVN(dates.depart)}
              </p>
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
  const airportCars = useLiveExtraServices('airport_transfer', AIRPORT_CARS)
  const [direction, setDirection] = useState('Đón tại sân bay')
  const [airport, setAirport] = useState(AIRPORTS[0].code)
  const [pickupTime, setPickupTime] = useState('09:30')
  const [address, setAddress] = useState('Trung tâm Quận 1')

  const selectedAirport = AIRPORTS.find((a) => a.code === airport) || AIRPORTS[0]

  return (
    <section className="page container extra-service-page">
      <ServiceHeader
        icon={<CarTaxiFront size={28} strokeWidth={1.8} />}
        categoryLabel="Đưa đón sân bay"
        title="Đưa đón sân bay riêng"
        text="Tài xế Mây An Nhiên chờ sẵn tại sảnh, giá trọn gói minh bạch, theo dõi giờ hạ cánh tự động."
        highlights={['Miễn phí chờ 60 phút', 'Giá trọn gói cầu đường', 'Đổi giờ đón linh hoạt']}
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
              {mode === 'Đón tại sân bay' ? (
                <><PlaneLanding size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Đón tại sân bay</>
              ) : (
                <><PlaneTakeoff size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Tiễn ra sân bay</>
              )}
            </button>
          ))}
        </div>

        <div className="extra-car-grid">
          <label className="momo-field">
            <span><Plane size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Sân bay</span>
            <select value={airport} onChange={(e) => setAirport(e.target.value)}>
              {AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.name} ({a.code})</option>)}
            </select>
          </label>
          <label className="momo-field">
            <span><MapPin size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Địa chỉ đón / trả</span>
            <input value={address} maxLength={80} placeholder="Nhập địa chỉ khách sạn / nhà riêng" onChange={(e) => setAddress(e.target.value)} />
          </label>
          <label className="momo-field">
            <span><Calendar size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Ngày đón</span>
            <input type="date" value={dates.depart} min={todayISO} onChange={(e) => setDates({ ...dates, depart: e.target.value })} />
          </label>
          <label className="momo-field">
            <span><Clock size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Giờ đón</span>
            <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} />
          </label>
        </div>
      </div>

      <div className="extra-cards-grid">
        {airportCars.map((car) => (
          <article key={car.id} className="extra-service-card">
            <div className="extra-card-top">
              <span className="extra-tag">{car.tag}</span>
              <span className="extra-cap">
                <Users size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 3 }} /> Tối đa {car.seats} khách · <Briefcase size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 3 }} /> {car.luggage} hành lý
              </span>
            </div>
            <h3>{car.name}</h3>
            <p className="muted">
              {car.model} · {direction} ({selectedAirport.code}) <ArrowRight size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle' }} /> {address || 'Trung tâm'}
            </p>
            <div className="perk-row">
              {car.perks.map((p) => (
                <span key={p}>
                  <Check size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 3 }} /> {p}
                </span>
              ))}
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
  const busTrips = useLiveExtraServices('bus', BUS_TRIPS)
  const [routeFilter, setRouteFilter] = useState('Tất cả')
  const [pickingBus, setPickingBus] = useState(null)
  const [busSeat, setBusSeat] = useState('A1')

  const routes = ['Tất cả', ...Array.from(new Set(busTrips.map((b) => `${b.from} - ${b.to}`)))]
  const list = busTrips.filter((b) => routeFilter === 'Tất cả' || `${b.from} - ${b.to}` === routeFilter)

  return (
    <section className="page container extra-service-page">
      <ServiceHeader
        icon={<Bus size={28} strokeWidth={1.8} />}
        categoryLabel="Vé xe khách & Limousine"
        title="Đặt vé xe khách & Limousine"
        text="Chọn tuyến xe uy tín, chọn giường nằm / cabin VIP trực tuyến và lên xe bằng mã vé điện tử Mây An Nhiên."
        highlights={['Cam kết giữ đúng số giường', 'Nhà xe Limousine chuẩn 5 sao', 'Hỗ trợ đổi chuyến 24/7']}
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
            <span><Calendar size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Ngày đi</span>
            <input type="date" value={dates.depart} min={todayISO} onChange={(e) => setDates({ ...dates, depart: e.target.value })} />
          </label>
          <label className="momo-field">
            <span><Users size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Số ghế</span>
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
              <div className="airline-logo"><Bus size={20} strokeWidth={1.8} /></div>
              <div className="flight-main">
                <div className="flight-top">
                  <div>
                    <h3>{bus.operator}</h3>
                    <small className="flight-code">
                      {bus.busType} · <Star size={12} strokeWidth={1.8} fill="currentColor" style={{ verticalAlign: 'middle', marginRight: 2 }} /> {bus.rating}
                    </small>
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
            <button type="button" className="login-close" onClick={() => setPickingBus(null)} aria-label="Đóng">
              <X size={18} strokeWidth={1.8} />
            </button>
            <h3>
              <Bus size={18} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Chọn vị trí giường / ghế — {pickingBus.operator}
            </h3>
            <p className="muted">
              {pickingBus.from} <ArrowRight size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle' }} /> {pickingBus.to} · {formatDateVN(dates.depart)} ({pickingBus.depart})
            </p>
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
                Tiếp tục thanh toán <ArrowRight size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
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
  const trainTrips = useLiveExtraServices('train', TRAIN_TRIPS)
  const [routeFilter, setRouteFilter] = useState('Tất cả')
  const [selectedCoach, setSelectedCoach] = useState('Toa 4')
  const routes = ['Tất cả', ...Array.from(new Set(trainTrips.map((t) => `${t.from} - ${t.to}`)))]
  const list = trainTrips.filter((t) => routeFilter === 'Tất cả' || `${t.from} - ${t.to}` === routeFilter)

  return (
    <section className="page container extra-service-page">
      <ServiceHeader
        icon={<TrainFront size={28} strokeWidth={1.8} />}
        categoryLabel="Vé tàu hỏa"
        title="Đặt vé tàu hỏa Đường sắt Việt Nam"
        text="Tra cứu giờ tàu SE / SP, chọn toa ngồi mềm hoặc giường nằm điều hòa, nhận vé điện tử Mây An Nhiên ngay."
        highlights={['Kết nối lịch tàu chính thức', 'Chọn toa & khoang linh hoạt', 'Xuất vé QR lên tàu nhanh']}
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
            <span><Calendar size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Ngày khởi hành</span>
            <input type="date" value={dates.depart} min={todayISO} onChange={(e) => setDates({ ...dates, depart: e.target.value })} />
          </label>
          <label className="momo-field">
            <span><TrainFront size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Chọn toa ưu tiên</span>
            <select value={selectedCoach} onChange={(e) => setSelectedCoach(e.target.value)}>
              {['Toa 2', 'Toa 4', 'Toa 6', 'Toa 8'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="momo-field">
            <span><Users size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Hành khách</span>
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
  const insurancePlans = useLiveExtraServices('insurance', INSURANCE_PLANS)
  const [scope, setScope] = useState('Trong nước')

  return (
    <section className="page container extra-service-page">
      <ServiceHeader
        icon={<ShieldCheck size={28} strokeWidth={1.8} />}
        categoryLabel="Bảo hiểm du lịch"
        title="Bảo hiểm du lịch an tâm"
        text="Bảo vệ toàn diện cho chuyến đi cùng Mây An Nhiên: y tế khẩn cấp, trễ chuyến bay, mất hành lý và hủy chuyến."
        highlights={['Cấp hợp đồng điện tử tức thì', 'Bồi thường trực tuyến nhanh gọn', 'Bảo vệ y tế đến 2 tỷ đồng']}
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
              {s === 'Trong nước' ? (
                <><MapPin size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Du lịch trong nước</>
              ) : (
                <><Globe size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Du lịch quốc tế</>
              )}
            </button>
          ))}
        </div>
        <div className="extra-car-grid">
          <label className="momo-field">
            <span><Calendar size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Ngày bắt đầu</span>
            <input type="date" value={dates.depart} min={todayISO} onChange={(e) => setDates({ ...dates, depart: e.target.value })} />
          </label>
          <label className="momo-field">
            <span><Calendar size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Ngày kết thúc</span>
            <input type="date" value={dates.ret} min={dates.depart || todayISO} onChange={(e) => setDates({ ...dates, ret: e.target.value })} />
          </label>
          <label className="momo-field">
            <span><Users size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Số người được bảo hiểm</span>
            <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} người</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="insurance-grid">
        {insurancePlans.map((plan) => (
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
              {plan.perks.map((p) => (
                <li key={p}>
                  <Check size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {p}
                </li>
              ))}
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
    { from: 'bot', text: 'Xin chào! Đội ngũ hỗ trợ 24/7 Mây An Nhiên luôn sẵn sàng giúp bạn. Bạn cần hỗ trợ vấn đề gì?' },
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
        <button type="button" className="login-close" onClick={onClose} aria-label="Đóng">
          <X size={18} strokeWidth={1.8} />
        </button>

        {activeModal === 'security' ? (
          <div className="trust-modal-body">
            <h3>
              <Lock size={18} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Thanh toán an toàn & Bảo mật
            </h3>
            <p className="muted">Mọi giao dịch trên Mây An Nhiên đều được mã hóa và bảo vệ nhiều lớp.</p>
            <ul className="ins-perks">
              <li><Check size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Hỗ trợ riêng biệt Ví MoMo, ZaloPay, Thẻ ATM nội địa & Visa/Mastercard</li>
              <li><Check size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Phiên đăng nhập bảo vệ bằng HttpOnly Cookie & chống CSRF</li>
              <li><Check size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Chống tạo trùng đơn hàng (Idempotency Key) khi bấm thanh toán</li>
              <li><Check size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Hoàn tiền minh bạch theo chính sách từng hãng bay & khách sạn</li>
            </ul>
            <button type="button" className="pay-btn" onClick={onClose}>Đã hiểu</button>
          </div>
        ) : (
          <div className="trust-modal-body">
            <h3>
              <Headset size={18} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Hỗ trợ khách hàng 24/7
            </h3>
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
