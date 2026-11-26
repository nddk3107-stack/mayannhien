// src/components/MobileBottomNav.jsx — Thanh điều hướng đáy chuẩn Native Mobile App (< 768px)
import React, { useEffect, useState } from 'react'
import {
  Home,
  Ticket,
  Sparkles,
  Bell,
  User,
  CheckCheck,
  ReceiptText,
  CreditCard,
  XCircle,
  X,
  Lock,
} from 'lucide-react'
import { apiFetch } from '../services/api.js'
import { useRealtime } from '../realtime/RealtimeContext.jsx'

function formatNotifTime(iso) {
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
    case 'booking': return <ReceiptText size={17} strokeWidth={1.9} />
    case 'payment': return <CreditCard size={17} strokeWidth={1.9} />
    case 'promo': return <Sparkles size={17} strokeWidth={1.9} />
    case 'cancel': return <XCircle size={17} strokeWidth={1.9} />
    default: return <Bell size={17} strokeWidth={1.9} />
  }
}

export default function MobileBottomNav({
  page,
  setPage,
  session,
  onOpenLogin,
}) {
  const [unread, setUnread] = useState(0)
  const [items, setItems] = useState([])
  const [notifOpen, setNotifOpen] = useState(false)
  const { subscribe } = useRealtime()

  const loadNotifications = async () => {
    if (!session) {
      setItems([])
      setUnread(0)
      return
    }
    try {
      const res = await apiFetch('/api/notifications?limit=25')
      if (res.ok && res.data) {
        setItems(res.data.items || [])
        setUnread(res.data.unreadCount || 0)
      }
    } catch {
      // ignore offline
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => loadNotifications(), 0)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.email])

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

  const markAllAsRead = async () => {
    try {
      const res = await apiFetch('/api/notifications/read-all', { method: 'PATCH' })
      if (res.ok) {
        setUnread(0)
        setItems((prev) => prev.map((item) => ({ ...item, is_read: 1 })))
      }
    } catch {
      // ignore
    }
  }

  const handleItemClick = async (notif) => {
    if (!notif.is_read) {
      apiFetch(`/api/notifications/${notif.id}/read`, { method: 'PATCH' }).catch(() => {})
      setUnread((prev) => Math.max(0, prev - 1))
      setItems((prev) => prev.map((item) => (item.id === notif.id ? { ...item, is_read: 1 } : item)))
    }
    setNotifOpen(false)
    if (notif.link) {
      if (notif.link === '#/bookings') setPage('bookings')
      else if (notif.link === '#/profile') setPage('profile')
      else if (notif.link.startsWith('#/')) setPage(notif.link.slice(2))
    }
  }

  const isHomeActive = !notifOpen && ['home', 'hotel', 'flight', 'combo', 'rooms', 'activity', 'car', 'bus', 'train', 'insurance'].includes(page)
  const isBookingsActive = !notifOpen && ['bookings', 'checkout', 'checkout-hotel'].includes(page)
  const isAiActive = !notifOpen && page === 'ai-planner'
  const isProfileActive = !notifOpen && page === 'profile'

  return (
    <>
      {/* Bottom Sheet Thông báo trên Mobile */}
      {notifOpen && (
        <div
          className="mobile-notif-sheet-overlay"
          onClick={() => setNotifOpen(false)}
          role="presentation"
        >
          <div
            className="mobile-notif-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Thông báo hệ thống"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-notif-sheet-handle" />
            <div className="mobile-notif-sheet-head">
              <div>
                <h3>Thông báo của bạn</h3>
                <small>{unread > 0 ? `${unread} thông báo chưa đọc` : 'Đã cập nhật mới nhất'}</small>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {session && unread > 0 && (
                  <button
                    type="button"
                    className="mobile-notif-readall-btn"
                    onClick={markAllAsRead}
                  >
                    <CheckCheck size={15} strokeWidth={2} />
                    <span>Đọc tất cả</span>
                  </button>
                )}
                <button
                  type="button"
                  className="mobile-notif-close-btn"
                  onClick={() => setNotifOpen(false)}
                  aria-label="Đóng thông báo"
                >
                  <X size={20} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div className="mobile-notif-sheet-body">
              {!session ? (
                <div className="mobile-notif-guest">
                  <Lock size={32} strokeWidth={1.8} />
                  <h4>Đăng nhập để nhận thông báo</h4>
                  <p>Theo dõi trạng thái vé máy bay, xác nhận phòng khách sạn và ưu đãi độc quyền theo thời gian thực.</p>
                  <button
                    type="button"
                    className="mobile-notif-login-btn"
                    onClick={() => {
                      setNotifOpen(false)
                      onOpenLogin?.()
                    }}
                  >
                    Đăng nhập ngay
                  </button>
                </div>
              ) : items.length === 0 ? (
                <div className="mobile-notif-empty">
                  <Bell size={32} strokeWidth={1.6} />
                  <p>Chưa có thông báo mới nào</p>
                  <small>Mọi cập nhật về đơn đặt chỗ và thanh toán sẽ xuất hiện tại đây.</small>
                </div>
              ) : (
                items.map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className={`mobile-notif-row ${item.is_read ? 'read' : 'unread'}`}
                    onClick={() => handleItemClick(item)}
                  >
                    <span className="mobile-notif-row-icon">{getNotifIcon(item.type)}</span>
                    <span className="mobile-notif-row-content">
                      <strong>{item.title}</strong>
                      <span>{item.message}</span>
                      <small>{formatNotifTime(item.created_at)}</small>
                    </span>
                    {!item.is_read && <span className="mobile-notif-row-dot" />}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Thanh Bottom Navigation 5 Tab cố định ở đáy màn hình (< 768px) */}
      <nav className="mobile-bottom-nav" aria-label="Điều hướng di động">
        <button
          type="button"
          className={`mobile-nav-tab ${isHomeActive ? 'active' : ''}`}
          onClick={() => {
            setNotifOpen(false)
            setPage('home')
          }}
        >
          <span className="mobile-nav-icon-wrap">
            <Home size={21} strokeWidth={isHomeActive ? 2.3 : 1.9} />
          </span>
          <span className="mobile-nav-label">Trang chủ</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${isBookingsActive ? 'active' : ''}`}
          onClick={() => {
            setNotifOpen(false)
            setPage('bookings')
          }}
        >
          <span className="mobile-nav-icon-wrap">
            <Ticket size={21} strokeWidth={isBookingsActive ? 2.3 : 1.9} />
          </span>
          <span className="mobile-nav-label">Đặt chỗ</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-tab is-ai-tab ${isAiActive ? 'active' : ''}`}
          onClick={() => {
            setNotifOpen(false)
            setPage('ai-planner')
          }}
        >
          <span className="mobile-nav-icon-wrap ai-glow">
            <Sparkles size={21} strokeWidth={2.2} />
          </span>
          <span className="mobile-nav-label">AI Lịch trình</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${notifOpen ? 'active' : ''}`}
          onClick={() => {
            if (!notifOpen && session) loadNotifications()
            setNotifOpen((prev) => !prev)
          }}
        >
          <span className="mobile-nav-icon-wrap">
            <Bell size={21} strokeWidth={notifOpen ? 2.3 : 1.9} />
            {unread > 0 && (
              <span className="mobile-nav-badge">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </span>
          <span className="mobile-nav-label">Thông báo</span>
        </button>

        <button
          type="button"
          className={`mobile-nav-tab ${isProfileActive ? 'active' : ''}`}
          onClick={() => {
            setNotifOpen(false)
            setPage('profile')
          }}
        >
          <span className="mobile-nav-icon-wrap">
            <User size={21} strokeWidth={isProfileActive ? 2.3 : 1.9} />
          </span>
          <span className="mobile-nav-label">Hồ sơ</span>
        </button>
      </nav>
    </>
  )
}
