// src/pages/ComboPage.jsx — Trang gói combo du lịch (Vé máy bay + Khách sạn)
import { useContext, useState } from 'react'
import {
  AlertCircle,
  Armchair,
  ArrowRight,
  BedDouble,
  Building2,
  Calendar,
  Plane,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { CatalogCtx } from '../data/CatalogContext.js'
import { formatCurrency, localRooms, nightsBetween, todayISO } from '../data/constants.js'
import {
  FLIGHT_SEAT_COLS,
  FLIGHT_SEAT_ROWS,
  OCCUPIED_FLIGHT_SEATS,
  SEAT_CLASSES,
  formatDateVN,
} from '../data/extraServices.js'
import {
  EmptyResult,
  HotelCard,
  PageHero,
  ResultsCount,
  SearchSummary,
  SkeletonList,
} from '../components/SharedUI.jsx'

export function ComboPage({ onChoose, dates, setDates, passengers, setPassengers, search, onClearSearch }) {
  const { catalog, catalogStatus } = useContext(CatalogCtx)
  const keyword = (search?.keyword || '').trim().toLowerCase()
  const [customizingCombo, setCustomizingCombo] = useState(null)
  const [pickedHotelId, setPickedHotelId] = useState('')
  const [pickedRoomId, setPickedRoomId] = useState('')
  const [pickedFlightId, setPickedFlightId] = useState('')
  const [pickedSeatClass, setPickedSeatClass] = useState('eco')
  const [pickedSeat, setPickedSeat] = useState('3B')

  const roomsList = (Array.isArray(catalog.rooms) && catalog.rooms.length > 0) ? catalog.rooms : localRooms

  const combos = (Array.isArray(catalog.combos) ? catalog.combos : catalog.hotels
    .map((hotel, index) => ({
      ...hotel,
      id: `combo-${hotel.id}`,
      hotelId: hotel.id,
      flightId: catalog.flights[index]?.id || catalog.flights[0]?.id,
      price: hotel.price + (catalog.flights[index]?.price || 0) - 450000,
      name: `Combo ${hotel.name} + vé bay`,
    })))
    .filter((combo) => !keyword || `${combo.name} ${combo.location}`.toLowerCase().includes(keyword))

  const handleHotelChange = (nextHotelId) => {
    setPickedHotelId(nextHotelId)
    const nextRooms = roomsList.filter((r) => r.hotelId === nextHotelId)
    setPickedRoomId(nextRooms[0]?.id || '')
  }

  const confirmCombo = () => {
    if (!customizingCombo) return
    const h = catalog.hotels.find((x) => x.id === pickedHotelId)
    const r = roomsList.find((x) => x.id === pickedRoomId)
    const f = catalog.flights.find((x) => x.id === pickedFlightId)
    const cls = SEAT_CLASSES.find((c) => c.id === pickedSeatClass) || SEAT_CLASSES[0]
    onChoose({
      ...customizingCombo,
      selectedMeta: {
        departDate: dates.depart,
        returnDate: dates.ret,
        hotelName: h?.name || customizingCombo.name,
        roomName: r?.name || 'Phòng tiêu chuẩn',
        flightInfo: f ? `${f.airline} (${f.from} - ${f.to}, ${f.depart})` : '',
        seat: pickedSeat,
        seatClass: cls.label,
      },
    })
    setCustomizingCombo(null)
  }

  const nights = nightsBetween(dates.depart, dates.ret)
  const activeHotelRooms = roomsList.filter((r) => r.hotelId === pickedHotelId)

  return (
    <section className="page container">
      <PageHero
        icon={<Sparkles size={28} strokeWidth={1.8} />}
        title="Combo bay + khách sạn"
        text="Chọn ngày tháng năm, khách sạn, loại phòng và chỗ ngồi máy bay trong một gói tiết kiệm."
      />
      <SearchSummary search={search} onClear={onClearSearch} />

      <div className="combo-date-picker">
        <h3>
          <Calendar size={18} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Chọn ngày tháng năm & số khách cho Combo
        </h3>
        <div className="combo-date-grid">
          <label className="field">
            <span>Ngày đi / Nhận phòng (ngày/tháng/năm)</span>
            <input
              type="date"
              value={dates.depart}
              min={todayISO}
              onChange={(e) => setDates({ ...dates, depart: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Ngày về / Trả phòng (ngày/tháng/năm)</span>
            <input
              type="date"
              value={dates.ret}
              min={dates.depart || todayISO}
              onChange={(e) => setDates({ ...dates, ret: e.target.value })}
            />
          </label>
          <label className="field">
            <span>Số hành khách</span>
            <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} khách</option>)}
            </select>
          </label>
        </div>
        {dates.depart && dates.ret && nights >= 1 ? (
          <p className="combo-date-summary">
            <Calendar size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Lịch trình: <b>{formatDateVN(dates.depart)}</b> <ArrowRight size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle' }} /> <b>{formatDateVN(dates.ret)}</b> · {nights} đêm · {passengers} khách
          </p>
        ) : (
          <p className="combo-date-warning">
            <AlertCircle size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Ngày về phải sau ngày đi ít nhất 1 đêm.
          </p>
        )}
      </div>

      <div className="hotel-grid page-grid">
        {catalogStatus === 'loading' ? (
          <SkeletonList count={3} />
        ) : (
          <>
            <ResultsCount count={combos.length} unit="combo" />
            {combos.length > 0 ? combos.map((combo) => (
              <HotelCard key={combo.id} hotel={combo} onChoose={onChoose} chooseLabel="Đặt ngay" />
            )) : <EmptyResult text="Không có combo phù hợp với từ khóa hiện tại." />}
          </>
        )}
      </div>

      {/* Modal chọn ngày tháng năm, khách sạn/phòng & chỗ ngồi cho Combo */}
      {customizingCombo && (
        <div className="login-overlay" onClick={() => setCustomizingCombo(null)} role="presentation">
          <div className="momo-seat-modal" role="dialog" aria-modal="true" aria-label="Tùy chỉnh Combo khách sạn và chỗ ngồi" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="login-close" onClick={() => setCustomizingCombo(null)} aria-label="Đóng">
              <X size={18} strokeWidth={1.8} />
            </button>
            <h3>
              <Sparkles size={18} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Tùy chỉnh {customizingCombo.name}
            </h3>
            <p className="muted">Chọn đầy đủ ngày tháng năm, khách sạn / phòng lưu trú và chỗ ngồi chuyến bay.</p>

            <div className="momo-modal-section">
              <h4>1. Ngày tháng năm đi & về</h4>
              <div className="combo-date-grid">
                <label className="momo-field">
                  <span><Calendar size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Ngày đi (nhận phòng)</span>
                  <input type="date" value={dates.depart} min={todayISO} onChange={(e) => setDates({ ...dates, depart: e.target.value })} />
                </label>
                <label className="momo-field">
                  <span><Calendar size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Ngày về (trả phòng)</span>
                  <input type="date" value={dates.ret} min={dates.depart || todayISO} onChange={(e) => setDates({ ...dates, ret: e.target.value })} />
                </label>
                <label className="momo-field">
                  <span><Users size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Số khách</span>
                  <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} khách</option>)}
                  </select>
                </label>
              </div>
              <small className="combo-inline-date">
                Lịch đã chọn: <b>{formatDateVN(dates.depart)}</b> <ArrowRight size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle' }} /> <b>{formatDateVN(dates.ret)}</b> ({Math.max(nights, 1)} đêm)
              </small>
            </div>

            <div className="momo-modal-section">
              <h4>2. Chọn khách sạn & loại phòng</h4>
              <div className="combo-two-col">
                <label className="momo-field">
                  <span><Building2 size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Khách sạn / Resort</span>
                  <select value={pickedHotelId} onChange={(e) => handleHotelChange(e.target.value)}>
                    {catalog.hotels.map((h) => (
                      <option key={h.id} value={h.id}>{h.name} ({h.location})</option>
                    ))}
                  </select>
                </label>
                <label className="momo-field">
                  <span><BedDouble size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Loại phòng</span>
                  <select value={pickedRoomId} onChange={(e) => setPickedRoomId(e.target.value)}>
                    {activeHotelRooms.length > 0 ? activeHotelRooms.map((r) => (
                      <option key={r.id} value={r.id}>{r.name} · {r.bedType}</option>
                    )) : <option value="">Phòng tiêu chuẩn</option>}
                  </select>
                </label>
              </div>
            </div>

            <div className="momo-modal-section">
              <h4>3. Chọn chuyến bay & chỗ ngồi (Ghế: <span className="seat-highlight">{pickedSeat}</span>)</h4>
              <div className="combo-two-col" style={{ marginBottom: 12 }}>
                <label className="momo-field">
                  <span><Plane size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Chuyến bay</span>
                  <select value={pickedFlightId} onChange={(e) => setPickedFlightId(e.target.value)}>
                    {catalog.flights.map((f) => (
                      <option key={f.id} value={f.id}>{f.airline} ({f.from} - {f.to}) · {f.depart}</option>
                    ))}
                  </select>
                </label>
                <label className="momo-field">
                  <span><Armchair size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Hạng ghế</span>
                  <select value={pickedSeatClass} onChange={(e) => setPickedSeatClass(e.target.value)}>
                    {SEAT_CLASSES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="cabin-map compact">
                {FLIGHT_SEAT_ROWS.slice(0, 4).map((row) => (
                  <div className="cabin-row" key={row}>
                    <span className="cabin-row-num">{row}</span>
                    {FLIGHT_SEAT_COLS.map((col, idx) => {
                      const code = `${row}${col}`
                      const taken = OCCUPIED_FLIGHT_SEATS.has(code)
                      return (
                        <span key={code} className={idx === 3 ? 'aisle-gap' : ''}>
                          <button
                            type="button"
                            disabled={taken}
                            className={`seat-btn ${taken ? 'taken' : pickedSeat === code ? 'chosen' : 'free'}`}
                            onClick={() => setPickedSeat(code)}
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

            <div className="momo-modal-foot">
              <div>
                <small>Trọn gói Combo · {formatDateVN(dates.depart)} - {formatDateVN(dates.ret)} · Ghế {pickedSeat}</small>
                <strong>{formatCurrency(customizingCombo.price)}</strong>
              </div>
              <button type="button" className="pay-btn" onClick={confirmCombo} disabled={nights < 1}>
                Đặt combo ngay <ArrowRight size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default ComboPage

