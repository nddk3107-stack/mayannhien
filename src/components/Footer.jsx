// src/components/Footer.jsx — Chân trang hệ thống du lịch trực tuyến Mây An Nhiên
import {
  Cloud,
  Plane,
  Handshake,
  Share2,
  Globe,
  PlayCircle,
  Send,
  ShieldCheck,
} from 'lucide-react'

const PAYMENT_PARTNERS = [
  { id: 'mastercard', label: 'Mastercard', color: '#EB001B' },
  { id: 'visa', label: 'VISA', color: '#1A1F71' },
  { id: 'jcb', label: 'JCB', color: '#0B4EA2' },
  { id: 'amex', label: 'AMEX', color: '#006FCF' },
  { id: 'vietqr', label: 'VIETQR', color: '#E11D48' },
  { id: 'momo', label: 'MoMo', color: '#A50064' },
  { id: 'techcombank', label: 'Techcombank', color: '#DC2626' },
  { id: 'vpbank', label: 'VPBank', color: '#16A34A' },
  { id: 'vib', label: 'VIB', color: '#0284C7' },
  { id: 'vietcombank', label: 'Vietcombank', color: '#15803D' },
  { id: 'onepay', label: 'OnePay', color: '#1D4ED8' },
  { id: 'mb', label: 'MB', color: '#2563EB' },
  { id: 'hsbc', label: 'HSBC', color: '#DB0011' },
  { id: 'sacombank', label: 'Sacombank', color: '#0369A1' },
  { id: 'acb', label: 'ACB', color: '#1E40AF' },
  { id: 'tpbank', label: 'TPBank', color: '#7E22CE' },
  { id: 'vietinbank', label: 'VietinBank', color: '#0284C7' },
  { id: 'bidv', label: 'BIDV', color: '#0F766E' },
  { id: 'citibank', label: 'Citibank', color: '#003B70' },
  { id: 'alepay', label: 'AlePay', color: '#F59E0B' },
]

const SOCIAL_LINKS = [
  { id: 'facebook', label: 'Facebook', Icon: Share2, bg: '#1877F2' },
  { id: 'instagram', label: 'Instagram', Icon: Globe, bg: '#E4405F' },
  { id: 'tiktok', label: 'TikTok', Icon: PlayCircle, bg: '#0F172A' },
  { id: 'youtube', label: 'Youtube', Icon: PlayCircle, bg: '#FF0000' },
  { id: 'telegram', label: 'Telegram', Icon: Send, bg: '#26A5E4' },
]

const PRODUCT_NAV_ITEMS = [
  { id: 'hotel', label: 'Khách sạn' },
  { id: 'flight', label: 'Vé máy bay' },
  { id: 'bus', label: 'Vé xe khách' },
  { id: 'car', label: 'Đưa đón sân bay' },
  { id: 'train', label: 'Tàu hỏa' },
  { id: 'combo', label: 'Combo tiết kiệm' },
  { id: 'activity', label: 'Hoạt động & Vui chơi' },
  { id: 'insurance', label: 'Bảo hiểm du lịch' },
  { id: 'ai-planner', label: 'Trợ lý AI lập lịch trình' },
  { id: 'bookings', label: 'Đặt chỗ của tôi' },
]

const ABOUT_ITEMS = [
  'Cách đặt chỗ',
  'Liên hệ chúng tôi',
  'Trợ giúp',
  'Tuyển dụng',
  'Về chúng tôi',
]

const OTHER_ITEMS = [
  'Mây An Nhiên Affiliate',
  'Giới thiệu bạn bè',
  'Mây An Nhiên Blog',
  'Chính Sách Quyền Riêng',
  'Điều khoản & Điều kiện',
  'Đăng ký nơi nghỉ của bạn',
  'Đăng ký doanh nghiệp hoạt động du lịch của bạn',
  'Khu vực báo chí',
  'Quy chế hoạt động',
  'Vulnerability Disclosure Program',
]

export function Footer({ onNavigate }) {
  return (
    <footer className="footer tvlk-footer">
      <div className="container footer-grid tvlk-footer-grid">
        {/* Column 1: Brand, certifications, partner button, 4x5 payment grid */}
        <div className="footer-brand tvlk-footer-brand-col">
          <div className="tvlk-footer-logo">
            <span className="brand-cloud" aria-hidden="true">
              <Cloud size={20} strokeWidth={1.8} />
            </span>
            <span className="tvlk-footer-logo-text">Mây An Nhiên</span>
            <span className="brand-mark tvlk-footer-logo-bird">
              <Plane size={18} strokeWidth={1.8} />
            </span>
          </div>

          <div className="tvlk-cert-badges">
            <div className="tvlk-cert-badge">
              <strong>IATA</strong>
              <small>Accredited Agent</small>
            </div>
            <div className="tvlk-cert-badge">
              <strong>BSI</strong>
              <small>ISO/IEC 27001</small>
            </div>
            <div className="tvlk-cert-badge bct">
              <span className="tvlk-bct-check">
                <ShieldCheck size={14} strokeWidth={1.8} />
              </span>
              <div>
                <strong>ĐÃ ĐĂNG KÝ</strong>
                <small>BỘ CÔNG THƯƠNG</small>
              </div>
            </div>
            <div className="tvlk-cert-badge bct">
              <span className="tvlk-bct-check">
                <ShieldCheck size={14} strokeWidth={1.8} />
              </span>
              <div>
                <strong>ĐÃ ĐĂNG KÝ</strong>
                <small>BỘ CÔNG THƯƠNG</small>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="tvlk-partner-btn"
            onClick={() => onNavigate?.('hotel')}
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            <Handshake size={18} strokeWidth={1.8} aria-hidden="true" />
            <span>Hợp tác với Mây An Nhiên</span>
          </button>

          <div className="tvlk-pay-section">
            <h4 className="tvlk-pay-title">Đối tác thanh toán</h4>
            <div className="tvlk-pay-grid pay-chips">
              {PAYMENT_PARTNERS.map((partner) => (
                <span
                  key={partner.id}
                  className={`tvlk-pay-tile pay-tile-${partner.id}`}
                  style={{ '--pay-brand-color': `color-mix(in srgb, ${partner.color} 50%, var(--text-primary))` }}
                  title={partner.label}
                >
                  {partner.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Column 2: Về Mây An Nhiên & Theo dõi chúng tôi trên */}
        <div className="footer-col tvlk-footer-col">
          <h4>Về Mây An Nhiên</h4>
          <div className="footer-nav tvlk-footer-links">
            {ABOUT_ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onNavigate?.('home')}
              >
                {item}
              </button>
            ))}
          </div>

          <h4 className="tvlk-footer-subhead">Theo dõi chúng tôi trên</h4>
          <div className="tvlk-social-list">
            {SOCIAL_LINKS.map((soc) => {
              const SocIcon = soc.Icon
              return (
                <a
                  key={soc.id}
                  href={`#${soc.id}`}
                  className="tvlk-social-item"
                  onClick={(e) => e.preventDefault()}
                >
                  <span
                    className="tvlk-social-icon"
                    style={{ backgroundColor: soc.bg, color: '#ffffff' }}
                    aria-hidden="true"
                  >
                    <SocIcon size={14} strokeWidth={1.8} />
                  </span>
                  <span>{soc.label}</span>
                </a>
              )
            })}
          </div>
        </div>

        {/* Column 3: Sản phẩm */}
        <div className="footer-col tvlk-footer-col">
          <h4>Sản phẩm</h4>
          <div className="footer-nav tvlk-footer-links">
            {PRODUCT_NAV_ITEMS.map((prod) => (
              <button
                key={prod.id}
                type="button"
                onClick={() => onNavigate?.(prod.id)}
              >
                {prod.label}
              </button>
            ))}
          </div>
        </div>

        {/* Column 4: Khác & Tải ứng dụng */}
        <div className="footer-col tvlk-footer-col">
          <h4>Khác</h4>
          <div className="footer-nav tvlk-footer-links">
            {OTHER_ITEMS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onNavigate?.('home')}
              >
                {item}
              </button>
            ))}
          </div>

          <h4 className="tvlk-footer-subhead">Tải ứng dụng Mây An Nhiên</h4>
          <div className="tvlk-store-badges">
            <button
              type="button"
              className="tvlk-store-badge"
              onClick={() => onNavigate?.('home')}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                <path fill="#34A853" d="M3.6 2.2c-.4.4-.6 1-.6 1.7v16.2c0 .7.2 1.3.6 1.7l.1.1L13 12.6v-.2L3.6 2.2z" />
                <path fill="#FBBC05" d="M16.1 15.8l-3.1-3.1v-.3l3.1-3.1.1.1 3.7 2.1c1.1.6 1.1 1.6 0 2.2l-3.8 2.1z" />
                <path fill="#EA4335" d="M16.2 15.7L13 12.5 3.6 21.9c.4.4 1.1.5 1.8.1l10.8-6.3z" />
                <path fill="#4285F4" d="M16.2 9.3L5.4 3c-.7-.4-1.4-.3-1.8.1L13 12.5l3.2-3.2z" />
              </svg>
              <div className="tvlk-store-text">
                <small>GET IT ON</small>
                <strong>Google Play</strong>
              </div>
            </button>

            <button
              type="button"
              className="tvlk-store-badge"
              onClick={() => onNavigate?.('home')}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.96 6.33c.67-.81 1.12-1.94 1-3.08-.96.04-2.13.64-2.82 1.45-.61.71-1.15 1.86-1 2.97 1.07.08 2.15-.53 2.82-1.34z" />
              </svg>
              <div className="tvlk-store-text">
                <small>Download on the</small>
                <strong>App Store</strong>
              </div>
            </button>
          </div>
        </div>
      </div>

      <div className="footer-bottom tvlk-footer-bottom container">
        <span>© 2026 Mây An Nhiên. Nền tảng đặt dịch vụ du lịch trực tuyến Việt Nam.</span>
        <span>Giá đã bao gồm thuế và phí · Thanh toán bảo mật ISO/IEC 27001</span>
      </div>
    </footer>
  )
}

export default Footer
