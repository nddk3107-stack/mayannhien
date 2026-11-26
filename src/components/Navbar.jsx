// src/components/Navbar.jsx — Thanh điều hướng 2 tầng Mây An Nhiên
import { useEffect, useRef, useState } from 'react'
import {
  Cloud,
  Plane,
  Globe,
  ChevronDown,
  BadgePercent,
  LifeBuoy,
  Handshake,
  ReceiptText,
  Sun,
  Moon,
  Bell,
  CheckCheck,
  Sparkles,
  CreditCard,
  XCircle,
  QrCode,
  User,
  FileText,
  Shield,
  Settings,
  LogOut,
  Wallet,
} from 'lucide-react'
import { apiFetch } from '../services/api.js'
import { useRealtime } from '../realtime/RealtimeContext.jsx'

const SERVICE_NAV_LINKS = [
  { id: 'hotel', label: 'Khách sạn' },
  { id: 'flight', label: 'Vé máy bay' },
  { id: 'combo', label: 'Combo tiết kiệm' },
  { id: 'bus', label: 'Vé xe khách' },
  { id: 'train', label: 'Tàu hỏa' },
  { id: 'car', label: 'Đưa đón sân bay' },
  { id: 'activity', label: 'Hoạt động & Vui chơi' },
  { id: 'insurance', label: 'Bảo hiểm du lịch' },
  { id: 'ai-planner', label: 'Trợ lý lập lịch trình', isAi: true },
]

function formatTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000)
    if (diffSec < 60) return 'Vừa xong'
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} phút trước`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} giờ trước`
    return `${d.getDate()}/${d.getMonth() + 1}`
  } catch {
    return ''
  }
}

function getNotifIcon(type) {
  switch (type) {
    case 'booking': return <ReceiptText size={16} strokeWidth={1.8} />
    case 'payment': return <CreditCard size={16} strokeWidth={1.8} />
    case 'promo': return <Sparkles size={16} strokeWidth={1.8} />
    case 'cancel': return <XCircle size={16} strokeWidth={1.8} />
    default: return <Bell size={16} strokeWidth={1.8} />
  }
}

export function NotificationBell({ session, onNavigate, theme }) {
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const popoverRef = useRef(null)
  const { subscribe } = useRealtime()

  const loadNotifications = async () => {
    if (!session) return
    try {
      const res = await apiFetch('/api/notifications?limit=20')
      if (res.ok && res.data) {
        setItems(res.data.items || [])
        setUnread(res.data.unreadCount || 0)
      }
    } catch { /* ignore */ }
  }

  useEffect(() => {
    const timer = setTimeout(() => loadNotifications(), 0)
    return () => clearTimeout(timer)
  }, [session]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!subscribe) return
    const unsub = subscribe('notification:new', (payload) => {
      const notif = payload?.data?.notification || payload?.notification
      if (notif) {
        setItems((prev) => [notif, ...prev])
        setUnread((prev) => prev + 1)
      }
    })
    return () => unsub?.()
  }, [subscribe])

  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const markAllAsRead = async () => {
    try {
      const res = await apiFetch('/api/notifications/read-all', { method: 'PATCH' })
      if (res.ok) {
        setUnread(0)
        setItems((prev) => prev.map((item) => ({ ...item, is_read: 1 })))
      }
    } catch { /* ignore */ }
  }

  const handleItemClick = async (notif) => {
    if (!notif.is_read) {
      apiFetch(`/api/notifications/${notif.id}/read`, { method: 'PATCH' }).catch(() => { })
      setUnread((prev) => Math.max(0, prev - 1))
      setItems((prev) => prev.map((item) => (item.id === notif.id ? { ...item, is_read: 1 } : item)))
    }
    setOpen(false)
    if (notif.link) {
      onNavigate(notif.link)
    }
  }

  const iconColor = theme === 'dark' ? '#38bdf8' : '#0194f3'
  const iconFill = theme === 'dark' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(1, 148, 243, 0.18)'

  return (
    <div className="notif-wrapper" ref={popoverRef}>
      <button
        type="button"
        className="notif-btn tvl-notif-btn"
        onClick={() => setOpen(!open)}
        title="Thông báo hệ thống"
        aria-label="Xem thông báo"
      >
        <Bell size={19} strokeWidth={2.2} color={iconColor} stroke={iconColor} fill={iconFill} />
        {unread > 0 && (
          <span className="notif-badge">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-popover">
          <div className="notif-header">
            <h4>Thông báo</h4>
            {unread > 0 && (
              <button type="button" className="notif-mark-all" onClick={markAllAsRead}>
                <CheckCheck size={15} strokeWidth={1.8} />
                <span>Đánh dấu tất cả đã đọc</span>
              </button>
            )}
          </div>
          <div className="notif-list">
            {items.length === 0 ? (
              <div className="notif-empty">Chưa có thông báo nào</div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  className={`notif-item ${item.is_read ? 'read' : 'unread'}`}
                  onClick={() => handleItemClick(item)}
                >
                  <span className="notif-icon">{getNotifIcon(item.type)}</span>
                  <div className="notif-content">
                    <strong className="notif-title">{item.title}</strong>
                    <p className="notif-msg">{item.message}</p>
                    <small className="notif-time">{formatTime(item.created_at)}</small>
                  </div>
                  {!item.is_read && <span className="notif-dot" />}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export function UserAccountMenu({ session, onNavigate, onLogout }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    const handleOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [open])

  const roleLabel = session.role === 'admin' ? 'Quản trị viên' : session.role === 'staff' ? 'Lễ tân' : 'Thành viên'
  const roleBadgeClass = session.role === 'admin' ? 'role-admin' : session.role === 'staff' ? 'role-staff' : 'role-user'

  return (
    <div className="account-dropdown-wrap" ref={menuRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="account-trigger-btn"
        onClick={() => setOpen(!open)}
        title="Tài khoản cá nhân"
        aria-expanded={open}
      >
        <span className="account-avatar">
          {session.avatarUrl ? (
            <img
              src={session.avatarUrl}
              alt={session.name}
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            session.name ? session.name.charAt(0).toUpperCase() : 'U'
          )}
        </span>
        <span className="account-name">{session.name}</span>
        <span className="account-caret" style={{ display: 'inline-flex', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
          <ChevronDown size={15} strokeWidth={1.8} />
        </span>
      </button>

      {open && (
        <div className="account-dropdown-menu">
          <div className="account-dropdown-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <span className="account-avatar" style={{ width: '36px', height: '36px', fontSize: '16px' }}>
                {session.avatarUrl ? (
                  <img
                    src={session.avatarUrl}
                    alt={session.name}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  session.name ? session.name.charAt(0).toUpperCase() : 'U'
                )}
              </span>
              <div style={{ overflow: 'hidden' }}>
                <b style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{session.name}</b>
                <small style={{ display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{session.email}</small>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span className={`account-role-pill ${roleBadgeClass}`}>{roleLabel}</span>
              {session.memberTier && (
                <span className="account-role-pill" style={{ background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7' }}>
                  {session.memberTier}
                </span>
              )}
            </div>
          </div>
          <div className="account-dropdown-divider" />
          <button type="button" className="account-menu-item" onClick={() => { setOpen(false); onNavigate('bookings'); }}>
            <FileText size={16} strokeWidth={1.8} />
            <span>Đơn đặt chỗ của tôi</span>
          </button>
          <button type="button" className="account-menu-item" onClick={() => { setOpen(false); onNavigate('profile'); }} style={{ color: '#0284c7', fontWeight: 600 }}>
            <Wallet size={16} strokeWidth={1.8} />
            <span>Ví Mây An Nhiên & Số dư</span>
          </button>
          <button type="button" className="account-menu-item" onClick={() => { setOpen(false); onNavigate('profile'); }}>
            <User size={16} strokeWidth={1.8} />
            <span>Hồ sơ cá nhân</span>
          </button>
          {(session.role === 'staff' || session.role === 'admin') && (
            <button type="button" className="account-menu-item" onClick={() => { setOpen(false); onNavigate('staff/scanner'); }}>
              <QrCode size={16} strokeWidth={1.8} />
              <span>Quét mã QR check-in</span>
            </button>
          )}
          {session.role === 'admin' && (
            <button type="button" className="account-menu-item" onClick={() => { setOpen(false); onNavigate('admin'); }}>
              <Shield size={16} strokeWidth={1.8} />
              <Settings size={14} strokeWidth={1.8} />
              <span>Cổng quản trị Admin</span>
            </button>
          )}
          <div className="account-dropdown-divider" />
          <button type="button" className="account-menu-item logout" onClick={() => { setOpen(false); onLogout(); }}>
            <LogOut size={16} strokeWidth={1.8} />
            <span>Đăng xuất</span>
          </button>
        </div>
      )}
    </div>
  )
}

export function Navbar({
  page,
  setPage,
  session,
  theme,
  toggleTheme,
  scrolled,
  onOpenLogin,
  onOpenRegister,
  onLogout,
  onNotify,
}) {
  const handlePromoClick = () => {
    if (page !== 'home') {
      setPage('home')
      window.setTimeout(() => {
        document.querySelector('#promo-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 120)
    } else {
      document.querySelector('#promo-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <header className={`header tvl-header ${scrolled ? 'scrolled' : ''} ${page === 'home' && !scrolled ? 'on-hero' : ''}`}>
      {/* Tầng 1: Logo + Utility Navigation + Auth */}
      <div className="header-top-row">
        <div className="header-top-inner">
          <button type="button" className="brand tvl-brand" onClick={() => setPage('home')} aria-label="Về trang chủ Mây An Nhiên">
            <span className="brand-cloud" aria-hidden="true">
              <Cloud size={20} strokeWidth={1.8} />
            </span>
            <span className="brand-text">Mây An Nhiên</span>
            <span className="brand-bird" aria-hidden="true">
              <Plane size={18} strokeWidth={1.8} />
            </span>
          </button>

          <div className="header-utility-nav">
            <button
              type="button"
              className="tvl-util-link tvl-lang-chip"
              onClick={() => onNotify('Đang sử dụng tiền tệ VND (Việt Nam Đồng) và ngôn ngữ Tiếng Việt.')}
            >
              <Globe size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>VND | VI</span>
              <ChevronDown size={16} strokeWidth={1.8} className="tvl-caret" aria-hidden="true" />
            </button>

            <button
              type="button"
              className="tvl-util-link"
              onClick={handlePromoClick}
            >
              <BadgePercent size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Khuyến mãi</span>
            </button>

            <button
              type="button"
              className="tvl-util-link"
              onClick={() => onNotify('Hỗ trợ khách hàng 24/7: 1900 1833 · Email: hotro@mayannhien.vn')}
            >
              <LifeBuoy size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Hỗ trợ</span>
              <ChevronDown size={15} strokeWidth={1.8} className="tvl-caret" aria-hidden="true" />
            </button>

            <button
              type="button"
              className="tvl-util-link hide-tablet"
              onClick={() => onNotify('Liên hệ hợp tác đại lý & đối tác khách sạn: partner@mayannhien.vn')}
            >
              <Handshake size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Hợp tác với chúng tôi</span>
            </button>

            <button
              type="button"
              className={`tvl-util-link ${page === 'bookings' ? 'active' : ''}`}
              onClick={() => setPage('bookings')}
            >
              <ReceiptText size={16} strokeWidth={1.8} aria-hidden="true" />
              <span>Đặt chỗ của tôi</span>
            </button>

            <button
              type="button"
              className="theme-toggle-btn tvl-theme-btn"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              aria-label="Chuyển chế độ sáng tối"
            >
              <span className="theme-toggle-icon" aria-hidden="true">
                {theme === 'dark' ? <Sun size={16} strokeWidth={1.8} /> : <Moon size={16} strokeWidth={1.8} />}
              </span>
              <span className="theme-toggle-text">{theme === 'dark' ? 'Sáng' : 'Tối'}</span>
            </button>

            {session ? (
              <div className="tvl-auth-logged">
                {(session.role === 'staff' || session.role === 'admin') && (
                  <button
                    type="button"
                    className={`tvl-util-link ${page === 'staff/scanner' ? 'active' : ''}`}
                    onClick={() => setPage('staff/scanner')}
                  >
                    <QrCode size={16} strokeWidth={1.8} aria-hidden="true" />
                    <span>Lễ tân</span>
                  </button>
                )}
                <NotificationBell
                  session={session}
                  theme={theme}
                  onNavigate={(link) => {
                    if (link === '#/bookings') setPage('bookings')
                    else if (link === '#/profile') setPage('profile')
                    else if (link?.startsWith('#/')) setPage(link.slice(2))
                  }}
                />
                <UserAccountMenu
                  session={session}
                  onNavigate={(p) => setPage(p)}
                  onLogout={onLogout}
                />
              </div>
            ) : (
              <div className="tvl-auth-buttons">
                <button type="button" className="tvl-login-btn" onClick={onOpenLogin}>
                  <User size={16} strokeWidth={1.8} aria-hidden="true" />
                  <span>Đăng Nhập</span>
                </button>
                <button type="button" className="tvl-register-btn" onClick={onOpenRegister}>
                  Đăng ký
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tầng 2: Thanh danh mục dịch vụ ngang Mây An Nhiên */}
      <div className="header-sub-row">
        <nav className="header-sub-inner" aria-label="Danh mục dịch vụ">
          {SERVICE_NAV_LINKS.map((item) => (
            <button
              type="button"
              key={item.id}
              className={`tvl-subnav-link ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
            >
              {item.isAi && <Sparkles size={16} strokeWidth={1.8} aria-hidden="true" />}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}

export default Navbar
