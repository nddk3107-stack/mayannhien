import React, { useState, useEffect, useRef } from 'react'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BedDouble,
  Check,
  Clock,
  Maximize2,
  Star,
  Users,
} from 'lucide-react'
import { todayISO, defaultReturn, nightsBetween, formatCurrency, PHONE_RE, EMAIL_RE } from '../data/constants.js'
import { RoomGallery, AmenityGroups } from './RoomsPage.jsx'
import PaymentMethodSelector, { PAYMENT_METHODS } from '../components/PaymentMethodSelector.jsx'
import SavedPassengerQuickPicker from '../components/SavedPassengerQuickPicker.jsx'
import { apiFetch } from '../services/api.js'

export function useHotelStay({ hotel, room, dates, session, traveler, onInvalid, onRequireLogin, onPay }) {
  const firstCheckin = dates?.depart >= todayISO ? dates.depart : todayISO
  const [checkin, setCheckin] = useState(firstCheckin)
  const [checkout, setCheckout] = useState(() => (dates?.ret && dates.ret > firstCheckin ? dates.ret : defaultReturn))
  const [adults, setAdults] = useState(2)
  const [children, setChildren] = useState(0)
  const [roomsCount, setRoomsCount] = useState(1)
  const [fieldErrors, setFieldErrors] = useState({})
  const [voucherInput, setVoucherInput] = useState('')
  const [voucher, setVoucher] = useState({ status: 'idle' }) // idle | checking | applied | error
  const [method, setMethod] = useState('sepay')
  const [paying, setPaying] = useState(false)
  const payTimer = useRef(null)
  const payingRef = useRef(false)
  const payIdemRef = useRef(null)

  useEffect(() => () => window.clearTimeout(payTimer.current), [])

  const nights = nightsBetween(checkin, checkout)
  const subtotal = nights >= 1 ? (room?.price || 0) * nights * roomsCount : 0

  let dateError = ''
  if (!checkin || checkin < todayISO) dateError = 'Ngày nhận phòng phải từ hôm nay trở về sau.'
  else if (!checkout || nights < 1) dateError = 'Ngày trả phòng phải sau ngày nhận phòng.'
  else if (nights > 30) dateError = 'Thời gian lưu trú tối đa 30 đêm.'

  const maxAdults = (room?.maxAdults || 2) * roomsCount
  const maxChildren = (room?.maxChildren || 0) * roomsCount
  const totalGuests = adults + children
  let capacityError = ''
  if (adults > maxAdults) capacityError = `Tối đa ${maxAdults} người lớn cho ${roomsCount} phòng (${room?.maxAdults}/phòng).`
  else if (children > maxChildren) capacityError = `Tối đa ${maxChildren} trẻ em cho ${roomsCount} phòng.`
  else if (totalGuests < 1 || totalGuests > 9) capacityError = 'Tổng số khách phải từ 1 đến 9.'

  const applied = voucher.status === 'applied' ? voucher.data : null
  const discount = applied ? applied.discount : 0
  const total = Math.max(subtotal - discount, 0)
  const methodLabel = PAYMENT_METHODS.find((entry) => entry.id === method)?.label || PAYMENT_METHODS[0].label

  useEffect(() => {
    if (subtotal <= 0 || voucher.status !== 'applied') return undefined
    let active = true
    apiFetch('/api/promos/validate', {
      method: 'POST',
      body: { code: voucher.data.code, serviceType: 'hotel', amount: subtotal },
    }).then((res) => {
      if (!active) return
      if (res.networkError) return
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
  }, [subtotal]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const validateTraveler = () => {
    const errs = {}
    if (!traveler.name || traveler.name.trim().length < 2) errs.name = 'Vui lòng nhập họ tên (tối thiểu 2 ký tự).'
    if (!traveler.phone || !PHONE_RE.test(traveler.phone.replace(/\s/g, ''))) errs.phone = 'Số điện thoại chưa hợp lệ.'
    if (!traveler.email || !EMAIL_RE.test(traveler.email.trim())) errs.email = 'Email chưa hợp lệ.'
    setFieldErrors(errs)
    return errs
  }

  const handlePayment = () => {
    if (paying || payingRef.current) return
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
          strictVoucher: Boolean(appliedVoucher),
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
        if (appliedVoucher && res.status === 409) setVoucher({ status: 'idle' })
        onInvalid(res.networkError
          ? 'Không kết nối được máy chủ. Vui lòng thử lại.'
          : (res.data?.error || 'Tạo đơn hàng thất bại. Vui lòng thử lại.'))
        return
      }
      payIdemRef.current = null
      onPay(res.data.booking)
    }, 600)
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

export default function HotelCheckoutPage({ selection, dates, session, traveler, setTraveler, onBack, onInvalid, onRequireLogin, onPay }) {
  const { hotel, room } = selection || {}
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

  if (!hotel || !room) {
    return (
      <section className="page container hotel-checkout">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={16} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Quay lại
        </button>
        <p className="muted">Không có thông tin phòng được chọn.</p>
      </section>
    )
  }

  return (
    <section className="page container hotel-checkout">
      <div className="hotel-checkout-layout">
        <div className="checkout-main">
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={16} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Chọn lại phòng
          </button>
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
              <div className="room-review-rating">
                <b>{hotel.rating}</b>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                  {Array.from({ length: Number(hotel.stars) || 4 }).map((_, idx) => (
                    <Star key={idx} size={13} strokeWidth={1.8} fill="currentColor" />
                  ))}
                </span>
              </div>
            </div>
            <div className="room-specs">
              <span><BedDouble size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {room.bedType}</span>
              {room.sizeSqm ? <span><Maximize2 size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {room.sizeSqm} m²</span> : null}
              <span><Users size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Tối đa {room.maxAdults} người lớn{room.maxChildren > 0 ? ` + ${room.maxChildren} trẻ em` : ''}</span>
              <span><Clock size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Nhận từ {room.checkinTime} · Trả trước {room.checkoutTime}</span>
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
            {dateError && <p className="field-error" role="alert"><AlertCircle size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {dateError}</p>}
            {capacityError && <p className="field-error" role="alert"><AlertCircle size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {capacityError}</p>}
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
            <SavedPassengerQuickPicker
              session={session}
              onSelect={(p) => {
                setTraveler((prev) => ({
                  ...prev,
                  name: p.full_name || prev.name,
                  phone: p.phone || prev.phone,
                }))
              }}
            />
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
            <PaymentMethodSelector method={method} setMethod={setMethod} session={session} totalAmount={total} />
          </div>
        </div>
        <aside className="booking-summary">
          <h3>Tóm tắt thanh toán</h3>
          <div className="summary-item"><span>Khách sạn</span><b>{hotel.name}</b></div>
          <div className="summary-name">{room.name}</div>
          <div className="summary-item"><span>Giá phòng/đêm</span><b>{formatCurrency(room.price)}</b></div>
          <div className="summary-item"><span>Số đêm</span><b>{safeNights} đêm</b></div>
          <div className="summary-item"><span>Số phòng</span><b>{roomsCount}</b></div>
          <div className="summary-item"><span>Nhận / Trả</span><b>{checkin} <ArrowRight size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle' }} /> {checkout}</b></div>
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
            {voucher.status === 'error' && (
              <p className="voucher-status error" role="alert">
                <AlertCircle size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {voucher.error}
              </p>
            )}
            {voucher.status === 'applied' && (
              <div className="voucher-applied" role="status">
                <div>
                  <b><Check size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {voucher.data.code}</b>
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
          <small>Thanh toán an toàn với xác thực hai lớp và bảo mật chuẩn SSL.</small>
        </aside>
      </div>
    </section>
  )
}
