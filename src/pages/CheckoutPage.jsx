import React, { useState, useEffect, useRef, useContext } from 'react'
import {
  ArrowLeft,
  Check,
  Loader2,
  Lock,
  ShoppingBag,
} from 'lucide-react'
import { CatalogCtx } from '../data/CatalogContext.js'
import { formatCurrency, getPromoRate, SERVICE_LABELS, getServiceTypeOfItem, PHONE_RE, EMAIL_RE } from '../data/constants.js'
import PaymentMethodSelector, { PAYMENT_METHODS } from '../components/PaymentMethodSelector.jsx'
import SavedPassengerQuickPicker from '../components/SavedPassengerQuickPicker.jsx'
import { apiFetch } from '../services/api.js'

export default function CheckoutPage({
  selectedItem,
  promo,
  setPromo,
  selectedPrice,
  passengers,
  setPassengers,
  traveler,
  setTraveler,
  dates,
  tripType,
  destination,
  session,
  onBack,
  onInvalid,
  onRequireLogin,
  onPickService,
  onPay,
}) {
  const { catalog } = useContext(CatalogCtx)
  const [paying, setPaying] = useState(false)
  const [method, setMethod] = useState('sepay')
  const payTimer = useRef(null)
  const payingRef = useRef(false)
  const payIdemRef = useRef(null)

  useEffect(() => () => window.clearTimeout(payTimer.current), [])

  const item = selectedItem || (catalog.flights && catalog.flights[0])

  if (!item) {
    return (
      <section className="page container checkout-layout">
        <div className="checkout-main">
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={16} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Quay lại trang chủ
          </button>
          <div className="empty-bookings">
            <span><ShoppingBag size={36} strokeWidth={1.8} /></span>
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
  const serviceType = getServiceTypeOfItem(item)
  const isFlight = serviceType === 'flight'
  const isPerPassenger = ['flight', 'activity', 'bus', 'train', 'insurance'].includes(serviceType)
  const basePrice = item.price * (isPerPassenger ? passengers : 1)
  const finalPrice = (selectedPrice || item.price) * (isPerPassenger ? passengers : 1)
  const discount = Math.max(basePrice - finalPrice, 0)
  const promoRate = getPromoRate(promo, item)
  const promoApplicable = promoRate > 0
  const methodLabel = PAYMENT_METHODS.find((entry) => entry.id === method)?.label || PAYMENT_METHODS[0].label
  const serviceName = SERVICE_LABELS[serviceType] || 'Dịch vụ du lịch'
  const dateLabel = isFlight
    ? ['Ngày bay', 'Ngày về']
    : (serviceType === 'hotel' || serviceType === 'combo')
      ? ['Nhận phòng', 'Trả phòng']
      : ['Ngày bắt đầu', 'Ngày kết thúc']
  const meta = item.selectedMeta || null

  const handlePayment = () => {
    if (paying || payingRef.current) return

    if (!session) {
      onRequireLogin()
      return
    }

    if (!traveler.name || traveler.name.trim().length < 2) {
      onInvalid('Vui lòng nhập họ tên người đặt (tối thiểu 2 ký tự).')
      return
    }

    if (!traveler.phone || !PHONE_RE.test(traveler.phone.replace(/\s/g, ''))) {
      onInvalid('Số điện thoại chưa hợp lệ.')
      return
    }

    if (!traveler.email || !EMAIL_RE.test(traveler.email.trim())) {
      onInvalid('Email chưa hợp lệ.')
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
    payTimer.current = window.setTimeout(async () => {
      const res = await apiFetch('/api/bookings', {
        method: 'POST',
        body: {
          serviceType,
          itemId: item.id,
          seatCode: item.seatCode || item.selectedSeat || item.selectedMeta?.seat || null,
          passengers,
          traveler: {
            name: traveler.name.trim(),
            phone: traveler.phone.trim(),
            email: traveler.email.trim(),
          },
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
    }, 600)
  }

  return (
    <div className="checkout-page-container">
      {/* Traveloka Progress Stepper */}
      <div className="checkout-stepper-wrap">
        <div className="checkout-stepper">
          <div className="stepper-step completed">
            <span className="step-circle"><Check size={14} strokeWidth={1.8} /></span>
            <span className="step-name">1. Chọn dịch vụ</span>
          </div>
          <div className="stepper-line completed" />
          <div className="stepper-step active">
            <span className="step-circle">2</span>
            <span className="step-name">2. Điền thông tin</span>
          </div>
          <div className="stepper-line" />
          <div className="stepper-step">
            <span className="step-circle">3</span>
            <span className="step-name">3. Thanh toán ({methodLabel})</span>
          </div>
          <div className="stepper-line" />
          <div className="stepper-step">
            <span className="step-circle">4</span>
            <span className="step-name">4. Vé điện tử</span>
          </div>
        </div>
      </div>

      <section className="page container checkout-layout">
        <div className="checkout-main">
          <button className="back-btn" onClick={onBack}>
            <ArrowLeft size={16} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Quay lại trang trước
          </button>
          <h1 className="checkout-title">Thông tin đặt chỗ & Thanh toán</h1>
          <p className="muted">Vui lòng điền chính xác thông tin hành khách để xuất vé điện tử hợp lệ.</p>

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
            <h3>Thông tin người đặt & Liên hệ</h3>
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
              <label className="field"><span>Họ tên</span><input value={traveler.name} maxLength={60} autoComplete="name" placeholder="VD: Nguyễn Văn A" onChange={(event) => setTraveler({ ...traveler, name: event.target.value })} /></label>
              <label className="field"><span>Số điện thoại</span><input value={traveler.phone} maxLength={15} inputMode="tel" autoComplete="tel" placeholder="VD: 0912 345 678" onChange={(event) => setTraveler({ ...traveler, phone: event.target.value })} /></label>
              <label className="field wide"><span>Email nhận vé điện tử PDF</span><input type="email" value={traveler.email} maxLength={80} autoComplete="email" placeholder="ban@email.com" onChange={(event) => setTraveler({ ...traveler, email: event.target.value })} /></label>
              <label className="field"><span>Số khách</span><select value={passengers} onChange={(event) => setPassengers(Number(event.target.value))}><option value="1">1 khách</option><option value="2">2 khách</option><option value="3">3 khách</option><option value="4">4 khách</option></select></label>
            </div>
          </div>

          <div className="traveler-card">
            <h3>Mã ưu đãi & Voucher</h3>
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
            <PaymentMethodSelector method={method} setMethod={setMethod} session={session} totalAmount={finalPrice} />
          </div>
        </div>

        <aside className="booking-summary sticky-summary">
          <h3>Tóm tắt chuyến đi</h3>
          <div className="summary-item">
            <span>Dịch vụ</span>
            <b>{serviceName}</b>
          </div>
          <div className="summary-name">{item.name || `${item.airline} ${item.from} - ${item.to}`}</div>
          {meta?.seat && <div className="summary-item"><span>Chỗ ngồi</span><b>Ghế {meta.seat}{meta.seatClass ? ` · ${meta.seatClass}` : ''}</b></div>}
          {meta?.roomName && <div className="summary-item"><span>Phòng đã chọn</span><b>{meta.roomName}</b></div>}
          {meta?.flightInfo && <div className="summary-item"><span>Chuyến bay</span><b>{meta.flightInfo}</b></div>}
          {meta?.coach && <div className="summary-item"><span>Toa ưu tiên</span><b>{meta.coach}</b></div>}
          {meta?.pickupTime && <div className="summary-item"><span>Đón/Tiễn</span><b>{meta.direction} · {meta.pickupTime}</b></div>}
          <div className="summary-item"><span>Giá gốc</span><b>{formatCurrency(basePrice)}</b></div>
          <div className="summary-item"><span>Mã áp dụng</span><b>{promo.title}</b></div>
          {!promoApplicable && (
            <p className="promo-warning">Mã này không áp dụng cho {serviceName.toLowerCase()} nên giảm giá là 0đ.</p>
          )}
          <div className="summary-item"><span>Giảm giá</span><b className="discount-value">-{formatCurrency(discount)}</b></div>
          <div className="summary-item"><span>Ngày đi</span><b>{dates.depart}</b></div>
          <div className="summary-item"><span>Số khách</span><b>{passengers} khách</b></div>
          <div className="summary-item"><span>Thanh toán</span><b>{methodLabel}</b></div>
          <div className="summary-total"><span>Tổng thanh toán</span><strong>{formatCurrency(finalPrice)}</strong></div>
          <button className="pay-btn pay-cta-btn" onClick={handlePayment} disabled={paying}>
            {paying ? (
              <><Loader2 size={16} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Đang kết nối cổng thanh toán…</>
            ) : (
              'Xác nhận và thanh toán'
            )}
          </button>
          {!session && <small className="pay-hint">Bạn cần đăng nhập để hoàn tất đặt chỗ.</small>}
          <small className="pay-guarantee-note">
            <Lock size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Bảo mật thanh toán SSL 256-bit · Xuất vé điện tử PDF tức thì
          </small>
        </aside>
      </section>
    </div>
  )
}
