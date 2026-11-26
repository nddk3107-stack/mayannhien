// src/pages/HomePage.jsx — Trang chủ hệ thống đặt dịch vụ du lịch trực tuyến Mây An Nhiên
import { useContext, useEffect, useState } from 'react'
import {
  ArrowRight,
  ShieldCheck,
  Headset,
  Gift,
  AlertTriangle,
  Plane,
  Building2,
  Ticket,
  Info,
  Copy,
  Check,
  Sun,
  Sparkles,
  ChevronRight,
  Crown,
  MapPin,
  Star,
  Newspaper,
  Cloud,
  CalendarCheck,
  BadgePercent,
  BellRing,
  Smartphone,
  PlayCircle,
} from 'lucide-react'
import { API_BASE } from '../services/api.js'
import { CatalogCtx } from '../data/CatalogContext.js'
import { collections, destinations, formatCurrency, services } from '../data/constants.js'
import { SearchCard } from '../components/SearchCard.jsx'
import { FlightCard, HotelCard, SkeletonList } from '../components/SharedUI.jsx'

export function ServiceDock({ service, setService, setPage }) {
  return (
    <section className="container service-dock" aria-label="Danh mục dịch vụ du lịch">
      {services.map((item) => (
        <button
          type="button"
          key={item.id}
          className={`dock-item ${service === item.id ? 'active' : ''}`}
          onClick={() => {
            setService?.(item.id)
            setPage?.(item.id)
          }}
        >
          <span className="dock-icon">{item.icon}</span>
          <b>{item.label}</b>
        </button>
      ))}
    </section>
  )
}

const fallbackBenefits = [
  ['security', 'Thanh toán bảo mật', 'Mô phỏng nhiều phương thức thanh toán và tóm tắt đơn hàng.'],
  ['support', 'Hỗ trợ 24/7', 'Nhân viên hỗ trợ bạn mọi lúc để giải đáp và xử lý mọi nhu cầu.'],
  ['promo', 'Quà tặng & ưu đãi', 'Nhiều mã giảm giá và ưu đãi độc quyền dành cho khách hàng thân thiết.'],
]

function renderBenefitIcon(iconKey, index, title) {
  const lower = String(title || iconKey || '').toLowerCase()
  if (lower.includes('hỗ trợ') || iconKey === 'support' || index === 1) {
    return <Headset size={20} strokeWidth={1.8} />
  }
  if (lower.includes('quà') || lower.includes('ưu đãi') || iconKey === 'promo' || index === 2) {
    return <Gift size={20} strokeWidth={1.8} />
  }
  return <ShieldCheck size={20} strokeWidth={1.8} />
}

export function TrustSection({ onOpenSecurity, onOpenSupport, onOpenPromos }) {
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

  const handleCardClick = (index, title) => {
    const lower = String(title || '').toLowerCase()
    if (lower.includes('hỗ trợ') || index === 1) onOpenSupport?.()
    else if (lower.includes('quà') || lower.includes('ưu đãi') || index === 2) onOpenPromos?.()
    else onOpenSecurity?.()
  }

  return (
    <section className="container trust-section">
      {status === 'error' && (
        <div className="data-error-strip" role="alert">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={16} strokeWidth={1.8} />
            <span>Không tải được ưu đãi mới từ máy chủ.</span>
          </span>
          <button type="button" onClick={() => { setStatus('loading'); setNonce((value) => value + 1) }}>Thử lại</button>
        </div>
      )}

      {items.map(([icon, title, text], index) => (
        <button
          type="button"
          key={title}
          className="trust-card-btn"
          onClick={() => handleCardClick(index, title)}
        >
          <span>{renderBenefitIcon(icon, index, title)}</span>
          <div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        </button>
      ))}
    </section>
  )
}

/* =====================================================================
   1. MÃ GIẢM GIÁ CHO NGƯỜI DÙNG MỚI
   ===================================================================== */
const COUPON_PRESETS = [
  {
    Icon: Plane,
    badgeBg: 'linear-gradient(135deg, #38bdf8, #0284c7)',
    headline: 'Giảm đến 75,000 cho lần đặt vé máy bay đầu tiên',
    subtext: 'Áp dụng cho khách hàng đặt chỗ trên hệ thống Mây An Nhiên',
    defaultCode: 'MAYANMOI',
  },
  {
    Icon: Building2,
    badgeBg: 'linear-gradient(135deg, #0284c7, #0369a1)',
    headline: 'Giảm giá tới 250.000 cho lần đặt phòng khách sạn đầu tiên',
    subtext: 'Áp dụng cho khách hàng đặt chỗ trên hệ thống Mây An Nhiên',
    defaultCode: 'MAYANMOI',
  },
  {
    Icon: Ticket,
    badgeBg: 'linear-gradient(135deg, #fb7185, #e11d48)',
    headline: 'Giảm đến 10% cho lần đặt vé tham quan & hoạt động đầu tiên',
    subtext: 'Áp dụng cho khách hàng đặt chỗ trên hệ thống Mây An Nhiên',
    defaultCode: 'MAYANMOI',
  },
]

export function PromoSection({ promo, setPromo }) {
  const { catalog } = useContext(CatalogCtx)
  const [copiedId, setCopiedId] = useState(null)

  const handleCopyCoupon = (item, codeText) => {
    setPromo?.(item)
    setCopiedId(item.id)
    try {
      navigator.clipboard?.writeText(codeText)
    } catch { /* ignore */ }
    window.setTimeout(() => {
      setCopiedId((curr) => (curr === item.id ? null : curr))
    }, 2000)
  }

  return (
    <section id="promo-section" className="container section-block tvl-coupon-section">
      <div className="tvl-coupon-header">
        <h2>Mã giảm giá cho người dùng mới</h2>
        <p>Áp dụng cho khách hàng đặt chỗ trên hệ thống Mây An Nhiên</p>
      </div>

      <div className="tvl-coupon-grid-wrap">
        <div className="tvl-coupon-grid">
          {catalog.promos.map((item, idx) => {
            const preset = COUPON_PRESETS[idx % COUPON_PRESETS.length]
            const CouponIcon = preset.Icon
            const isSelected = promo?.id === item.id
            const isCopied = copiedId === item.id
            const codeDisplay = item.code || 'MAYANMOI'
            const subtextDisplay = preset.subtext

            return (
              <article
                key={item.id}
                className={`tvl-coupon-card ${isSelected ? 'selected' : ''}`}
              >
                <span className="tvl-notch-left" aria-hidden="true" />
                <span className="tvl-notch-right" aria-hidden="true" />

                <div className="tvl-coupon-top">
                  <span
                    className="tvl-coupon-icon"
                    style={{ background: preset.badgeBg, color: '#ffffff' }}
                    aria-hidden="true"
                  >
                    <CouponIcon size={20} strokeWidth={1.8} />
                  </span>
                  <div className="tvl-coupon-copy">
                    <h3>{preset.headline}</h3>
                    <p>{subtextDisplay}</p>
                  </div>
                  <span className="tvl-coupon-info" title={subtextDisplay} aria-hidden="true">
                    <Info size={16} strokeWidth={1.8} />
                  </span>
                </div>

                <div className="tvl-coupon-divider" />

                <div className="tvl-coupon-bottom">
                  <div className="tvl-coupon-code-box">
                    <span
                      className="tvl-copy-glyph"
                      aria-hidden="true"
                      style={{ color: isCopied ? '#16a34a' : 'currentColor', display: 'inline-flex', alignItems: 'center' }}
                    >
                      {isCopied ? <Check size={15} strokeWidth={2.2} color="#16a34a" /> : <Copy size={15} strokeWidth={1.8} />}
                    </span>
                    <code>{codeDisplay}</code>
                  </div>
                  <button
                    type="button"
                    className={`tvl-coupon-copy-btn ${isSelected ? 'active' : ''}`}
                    onClick={() => handleCopyCoupon(item, codeDisplay)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    {isCopied ? (
                      <>
                        <Check size={15} strokeWidth={2.2} color="#16a34a" />
                        <span>Đã chép</span>
                      </>
                    ) : isSelected ? (
                      'Đã chọn'
                    ) : (
                      'Sao chép'
                    )}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* =====================================================================
   2. ƯU ĐÃI ĐANG DIỄN RA (Image 3 bottom + Image 4 top)
   ===================================================================== */
export function OngoingCampaignsSection({ setPage, setService }) {
  const [showShaModal, setShowShaModal] = useState(false)
  const [copiedHash, setCopiedHash] = useState(false)
  const [sha256Hex, setSha256Hex] = useState('4a9fe3108ce8167db8d8d7f7639f4ad16e838706b72a6b22eb625026df3a1376')
  const PROMO_PAYLOAD = 'MAYAN-DEAL-APP-500K-AUTONOMOUS-SECURE-VOUCHER-VN-2026'

  useEffect(() => {
    if (typeof window !== 'undefined' && window.crypto?.subtle) {
      const encoder = new TextEncoder()
      const data = encoder.encode(PROMO_PAYLOAD)
      window.crypto.subtle.digest('SHA-256', data).then((hashBuffer) => {
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const hex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
        setSha256Hex(hex)
      }).catch(() => {})
    }
  }, [])

  const goService = (target) => {
    setService?.(target)
    setPage?.(target)
  }

  return (
    <section className="container section-block tvlk-campaigns-section">
      <div className="tvlk-section-head">
        <h2>Ưu đãi đang diễn ra</h2>
      </div>

      {/* Wide Featured Banner Card (Black Friday / Camping night backdrop with QR code) */}
      <div
        className="tvlk-wide-campaign-banner"
        style={{
          backgroundImage:
            'linear-gradient(90deg, rgba(6, 20, 46, 0.92) 0%, rgba(12, 37, 74, 0.72) 48%, rgba(15, 23, 42, 0.45) 100%), url(https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=1600&q=85)',
        }}
      >
        <div className="tvlk-wide-banner-left">
          <div className="tvlk-bf-badge">
            <span className="tvlk-bf-top">BLACK<small>%</small></span>
            <span className="tvlk-bf-mid"><small>%</small>FRIDAY</span>
            <span className="tvlk-bf-date">17-27.11</span>
          </div>

          <div className="tvlk-wide-banner-copy">
            <h3>
              Nhận ưu đãi đặc biệt
              <br />
              lên đến <strong>500K VND</strong> tặng Bạn Mới
            </h3>
            <span className="tvlk-terms-note">Điều khoản áp dụng</span>
          </div>
        </div>

        <div className="tvlk-wide-banner-right">
          <div className="tvlk-qr-promo-box">
            <span className="tvlk-qr-red-tag">DEAL TỐT TRÊN APP</span>
            <div
              className="tvlk-qr-svg-wrap"
              aria-label="Mã QR tải ứng dụng & nhận ưu đãi (Ký số SHA-256)"
              title={`Quét mã QR tải app nhận Deal 500K — SHA-256: ${sha256Hex}`}
              style={{ cursor: 'pointer' }}
              onClick={() => setShowShaModal(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 35 35" width="84" height="84" shapeRendering="crispEdges" role="img" aria-hidden="true">
                <path fill="#ffffff" d="M0 0h35v35H0z" />
                <path stroke="#0f172a" d="M1 1.5h7m2 0h1m1 0h2m3 0h1m1 0h2m1 0h1m1 0h1m2 0h7M1 2.5h1m5 0h1m2 0h2m4 0h4m2 0h1m2 0h1m1 0h1m5 0h1M1 3.5h1m1 0h3m1 0h1m1 0h1m1 0h3m1 0h2m3 0h3m1 0h1m2 0h1m1 0h3m1 0h1M1 4.5h1m1 0h3m1 0h1m1 0h2m2 0h1m2 0h1m1 0h3m3 0h1m2 0h1m1 0h3m1 0h1M1 5.5h1m1 0h3m1 0h1m1 0h3m1 0h6m1 0h2m1 0h3m1 0h1m1 0h3m1 0h1M1 6.5h1m5 0h1m1 0h3m3 0h1m2 0h1m2 0h1m1 0h1m3 0h1m5 0h1M1 7.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M9 8.5h1m1 0h1m1 0h1m3 0h1m2 0h1m1 0h1M1 9.5h1m1 0h5m2 0h2m2 0h1m3 0h1m4 0h3m1 0h5M1 10.5h1m2 0h2m2 0h1m3 0h1m1 0h2m1 0h1m1 0h4m1 0h1m2 0h2m1 0h3M4 11.5h2m1 0h2m1 0h2m1 0h5m5 0h1m2 0h1m2 0h1m1 0h2M1 12.5h3m1 0h1m4 0h1m3 0h1m1 0h2m2 0h4m1 0h1m1 0h1m1 0h3M1 13.5h2m1 0h2m1 0h2m2 0h1m3 0h2m1 0h1m2 0h1m1 0h1m2 0h1m1 0h3M1 14.5h4m1 0h1m1 0h3m1 0h1m3 0h1m2 0h2m3 0h2m1 0h2m2 0h3M1 15.5h2m4 0h6m2 0h2m2 0h1m1 0h2m2 0h3m1 0h1m1 0h2M2 16.5h2m2 0h1m1 0h1m3 0h1m2 0h3m2 0h1m1 0h1m2 0h5m1 0h1M2 17.5h1m1 0h1m2 0h2m2 0h1m1 0h1m2 0h1m1 0h1m2 0h1m1 0h4m1 0h3m2 0h1M1 18.5h4m1 0h1m1 0h1m4 0h2m2 0h1m2 0h3m1 0h1m2 0h2m1 0h3M3 19.5h1m2 0h2m1 0h2m1 0h2m2 0h1m10 0h3m1 0h2M2 20.5h1m1 0h3m1 0h2m2 0h3m1 0h2m1 0h4m2 0h1m2 0h5M1 21.5h3m1 0h1m1 0h2m2 0h2m1 0h1m1 0h1m2 0h3m1 0h4m1 0h1m1 0h1M1 22.5h1m1 0h2m5 0h1m2 0h4m3 0h1m3 0h1m2 0h1m2 0h2m1 0h1M1 23.5h1m4 0h3m1 0h2m1 0h2m4 0h1m1 0h2m3 0h3m1 0h3M1 24.5h1m2 0h1m3 0h1m2 0h7m1 0h2m1 0h5m1 0h1m2 0h3M1 25.5h1m1 0h6m1 0h1m3 0h3m1 0h1m4 0h1m1 0h6m1 0h1M9 26.5h5m3 0h1m2 0h1m1 0h1m1 0h2m3 0h1m1 0h1M1 27.5h7m2 0h3m3 0h2m1 0h1m4 0h2m1 0h1m1 0h1m1 0h2M1 28.5h1m5 0h1m1 0h1m1 0h1m1 0h2m2 0h1m1 0h7m3 0h4M1 29.5h1m1 0h3m1 0h1m1 0h1m2 0h2m1 0h1m3 0h3m1 0h1m1 0h6m1 0h2M1 30.5h1m1 0h3m1 0h1m1 0h2m1 0h2m1 0h1m4 0h1m1 0h1m1 0h3m2 0h1m1 0h3M1 31.5h1m1 0h3m1 0h1m1 0h2m1 0h1m4 0h1m1 0h1m1 0h3m1 0h1m1 0h2m2 0h1M1 32.5h1m5 0h1m2 0h1m1 0h1m1 0h2m1 0h1m1 0h1m1 0h4m4 0h1m1 0h1M1 33.5h7m1 0h1m4 0h1m1 0h4m3 0h4m1 0h1m1 0h1m1 0h1" />
              </svg>
            </div>
            <div
              className="tvlk-qr-hash-badge"
              onClick={() => setShowShaModal(true)}
              title="Bấm để xem chi tiết băm SHA-256 và xác thực chữ ký số"
            >
              <ShieldCheck size={11} strokeWidth={2.2} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              SHA-256: {sha256Hex.slice(0, 8)}...{sha256Hex.slice(-6)}
            </div>
          </div>
          <button
            type="button"
            className="tvlk-wide-cta-pill"
            onClick={() => setShowShaModal(true)}
          >
            Xem ưu đãi & SHA-256
          </button>
        </div>
      </div>

      {/* Modal Xác thực Hàm băm SHA-256 */}
      {showShaModal && (
        <div className="login-overlay tvlk-sha-overlay" onClick={() => setShowShaModal(false)} role="presentation">
          <div className="login-modal tvlk-sha-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Xác thực mã QR bằng SHA-256">
            <div className="tvlk-sha-head">
              <div className="tvlk-sha-title">
                <ShieldCheck size={24} color="#10b981" strokeWidth={2.2} />
                <div>
                  <h3>Xác thực Mã QR bằng Hàm Băm SHA-256</h3>
                  <p>Mã hóa bảo mật chống giả mạo ưu đãi độc quyền 500.000 ₫ Mây An Nhiên</p>
                </div>
              </div>
              <button type="button" className="login-close" onClick={() => setShowShaModal(false)} aria-label="Đóng">
                ×
              </button>
            </div>

            <div className="tvlk-sha-body">
              <div className="tvlk-sha-qr-preview">
                <div className="tvlk-sha-qr-box">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 35 35" width="130" height="130" shapeRendering="crispEdges" role="img" aria-hidden="true">
                    <path fill="#ffffff" d="M0 0h35v35H0z" />
                    <path stroke="#0f172a" d="M1 1.5h7m2 0h1m1 0h2m3 0h1m1 0h2m1 0h1m1 0h1m2 0h7M1 2.5h1m5 0h1m2 0h2m4 0h4m2 0h1m2 0h1m1 0h1m5 0h1M1 3.5h1m1 0h3m1 0h1m1 0h1m1 0h3m1 0h2m3 0h3m1 0h1m2 0h1m1 0h3m1 0h1M1 4.5h1m1 0h3m1 0h1m1 0h2m2 0h1m2 0h1m1 0h3m3 0h1m2 0h1m1 0h3m1 0h1M1 5.5h1m1 0h3m1 0h1m1 0h3m1 0h6m1 0h2m1 0h3m1 0h1m1 0h3m1 0h1M1 6.5h1m5 0h1m1 0h3m3 0h1m2 0h1m2 0h1m1 0h1m3 0h1m5 0h1M1 7.5h7m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h1m1 0h7M9 8.5h1m1 0h1m1 0h1m3 0h1m2 0h1m1 0h1M1 9.5h1m1 0h5m2 0h2m2 0h1m3 0h1m4 0h3m1 0h5M1 10.5h1m2 0h2m2 0h1m3 0h1m1 0h2m1 0h1m1 0h4m1 0h1m2 0h2m1 0h3M4 11.5h2m1 0h2m1 0h2m1 0h5m5 0h1m2 0h1m2 0h1m1 0h2M1 12.5h3m1 0h1m4 0h1m3 0h1m1 0h2m2 0h4m1 0h1m1 0h1m1 0h3M1 13.5h2m1 0h2m1 0h2m2 0h1m3 0h2m1 0h1m2 0h1m1 0h1m2 0h1m1 0h3M1 14.5h4m1 0h1m1 0h3m1 0h1m3 0h1m2 0h2m3 0h2m1 0h2m2 0h3M1 15.5h2m4 0h6m2 0h2m2 0h1m1 0h2m2 0h3m1 0h1m1 0h2M2 16.5h2m2 0h1m1 0h1m3 0h1m2 0h3m2 0h1m1 0h1m2 0h5m1 0h1M2 17.5h1m1 0h1m2 0h2m2 0h1m1 0h1m2 0h1m1 0h1m2 0h1m1 0h4m1 0h3m2 0h1M1 18.5h4m1 0h1m1 0h1m4 0h2m2 0h1m2 0h3m1 0h1m2 0h2m1 0h3M3 19.5h1m2 0h2m1 0h2m1 0h2m2 0h1m10 0h3m1 0h2M2 20.5h1m1 0h3m1 0h2m2 0h3m1 0h2m1 0h4m2 0h1m2 0h5M1 21.5h3m1 0h1m1 0h2m2 0h2m1 0h1m1 0h1m2 0h3m1 0h4m1 0h1m1 0h1M1 22.5h1m1 0h2m5 0h1m2 0h4m3 0h1m3 0h1m2 0h1m2 0h2m1 0h1M1 23.5h1m4 0h3m1 0h2m1 0h2m4 0h1m1 0h2m3 0h3m1 0h3M1 24.5h1m2 0h1m3 0h1m2 0h7m1 0h2m1 0h5m1 0h1m2 0h3M1 25.5h1m1 0h6m1 0h1m3 0h3m1 0h1m4 0h1m1 0h6m1 0h1M9 26.5h5m3 0h1m2 0h1m1 0h1m1 0h2m3 0h1m1 0h1M1 27.5h7m2 0h3m3 0h2m1 0h1m4 0h2m1 0h1m1 0h1m1 0h2M1 28.5h1m5 0h1m1 0h1m1 0h1m1 0h2m2 0h1m1 0h7m3 0h4M1 29.5h1m1 0h3m1 0h1m1 0h1m2 0h2m1 0h1m3 0h3m1 0h1m1 0h6m1 0h2M1 30.5h1m1 0h3m1 0h1m1 0h2m1 0h2m1 0h1m4 0h1m1 0h1m1 0h3m2 0h1m1 0h3M1 31.5h1m1 0h3m1 0h1m1 0h2m1 0h1m4 0h1m1 0h1m1 0h3m1 0h1m1 0h2m2 0h1M1 32.5h1m5 0h1m2 0h1m1 0h1m1 0h2m1 0h1m1 0h1m1 0h4m4 0h1m1 0h1M1 33.5h7m1 0h1m4 0h1m1 0h4m3 0h4m1 0h1m1 0h1m1 0h1" />
                  </svg>
                  <span className="tvlk-sha-status-pill">
                    <Check size={13} strokeWidth={2.5} /> Ký số SHA-256 hợp lệ 100%
                  </span>
                </div>
              </div>

              <div className="tvlk-sha-details">
                <div className="tvlk-sha-row">
                  <span className="tvlk-sha-lbl">Thuật toán băm:</span>
                  <strong className="tvlk-sha-algo">SHA-256 (Secure Hash Algorithm 256-bit, FIPS 180-4)</strong>
                </div>
                <div className="tvlk-sha-row">
                  <span className="tvlk-sha-lbl">Dữ liệu gốc (Payload):</span>
                  <code className="tvlk-sha-payload-box">{PROMO_PAYLOAD}</code>
                </div>
                <div className="tvlk-sha-row">
                  <span className="tvlk-sha-lbl">Mã băm SHA-256 Digest (64 Hex):</span>
                  <div className="tvlk-sha-digest-wrap">
                    <code className="tvlk-sha-full-hash">{sha256Hex}</code>
                    <button
                      type="button"
                      className="tvlk-sha-copy-action"
                      onClick={() => {
                        navigator.clipboard.writeText(sha256Hex)
                        setCopiedHash(true)
                        setTimeout(() => setCopiedHash(false), 2000)
                      }}
                      title="Sao chép hàm băm SHA-256"
                    >
                      {copiedHash ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                      <span>{copiedHash ? 'Đã sao chép' : 'Sao chép Hash'}</span>
                    </button>
                  </div>
                </div>
                <div className="tvlk-sha-row tvlk-sha-promo-row">
                  <span className="tvlk-sha-lbl">Mã ưu đãi áp dụng:</span>
                  <div className="tvlk-sha-voucher-card">
                    <strong className="tvlk-sha-code-pill">MAYAN500K</strong>
                    <span className="tvlk-sha-code-note">Giảm 500.000 ₫ cho chuyến bay hoặc khách sạn bất kỳ</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="tvlk-sha-foot">
              <button
                type="button"
                className="pay-cta-btn tvlk-sha-apply-btn"
                onClick={() => {
                  setShowShaModal(false)
                  goService('combo')
                }}
              >
                Áp dụng ưu đãi vào Combo <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3 Colorful Campaign Banner Cards (Image 4) */}
      <div className="tvlk-campaign-trio">
        {/* Card 1: Red Sun PhuQuoc Airways */}
        <article
          className="tvlk-mini-campaign-card campaign-red"
          onClick={() => goService('flight')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goService('flight') }}
        >
          <div className="tvlk-mini-campaign-copy">
            <span className="tvlk-mini-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Sun size={15} strokeWidth={1.8} />
              <span>SUN PhuQuoc AIRWAYS</span>
            </span>
            <h3>Deal hè siêu hot</h3>
            <div className="tvlk-mini-discount">
              <small>Giảm đến</small>
              <strong>200K</strong>
            </div>
            <span className="tvlk-mini-foot">Điều khoản áp dụng</span>
          </div>
          <div
            className="tvlk-mini-campaign-photo"
            style={{
              backgroundImage:
                'url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80)',
            }}
          />
        </article>

        {/* Card 2: Teal Vietnam Airlines */}
        <article
          className="tvlk-mini-campaign-card campaign-teal"
          onClick={() => goService('flight')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goService('flight') }}
        >
          <div className="tvlk-mini-campaign-copy">
            <span className="tvlk-mini-brand" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={15} strokeWidth={1.8} />
              <span>Vietnam Airlines</span>
            </span>
            <h3>Thả ga du lịch khám phá</h3>
            <div className="tvlk-mini-discount-inline">
              Giảm đến <strong>200K</strong>
            </div>
            <span className="tvlk-mini-foot">Điều khoản áp dụng</span>
          </div>
          <div
            className="tvlk-mini-campaign-photo"
            style={{
              backgroundImage:
                'url(https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=600&q=80)',
            }}
          />
        </article>

        {/* Card 3: Dark Luxury Gold WORLD'S BEST HOTELS */}
        <article
          className="tvlk-mini-campaign-card campaign-gold"
          onClick={() => goService('hotel')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goService('hotel') }}
        >
          <div className="tvlk-mini-campaign-copy">
            <span className="tvlk-mini-gold-tag">ĐỐI TÁC ĐỘC QUYỀN</span>
            <h3 className="tvlk-gold-heading">WORLD&apos;S BEST HOTELS</h3>
            <div className="tvlk-gold-badge">MÃ 1 TRIỆU MỖI NGÀY</div>
          </div>
          <div className="tvlk-gold-partners">
            <span>MARRIOTT</span>
            <span>ACCOR</span>
            <span>IHG</span>
            <span>VINPEARL</span>
            <span>HILTON</span>
            <span>HYATT</span>
          </div>
        </article>
      </div>
    </section>
  )
}

/* =====================================================================
   3. VÉ MÁY BAY GIÁ TỐT (Image 5)
   ===================================================================== */
const FLIGHT_FILTER_TABS = ['Hà Nội', 'Hồ Chí Minh', 'Đà Nẵng', 'Đông Nam Á', 'Đông Á', 'Khác']

const FLIGHT_DEALS_BY_TAB = {
  'Hà Nội': [
    {
      id: 'fd-hn-sgn',
      route: 'Hà Nội - Sài Gòn (TP HCM)',
      date: '5 thg 2 2027',
      oldPrice: 881142,
      price: 874858,
      airline: 'Vietjet Air',
      from: 'Hà Nội',
      to: 'TP.HCM',
      image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'fd-hn-cl',
      route: 'Hà Nội - Chu Lai',
      date: '27 thg 12 2026',
      oldPrice: 1367860,
      price: 1075798,
      airline: 'Vietnam Airlines',
      from: 'Hà Nội',
      to: 'Chu Lai',
      image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'fd-hn-nt',
      route: 'Hà Nội - Nha Trang',
      date: '15 thg 12 2026',
      oldPrice: 1210977,
      price: 1142778,
      airline: 'Bamboo Airways',
      from: 'Hà Nội',
      to: 'Nha Trang',
      image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'fd-hn-hue',
      route: 'Hà Nội - Huế',
      date: '29 thg 12 2026',
      oldPrice: 1290000,
      price: 1142778,
      airline: 'Vietnam Airlines',
      from: 'Hà Nội',
      to: 'Huế',
      image: 'https://images.unsplash.com/photo-1557750255-c76072a7aad1?auto=format&fit=crop&w=700&q=80',
    },
  ],
  'Hồ Chí Minh': [
    {
      id: 'fd-sgn-dad',
      route: 'TP HCM - Đà Nẵng',
      date: '12 thg 12 2026',
      oldPrice: 1450000,
      price: 980000,
      airline: 'Vietnam Airlines',
      from: 'TP.HCM',
      to: 'Đà Nẵng',
      image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'fd-sgn-pqc',
      route: 'TP HCM - Phú Quốc',
      date: '18 thg 12 2026',
      oldPrice: 1250000,
      price: 890000,
      airline: 'Vietjet Air',
      from: 'TP.HCM',
      to: 'Phú Quốc',
      image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'fd-sgn-han',
      route: 'TP HCM - Hà Nội',
      date: '22 thg 12 2026',
      oldPrice: 1890000,
      price: 1420000,
      airline: 'Bamboo Airways',
      from: 'TP.HCM',
      to: 'Hà Nội',
      image: 'https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'fd-sgn-dli',
      route: 'TP HCM - Đà Lạt',
      date: '25 thg 12 2026',
      oldPrice: 1120000,
      price: 790000,
      airline: 'Vietjet Air',
      from: 'TP.HCM',
      to: 'Đà Lạt',
      image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=700&q=80',
    },
  ],
  'Đà Nẵng': [
    {
      id: 'fd-dad-han',
      route: 'Đà Nẵng - Hà Nội',
      date: '14 thg 12 2026',
      oldPrice: 1320000,
      price: 940000,
      airline: 'Vietnam Airlines',
      from: 'Đà Nẵng',
      to: 'Hà Nội',
      image: 'https://images.unsplash.com/photo-1509030450996-dd1a26dda07a?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'fd-dad-sgn',
      route: 'Đà Nẵng - Sài Gòn (TP HCM)',
      date: '19 thg 12 2026',
      oldPrice: 1290000,
      price: 960000,
      airline: 'Vietjet Air',
      from: 'Đà Nẵng',
      to: 'TP.HCM',
      image: 'https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'fd-dad-pqc',
      route: 'Đà Nẵng - Phú Quốc',
      date: '24 thg 12 2026',
      oldPrice: 1650000,
      price: 1290000,
      airline: 'Bamboo Airways',
      from: 'Đà Nẵng',
      to: 'Phú Quốc',
      image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'fd-dad-dli',
      route: 'Đà Nẵng - Đà Lạt',
      date: '28 thg 12 2026',
      oldPrice: 1490000,
      price: 1150000,
      airline: 'Vietnam Airlines',
      from: 'Đà Nẵng',
      to: 'Đà Lạt',
      image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=700&q=80',
    },
  ],
  'Đông Nam Á': [
    {
      id: 'fd-sea-bkk',
      route: 'TP HCM - Bangkok',
      date: '16 thg 1 2027',
      oldPrice: 2450000,
      price: 1850000,
      airline: 'Vietjet Air',
      from: 'TP.HCM',
      to: 'Bangkok',
      image: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'fd-sea-sin',
      route: 'Hà Nội - Singapore',
      date: '20 thg 1 2027',
      oldPrice: 3120000,
      price: 2390000,
      airline: 'Vietnam Airlines',
      from: 'Hà Nội',
      to: 'Singapore',
      image: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'fd-sea-kul',
      route: 'TP HCM - Kuala Lumpur',
      date: '25 thg 1 2027',
      oldPrice: 2180000,
      price: 1620000,
      airline: 'Bamboo Airways',
      from: 'TP.HCM',
      to: 'Kuala Lumpur',
      image: 'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=700&q=80',
    },
    {
      id: 'fd-sea-dps',
      route: 'TP HCM - Bali',
      date: '2 thg 2 2027',
      oldPrice: 4250000,
      price: 3490000,
      airline: 'Vietjet Air',
      from: 'TP.HCM',
      to: 'Bali',
      image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=700&q=80',
    },
  ],
}

export function FlightDealsSection({ setPage, setService, setKeyword, onChooseItem }) {
  const { catalog } = useContext(CatalogCtx)
  const [activeTab, setActiveTab] = useState('Hà Nội')

  const baseCards = FLIGHT_DEALS_BY_TAB[activeTab] || FLIGHT_DEALS_BY_TAB['Hà Nội']
  const cards = baseCards.map((card, idx) => {
    const realFlight =
      catalog.flights.find((f) => f.to === card.to || f.from === card.from) ||
      catalog.flights[idx % Math.max(1, catalog.flights.length)]
    return {
      ...card,
      flightRef: realFlight
        ? { ...realFlight, from: card.from, to: card.to, price: card.price, airline: card.airline || realFlight.airline }
        : null,
    }
  })

  const handlePickFlight = (card) => {
    setKeyword?.(card.to)
    if (card.flightRef && onChooseItem) {
      onChooseItem(card.flightRef)
    } else {
      setService?.('flight')
      setPage?.('flight')
    }
  }

  return (
    <section className="container section-block tvlk-deals-section">
      <div className="tvlk-section-head-row">
        <h2>Vé máy bay giá tốt</h2>
        <button
          type="button"
          className="tvlk-head-chevron"
          aria-label="Xem tất cả vé máy bay"
          onClick={() => { setService?.('flight'); setPage?.('flight') }}
        >
          <ChevronRight size={20} strokeWidth={1.8} />
        </button>
      </div>

      <div className="tvlk-filter-pills" role="tablist" aria-label="Lọc vé máy bay theo khu vực">
        {FLIGHT_FILTER_TABS.map((tab) => (
          <button
            type="button"
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`tvlk-filter-pill ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tvlk-photo-cards-grid">
        {cards.map((card, idx) => (
          <article
            key={card.id}
            className="tvlk-deal-card"
            onClick={() => handlePickFlight(card, idx)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handlePickFlight(card, idx) }}
          >
            <div
              className="tvlk-deal-photo"
              style={{ backgroundImage: `url(${card.image})` }}
            >
              <span className="tvlk-badge-dark-tl">MỘT CHIỀU</span>
              <span className="tvlk-ribbon-orange-br">Giá tốt chỉ từ</span>
            </div>

            <div className="tvlk-deal-body">
              <h3 className="tvlk-deal-title">{card.route}</h3>
              <div className="tvlk-deal-meta">
                <span className="tvlk-gold-crown" aria-hidden="true">
                  <Crown size={15} strokeWidth={1.8} />
                </span>
                <span>{card.date}</span>
              </div>
              <div className="tvlk-deal-old-price">{formatCurrency(card.oldPrice)}</div>
              <div className="tvlk-deal-price">{formatCurrency(card.price)}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/* =====================================================================
   4. KHÁCH SẠN GIÁ TỐT (Image 6)
   ===================================================================== */
const HOTEL_FILTER_TABS = ['Nội địa', 'Đà Nẵng', 'Phú Quốc', 'Đà Lạt', 'Nha Trang', 'Vũng Tàu', 'Hội An', 'Sapa']

const EXTRA_HOTEL_CARDS = [
  {
    id: 'hotel-1',
    name: 'Sóng Homestay - The Sóng Vũng Tàu',
    district: 'Thắng Tam',
    stars: 4,
    rating: 8.9,
    reviewsCount: '1,5k đánh giá',
    oldPrice: 478615,
    price: 315886,
    discountPct: 34,
    image: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'hotel-2',
    name: 'Khách sạn The Passion Lux Airport',
    district: 'Phường 4',
    stars: 3,
    rating: 8.2,
    reviewsCount: '152 đánh giá',
    oldPrice: 1345891,
    price: 792326,
    discountPct: 41,
    image: 'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'hotel-3',
    name: 'Joi Boutique Bãi Trước',
    district: 'Phường 1',
    stars: 3,
    rating: 8.7,
    reviewsCount: '119 đánh giá',
    oldPrice: 902327,
    price: 277371,
    discountPct: 69,
    image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'hotel-4',
    name: 'KLY Hotel & Retreat',
    district: 'Thắng Tam',
    stars: 3,
    rating: 9.0,
    reviewsCount: '75 đánh giá',
    oldPrice: 2327273,
    price: 672747,
    discountPct: 45,
    image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80',
  },
]

export function HotelDealsSection({ setPage, setService, setKeyword, onChooseItem, onOpenReviews }) {
  const { catalog } = useContext(CatalogCtx)
  const [activeTab, setActiveTab] = useState('Nội địa')

  const matchingCatalogHotels =
    activeTab === 'Nội địa'
      ? catalog.hotels
      : catalog.hotels.filter(
          (h) =>
            String(h.location || '').toLowerCase().includes(activeTab.toLowerCase()) ||
            String(h.name || '').toLowerCase().includes(activeTab.toLowerCase())
        )
  const hotelPool = matchingCatalogHotels.length > 0 ? matchingCatalogHotels : catalog.hotels

  const cards = EXTRA_HOTEL_CARDS.map((preset, idx) => {
    const realHotel = hotelPool[idx % Math.max(1, hotelPool.length)]
    const displayName =
      activeTab === 'Nội địa'
        ? realHotel?.name || preset.name
        : realHotel && String(realHotel.location || '').toLowerCase().includes(activeTab.toLowerCase())
          ? realHotel.name
          : `${preset.name} ${activeTab}`
    const displayPrice = realHotel?.price || preset.price
    const displayOldPrice = Math.round(displayPrice * (100 / (100 - preset.discountPct)))
    return {
      ...preset,
      name: displayName,
      district: activeTab === 'Nội địa' ? realHotel?.location || preset.district : activeTab,
      stars: realHotel?.stars || preset.stars,
      rating: realHotel?.rating || preset.rating,
      price: displayPrice,
      oldPrice: displayOldPrice,
      image: realHotel?.image ? (/^url\(|^linear-gradient|^radial-gradient/.test(realHotel.image) ? realHotel.image : ('url(' + realHotel.image + ')')) : preset.image,
      hotelRef: realHotel
        ? { ...realHotel, name: displayName, price: displayPrice }
        : { id: preset.id, name: displayName, location: preset.district, rating: preset.rating, stars: preset.stars, price: displayPrice },
    }
  })

  const handleCardClick = (card) => {
    if (activeTab !== 'Nội địa') setKeyword?.(activeTab)
    if (onChooseItem && card.hotelRef) {
      onChooseItem(card.hotelRef)
    } else {
      setService?.('hotel')
      setPage?.('hotel')
    }
  }

  return (
    <section className="container section-block tvlk-deals-section">
      <div className="tvlk-section-head-row">
        <h2>Khách sạn giá tốt</h2>
        <button
          type="button"
          className="tvlk-head-chevron"
          aria-label="Xem tất cả khách sạn"
          onClick={() => { setService?.('hotel'); setPage?.('hotel') }}
        >
          <ChevronRight size={20} strokeWidth={1.8} />
        </button>
      </div>

      <div className="tvlk-filter-pills" role="tablist" aria-label="Lọc khách sạn theo điểm đến">
        {HOTEL_FILTER_TABS.map((tab) => (
          <button
            type="button"
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`tvlk-filter-pill ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tvlk-photo-cards-grid">
        {cards.map((card) => (
          <article
            key={`${activeTab}-${card.id}`}
            className="tvlk-deal-card"
            onClick={() => handleCardClick(card)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCardClick(card) }}
          >
            <div
              className="tvlk-deal-photo"
              style={{ backgroundImage: `url(${card.image})` }}
            >
              <span className="tvlk-badge-blue-tl" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={13} strokeWidth={1.8} aria-hidden="true" />
                <span>{activeTab === 'Nội địa' ? card.district : activeTab}</span>
              </span>
              <span className="tvlk-ribbon-orange-br">Tiết kiệm {card.discountPct}%</span>
            </div>

            <div className="tvlk-deal-body">
              <h3 className="tvlk-deal-title">{card.name}</h3>
              <div className="tvlk-hotel-stars" aria-label={`${card.stars} sao`} style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: '#f59e0b' }}>
                {Array.from({ length: card.stars }, (_, i) => (
                  <Star key={i} size={14} strokeWidth={1.8} fill="currentColor" />
                ))}
              </div>
              <button
                type="button"
                className="tvlk-deal-rating-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenReviews?.(card.hotelRef)
                }}
              >
                <strong>{card.rating}/10</strong> · <span>{card.reviewsCount}</span>
              </button>
              <div className="tvlk-deal-old-price">{formatCurrency(card.oldPrice)}</div>
              <div className="tvlk-deal-price">{formatCurrency(card.price)}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/* =====================================================================
   5. VÉ VUI CHƠI GIÁ TỐT (Image 7)
   ===================================================================== */
const ACTIVITY_FILTER_TABS = [
  'Đà Nẵng',
  'TP. Hồ Chí Minh - Lân cận',
  'Hà Nội - Lân cận',
  'Nha Trang - Phú Quốc',
  'Đà Lạt - Phan Thiết',
  'Khác',
]

const ACTIVITY_CARDS = [
  {
    id: 'act-1',
    location: 'Hòa Ninh',
    title: 'Sun World Ba Na Hills tại Đà Nẵng',
    rating: '9.0/10',
    reviews: '76,7k đánh giá',
    price: 1000000,
    official: true,
    image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'act-2',
    location: 'Bình Minh',
    title: 'Vé VinWonders Nam Hội An',
    rating: '9.7/10',
    reviews: '17,3k đánh giá',
    price: 360000,
    official: true,
    image: 'https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'act-3',
    location: 'Cẩm Nam',
    title: 'Vé Ký ức Hội An',
    rating: '9.2/10',
    reviews: '6,2k đánh giá',
    price: 540000,
    official: true,
    image: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'act-4',
    location: 'Cẩm Thanh',
    title: 'Vé đi thuyền thúng Rừng dừa',
    rating: '9.7/10',
    reviews: '7,4k đánh giá',
    price: 86000,
    official: false,
    image: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80',
  },
]

export function ActivityDealsSection({ setPage, setService, setKeyword }) {
  const [activeTab, setActiveTab] = useState('Đà Nẵng')

  const goActivity = (loc) => {
    if (loc) setKeyword?.(loc)
    setService?.('activity')
    setPage?.('activity')
  }

  return (
    <section className="container section-block tvlk-deals-section">
      <div className="tvlk-section-head-row">
        <h2>Vé vui chơi giá tốt</h2>
        <button
          type="button"
          className="tvlk-head-chevron"
          aria-label="Xem tất cả vé vui chơi"
          onClick={goActivity}
        >
          <ChevronRight size={20} strokeWidth={1.8} />
        </button>
      </div>

      <div className="tvlk-filter-pills" role="tablist" aria-label="Lọc vé vui chơi theo khu vực">
        {ACTIVITY_FILTER_TABS.map((tab) => (
          <button
            type="button"
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`tvlk-filter-pill ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tvlk-photo-cards-grid">
        {ACTIVITY_CARDS.map((card) => (
          <article
            key={card.id}
            className="tvlk-deal-card"
            onClick={() => goActivity(activeTab === 'Đà Nẵng' ? card.location : activeTab)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') goActivity(activeTab === 'Đà Nẵng' ? card.location : activeTab) }}
          >
            <div
              className="tvlk-deal-photo"
              style={{ backgroundImage: `url(${card.image})` }}
            >
              <span className="tvlk-badge-coral-tl" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <MapPin size={13} strokeWidth={1.8} aria-hidden="true" />
                <span>{card.location}</span>
              </span>
              {card.official && (
                <span className="tvlk-official-seal">ĐỐI TÁC CHÍNH THỨC</span>
              )}
            </div>

            <div className="tvlk-deal-body">
              <h3 className="tvlk-deal-title">{card.title}</h3>
              <div className="tvlk-deal-rating-static">
                <strong>{card.rating}</strong> · <span>{card.reviews}</span>
              </div>
              <div className="tvlk-deal-price">{formatCurrency(card.price)}</div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

/* =====================================================================
   6. MẸO DU LỊCH & CẢM HỨNG
   ===================================================================== */
const INSPIRATION_TABS = [
  'Việt Nam',
  'Đông Nam Á',
  'Đông Á',
  'Úc & New Zealand',
  'Phần Còn Lại Của Thế Giới',
]

const INSPIRATION_ARTICLES = [
  {
    id: 'art-1',
    title: 'Lễ hội Đèn lồng Hội An 2026: Lịch trăng rằm và cách tận hưởng trọn vẹn',
    readTime: 'Đọc trong khoảng 5 phút',
    author: 'Mây An Nhiên Editorial',
    image: 'https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'art-2',
    title: 'Vietnam National Games 2026: Đại hội thể thao lớn nhất Việt Nam trở lại Thành phố Hồ Chí Minh',
    readTime: 'Đọc trong khoảng 6 phút',
    author: 'Mây An Nhiên Editorial',
    image: 'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'art-3',
    title: 'Festival Hoa Đà Lạt 2026: Lịch trình, địa điểm và chuỗi sự kiện',
    readTime: 'Đọc trong khoảng 6 phút',
    author: 'Mây An Nhiên Travel',
    image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=800&q=80',
  },
  {
    id: 'art-4',
    title: 'Lễ Thất Tịch 2026 là ngày gì? Nguồn gốc và ý nghĩa văn hóa Á Đông',
    readTime: 'Đọc trong khoảng 13 phút',
    author: 'Mây An Nhiên Travel',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
  },
]

export function TravelInspirationSection({ setPage }) {
  const [activeTab, setActiveTab] = useState('Việt Nam')

  return (
    <section className="container section-block tvlk-inspiration-section">
      <div className="tvlk-section-head-row">
        <h2 className="tvlk-icon-heading" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span className="tvlk-news-icon" aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Newspaper size={22} strokeWidth={1.8} />
          </span>
          <span>Mẹo Du Lịch &amp; Cảm Hứng</span>
        </h2>
      </div>

      <div className="tvlk-filter-pills" role="tablist" aria-label="Lọc bài viết cẩm nang du lịch">
        {INSPIRATION_TABS.map((tab) => (
          <button
            type="button"
            key={tab}
            role="tab"
            aria-selected={activeTab === tab}
            className={`tvlk-filter-pill ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="tvlk-photo-cards-grid">
        {INSPIRATION_ARTICLES.map((art) => (
          <article
            key={art.id}
            className="tvlk-article-card"
            onClick={() => setPage?.('ai-planner')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setPage?.('ai-planner') }}
          >
            <div
              className="tvlk-article-photo"
              style={{ backgroundImage: `url(${art.image})` }}
            />
            <div className="tvlk-article-body">
              <h3>{art.title}</h3>
              <p className="tvlk-article-time">{art.readTime}</p>
              <div className="tvlk-article-author">
                <span className="tvlk-author-dot" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Cloud size={12} strokeWidth={1.8} />
                </span>
                <span>{art.author}</span>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="tvlk-inspiration-more-wrap">
        <button
          type="button"
          className="tvlk-inspiration-more-btn"
          onClick={() => setPage?.('ai-planner')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          <span>Đọc các bài báo đầy cảm hứng</span>
          <ChevronRight size={16} strokeWidth={1.8} />
        </button>
      </div>
    </section>
  )
}

/* =====================================================================
   7. PHỔ BIẾN Ở VIỆT NAM (Image 9)
   ===================================================================== */
const POPULAR_VN_TABS = [
  {
    id: 'dom-flight',
    label: 'Vé máy bay nội địa',
    targetPage: 'flight',
    links: [
      'Vé máy bay Sài Gòn đi Hà Nội',
      'Vé máy bay Hà Nội đi Sài Gòn',
      'Vé máy bay Đà Nẵng đi Hà Nội',
      'Vé máy bay Vinh đi Sài Gòn',
      'Vé máy bay Sài Gòn đi Đà Nẵng',
      'Vé máy bay Hà Nội đi Đà Nẵng',
      'Vé máy bay Đà Nẵng đi Sài Gòn',
      'Vé máy bay Vinh đi Nha Trang',
      'Vé máy bay Sài Gòn đi Phú Quốc',
      'Vé máy bay Hà Nội đi Nha Trang',
      'Vé máy bay Đà Nẵng đi Đà Lạt',
      'Vé máy bay Vinh đi Đà Lạt',
      'Vé máy bay Sài Gòn đi Quy Nhơn',
      'Vé máy bay Hà Nội đi Phú Quốc',
      'Vé máy bay Đà Nẵng đi Nha Trang',
      'Vé máy bay Vinh đi Hà Nội',
      'Vé máy bay Sài Gòn đi Huế',
      'Vé máy bay Hà Nội đi Đà Lạt',
      'Vé máy bay Đà Nẵng đi Phú Quốc',
      'Vé máy bay Vinh đi Buôn Ma Thuột',
      'Vé máy bay Sài Gòn đi Nha Trang',
      'Vé máy bay Hà Nội đi Cần Thơ',
      'Vé máy bay Đà Nẵng đi Cần Thơ',
      'Vé máy bay Vinh đi Quy Nhơn',
      'Vé máy bay Sài Gòn đi Đà Lạt',
      'Vé máy bay Hà Nội đi Huế',
      'Vé máy bay Đà Nẵng đi Hải Phòng',
      'Vé máy bay Vinh đi Đà Nẵng',
      'Vé máy bay Sài Gòn đi Thanh Hoá',
      'Vé máy bay Hà Nội đi Quy Nhơn',
      'Vé máy bay Đà Nẵng đi Buôn Ma Thuột',
      'Vé máy bay Vinh đi Phú Quốc',
      'Vé máy bay Sài Gòn đi Vinh',
      'Vé máy bay Hà Nội đi Côn Đảo',
      'Vé máy bay Đà Nẵng đi Vinh',
      'Vé máy bay Vinh đi Cần Thơ',
      'Vé máy bay Sài Gòn đi Pleiku',
      'Vé máy bay Hà Nội đi Buôn Ma Thuột',
      'Vé máy bay Đà Nẵng đi Pleiku',
    ],
  },
  {
    id: 'intl-flight',
    label: 'Vé máy bay quốc tế',
    targetPage: 'flight',
    links: [
      'Vé máy bay đi Bangkok',
      'Vé máy bay đi Singapore',
      'Vé máy bay đi Seoul',
      'Vé máy bay đi Tokyo',
      'Vé máy bay đi Đài Bắc',
      'Vé máy bay đi Kuala Lumpur',
      'Vé máy bay đi Bali',
      'Vé máy bay đi Sydney',
      'Vé máy bay đi Melbourne',
      'Vé máy bay đi Paris',
      'Vé máy bay đi Hồng Kông',
      'Vé máy bay đi Thượng Hải',
    ],
  },
  {
    id: 'airlines',
    label: 'Hãng hàng không',
    targetPage: 'flight',
    links: [
      'Vietnam Airlines',
      'Vietjet Air',
      'Bamboo Airways',
      'Vietravel Airlines',
      'Pacific Airlines',
      'Singapore Airlines',
      'Thai Airways',
      'Korean Air',
      'ANA All Nippon Airways',
      'Cathay Pacific',
      'Qatar Airways',
      'Emirates',
    ],
  },
  {
    id: 'vn-hotels',
    label: 'Khách sạn tại Việt Nam',
    targetPage: 'hotel',
    links: [
      'Khách sạn Đà Nẵng',
      'Khách sạn Phú Quốc',
      'Khách sạn Đà Lạt',
      'Khách sạn Nha Trang',
      'Khách sạn Vũng Tàu',
      'Khách sạn Hà Nội',
      'Khách sạn TP. Hồ Chí Minh',
      'Khách sạn Hội An',
      'Khách sạn Sapa',
      'Khách sạn Quy Nhơn',
      'Khách sạn Huế',
      'Khách sạn Hạ Long',
    ],
  },
  {
    id: 'intl-hotels',
    label: 'Khách sạn nước ngoài',
    targetPage: 'hotel',
    links: [
      'Khách sạn Bangkok',
      'Khách sạn Singapore',
      'Khách sạn Tokyo',
      'Khách sạn Seoul',
      'Khách sạn Kuala Lumpur',
      'Khách sạn Đài Bắc',
      'Khách sạn Bali',
      'Khách sạn Hồng Kông',
    ],
  },
  {
    id: 'vt-hotels',
    label: 'Khách sạn Vũng Tàu giá rẻ',
    targetPage: 'hotel',
    links: [
      'Khách sạn Bãi Sau Vũng Tàu',
      'Khách sạn Bãi Trước Vũng Tàu',
      'Homestay Vũng Tàu gần biển',
      'Resort Hồ Tràm Vũng Tàu',
      'Villa Vũng Tàu có hồ bơi',
      'Khách sạn Thắng Tam Vũng Tàu',
      'Khách sạn 5 sao Vũng Tàu',
      'Căn hộ The Sóng Vũng Tàu',
    ],
  },
  {
    id: 'dl-hotels',
    label: 'Khách sạn Đà Lạt giá rẻ',
    targetPage: 'hotel',
    links: [
      'Khách sạn gần chợ Đà Lạt',
      'Homestay Đà Lạt view đồi thông',
      'Resort Hồ Tuyền Lâm Đà Lạt',
      'Villa Đà Lạt nguyên căn',
      'Khách sạn Phường 1 Đà Lạt',
      'Khách sạn 4 sao Đà Lạt',
      'Khách sạn Hồ Xuân Hương',
      'Boutique Hotel Đà Lạt',
    ],
  },
  {
    id: 'dn-hotels',
    label: 'Khách sạn Đà Nẵng giá rẻ',
    targetPage: 'hotel',
    links: [
      'Khách sạn biển Mỹ Khê Đà Nẵng',
      'Resort 5 sao Sơn Trà Đà Nẵng',
      'Khách sạn gần Cầu Rồng',
      'Khách sạn sông Hàn Đà Nẵng',
      'Villa biển Non Nước Đà Nẵng',
      'Khách sạn trung tâm Hải Châu',
      'Homestay An Thượng Đà Nẵng',
      'Khách sạn gia đình Đà Nẵng',
    ],
  },
  {
    id: 'vn-activities',
    label: 'Điểm tham quan tại Việt Nam',
    targetPage: 'activity',
    links: [
      'Sun World Ba Na Hills Đà Nẵng',
      'VinWonders Phú Quốc',
      'VinWonders Nha Trang',
      'Vé Ký Ức Hội An',
      'Cáp treo Fansipan Sapa',
      'Sun World Hạ Long',
      'Thuyền thúng Rừng dừa Bảy Mẫu',
      'Landmark 81 SkyView TP.HCM',
    ],
  },
  {
    id: 'bus-tickets',
    label: 'Vé xe khách',
    targetPage: 'bus',
    links: [
      'Xe Sài Gòn đi Đà Lạt',
      'Xe Sài Gòn đi Vũng Tàu',
      'Xe Sài Gòn đi Nha Trang',
      'Xe Sài Gòn đi Phan Thiết',
      'Xe Hà Nội đi Sapa',
      'Xe Hà Nội đi Hạ Long',
      'Xe Hà Nội đi Ninh Bình',
      'Xe Đà Nẵng đi Hội An',
    ],
  },
]

export function PopularVietnamSection({ setKeyword, setService, setPage }) {
  const [activeTabId, setActiveTabId] = useState(POPULAR_VN_TABS[0].id)
  const currentTab = POPULAR_VN_TABS.find((t) => t.id === activeTabId) || POPULAR_VN_TABS[0]

  const handleLinkClick = (text) => {
    const cleaned = text
      .replace(/^Vé máy bay\s+/i, '')
      .replace(/^Khách sạn\s+/i, '')
      .replace(/^Xe\s+/i, '')
    setKeyword?.(cleaned)
    setService?.(currentTab.targetPage)
    setPage?.(currentTab.targetPage)
  }

  return (
    <section className="container section-block tvlk-popular-vn-section">
      <div className="tvlk-section-head">
        <h2>Phổ biến ở Việt Nam</h2>
      </div>

      <div className="tvlk-popular-tabs" role="tablist" aria-label="Danh mục phổ biến ở Việt Nam">
        {POPULAR_VN_TABS.map((tab) => (
          <button
            type="button"
            key={tab.id}
            role="tab"
            aria-selected={activeTabId === tab.id}
            className={`tvlk-popular-tab ${activeTabId === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTabId(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tvlk-popular-links-grid">
        {currentTab.links.map((itemText) => (
          <button
            type="button"
            key={itemText}
            className="tvlk-popular-link"
            onClick={() => handleLinkClick(itemText)}
          >
            {itemText}
          </button>
        ))}
      </div>
    </section>
  )
}

/* =====================================================================
   8. #1 ỨNG DỤNG DU LỊCH MÂY AN NHIÊN TẤT-CẢ-TRONG-MỘT BANNER
   ===================================================================== */
export function AppDownloadBanner() {
  return (
    <section
      className="tvlk-app-download-banner"
      style={{
        backgroundImage:
          'linear-gradient(90deg, rgba(0, 122, 217, 0.94) 0%, rgba(1, 134, 219, 0.72) 48%, rgba(4, 78, 128, 0.25) 100%), url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1920&q=85)',
      }}
    >
      <div className="container tvlk-app-banner-inner">
        <h2 className="tvlk-app-banner-title">
          #1 Ứng dụng du lịch Mây An Nhiên Tất-cả-trong-một<sup>*</sup>
        </h2>

        <div className="tvlk-app-feature-pills">
          <div className="tvlk-app-feature-pill">
            <CalendarCheck size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>Hoàn tiền và đổi lịch dễ dàng</span>
          </div>
          <div className="tvlk-app-feature-pill">
            <BadgePercent size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>Ưu đãi chỉ có trên ứng dụng</span>
          </div>
          <div className="tvlk-app-feature-pill">
            <BellRing size={16} strokeWidth={1.8} aria-hidden="true" />
            <span>Thông báo và cảnh báo tức thì</span>
          </div>
        </div>

        <div className="tvlk-app-download-row">
          <div className="tvlk-app-qr-card" aria-label="Mã QR tải ứng dụng Mây An Nhiên">
            <svg viewBox="0 0 92 92" width="96" height="96" role="img" aria-hidden="true">
              <rect width="92" height="92" fill="#ffffff" rx="8" />
              <rect x="8" y="8" width="24" height="24" fill="none" stroke="#0f172a" strokeWidth="4" />
              <rect x="14" y="14" width="12" height="12" fill="#0f172a" />
              <rect x="60" y="8" width="24" height="24" fill="none" stroke="#0f172a" strokeWidth="4" />
              <rect x="66" y="14" width="12" height="12" fill="#0f172a" />
              <rect x="8" y="60" width="24" height="24" fill="none" stroke="#0f172a" strokeWidth="4" />
              <rect x="14" y="66" width="12" height="12" fill="#0f172a" />
              <rect x="38" y="10" width="6" height="10" fill="#0f172a" />
              <rect x="48" y="16" width="6" height="12" fill="#0f172a" />
              <rect x="12" y="38" width="14" height="6" fill="#0f172a" />
              <rect x="38" y="38" width="16" height="16" rx="4" fill="#0194f3" />
              <rect x="60" y="40" width="18" height="6" fill="#0f172a" />
              <rect x="38" y="60" width="8" height="12" fill="#0f172a" />
              <rect x="52" y="56" width="6" height="18" fill="#0f172a" />
              <rect x="64" y="62" width="18" height="6" fill="#0f172a" />
              <rect x="62" y="74" width="12" height="8" fill="#0f172a" />
            </svg>
          </div>

          <div className="tvlk-app-stores-wrap">
            <div className="tvlk-app-stores-row">
              <div className="tvlk-store-rating-block">
                <div className="tvlk-store-badge-dark">
                  <span className="tvlk-store-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <Smartphone size={18} strokeWidth={1.8} />
                  </span>
                  <div>
                    <small>Tải về trên</small>
                    <strong>App Store</strong>
                  </div>
                </div>
                <div className="tvlk-store-score">
                  <strong>4.7<small>/5</small></strong>
                  <span>Xếp hạng ứng dụng</span>
                </div>
              </div>

              <div className="tvlk-store-rating-block">
                <div className="tvlk-store-badge-dark">
                  <span className="tvlk-store-icon" style={{ display: 'inline-flex', alignItems: 'center' }}>
                    <PlayCircle size={18} strokeWidth={1.8} />
                  </span>
                  <div>
                    <small>TẢI TRÊN</small>
                    <strong>Google Play</strong>
                  </div>
                </div>
                <div className="tvlk-store-score">
                  <strong>4.9<small>/5</small></strong>
                  <span>Xếp hạng ứng dụng</span>
                </div>
              </div>
            </div>

            <p className="tvlk-app-footnote">
              *Nền tảng đặt vé máy bay, khách sạn, combo và trải nghiệm du lịch trực tuyến Mây An Nhiên Việt Nam.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

/* Legacy exports preserved for compatibility */
export function CollectionSection() {
  return (
    <section className="container section-block collection-section">
      <div className="section-title">
        <div>
          <h2>Bộ sưu tập nghỉ dưỡng</h2>
        </div>
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

export function DestinationSection() {
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

export function ListingPreview({ title, type, onChoose, onOpenReviews }) {
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
          : list.map((item) => (
            type === 'flight'
              ? <FlightCard key={item.id} flight={item} onChoose={onChoose} />
              : <HotelCard key={item.id} hotel={item} onChoose={onChoose} onOpenReviews={onOpenReviews} />
          ))}
      </div>
    </section>
  )
}

export function HomePage({
  service,
  setService,
  setPage,
  tripType,
  setTripType,
  keyword,
  setKeyword,
  passengers,
  setPassengers,
  dates,
  setDates,
  onSearch,
  promo,
  setPromo,
  onChooseItem,
  onOpenReviews,
}) {
  return (
    <div className="tvlk-homepage-body">
      <section className="hero tvl-hero">
        <div className="tvl-hero-overlay" aria-hidden="true" />
        <div className="container tvl-hero-container">
          <h1 className="tvl-hero-title">
            Mây An Nhiên — Đặt trọn hành trình, một chạm đi bất cứ đâu
          </h1>

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
            onSubmit={onSearch}
          />
        </div>
      </section>

      {/* 1. Mã giảm giá cho người dùng mới */}
      <PromoSection promo={promo} setPromo={setPromo} />

      {/* 2. Ưu đãi đang diễn ra */}
      <OngoingCampaignsSection setPage={setPage} setService={setService} />

      {/* 3. Vé máy bay giá tốt */}
      <FlightDealsSection setPage={setPage} setService={setService} setKeyword={setKeyword} onChooseItem={onChooseItem} />

      {/* 4. Khách sạn giá tốt */}
      <HotelDealsSection
        setPage={setPage}
        setService={setService}
        setKeyword={setKeyword}
        onChooseItem={onChooseItem}
        onOpenReviews={onOpenReviews}
      />

      {/* 5. Vé vui chơi giá tốt */}
      <ActivityDealsSection setPage={setPage} setService={setService} setKeyword={setKeyword} />

      {/* 6. Mẹo Du Lịch & Cảm Hứng */}
      <TravelInspirationSection setPage={setPage} />

      {/* 7. Phổ biến ở Việt Nam */}
      <PopularVietnamSection setKeyword={setKeyword} setService={setService} setPage={setPage} />

      {/* 8. #1 Ứng dụng du lịch Mây An Nhiên Tất-cả-trong-một */}
      <AppDownloadBanner />
    </div>
  )
}

export default HomePage
