// src/Admin.jsx — Khu vực quản trị Mây An Nhiên (SPA riêng, hash #/admin/*).
// Nguyên tắc bảo mật:
//  - KHÔNG TIN role trong localStorage: mọi dữ liệu đều do /api/admin/* trả về
//    sau khi server xác thực cookie phiên + role='admin'.
//  - Giao diện admin KHÔNG trộn vào menu/điều hướng của người dùng.
import { memo, useEffect, useState, useRef } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BedDouble,
  Building2,
  Bus,
  Camera,
  CarTaxiFront,
  Cloud,
  Download,
  Eye,
  FerrisWheel,
  FileText,
  Gift,
  Grid,
  Loader2,
  LogOut,
  Moon,
  Plane,
  Plus,
  QrCode,
  ReceiptText,
  RefreshCw,
  Shield,
  ShieldCheck,
  Star,
  Sun,
  TicketPercent,
  TrainFront,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { apiFetch } from '../services/api.js'
import '../styles/admin.css'
import { useRealtime } from '../realtime/RealtimeContext.jsx'

const ADMIN_SECTIONS = [
  { id: 'dashboard', label: 'Tổng quan', Icon: BarChart3 },
  { id: 'bookings', label: 'Đơn đặt chỗ', Icon: ReceiptText },
  { id: 'hotels', label: 'Khách sạn', Icon: Building2 },
  { id: 'rooms', label: 'Phòng', Icon: BedDouble },
  { id: 'flights', label: 'Chuyến bay', Icon: Plane },
  { id: 'combos', label: 'Combo', Icon: Gift },
  { id: 'promotions', label: 'Khuyến mãi', Icon: TicketPercent },
  { id: 'users', label: 'Người dùng', Icon: Users },
  { id: 'audit-logs', label: 'Nhật ký (Audit)', Icon: FileText },
]

const STATUS_OPTIONS = ['Đã tạo', 'Chờ thanh toán', 'Đã thanh toán', 'Đã xác nhận', 'checked_in', 'Hoàn tất', 'Đã hủy']
const PAYMENT_LABELS = {
  pending: 'Chờ thanh toán',
  paid: 'Đã thanh toán',
  refund_pending: 'Chờ hoàn tiền',
  refunded: 'Đã hoàn tiền',
  simulated: 'Đã thanh toán',
}

// Helpers dùng trong file này (không export -> giữ nguyên fast refresh của React).
const money = (value) => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(Number(value) || 0)

const formatDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}

const routeFromHash = () => {
  const raw = window.location.hash.replace(/^#\/?/, '')
  const [, section] = raw.split('/')
  if (section === 'extra') return 'extra'
  if (section === 'audit-logs') return 'audit-logs'
  return ADMIN_SECTIONS.some((s) => s.id === section) ? section : 'dashboard'
}

/* ----------------------------------------------------------- primitives */
function Modal({ title, onClose, children }) {
  return (
    <div className="admin-modal-overlay" role="presentation" onClick={onClose}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Đóng">
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, hint, children, wide }) {
  return (
    <label className={`admin-field${wide ? ' wide' : ''}`}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

function Toggle({ checked, onChange, labelOn = 'Đang kinh doanh', labelOff = 'Ngừng kinh doanh' }) {
  return (
    <button
      type="button"
      className={`admin-toggle ${checked ? 'on' : 'off'}`}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
    >
      {checked ? labelOn : labelOff}
    </button>
  )
}

function Empty({ text }) {
  return <div className="admin-empty">{text}</div>
}

/* --------------------------------------------------------- admin login */
function AdminLogin({ onLogged }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    if (busy) return
    const mail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mail)) { setError('Email không hợp lệ.'); return }
    if (password.length < 6) { setError('Mật khẩu phải có ít nhất 6 ký tự.'); return }
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch('/api/auth/login', { method: 'POST', body: { email: mail, password } })
      if (res.networkError) { setError('Không kết nối được máy chủ.'); return }
      if (!res.ok) { setError(res.data?.error || 'Đăng nhập thất bại.'); return }
      const user = res.data.user
      if (user.role !== 'admin') {
        // Không phải quản trị viên -> đăng xuất ngay, không giữ phiên
        await apiFetch('/api/auth/logout', { method: 'POST' })
        setError('Tài khoản này không có quyền quản trị viên.')
        return
      }
      onLogged(user)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="admin-login-page">
      <form className="admin-login-card" onSubmit={submit} noValidate>
        <span className="admin-brand-mark"><Cloud size={26} strokeWidth={1.8} /></span>
        <h1>Đăng nhập quản trị</h1>
        <p>Chỉ tài khoản có vai trò <b>admin</b> trên máy chủ mới vào được khu vực này.</p>
        <Field label="Email quản trị">
          <input
            type="email" value={email} maxLength={80} autoComplete="username"
            placeholder="admin@mayan.test"
            onChange={(e) => { setEmail(e.target.value); setError('') }}
          />
        </Field>
        <Field label="Mật khẩu">
          <input
            type="password" value={password} maxLength={64} autoComplete="current-password"
            placeholder="Tối thiểu 6 ký tự"
            onChange={(e) => { setPassword(e.target.value); setError('') }}
          />
        </Field>
        {error && <p className="admin-login-error" role="alert">{error}</p>}
        <button className="admin-login-submit" type="submit" disabled={busy}>
          {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
        </button>
        <small>Tạo tài khoản admin đầu tiên bằng: <code>npm run seed:admin</code></small>
      </form>
    </div>
  )
}

/* --------------------------------------------------------- admin shell */
export default function AdminApp({ onExit }) {
  // undefined = đang kiểm tra phiên; null = chưa đăng nhập; {role:'user'} = sai quyền
  const [user, setUser] = useState(undefined)
  const [checking, setChecking] = useState(true)
  const [section, setSection] = useState(routeFromHash)
  const [bookingPreset, setBookingPreset] = useState(null)
  const [blockedReason, setBlockedReason] = useState('')
  const [adminTheme, setAdminTheme] = useState(() => {
    try { return localStorage.getItem('mayan_theme') || 'dark' } catch { return 'dark' }
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', adminTheme)
  }, [adminTheme])

  const toggleAdminTheme = () => {
    const next = adminTheme === 'dark' ? 'light' : 'dark'
    setAdminTheme(next)
    try { localStorage.setItem('mayan_theme', next) } catch { }
    document.documentElement.setAttribute('data-theme', next)
  }

  // Điều hướng theo hash #/admin/<section> (F5 giữ nguyên trang đang xem)
  useEffect(() => {
    const onHash = () => setSection(routeFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  // Đồng bộ hash khi đổi section — việc ghi window.location.hash phải nằm trong effect.
  // Bỏ qua hash trang đăng nhập (không thuộc ADMIN_SECTIONS) để không ghi đè luồng login.
  useEffect(() => {
    if (window.location.hash.includes('/login')) return
    if (window.location.hash !== `#/admin/${section}`) window.location.hash = `#/admin/${section}`
  }, [section])

  const goto = (id, preset = null) => {
    setBookingPreset(preset)
    setSection(id) // effect phía trên sẽ ghi hash tương ứng
  }

  // Kiểm tra phiên THẬT với server ngay khi vào /admin (không tin localStorage)
  useEffect(() => {
    let active = true
      ; (async () => {
        const res = await apiFetch('/api/auth/me')
        if (!active) return
        if (res.networkError || !res.ok) { setUser(null); setChecking(false); return }
        const me = res.data?.user
        if (me?.role === 'admin') {
          setUser(me)
        } else {
          setUser(me || null)
          setBlockedReason(me ? 'Tài khoản của bạn không có quyền quản trị viên.' : '')
        }
        setChecking(false)
      })()
    return () => { active = false }
  }, [])

  const { client } = useRealtime()

  useEffect(() => {
    if (user?.role === 'admin') {
      client.subscribeChannel('telemetry')
      client.subscribeChannel('admin')
      client.sendAction('get_telemetry')
    }
  }, [user, client])

  // Gọi API quản trị — tự xử lý 401/403 (phiên hết hạn / bị hạ quyền)
  const call = async (path, options) => {
    const res = await apiFetch(path, options)
    if (res.status === 401) { setUser(null); setBlockedReason('Phiên đăng nhập đã hết hạn.'); return res }
    if (res.status === 403) { setBlockedReason(res.data?.error || 'Bạn không có quyền thực hiện thao tác này.'); return res }
    return res
  }

  const logout = async () => {
    await apiFetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setBlockedReason('')
    if (window.location.hash !== '#/admin/login') window.location.hash = '#/admin/login'
  }

  if (checking) return <div className="admin-loading">Đang kiểm tra phiên đăng nhập…</div>

  if (!user) {
    return (
      <AdminLogin
        onLogged={(me) => {
          setUser(me)
          setBlockedReason('')
          if (window.location.hash !== '#/admin/dashboard') window.location.hash = '#/admin/dashboard'
        }}
      />
    )
  }

  if (user.role !== 'admin') {
    return (
      <div className="admin-login-page">
        <div className="admin-login-card">
          <span className="admin-brand-mark"><AlertTriangle size={26} strokeWidth={1.8} /></span>
          <h1>Không có quyền truy cập</h1>
          <p>{blockedReason || 'Chỉ quản trị viên mới được vào khu vực này.'}</p>
          <button
            className="admin-login-submit"
            type="button"
            onClick={async () => { await logout(); onExit?.() }}
          >
            Về trang người dùng
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <span className="admin-brand-mark"><Cloud size={22} strokeWidth={1.8} /></span>
          <div>
            <b>Mây An Nhiên</b>
            <small>Trung tâm quản trị</small>
          </div>
        </div>
        <nav className="admin-nav">
          {ADMIN_SECTIONS.map((item) => {
            const SectionIcon = item.Icon
            return (
              <button
                key={item.id}
                type="button"
                className={section === item.id ? 'active' : ''}
                onClick={() => goto(item.id)}
              >
                <i><SectionIcon size={16} strokeWidth={1.8} /></i> {item.label}
              </button>
            )
          })}
        </nav>
        <div className="admin-sidebar-foot">
          <button type="button" className="ghost" onClick={onExit}>
            <ArrowLeft size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Trang người dùng
          </button>
          <button type="button" onClick={logout}>
            <LogOut size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Đăng xuất
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <h2>
            {section === 'audit-logs'
              ? 'Nhật ký hoạt động (Audit Logs)'
              : section === 'extra'
                ? 'Dịch vụ mở rộng'
                : (ADMIN_SECTIONS.find((s) => s.id === section)?.label || 'Tổng quan')}
          </h2>
          <div className="admin-topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="admin-theme-btn"
              onClick={toggleAdminTheme}
              title={adminTheme === 'dark' ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
              aria-label="Đổi giao diện sáng/tối"
            >
              {adminTheme === 'dark' ? (
                <><Sun size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Sáng</>
              ) : (
                <><Moon size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Tối</>
              )}
            </button>
            <span className="admin-chip" title={user.email}>
              <Shield size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {user.name} · admin
            </span>
          </div>
        </header>

        <main className="admin-content">
          <ErrorBar message={blockedReason} onRetry={() => setBlockedReason('')} />
          {section === 'dashboard' && <DashboardSection call={call} onGoto={goto} />}
          {section === 'audit-logs' && <AuditLogViewerSection call={call} onBack={() => goto('dashboard')} />}
          {section === 'bookings' && <BookingsSection call={call} preset={bookingPreset} />}
          {section === 'hotels' && <CatalogCrudSection kind="hotels" call={call} />}
          {section === 'rooms' && <RoomCrudSection call={call} />}
          {section === 'flights' && <CatalogCrudSection kind="flights" call={call} />}
          {section === 'combos' && <ComboCrudSection call={call} onGotoExtra={() => goto('extra')} />}
          {section === 'promotions' && <PromoCrudSection call={call} />}
          {section === 'extra' && <ExtraCrudSection call={call} onBack={() => goto('combos')} />}
          {section === 'users' && <UsersSection call={call} />}
        </main>
      </div>
    </div>
  )
}


/* ------------------------------------------------ QR Scanner Modal (Admin) */
function AdminQrScannerModal({ onClose, onSuccess }) {
  const [manualCode, setManualCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [cameraError, setCameraError] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const qrRef = useRef(null)
  const fileRef = useRef(null)

  const stopCam = async () => {
    if (qrRef.current) {
      try {
        if (qrRef.current.isScanning) await qrRef.current.stop()
        await qrRef.current.clear()
      } catch {}
    }
    setCameraActive(false)
  }

  const startCam = async () => {
    setCameraError('')
    try {
      await stopCam()
      const devices = await Html5Qrcode.getCameras()
      if (!devices || !devices.length) {
        setCameraError('Không tìm thấy thiết bị Camera. Bạn có thể tải ảnh mã QR hoặc nhập mã đơn bên dưới.')
        return
      }
      const qr = new Html5Qrcode('admin-qr-reader')
      qrRef.current = qr
      const qrCfg = { fps: 10, qrbox: { width: 220, height: 220 } }
      const onDecoded = (decodedText) => {
        verifyTicket({ qrData: decodedText })
      }
      const rearCam = devices.find((d) => /back|rear|environment|sau/i.test(d.label || ''))
      const fallbackId = rearCam?.id || devices[devices.length - 1].id
      const isMobile = window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
      if (isMobile) {
        try {
          await qr.start({ facingMode: 'environment' }, qrCfg, onDecoded, () => {})
        } catch {
          await qr.start(fallbackId, qrCfg, onDecoded, () => {})
        }
      } else {
        await qr.start(fallbackId, qrCfg, onDecoded, () => {})
      }
      setCameraActive(true)
    } catch {
      setCameraError('Không mở được Camera trực tiếp. Vui lòng chọn ảnh mã QR hoặc nhập mã đặt chỗ bên dưới.')
    }
  }

  useEffect(() => {
    const t = setTimeout(() => startCam(), 250)
    return () => {
      clearTimeout(t)
      stopCam()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const verifyTicket = async (payload) => {
    setLoading(true)
    setScanResult(null)
    const res = await apiFetch('/api/staff/checkin/verify', { method: 'POST', body: payload })
    setLoading(false)
    if (res.ok) {
      setScanResult({ ok: true, message: res.data?.message || 'Check-in thành công!', booking: res.data?.booking })
      setManualCode('')
      onSuccess?.(res.data?.booking)
    } else {
      setScanResult({ ok: false, error: res.data?.error || 'Xác thực vé thất bại.' })
    }
  }

  const handleFile = async (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setCameraError('')
    try {
      await stopCam()
      const qr = new Html5Qrcode('admin-qr-reader')
      qrRef.current = qr
      const decoded = await qr.scanFile(f, true)
      verifyTicket({ qrData: decoded })
    } catch {
      setCameraError('Không đọc được mã QR trong ảnh đã chọn.')
    }
  }

  return (
    <Modal title="Quét Mã QR Check-in Vé Điện Tử (E-Ticket HMAC-SHA256)" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button" onClick={cameraActive ? stopCam : startCam}>
            <Camera size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            {cameraActive ? 'Tắt Camera' : 'Bật Camera'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          <button type="button" onClick={() => fileRef.current?.click()}>
            Quét từ file ảnh QR
          </button>
        </div>

        {cameraError && <div className="admin-error" role="alert"><span>{cameraError}</span></div>}

        <div
          id="admin-qr-reader"
          style={{
            width: '100%',
            minHeight: '220px',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px dashed var(--adm-border)',
            background: 'var(--adm-panel)',
          }}
        />

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!manualCode.trim()) return
            const raw = manualCode.trim()
            verifyTicket(raw.startsWith('{') ? { qrData: raw } : { bookingCode: raw.toUpperCase() })
          }}
          style={{ display: 'flex', gap: '8px' }}
        >
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Nhập mã đơn (VD: MAN1234567) hoặc chuỗi JSON QR…"
            style={{ flex: 1 }}
          />
          <button type="submit" className="primary" disabled={loading || !manualCode.trim()}>
            {loading ? 'Đang kiểm tra…' : 'Check-in ngay'}
          </button>
        </form>

        {scanResult && (
          <div
            style={{
              padding: '12px',
              borderRadius: '10px',
              border: `1.5px solid ${scanResult.ok ? '#10b981' : '#ef4444'}`,
              background: scanResult.ok ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
            }}
          >
            <b>{scanResult.ok ? `✓ ${scanResult.message}` : `✕ ${scanResult.error}`}</b>
            {scanResult.booking && (
              <div style={{ fontSize: '0.85rem', marginTop: '6px' }}>
                Mã đơn: <b>{scanResult.booking.code}</b> · Khách: <b>{scanResult.booking.travelerName}</b> · Dịch vụ: {scanResult.booking.title} ({money(scanResult.booking.total)})
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}

/* ------------------------------------------- Booking Detail & Note Modal */
function BookingDetailModal({ booking, call, onClose, onSaved }) {
  const [note, setNote] = useState(booking.internalNote || '')
  const [savingNote, setSavingNote] = useState(false)
  const [payments, setPayments] = useState({ attempts: [], transactions: [] })
  const [downloading, setDownloading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    call(`/api/admin/bookings/${encodeURIComponent(booking.code)}/payments`).then((res) => {
      if (res.ok && res.data?.data) setPayments(res.data.data)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking.code])

  const saveNote = async () => {
    setSavingNote(true)
    setMsg('')
    const res = await call(`/api/admin/bookings/${booking.id}`, {
      method: 'PATCH',
      body: { internalNote: note },
    })
    setSavingNote(false)
    if (res.ok) {
      setMsg('Đã lưu ghi chú nội bộ và ghi Audit Log.')
      onSaved?.(res.data?.data)
    } else {
      setMsg(res.data?.error || 'Không lưu được ghi chú.')
    }
  }

  const downloadEticket = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/bookings/${booking.id}/eticket`, {
        headers: { 'X-Requested-With': 'fetch' },
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error('Không thể xuất E-Ticket cho đơn này.')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `MayAnNhien-ETicket-${booking.code}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setMsg(e.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Modal title={`Chi tiết đơn đặt chỗ: ${booking.code}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '0.9rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', padding: '12px', borderRadius: '10px', background: 'var(--adm-panel)', border: '1px solid var(--adm-border)' }}>
          <div><small style={{ opacity: 0.7 }}>Khách hàng:</small><br /><b>{booking.traveler?.name}</b> ({booking.traveler?.phone})</div>
          <div><small style={{ opacity: 0.7 }}>Email:</small><br /><b>{booking.traveler?.email || booking.ownerEmail}</b></div>
          <div><small style={{ opacity: 0.7 }}>Dịch vụ ({booking.serviceType}):</small><br /><b>{booking.title}</b></div>
          <div><small style={{ opacity: 0.7 }}>Số hành khách:</small><br /><b>{booking.passengers} khách</b> {booking.roomName ? `· Phòng: ${booking.roomName}` : ''} {booking.seatCode ? `· Ghế: ${booking.seatCode}` : ''}</div>
          <div><small style={{ opacity: 0.7 }}>Lịch trình:</small><br /><b>{booking.dates?.depart || '—'} → {booking.dates?.ret || '—'}</b></div>
          <div>
            <small style={{ opacity: 0.7 }}>Thanh toán & Voucher:</small><br />
            <b>{money(booking.total)}</b> {booking.discount > 0 ? `(Giảm ${money(booking.discount)} · Mã ${booking.promo})` : ''}
          </div>
          <div><small style={{ opacity: 0.7 }}>Trạng thái đơn:</small><br /><span className="admin-tag ok">{booking.status}</span></div>
          <div><small style={{ opacity: 0.7 }}>Trạng thái thanh toán:</small><br /><span className="admin-tag">{PAYMENT_LABELS[booking.paymentStatus] || booking.paymentStatus}</span> ({booking.paymentMethod || 'Chuyển khoản'})</div>
          {booking.checkedInAt && (
            <div style={{ gridColumn: 'span 2' }}>
              <small style={{ opacity: 0.7 }}>Check-in:</small> <b>{formatDate(booking.checkedInAt)}</b> bởi <b>{booking.checkedInBy}</b>
            </div>
          )}
          {booking.cancelReason && (
            <div style={{ gridColumn: 'span 2', color: '#ef4444' }}>
              <small>Lý do hủy/hoàn:</small> <b>{booking.cancelReason}</b>
            </div>
          )}
        </div>

        <Field label="Ghi chú vận hành nội bộ (Admin / Lễ tân)" wide>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nhập ghi chú đặc biệt về đơn đặt chỗ, yêu cầu xuất hóa đơn, nâng hạng phòng…"
          />
        </Field>

        {payments.attempts?.length > 0 && (
          <div>
            <b style={{ fontSize: '0.85rem' }}>Lịch sử giao dịch đối soát ({payments.attempts.length}):</b>
            <div style={{ maxHeight: '110px', overflowY: 'auto', marginTop: '4px', fontSize: '0.8rem', border: '1px solid var(--adm-border)', borderRadius: '8px', padding: '8px' }}>
              {payments.attempts.map((a) => (
                <div key={a.order_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', borderBottom: '1px dashed var(--adm-border)' }}>
                  <span><code>{a.order_id}</code> ({a.provider})</span>
                  <span><b>{money(a.amount)}</b> · {a.status} {a.trans_id ? `(#${a.trans_id})` : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {msg && <div className="admin-notice">{msg}</div>}

        <div className="admin-form-actions" style={{ justifyContent: 'space-between' }}>
          {booking.status !== 'Đã hủy' ? (
            <button type="button" onClick={downloadEticket} disabled={downloading}>
              <Download size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              {downloading ? 'Đang tạo PDF…' : 'Tải vé E-Ticket PDF (kèm QR)'}
            </button>
          ) : <span />}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" onClick={onClose}>Đóng</button>
            <button type="button" className="primary" onClick={saveNote} disabled={savingNote}>
              {savingNote ? 'Đang lưu…' : 'Lưu ghi chú'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

/* ------------------------------------------- PRODUCTION ADMIN DASHBOARD */
const RANGE_OPTIONS = [
  { id: 'today', label: 'Hôm nay' },
  { id: '7d', label: '7 ngày qua' },
  { id: '30d', label: '30 ngày qua' },
  { id: 'month', label: 'Tháng này' },
  { id: 'all', label: 'Toàn thời gian' },
]

const STATUS_BADGE_COLORS = {
  pending: { bg: 'rgba(245, 158, 11, 0.18)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.45)' },
  confirmed: { bg: 'rgba(59, 130, 246, 0.18)', color: '#3b82f6', border: 'rgba(59, 130, 246, 0.45)' },
  checked_in: { bg: 'rgba(16, 185, 129, 0.18)', color: '#10b981', border: 'rgba(16, 185, 129, 0.45)' },
  completed: { bg: 'rgba(139, 92, 246, 0.18)', color: '#a855f7', border: 'rgba(139, 92, 246, 0.45)' },
  cancelled: { bg: 'rgba(239, 68, 68, 0.18)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.45)' },
}

const PAYMENT_BADGE_COLORS = {
  pending: { bg: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.45)' },
  paid: { bg: 'rgba(16, 185, 129, 0.18)', color: '#10b981', border: 'rgba(16, 185, 129, 0.45)' },
  refund_pending: { bg: 'rgba(249, 115, 22, 0.2)', color: '#f97316', border: 'rgba(249, 115, 22, 0.45)' },
  refunded: { bg: 'rgba(239, 68, 68, 0.18)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.45)' },
}

/**
 * Biểu đồ Doanh thu thực & Số đơn mới theo ngày.
 * - Tách component + memo: hover chỉ re-render biểu đồ, không re-render toàn Dashboard.
 * - 1 handler onMouseMove trên vùng vẽ (tính cột theo toạ độ X) -> không nhấp nháy khi
 *   chuột đi qua khe giữa các cột.
 * - Tooltip nổi (position: absolute, pointer-events: none) -> KHÔNG đẩy layout, hết giật.
 */
const RevenueChart = memo(function RevenueChart({ data }) {
  const [hoverIdx, setHoverIdx] = useState(-1)
  const plotRef = useRef(null)
  const n = data.length
  const maxRev = Math.max(1, ...data.map((d) => d.net_revenue))
  const maxOrd = Math.max(1, ...data.map((d) => d.orders_count))
  const labelStep = n > 15 ? Math.ceil(n / 10) : 1

  const handleMove = (e) => {
    const el = plotRef.current
    if (!el || !n) return
    const rect = el.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const idx = Math.min(n - 1, Math.max(0, Math.floor(ratio * n)))
    setHoverIdx((prev) => (prev === idx ? prev : idx))
  }

  const hovered = hoverIdx >= 0 ? data[hoverIdx] : null
  const leftPct = hovered ? ((hoverIdx + 0.5) / n) * 100 : 0
  const tipTranslate = leftPct < 18 ? '0%' : leftPct > 82 ? '-100%' : '-50%'
  const cols = `repeat(${Math.max(n, 1)}, minmax(0, 1fr))`
  const colGap = n > 14 ? '3px' : '6px'

  return (
    <section className="admin-panel" style={{ gridColumn: 'span 2', minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
        <div>
          <h3 style={{ margin: 0 }}>Biểu đồ Doanh thu thực & Lưu lượng đơn theo ngày</h3>
          <small style={{ opacity: 0.75 }}>Di chuột vào từng cột để xem chi tiết doanh thu thực nhận và số đơn đặt mới</small>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <i style={{ width: 10, height: 10, borderRadius: 2, background: '#10b981', display: 'inline-block' }} /> Doanh thu thực
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <i style={{ width: 10, height: 10, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }} /> Số đơn mới
          </span>
        </div>
      </div>

      <div
        ref={plotRef}
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(-1)}
        style={{
          position: 'relative',
          flex: 1,
          minHeight: '240px',
          display: 'grid',
          gridTemplateColumns: cols,
          gridTemplateRows: '1fr',
          gap: colGap,
          padding: '76px 4px 0',
          borderBottom: '1px solid var(--adm-border)',
          cursor: 'crosshair',
          userSelect: 'none',
        }}
      >
        {data.map((d, idx) => {
          const revPct = d.net_revenue > 0 ? Math.max((d.net_revenue / maxRev) * 100, 6) : 1.5
          const ordPct = d.orders_count > 0 ? Math.max((d.orders_count / maxOrd) * 100, 8) : 1.5
          const active = idx === hoverIdx
          return (
            <div
              key={d.date}
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: '2px',
                minWidth: 0,
                borderRadius: '6px 6px 0 0',
                background: active ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
              }}
            >
              <span style={{ width: '46%', maxWidth: '16px', height: `${revPct}%`, background: 'linear-gradient(180deg, #10b981, #059669)', borderRadius: '3px 3px 0 0' }} />
              <span style={{ width: '36%', maxWidth: '12px', height: `${ordPct}%`, background: '#3b82f6', opacity: active ? 1 : 0.85, borderRadius: '3px 3px 0 0' }} />
            </div>
          )
        })}

        {hovered && (
          <div
            role="tooltip"
            style={{
              position: 'absolute',
              top: '6px',
              left: `${leftPct}%`,
              transform: `translateX(${tipTranslate})`,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 2,
              padding: '6px 10px',
              borderRadius: '8px',
              background: 'var(--adm-surface)',
              border: '1px solid #10b981',
              boxShadow: 'var(--adm-shadow-md)',
              fontSize: '0.78rem',
              lineHeight: 1.4,
            }}
          >
            <div><b>Ngày {hovered.date}</b></div>
            <div>Doanh thu thực: <b style={{ color: '#10b981' }}>{money(hovered.net_revenue)}</b></div>
            <div>{hovered.orders_count} đơn mới · {hovered.paid_orders_count} đơn thực thu</div>
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: colGap, padding: '6px 4px 0' }}>
        {data.map((d, idx) => (
          <small
            key={d.date}
            style={{
              fontSize: n > 15 ? '0.62rem' : '0.68rem',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'visible',
              opacity: idx === hoverIdx ? 1 : (idx % labelStep === 0 ? 0.8 : 0),
              fontWeight: idx === hoverIdx ? 700 : 400,
            }}
          >
            {d.label}
          </small>
        ))}
      </div>
    </section>
  )
})

function DashboardSection({ call, onGoto }) {
  const [range, setRange] = useState('30d')
  const [overview, setOverview] = useState(null)
  const [error, setError] = useState('')
  const [showExportModal, setShowExportModal] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [detailBooking, setDetailBooking] = useState(null)
  const { lastTelemetry, status: wsStatus, subscribe } = useRealtime()

  const load = async (targetRange = range) => {
    setError('')
    const res = await call(`/api/admin/dashboard/overview?range=${encodeURIComponent(targetRange)}`)
    if (!res.ok) {
      setError(res.data?.error || 'Không tải được dữ liệu tổng quan vận hành.')
      return
    }
    setOverview(res.data?.data || null)
  }

  useEffect(() => {
    load(range)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  useEffect(() => {
    if (!subscribe) return
    const reload = () => load(range)
    const u1 = subscribe('dashboard:update', reload)
    const u2 = subscribe('booking:created', reload)
    const u3 = subscribe('booking:updated', reload)
    const u4 = subscribe('booking:cancelled', reload)
    const u5 = subscribe('booking:checked_in', reload)
    const u6 = subscribe('payment:received', reload)
    return () => { u1?.(); u2?.(); u3?.(); u4?.(); u5?.(); u6?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, range])

  if (error) return <ErrorBar message={error} onRetry={() => load(range)} />
  if (!overview) return <div className="admin-loading">Đang tải dữ liệu vận hành thời gian thực…</div>

  const { financial, ops, charts, system_health } = overview
  const revChart = charts?.revenue_chart || []
  const isLive = wsStatus === 'connected'

  return (
    <div className="admin-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* 1. HEADER BAR: Tiêu đề + Bộ lọc thời gian + Live Indicator + Xuất Excel + Audit Logs */}
      <section
        className="admin-panel"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '14px 18px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Tổng quan vận hành</h3>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '0.78rem',
              fontWeight: 700,
              background: isLive ? 'rgba(16, 185, 129, 0.14)' : 'rgba(245, 158, 11, 0.16)',
              color: isLive ? '#10b981' : '#f59e0b',
              border: `1px solid ${isLive ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
            }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isLive ? '#10b981' : '#f59e0b' }} />
            {isLive ? 'LIVE REAL-TIME' : 'ĐANG KẾT NỐI'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'inline-flex', background: 'var(--adm-bg)', padding: '3px', borderRadius: '10px', border: '1px solid var(--adm-border)', gap: '3px' }}>
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRange(opt.id)}
                className={range === opt.id ? 'primary' : ''}
                style={{
                  padding: '5px 11px',
                  fontSize: '0.8rem',
                  borderRadius: '7px',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button type="button" onClick={() => onGoto('audit-logs')} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}>
            <FileText size={14} strokeWidth={1.8} /> Audit Logs
          </button>
          <button type="button" className="primary" onClick={() => setShowExportModal(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}>
            <Download size={14} strokeWidth={1.8} /> Xuất báo cáo Excel (.xlsx)
          </button>
        </div>
      </section>

      {/* 2. HÀNG 1 — 4 KPI TÀI CHÍNH THỰC (FINANCIAL KPIs) */}
      <div className="admin-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 0 }}>
        <div
          className="admin-stat"
          style={{
            border: '1.5px solid rgba(16, 185, 129, 0.45)',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(14, 116, 144, 0.05))',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, color: '#10b981' }}>Doanh thu thực (Net Revenue)</span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 700,
                background: financial.growth_percent >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: financial.growth_percent >= 0 ? '#10b981' : '#ef4444',
              }}
            >
              {financial.growth_percent >= 0 ? `+${financial.growth_percent}%` : `${financial.growth_percent}%`}
            </span>
          </div>
          <strong style={{ fontSize: '1.55rem', color: '#10b981' }}>{money(financial.net_revenue)}</strong>
          <small>{financial.valid_orders_count} đơn thực thu đã thanh toán & xác nhận</small>
        </div>

        <div className="admin-stat">
          <span>Tổng giá trị đơn (GMV)</span>
          <strong>{money(financial.gmv)}</strong>
          <small>Tổng giá trị gốc trước khuyến mãi</small>
        </div>

        <div className="admin-stat">
          <span>Tổng chiết khấu (Voucher)</span>
          <strong style={{ color: '#f59e0b' }}>{money(financial.total_discount)}</strong>
          <small>Mã giảm giá đã áp dụng cho đơn hợp lệ</small>
        </div>

        <div className="admin-stat">
          <span>Tổng hoàn tiền (Refund)</span>
          <strong style={{ color: financial.total_refund > 0 ? '#ef4444' : 'inherit' }}>{money(financial.total_refund)}</strong>
          <small>{financial.refunded_orders_count || 0} đơn đã hoàn tiền cho khách</small>
        </div>
      </div>

      {/* 3. HÀNG 2 — 4 THẺ CẦN XỬ LÝ NGAY (ACTIONABLE OPS CARDS) */}
      <div className="admin-stat-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: 0 }}>
        {/* Card 1: Chờ thanh toán / duyệt */}
        <div
          className="admin-stat"
          onClick={() => onGoto('bookings', { status: 'Chờ thanh toán' })}
          style={{ cursor: 'pointer', borderLeft: '4px solid #f59e0b' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onGoto('bookings', { status: 'Chờ thanh toán' }) }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Chờ thanh toán / duyệt</span>
            <ArrowRight size={14} />
          </div>
          <strong style={{ color: ops.pending_payment_count > 0 ? '#f59e0b' : 'inherit' }}>
            {ops.pending_payment_count} đơn
          </strong>
          <small>Bấm để mở danh sách đơn đang giữ chỗ chờ duyệt</small>
        </div>

        {/* Card 2: Check-in hôm nay + Nút mở nhanh Quét QR */}
        <div
          className="admin-stat"
          style={{ borderLeft: '4px solid #0284c7', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
        >
          <div
            onClick={() => onGoto('bookings', { status: 'Đã xác nhận' })}
            style={{ cursor: 'pointer' }}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') onGoto('bookings', { status: 'Đã xác nhận' }) }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Check-in hôm nay</span>
              <ArrowRight size={14} />
            </div>
            <strong style={{ color: '#0284c7', display: 'block', margin: '4px 0' }}>
              {ops.today_checkins_count} lượt
            </strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
            <small>Lịch nhận phòng / khởi hành</small>
            <button
              type="button"
              className="primary"
              onClick={(e) => { e.stopPropagation(); setShowQrModal(true) }}
              style={{ padding: '4px 9px', fontSize: '0.75rem', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <QrCode size={12} /> Quét QR
            </button>
          </div>
        </div>

        {/* Card 3: Chờ hoàn tiền (refund_pending) */}
        <div
          className="admin-stat"
          onClick={() => onGoto('bookings', { paymentStatus: 'refund_pending' })}
          style={{
            cursor: 'pointer',
            borderLeft: `4px solid ${ops.refund_pending_count > 0 ? '#ef4444' : '#64748b'}`,
            background: ops.refund_pending_count > 0 ? 'rgba(239, 68, 68, 0.08)' : undefined,
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onGoto('bookings', { paymentStatus: 'refund_pending' }) }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: ops.refund_pending_count > 0 ? '#ef4444' : undefined, fontWeight: ops.refund_pending_count > 0 ? 700 : undefined }}>
              Chờ hoàn tiền (Refund)
            </span>
            <ArrowRight size={14} />
          </div>
          <strong style={{ color: ops.refund_pending_count > 0 ? '#ef4444' : 'inherit' }}>
            {ops.refund_pending_count} đơn
          </strong>
          <small>
            {ops.refund_pending_count > 0
              ? 'Cần kế toán / Admin xác nhận hoàn tiền ngay'
              : 'Không có đơn hủy tồn đọng chờ hoàn tiền'}
          </small>
        </div>

        {/* Card 4: Sản phẩm đang mở bán & Cảnh báo tồn kho */}
        <div
          className="admin-stat"
          onClick={() => onGoto(ops.low_inventory_alerts?.[0]?.type === 'flight' ? 'flights' : 'rooms')}
          style={{ cursor: 'pointer', borderLeft: '4px solid #10b981' }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.key === 'Enter') onGoto('rooms') }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Sản phẩm đang mở bán</span>
            <ArrowRight size={14} />
          </div>
          <strong>
            {ops.active_catalog?.hotels || 0} KS · {ops.active_catalog?.flights || 0} Bay · {ops.active_catalog?.combos || 0} Combo
          </strong>
          <small style={{ color: ops.low_inventory_alerts?.length > 0 ? '#f59e0b' : undefined }}>
            {ops.low_inventory_alerts?.length > 0
              ? `⚠️ ${ops.low_inventory_alerts.length} hạng phòng/chuyến bay sắp kín chỗ`
              : `${ops.active_catalog?.rooms || 0} hạng phòng & ${ops.active_catalog?.promotions || 0} mã KM sẵn sàng`}
          </small>
        </div>
      </div>

      {/* 4. HÀNG 3 — BIỂU ĐỒ PHÂN TÍCH (2 CỘT TỶ LỆ 8 / 4) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
        {/* Cột trái: Biểu đồ Doanh thu thực & Số đơn mới (component riêng, hover không gây giật) */}
        <RevenueChart data={revChart} />

        {/* Cột phải: Phân bổ doanh thu theo dịch vụ & Trạng thái đơn */}
        <section className="admin-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ margin: '0 0 10px 0' }}>Tỷ trọng Doanh thu theo Dịch vụ</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {(charts?.service_breakdown || []).map((svc) => {
                const barColor = svc.key === 'hotel' ? '#10b981' : svc.key === 'flight' ? '#3b82f6' : '#f59e0b'
                return (
                  <div key={svc.key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem', marginBottom: '4px' }}>
                      <span><b>{svc.label}</b> ({svc.orders_count} đơn)</span>
                      <span><b>{money(svc.revenue)}</b> ({svc.percent}%)</span>
                    </div>
                    <div style={{ height: '8px', borderRadius: '999px', background: 'var(--adm-bg)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min(svc.percent, 100)}%`, height: '100%', background: barColor, borderRadius: '999px' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--adm-border)', paddingTop: '12px' }}>
            <h3 style={{ margin: '0 0 10px 0' }}>Phân bổ Trạng thái Đơn</h3>
            <ul className="admin-status-list" style={{ margin: 0 }}>
              {(charts?.status_breakdown || []).map((st) => {
                const badgeStyle = STATUS_BADGE_COLORS[st.key] || STATUS_BADGE_COLORS.confirmed
                return (
                  <li key={st.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        background: badgeStyle.bg,
                        color: badgeStyle.color,
                        border: `1px solid ${badgeStyle.border}`,
                      }}
                    >
                      {st.label}
                    </span>
                    <span style={{ fontSize: '0.82rem' }}><b>{st.count}</b> đơn ({st.percent}%)</span>
                    <strong style={{ fontSize: '0.85rem' }}>{money(st.amount)}</strong>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      </div>

      {/* 5. HÀNG 4 — BẢNG ĐƠN ĐẶT CHỖ GẦN NHẤT (2 BADGE TÁCH BIỆT) */}
      <section className="admin-panel">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div>
            <h3 style={{ margin: 0 }}>Đơn đặt chỗ gần nhất</h3>
            <small style={{ opacity: 0.75 }}>Cập nhật tức thì từ cơ sở dữ liệu — tách bạch rõ Trạng thái đơn và Trạng thái thanh toán</small>
          </div>
          <button type="button" onClick={() => onGoto('bookings', null)} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.82rem' }}>
            Quản lý toàn bộ đơn <ArrowRight size={14} />
          </button>
        </div>

        {(!charts?.recent_bookings || charts.recent_bookings.length === 0) ? (
          <Empty text="Chưa có đơn đặt chỗ nào." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Mã đơn</th>
                  <th>Khách hàng</th>
                  <th>Dịch vụ</th>
                  <th className="num">Tổng tiền</th>
                  <th>Trạng thái đơn</th>
                  <th>Thanh toán</th>
                  <th>Thời gian tạo</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {charts.recent_bookings.map((b) => {
                  const bStyle = STATUS_BADGE_COLORS[b.bookingStatusKey] || STATUS_BADGE_COLORS.confirmed
                  const pStyle = PAYMENT_BADGE_COLORS[b.paymentStatusKey] || PAYMENT_BADGE_COLORS.pending
                  return (
                    <tr key={b.id}>
                      <td><code>{b.code}</code></td>
                      <td>
                        <b>{b.traveler?.name}</b>
                        <small>{b.traveler?.phone} · {b.traveler?.email || b.ownerEmail}</small>
                      </td>
                      <td>
                        <b>{b.serviceType === 'flight' ? 'Chuyến bay' : b.serviceType === 'combo' ? 'Combo' : 'Khách sạn'}</b>
                        <small>{b.title}</small>
                      </td>
                      <td className="num">
                        <b>{money(b.total)}</b>
                        {b.discount > 0 && <small>KM: -{money(b.discount)}</small>}
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            background: bStyle.bg,
                            color: bStyle.color,
                            border: `1px solid ${bStyle.border}`,
                          }}
                        >
                          {b.bookingStatusLabel}
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '3px 9px',
                            borderRadius: '6px',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            background: pStyle.bg,
                            color: pStyle.color,
                            border: `1px solid ${pStyle.border}`,
                          }}
                        >
                          {b.paymentStatusLabel}
                        </span>
                      </td>
                      <td><small>{formatDate(b.createdAt)}</small></td>
                      <td className="admin-actions">
                        <button type="button" onClick={() => setDetailBooking(b)} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                          <Eye size={13} /> Chi tiết
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 6. THANH SYSTEM HEALTH THU GỌN (FOOTER BAR) */}
      <footer
        className="admin-panel"
        style={{
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          fontSize: '0.8rem',
          opacity: 0.9,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <b>System Health: {system_health?.status || 'Live'}</b>
          <span>· WebSocket Clients: <b>{lastTelemetry?.realtime?.wsClients ?? 1}</b></span>
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <span>RAM Heap/RSS: <b>{lastTelemetry?.process?.heapUsedMb ?? system_health?.heapUsedMb ?? 0} / {lastTelemetry?.process?.rssMb ?? system_health?.rssMb ?? 0} MB</b></span>
          <span>CPU: <b>{lastTelemetry?.os?.cpuCores ?? system_health?.cpuCores ?? 1} Cores (Load {lastTelemetry?.os?.loadAvg?.[0] ?? system_health?.loadAvg ?? 0})</b></span>
          <span>Uptime: <b>{Math.max(1, Math.floor((lastTelemetry?.process?.uptime ?? system_health?.uptimeSeconds ?? 60) / 60))} phút</b></span>
        </div>
      </footer>

      {showExportModal && <ExportExcelModal defaultRange={range} onClose={() => setShowExportModal(false)} />}
      {showQrModal && (
        <AdminQrScannerModal
          onClose={() => setShowQrModal(false)}
          onSuccess={() => load(range)}
        />
      )}
      {detailBooking && (
        <BookingDetailModal
          booking={detailBooking}
          call={call}
          onClose={() => setDetailBooking(null)}
          onSaved={() => load(range)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------------------------- bookings */
const ADMIN_TRANSITIONS = {
  'Đã tạo': ['Chờ thanh toán', 'Đã xác nhận', 'Đã hủy'],
  'Chờ thanh toán': ['Đã xác nhận', 'Đã hủy'],
  'Đã thanh toán': ['Đã xác nhận', 'checked_in', 'Đã hủy'],
  'Đã xác nhận': ['checked_in', 'Hoàn tất', 'Đã hủy'],
  'checked_in': ['Hoàn tất', 'Đã hủy'],
  'Hoàn tất': [],
  'Đã hủy': [],
}

function BookingsSection({ call, preset }) {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState(preset?.status || 'all')
  const [serviceType, setServiceType] = useState(preset?.serviceType || 'all')
  const [paymentStatus, setPaymentStatus] = useState(preset?.paymentStatus || 'all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showExportModal, setShowExportModal] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [detailBooking, setDetailBooking] = useState(null)
  const [paymentEdit, setPaymentEdit] = useState(null)
  const [paymentReason, setPaymentReason] = useState('')
  const [newPaymentStatus, setNewPaymentStatus] = useState('')
  const limit = 20
  const { subscribe } = useRealtime()

  useEffect(() => {
    const unsubCreated = subscribe('booking:created', ({ booking }) => {
      if (!booking) return
      setRows((prev) => {
        if (prev.some((b) => b.id === booking.id || b.code === booking.code)) return prev
        return [booking, ...prev]
      })
      setTotal((t) => t + 1)
      setNotice(`Đơn mới vừa tạo: ${booking.code} (${booking.customerName || 'Khách'} · ${money(booking.total)})`)
    })

    const unsubUpdated = subscribe('booking:updated', ({ booking }) => {
      if (!booking) return
      setRows((prev) => prev.map((b) => (b.id === booking.id || b.code === booking.code ? { ...b, ...booking } : b)))
      setNotice(`Đơn ${booking.code} vừa được cập nhật: ${booking.status}`)
    })

    const unsubCancelled = subscribe('booking:cancelled', ({ code, status: nextSt }) => {
      if (!code) return
      setRows((prev) => prev.map((b) => (b.code === code ? { ...b, status: nextSt || 'Đã hủy' } : b)))
      setNotice(`Đơn ${code} đã bị hủy`)
    })

    return () => {
      unsubCreated()
      unsubUpdated()
      unsubCancelled()
    }
  }, [subscribe])

  const load = async (
    nextPage = page,
    filters = { q, status, serviceType, paymentStatus, fromDate, toDate }
  ) => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(nextPage), limit: String(limit) })
    if (filters.q?.trim()) params.set('q', filters.q.trim())
    if (filters.status && filters.status !== 'all') params.set('status', filters.status)
    if (filters.serviceType && filters.serviceType !== 'all') params.set('serviceType', filters.serviceType)
    if (filters.paymentStatus && filters.paymentStatus !== 'all') params.set('paymentStatus', filters.paymentStatus)
    if (filters.fromDate) params.set('fromDate', filters.fromDate)
    if (filters.toDate) params.set('toDate', filters.toDate)

    const res = await call(`/api/admin/bookings?${params.toString()}`)
    setLoading(false)
    if (!res.ok) { setError(res.data?.error || 'Không tải được danh sách đơn.'); return }
    const data = res.data?.data || {}
    setRows(data.items || [])
    setTotal(data.total || 0)
  }

  useEffect(() => {
    const initFilters = {
      q: '',
      status: preset?.status || 'all',
      serviceType: preset?.serviceType || 'all',
      paymentStatus: preset?.paymentStatus || 'all',
      fromDate: '',
      toDate: '',
    }
    setStatus(initFilters.status)
    setServiceType(initFilters.serviceType)
    setPaymentStatus(initFilters.paymentStatus)
    load(1, initFilters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  const applyFilter = () => {
    setPage(1)
    load(1, { q, status, serviceType, paymentStatus, fromDate, toDate })
  }

  const changeStatus = async (booking, nextStatus) => {
    if (nextStatus === booking.status) return
    let cancelReason = ''
    if (nextStatus === 'Đã hủy') {
      const inputReason = window.prompt(
        `Nhập lý do hủy đơn ${booking.code} (Hệ thống sẽ tự động hoàn lại phòng/ghế đã giữ & ghi Audit Log):`,
        'Khách hàng yêu cầu hủy / Thay đổi lịch trình'
      )
      if (inputReason === null) return
      cancelReason = inputReason.trim() || 'Hủy bởi quản trị viên'
    }
    const res = await call(`/api/admin/bookings/${booking.id}`, {
      method: 'PATCH',
      body: { status: nextStatus, cancelReason },
    })
    if (!res.ok) { setError(res.data?.error || 'Không chuyển được trạng thái.'); return }
    setNotice(`Đơn ${booking.code}: ${booking.status} -> ${nextStatus}`)
    load(page)
  }

  const changePaymentStatus = async (booking, nextPayment) => {
    if (!paymentReason.trim() || paymentReason.trim().length < 5) {
      setError('Bắt buộc nhập lý do tối thiểu 5 ký tự khi cập nhật trạng thái thanh toán/hoàn tiền.')
      return
    }
    const res = await call(`/api/admin/bookings/${booking.id}`, {
      method: 'PATCH',
      body: { paymentStatus: nextPayment, paymentReason: paymentReason.trim() },
    })
    if (!res.ok) { setError(res.data?.error || 'Không cập nhật được trạng thái thanh toán.'); return }
    setNotice(`Đơn ${booking.code}: thanh toán -> ${PAYMENT_LABELS[nextPayment] || nextPayment}`)
    setPaymentEdit(null)
    setPaymentReason('')
    load(page)
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="admin-section">
      <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <input
          className="admin-search" value={q} maxLength={120}
          placeholder="Tìm mã đơn, tên, SĐT, email khách, dịch vụ…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') applyFilter() }}
        />
        <select value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
          <option value="all">Tất cả dịch vụ</option>
          <option value="hotel">Khách sạn</option>
          <option value="flight">Chuyến bay</option>
          <option value="combo">Combo</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Tất cả trạng thái đơn</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)}>
          <option value="all">Tất cả thanh toán</option>
          <option value="paid">Đã thanh toán</option>
          <option value="pending">Chờ thanh toán</option>
          <option value="refund_pending">Chờ hoàn tiền</option>
          <option value="refunded">Đã hoàn tiền</option>
        </select>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} title="Từ ngày đặt" />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} title="Đến ngày đặt" />
        <button type="button" className="primary" onClick={applyFilter}>Lọc</button>
        <button type="button" onClick={() => setShowQrModal(true)}>
          <QrCode size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Quét QR Check-in
        </button>
        <button type="button" onClick={() => setShowExportModal(true)}>
          <BarChart3 size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Xuất Excel
        </button>
        <span className="admin-count">{total} đơn</span>
      </div>

      <ErrorBar message={error} onRetry={() => load(page)} />
      {notice && <div className="admin-notice" role="status">{notice}</div>}

      {loading ? <div className="admin-loading">Đang tải…</div>
        : rows.length === 0 ? <Empty text="Không có đơn đặt chỗ nào khớp bộ lọc." />
          : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Dịch vụ & Phòng/Ghế</th>
                    <th>Khách hàng</th>
                    <th>Tổng tiền</th>
                    <th>Trạng thái đơn</th>
                    <th>Thanh toán</th>
                    <th>Ngày tạo</th>
                    <th>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => {
                    const options = Array.from(new Set([b.status, ...(ADMIN_TRANSITIONS[b.status] || [])]))
                    return (
                      <tr key={b.id}>
                        <td>
                          <code>{b.code}</code>
                          {b.internalNote && <small style={{ color: '#0284c7', display: 'block' }}>📝 Có ghi chú</small>}
                        </td>
                        <td>
                          <b>{b.serviceType === 'flight' ? 'Vé máy bay' : b.serviceType === 'hotel' ? 'Khách sạn' : 'Combo'}</b>
                          <small>{b.title}</small>
                          {(b.roomName || b.seatCode) && (
                            <small style={{ color: '#10b981' }}>
                              {b.roomName ? `Phòng: ${b.roomName}` : ''} {b.seatCode ? `Ghế: ${b.seatCode}` : ''}
                            </small>
                          )}
                        </td>
                        <td>
                          <b>{b.traveler.name}</b>
                          <small>{b.traveler.phone} · {b.passengers} khách</small>
                          <small>{b.traveler.email || b.ownerEmail}</small>
                        </td>
                        <td className="num">
                          <b>{money(b.total)}</b>
                          {b.discount > 0 && <small>giảm {money(b.discount)} ({b.promo})</small>}
                        </td>
                        <td>
                          <select value={b.status} onChange={(e) => changeStatus(b, e.target.value)}>
                            {options.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                          {b.cancelReason && <small style={{ color: '#ef4444', display: 'block' }}>Lý do: {b.cancelReason}</small>}
                        </td>
                        <td>
                          {paymentEdit === b.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <select
                                value={newPaymentStatus}
                                onChange={(e) => setNewPaymentStatus(e.target.value)}
                              >
                                {['pending', 'refund_pending', 'refunded'].map((p) => (
                                  <option key={p} value={p}>{PAYMENT_LABELS[p]}</option>
                                ))}
                              </select>
                              <textarea
                                value={paymentReason}
                                onChange={(e) => setPaymentReason(e.target.value)}
                                placeholder="Lý do hoàn tiền/đối soát…"
                                rows={1}
                                style={{ width: '100%', fontSize: '12px' }}
                              />
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  onClick={() => changePaymentStatus(b, newPaymentStatus)}
                                  disabled={!paymentReason.trim()}
                                  className="primary"
                                >
                                  Lưu
                                </button>
                                <button type="button" onClick={() => { setPaymentEdit(null); setPaymentReason('') }} className="danger">Hủy</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className={`admin-tag ${b.paymentStatus === 'paid' ? 'ok' : b.paymentStatus === 'refund_pending' ? 'warn' : b.paymentStatus === 'refunded' ? 'danger' : ''}`}>
                                {PAYMENT_LABELS[b.paymentStatus] || b.paymentStatus}
                              </span>
                              <small>{b.paymentMethod || 'Chuyển khoản / Ví'}</small>
                              <button
                                type="button"
                                onClick={() => {
                                  setPaymentEdit(b.id)
                                  setNewPaymentStatus(b.paymentStatus === 'refund_pending' ? 'refunded' : 'refunded')
                                  setPaymentReason('Hoàn tiền theo yêu cầu hủy đơn hợp lệ')
                                }}
                                style={{ marginTop: '4px', fontSize: '11px', padding: '2px 8px' }}
                              >
                                {b.paymentStatus === 'refund_pending' ? 'Duyệt hoàn tiền' : 'Cập nhật TT'}
                              </button>
                            </>
                          )}
                        </td>
                        <td>{formatDate(b.createdAt)}</td>
                        <td className="admin-actions">
                          <button type="button" onClick={() => setDetailBooking(b)}>
                            <Eye size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} /> Chi tiết
                          </button>
                          <button
                            type="button"
                            className="danger"
                            disabled={b.status === 'Đã hủy'}
                            onClick={() => changeStatus(b, 'Đã hủy')}
                          >
                            {b.status === 'Đã hủy' ? 'Đã hủy' : 'Hủy đơn'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

      <div className="admin-pager">
        <button type="button" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(p) }}>
          <ArrowLeft size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Trước
        </button>
        <span>Trang {page}/{totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); load(p) }}>
          Sau <ArrowRight size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
        </button>
      </div>
      {showExportModal && <ExportExcelModal onClose={() => setShowExportModal(false)} />}
      {showQrModal && <AdminQrScannerModal onClose={() => setShowQrModal(false)} onSuccess={() => load(page)} />}
      {detailBooking && (
        <BookingDetailModal
          booking={detailBooking}
          call={call}
          onClose={() => setDetailBooking(null)}
          onSaved={() => load(page)}
        />
      )}
    </div>
  )
}

/* ------------------------------------------- Flight Seat Map Modal (Admin) */
function FlightSeatMapModal({ flight, call, onClose, onUpdated }) {
  const [seats, setSeats] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState('')

  const loadSeats = async () => {
    setLoading(true)
    const res = await call(`/api/admin/flights/${flight.id}/seats`)
    setLoading(false)
    if (res.ok && Array.isArray(res.data?.data?.seats)) {
      setSeats(res.data.data.seats)
    }
  }

  useEffect(() => {
    loadSeats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight.id])

  const toggleSeat = async (seat) => {
    setToggling(seat.seat_code)
    const nextStatus = seat.status === 'available' ? 'booked' : 'available'
    const res = await call(`/api/admin/flights/${flight.id}/seats/${seat.seat_code}`, {
      method: 'PATCH',
      body: { status: nextStatus },
    })
    setToggling('')
    if (res.ok) {
      setSeats((prev) => prev.map((s) => (s.seat_code === seat.seat_code ? { ...s, status: nextStatus } : s)))
      onUpdated?.()
    }
  }

  const availCount = seats.filter((s) => s.status === 'available').length
  const bookedCount = seats.length - availCount

  return (
    <Modal title={`Sơ đồ ghế chuyến bay: ${flight.airline} (${flight.flightCode || flight.id})`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
          <span>Tuyến: <b>{flight.from} → {flight.to}</b> ({flight.depart} – {flight.arrive})</span>
          <span>
            <b style={{ color: '#10b981' }}>{availCount} ghế trống</b> · <b style={{ color: '#ef4444' }}>{bookedCount} đã đặt/khóa</b>
          </span>
        </div>
        <small style={{ opacity: 0.75 }}>Bấm vào ghế bất kỳ để Khóa / Mở khóa ghế trực tiếp trên SQLite (tự động ghi Audit Log)</small>

        {loading ? (
          <div className="admin-loading">Đang tải sơ đồ ghế…</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '6px',
              maxHeight: '360px',
              overflowY: 'auto',
              padding: '10px',
              borderRadius: '10px',
              background: 'var(--adm-panel)',
              border: '1px solid var(--adm-border)',
            }}
          >
            {seats.map((s) => {
              const isAvail = s.status === 'available'
              return (
                <button
                  key={s.seat_code}
                  type="button"
                  disabled={toggling === s.seat_code}
                  onClick={() => toggleSeat(s)}
                  style={{
                    padding: '7px 4px',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: `1px solid ${isAvail ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`,
                    background: isAvail ? 'rgba(16,185,129,0.14)' : 'rgba(239,68,68,0.18)',
                    color: isAvail ? '#10b981' : '#ef4444',
                  }}
                >
                  {s.seat_code}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}

/* -------------------------------------------------- hotels & flights CRUD */
const FLIGHT_STATUS_LABELS = {
  scheduled: 'Đúng giờ (Scheduled)',
  boarding: 'Đang lên tàu (Boarding)',
  departed: 'Đã khởi hành (Departed)',
  cancelled: 'Đã hủy chuyến (Cancelled)',
}

function CatalogCrudSection({ kind, call }) {
  const isHotel = kind === 'hotels'
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [seatMapFlight, setSeatMapFlight] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const emptyForm = () => (isHotel
    ? { name: '', location: '', city: '', lat: '', lng: '', rating: '9.0', stars: '5', price: '', hasPromo: false, image: '', description: '', perks: '', isActive: true }
    : { flightCode: '', airline: '', logo: 'VN', from: '', to: '', depart: '07:00', arrive: '09:00', duration: '2h 00m', price: '', businessPrice: '', totalSeats: '72', flightStatus: 'scheduled', cutoffHours: '2', tag: '', hasPromo: false, isActive: true })

  const load = async () => {
    setError('')
    const res = await call(`/api/admin/${kind}`)
    if (!res.ok) { setError(res.data?.error || 'Không tải được dữ liệu.'); return }
    setRows(Array.isArray(res.data?.data) ? res.data.data : [])
  }

  useEffect(() => { load() }, [kind]) // eslint-disable-line react-hooks/exhaustive-deps
  const openCreate = () => { setEditing(null); setFormError(''); setForm(emptyForm()) }

  const openEdit = (row) => {
    setEditing(row)
    setFormError('')
    setForm(isHotel
      ? {
        name: row.name, location: row.location, city: row.city || row.location || '',
        lat: row.lat == null ? '' : String(row.lat), lng: row.lng == null ? '' : String(row.lng),
        rating: String(row.rating), stars: String(row.stars),
        price: String(row.price), hasPromo: row.hasPromo, image: row.image || '',
        description: row.description || '', perks: (row.perks || []).join(', '), isActive: row.isActive,
      }
      : {
        flightCode: row.flightCode || '', airline: row.airline, logo: row.logo || '', from: row.from, to: row.to, depart: row.depart,
        arrive: row.arrive, duration: row.duration, price: String(row.price),
        businessPrice: String(row.businessPrice || Math.round(row.price * 1.8)),
        totalSeats: String(row.totalSeats || 72),
        flightStatus: row.flightStatus || 'scheduled',
        cutoffHours: String(row.cutoffHours ?? 2),
        tag: row.tag || '',
        hasPromo: row.hasPromo, isActive: row.isActive,
      })
  }

  const save = async () => {
    if (!form || saving) return
    setSaving(true)
    setFormError('')
    const numericPrice = Number(String(form.price).replace(/[^\d]/g, ''))
    const body = isHotel
      ? {
        name: form.name, location: form.location, city: form.city || form.location,
        lat: form.lat === '' ? null : Number(form.lat),
        lng: form.lng === '' ? null : Number(form.lng),
        rating: Number(form.rating),
        stars: Number(form.stars), price: numericPrice, hasPromo: form.hasPromo,
        image: form.image, description: form.description,
        perks: String(form.perks || '').split(',').map((s) => s.trim()).filter(Boolean),
        isActive: form.isActive,
      }
      : {
        flightCode: form.flightCode,
        airline: form.airline, logo: form.logo, from: form.from, to: form.to,
        depart: form.depart, arrive: form.arrive, duration: form.duration,
        price: numericPrice,
        businessPrice: form.businessPrice ? Number(String(form.businessPrice).replace(/[^\d]/g, '')) : Math.round(numericPrice * 1.8),
        totalSeats: Number(form.totalSeats) || 72,
        flightStatus: form.flightStatus || 'scheduled',
        cutoffHours: Number(form.cutoffHours) || 2,
        tag: form.tag, hasPromo: form.hasPromo, isActive: form.isActive,
      }
    const path = editing ? `/api/admin/${kind}/${editing.id}` : `/api/admin/${kind}`
    const res = await call(path, { method: editing ? 'PATCH' : 'POST', body })
    setSaving(false)
    if (!res.ok) { setFormError(res.data?.error || 'Không lưu được dữ liệu.'); return }
    setNotice(editing ? 'Đã cập nhật thành công.' : 'Đã tạo mới thành công.')
    setForm(null)
    setEditing(null)
    load()
  }

  const toggleActive = async (row) => {
    const res = await call(`/api/admin/${kind}/${row.id}`, { method: 'PATCH', body: { isActive: !row.isActive } })
    if (!res.ok) { setError(res.data?.error || 'Không đổi được trạng thái.'); return }
    setNotice(`${row.name || row.airline}: ${row.isActive ? 'đã chuyển sang Ẩn (Ngừng bán)' : 'đã mở bán lại'}.`)
    load()
  }

  const softDelete = async (row) => {
    if (!window.confirm(`Xác nhận ẩn/ngừng kinh doanh "${row.name || row.airline}"? Hệ thống sẽ bảo toàn lịch sử đơn đặt và phòng liên kết.`)) return
    const res = await call(`/api/admin/${kind}/${row.id}`, { method: 'DELETE' })
    if (!res.ok) { setError(res.data?.error || 'Không thực hiện được thao tác.'); return }
    setNotice(res.data?.data?.message || `Đã chuyển ${row.name || row.airline} sang trạng thái Ẩn (Ngừng bán).`)
    load()
  }

  const filteredRows = rows.filter((r) => {
    if (statusFilter === 'active' && !r.isActive) return false
    if (statusFilter === 'inactive' && r.isActive) return false
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return isHotel
      ? (r.name?.toLowerCase().includes(q) || r.location?.toLowerCase().includes(q))
      : (r.airline?.toLowerCase().includes(q) || r.from?.toLowerCase().includes(q) || r.to?.toLowerCase().includes(q) || r.flightCode?.toLowerCase().includes(q))
  })

  return (
    <div className="admin-section">
      <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <input
          className="admin-search"
          placeholder={isHotel ? 'Tìm tên khách sạn, địa điểm, thành phố…' : 'Tìm hãng bay, mã chuyến, sân bay đi/đến…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Tất cả trạng thái ({rows.length})</option>
          <option value="active">Đang mở bán (Active)</option>
          <option value="inactive">Đã ẩn / Ngừng bán (Hidden)</option>
        </select>
        <button type="button" className="primary" onClick={openCreate}>
          + Thêm {isHotel ? 'khách sạn' : 'chuyến bay'}
        </button>
        <span className="admin-count">{filteredRows.length} bản ghi</span>
      </div>

      <ErrorBar message={error} onRetry={load} />
      {notice && <div className="admin-notice" role="status">{notice}</div>}

      {filteredRows.length === 0 ? <Empty text="Không có dữ liệu khớp bộ lọc." /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{isHotel ? 'Khách sạn' : 'Chuyến bay & Mã chuyến'}</th>
                <th>{isHotel ? 'Địa điểm / Tọa độ' : 'Tuyến bay'}</th>
                <th>{isHotel ? 'Hạng sao & Đánh giá' : 'Giờ bay & Trạng thái'}</th>
                <th>{isHotel ? 'Giá / đêm' : 'Giá Phổ thông / Thương gia'}</th>
                <th>{isHotel ? 'Tiện ích' : 'Tồn kho ghế'}</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className={row.isActive ? '' : 'muted'}>
                  <td>
                    <b>{isHotel ? row.name : `${row.airline} (${row.flightCode || row.id})`}</b>
                    <small>{isHotel ? row.description : `${row.logo} · Thời lượng ${row.duration} · Đóng quầy trước ${row.cutoffHours ?? 2}h`}</small>
                  </td>
                  <td>
                    {isHotel ? (
                      <>
                        <b>{row.location}</b>
                        {row.lat && row.lng && <small>GPS: {row.lat}, {row.lng}</small>}
                      </>
                    ) : (
                      <b>{row.from} → {row.to}</b>
                    )}
                  </td>
                  <td>
                    {isHotel ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                        <b>{row.rating}</b> <Star size={12} strokeWidth={1.8} fill="currentColor" /> · {row.stars} sao
                      </span>
                    ) : (
                      <>
                        <b>{row.depart} – {row.arrive}</b>
                        <small>{FLIGHT_STATUS_LABELS[row.flightStatus] || row.flightStatus || 'Đúng giờ'}</small>
                      </>
                    )}
                  </td>
                  <td className="num">
                    <b>{money(row.price)}</b>
                    {!isHotel && row.businessPrice && <small>Thương gia: {money(row.businessPrice)}</small>}
                  </td>
                  <td>
                    {isHotel ? (
                      <small>{(row.perks || []).slice(0, 3).join(', ') || '—'}</small>
                    ) : (
                      <span className={`admin-tag ${(row.availableSeats ?? 72) <= 10 ? 'warn' : 'ok'}`}>
                        {row.availableSeats ?? 72}/{row.totalSeats ?? 72} ghế trống
                      </span>
                    )}
                  </td>
                  <td>
                    <Toggle
                      checked={row.isActive}
                      onChange={() => toggleActive(row)}
                      labelOn="Đang bán" labelOff="Đã ẩn"
                    />
                  </td>
                  <td className="admin-actions">
                    {!isHotel && (
                      <button type="button" onClick={() => setSeatMapFlight(row)} title="Xem & Khóa sơ đồ ghế">
                        <Grid size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} /> Sơ đồ ghế
                      </button>
                    )}
                    <button type="button" onClick={() => openEdit(row)}>Sửa</button>
                    {row.isActive && (
                      <button type="button" className="danger" onClick={() => softDelete(row)}>
                        Ẩn
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {seatMapFlight && (
        <FlightSeatMapModal
          flight={seatMapFlight}
          call={call}
          onClose={() => setSeatMapFlight(null)}
          onUpdated={load}
        />
      )}

      {form && (
        <Modal
          title={editing ? `Sửa: ${editing.name || editing.airline}` : `Thêm ${isHotel ? 'khách sạn' : 'chuyến bay'}`}
          onClose={() => setForm(null)}
        >
          <div className="admin-form">
            {isHotel ? (
              <>
                <Field label="Tên khách sạn"><input value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="Địa chỉ / Thành phố"><input value={form.location} maxLength={120} onChange={(e) => setForm({ ...form, location: e.target.value, city: e.target.value })} /></Field>
                <Field label="Điểm đánh giá (0–10)"><input value={form.rating} inputMode="decimal" onChange={(e) => setForm({ ...form, rating: e.target.value })} /></Field>
                <Field label="Hạng sao (1–5)"><input value={form.stars} inputMode="numeric" onChange={(e) => setForm({ ...form, stars: e.target.value })} /></Field>
                <Field label="Giá chuẩn / đêm (₫)"><input value={form.price} inputMode="numeric" onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
                <Field label="Tiện ích (tags, cách nhau dấu phẩy)"><input value={form.perks} maxLength={250} onChange={(e) => setForm({ ...form, perks: e.target.value })} /></Field>
                <Field label="Vĩ độ GPS (Lat - tùy chọn)"><input value={form.lat} placeholder="16.0544" onChange={(e) => setForm({ ...form, lat: e.target.value })} /></Field>
                <Field label="Kinh độ GPS (Lng - tùy chọn)"><input value={form.lng} placeholder="108.2022" onChange={(e) => setForm({ ...form, lng: e.target.value })} /></Field>
                <Field label="Ảnh đại diện (URL)" wide><input value={form.image} maxLength={800} onChange={(e) => setForm({ ...form, image: e.target.value })} /></Field>
                <Field label="Mô tả chi tiết" wide><textarea value={form.description} maxLength={600} rows={3} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
              </>
            ) : (
              <>
                <Field label="Hãng hàng không"><input value={form.airline} maxLength={60} onChange={(e) => setForm({ ...form, airline: e.target.value })} /></Field>
                <Field label="Mã chuyến bay"><input value={form.flightCode} maxLength={20} placeholder="VN-218" onChange={(e) => setForm({ ...form, flightCode: e.target.value.toUpperCase() })} /></Field>
                <Field label="Mã hiệu hãng (Logo)"><input value={form.logo} maxLength={6} onChange={(e) => setForm({ ...form, logo: e.target.value.toUpperCase() })} /></Field>
                <Field label="Trạng thái vận hành">
                  <select value={form.flightStatus} onChange={(e) => setForm({ ...form, flightStatus: e.target.value })}>
                    <option value="scheduled">Đúng giờ (Scheduled)</option>
                    <option value="boarding">Đang lên tàu (Boarding)</option>
                    <option value="departed">Đã khởi hành (Departed)</option>
                    <option value="cancelled">Đã hủy chuyến (Cancelled)</option>
                  </select>
                </Field>
                <Field label="Sân bay đi"><input value={form.from} maxLength={60} onChange={(e) => setForm({ ...form, from: e.target.value })} /></Field>
                <Field label="Sân bay đến"><input value={form.to} maxLength={60} onChange={(e) => setForm({ ...form, to: e.target.value })} /></Field>
                <Field label="Giờ khởi hành (HH:MM)"><input value={form.depart} maxLength={5} onChange={(e) => setForm({ ...form, depart: e.target.value })} /></Field>
                <Field label="Giờ hạ cánh (HH:MM)"><input value={form.arrive} maxLength={5} onChange={(e) => setForm({ ...form, arrive: e.target.value })} /></Field>
                <Field label="Thời lượng bay"><input value={form.duration} maxLength={24} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></Field>
                <Field label="Tổng số ghế"><input value={form.totalSeats} inputMode="numeric" onChange={(e) => setForm({ ...form, totalSeats: e.target.value })} /></Field>
                <Field label="Giá vé Phổ thông (₫)"><input value={form.price} inputMode="numeric" onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
                <Field label="Giá vé Thương gia (₫)"><input value={form.businessPrice} inputMode="numeric" onChange={(e) => setForm({ ...form, businessPrice: e.target.value })} /></Field>
                <Field label="Đóng nhận đặt trước giờ bay (giờ)"><input value={form.cutoffHours} inputMode="numeric" onChange={(e) => setForm({ ...form, cutoffHours: e.target.value })} /></Field>
                <Field label="Nhãn hiển thị (Tag)"><input value={form.tag} maxLength={40} onChange={(e) => setForm({ ...form, tag: e.target.value })} /></Field>
              </>
            )}
            <label className="admin-check">
              <input type="checkbox" checked={form.hasPromo} onChange={(e) => setForm({ ...form, hasPromo: e.target.checked })} />
              Áp dụng chương trình ưu đãi
            </label>
            <label className="admin-check">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Đang mở bán (Active)
            </label>
            {formError && <p className="admin-login-error" role="alert">{formError}</p>}
            <div className="admin-form-actions">
              <button type="button" onClick={() => setForm(null)}>Hủy</button>
              <button type="button" className="primary" disabled={saving} onClick={save}>
                {saving ? 'Đang lưu…' : 'Lưu lại'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ----------------------------------------------------------- combos CRUD */
function ComboCrudSection({ call, onGotoExtra }) {
  const [rows, setRows] = useState([])
  const [hotels, setHotels] = useState([])
  const [flights, setFlights] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = async () => {
    setError('')
    const [combosRes, hotelsRes, flightsRes] = await Promise.all([
      call('/api/admin/combos'), call('/api/admin/hotels'), call('/api/admin/flights'),
    ])
    if (!combosRes.ok) { setError(combosRes.data?.error || 'Không tải được danh sách combo.'); return }
    setRows(Array.isArray(combosRes.data?.data) ? combosRes.data.data : [])
    setHotels(Array.isArray(hotelsRes.data?.data) ? hotelsRes.data.data : [])
    setFlights(Array.isArray(flightsRes.data?.data) ? flightsRes.data.data : [])
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps react/set-state-in-effect
  const openCreate = () => {
    setEditing(null)
    setFormError('')
    setForm({
      name: '', hotelId: '', flightId: '', saving: '450000', priceOverride: '',
      description: '', validFrom: '', validTo: '', isActive: true,
    })
  }

  const openEdit = (row) => {
    setEditing(row)
    setFormError('')
    setForm({
      name: row.name, hotelId: row.hotelId, flightId: row.flightId, saving: String(row.saving),
      priceOverride: row.priceOverride == null ? '' : String(row.priceOverride),
      description: row.description || '', validFrom: row.validFrom || '', validTo: row.validTo || '',
      isActive: row.isActive,
    })
  }

  const save = async () => {
    if (!form || saving) return
    setSaving(true)
    setFormError('')
    const body = {
      name: form.name,
      hotelId: form.hotelId,
      flightId: form.flightId,
      saving: Number(form.saving),
      priceOverride: String(form.priceOverride).trim() === ''
        ? null
        : Number(String(form.priceOverride).replace(/[^\d]/g, '')),
      description: form.description,
      validFrom: form.validFrom || null,
      validTo: form.validTo || null,
      isActive: form.isActive,
    }
    const path = editing ? `/api/admin/combos/${editing.id}` : '/api/admin/combos'
    const res = await call(path, { method: editing ? 'PATCH' : 'POST', body })
    setSaving(false)
    if (!res.ok) { setFormError(res.data?.error || 'Không lưu được combo.'); return }
    setNotice(editing ? 'Đã cập nhật combo.' : 'Đã tạo combo.')
    setForm(null)
    setEditing(null)
    load()
  }

  const toggleActive = async (row) => {
    const res = await call(`/api/admin/combos/${row.id}`, { method: 'PATCH', body: { isActive: !row.isActive } })
    if (!res.ok) { setError(res.data?.error || 'Không đổi được trạng thái.'); return }
    setNotice(`${row.name}: ${row.isActive ? 'ngừng bán' : 'bán lại'}.`)
    load()
  }

  const activeHotels = hotels.filter((h) => h.isActive)
  const activeFlights = flights.filter((f) => f.isActive)

  return (
    <div className="admin-section">
      <div className="admin-toolbar">
        <button type="button" className="primary" onClick={openCreate}>
          <Plus size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Tạo combo
        </button>
        {onGotoExtra && (
          <button type="button" onClick={onGotoExtra}>
            <FerrisWheel size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Quản lý dịch vụ mở rộng (Tour, Xe, Tàu, BH) <ArrowRight size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
          </button>
        )}
        <span className="admin-count">{rows.length} combo</span>
      </div>

      <ErrorBar message={error} onRetry={load} />
      {notice && <div className="admin-notice" role="status">{notice}</div>}

      {rows.length === 0 ? <Empty text="Chưa có combo nào." /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tên combo</th>
                <th>Thành phần liên kết</th>
                <th>Giá bán</th>
                <th>Tiết kiệm</th>
                <th>Có hiệu lực</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.isActive ? '' : 'muted'}>
                  <td>
                    <b>{row.name}</b>
                    <small>{row.description}</small>
                    {row.inventoryWarning && (
                      <small style={{ color: '#f59e0b', fontWeight: 700, display: 'block', marginTop: '3px' }}>
                        ⚠️ Cảnh báo tồn kho: {row.inventoryWarning}
                      </small>
                    )}
                  </td>
                  <td>
                    <small>KS: <b>{row.hotelName || row.hotelId}</b> ({row.roomName || 'Phòng chuẩn'})</small>
                    <small>Bay: <b>{row.flightLabel || row.flightId}</b></small>
                  </td>
                  <td className="num">
                    <b>{money(row.price)}</b>
                    {row.originalPrice && <small style={{ textDecoration: 'line-through', opacity: 0.7 }}>Gốc: {money(row.originalPrice)}</small>}
                  </td>
                  <td className="num">{money(row.saving)}<small>{row.maxSlots || 20} suất</small></td>
                  <td><small>{row.validFrom || '—'} - {row.validTo || '…'}</small></td>
                  <td>
                    <Toggle checked={row.isActive} onChange={() => toggleActive(row)} labelOn="Đang bán" labelOff="Ngừng bán" />
                  </td>
                  <td className="admin-actions">
                    <button type="button" onClick={() => openEdit(row)}>Sửa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title={editing ? `Sửa: ${editing.name}` : 'Tạo combo mới'} onClose={() => setForm(null)}>
          <div className="admin-form">
            <Field label="Tên combo" wide>
              <input value={form.name} maxLength={140} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Khách sạn liên kết">
              <select value={form.hotelId} onChange={(e) => setForm({ ...form, hotelId: e.target.value })}>
                <option value="">— Chọn khách sạn —</option>
                {activeHotels.map((h) => <option key={h.id} value={h.id}>{h.name} ({money(h.price)})</option>)}
              </select>
            </Field>
            <Field label="Chuyến bay liên kết">
              <select value={form.flightId} onChange={(e) => setForm({ ...form, flightId: e.target.value })}>
                <option value="">— Chọn chuyến bay —</option>
                {activeFlights.map((f) => <option key={f.id} value={f.id}>{f.id} {f.from}-{f.to} ({money(f.price)})</option>)}
              </select>
            </Field>
            <Field label="Mức giảm khi mua combo (₫)" hint="Giá = khách sạn + vé − mức giảm">
              <input value={form.saving} inputMode="numeric" onChange={(e) => setForm({ ...form, saving: e.target.value })} />
            </Field>
            <Field label="Giá ghi đè (₫, trống = tự tính)">
              <input value={form.priceOverride} inputMode="numeric" onChange={(e) => setForm({ ...form, priceOverride: e.target.value })} />
            </Field>
            <Field label="Hiệu lực từ (YYYY-MM-DD)">
              <input value={form.validFrom} maxLength={10} placeholder="2026-10-01" onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
            </Field>
            <Field label="Hiệu lực đến (YYYY-MM-DD)">
              <input value={form.validTo} maxLength={10} placeholder="2026-12-31" onChange={(e) => setForm({ ...form, validTo: e.target.value })} />
            </Field>
            <Field label="Mô tả" wide>
              <textarea value={form.description} maxLength={600} rows={3} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <label className="admin-check">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Đang kinh doanh
            </label>
            {formError && <p className="admin-login-error" role="alert">{formError}</p>}
            <div className="admin-form-actions">
              <button type="button" onClick={() => setForm(null)}>Hủy</button>
              <button type="button" className="primary" disabled={saving} onClick={save}>
                {saving ? 'Đang lưu…' : 'Lưu lại'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* -------------------------------------------------------- extra services CRUD */
function ExtraCrudSection({ call, onBack }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = async () => {
    setError('')
    setLoading(true)
    const res = await call('/api/admin/extra-services')
    setLoading(false)
    if (!res.ok) {
      setError(res.data?.error || 'Không tải được danh sách dịch vụ mở rộng.')
      return
    }
    setItems(Array.isArray(res.data?.items) ? res.data.items : [])
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditing(null)
    setFormError('')
    setForm({
      category: 'tour',
      name: '',
      description: '',
      price: '500000',
      isActive: true,
      metadataText: '{}',
    })
  }

  const openEdit = (row) => {
    setEditing(row)
    setFormError('')
    setForm({
      category: row.category,
      name: row.name,
      description: row.description || '',
      price: String(row.price),
      isActive: Boolean(row.is_active),
      metadataText: JSON.stringify(row.metadata || {}, null, 2),
    })
  }

  const save = async () => {
    if (!form || saving) return
    setFormError('')
    if (!form.name.trim()) { setFormError('Vui lòng nhập tên dịch vụ.'); return }
    let parsedMeta = {}
    try {
      parsedMeta = JSON.parse(form.metadataText || '{}')
    } catch {
      setFormError('Metadata phải là chuỗi JSON hợp lệ (ví dụ: {}).')
      return
    }
    setSaving(true)
    const payload = {
      category: form.category,
      name: form.name.trim(),
      description: form.description.trim(),
      price: Number(form.price) || 0,
      metadata: parsedMeta,
      isActive: form.isActive,
    }
    const res = editing
      ? await call(`/api/admin/extra-services/${editing.id}`, { method: 'PATCH', body: payload })
      : await call('/api/admin/extra-services', { method: 'POST', body: payload })
    setSaving(false)
    if (!res.ok) {
      setFormError(res.data?.error || 'Không lưu được dịch vụ.')
      return
    }
    setNotice(editing ? `Đã cập nhật dịch vụ: ${form.name}` : `Đã thêm dịch vụ: ${form.name}`)
    setForm(null)
    load()
  }

  const toggleActive = async (row) => {
    const res = await call(`/api/admin/extra-services/${row.id}`, {
      method: 'PATCH',
      body: { isActive: !row.is_active },
    })
    if (!res.ok) {
      setError(res.data?.error || 'Không đổi được trạng thái dịch vụ.')
      return
    }
    setNotice(`Đã đổi trạng thái: ${row.name}`)
    load()
  }

  const filtered = items.filter((it) => categoryFilter === 'all' || it.category === categoryFilter)

  const CATEGORY_NAMES = {
    tour: 'Vui chơi / Tour',
    airport_transfer: 'Đưa đón sân bay',
    bus: 'Xe khách',
    train: 'Tàu hỏa',
    insurance: 'Bảo hiểm du lịch',
  }

  const CATEGORY_ICONS = {
    tour: FerrisWheel,
    airport_transfer: CarTaxiFront,
    bus: Bus,
    train: TrainFront,
    insurance: ShieldCheck,
  }

  return (
    <div className="admin-section">
      <div className="admin-toolbar">
        {onBack && (
          <button type="button" onClick={onBack}>
            <ArrowLeft size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Quay lại Combo
          </button>
        )}
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">Tất cả loại dịch vụ ({items.length})</option>
          <option value="tour">Tour / Vui chơi</option>
          <option value="airport_transfer">Đưa đón sân bay</option>
          <option value="bus">Xe khách</option>
          <option value="train">Tàu hỏa</option>
          <option value="insurance">Bảo hiểm</option>
        </select>
        <button type="button" className="primary" onClick={openCreate}>
          <Plus size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Thêm dịch vụ mới
        </button>
        <span className="admin-count">{filtered.length} dịch vụ</span>
      </div>

      <ErrorBar message={error} onRetry={load} />
      {notice && <div className="admin-notice" role="status">{notice}</div>}

      {filtered.length === 0 ? (
        <Empty text={loading ? 'Đang tải dịch vụ...' : 'Chưa có dịch vụ nào trong danh mục này.'} />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Dịch vụ</th>
                <th>Phân loại</th>
                <th>Giá niêm yết</th>
                <th>Thông số chi tiết</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className={row.is_active ? '' : 'muted'}>
                  <td>
                    <b>{row.name}</b>
                    <small>{row.description}</small>
                  </td>
                  <td>
                    <span className="admin-tag ok" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {(() => {
                        const CatIcon = CATEGORY_ICONS[row.category]
                        return CatIcon ? <CatIcon size={13} strokeWidth={1.8} /> : null
                      })()}
                      {CATEGORY_NAMES[row.category] || row.category}
                    </span>
                  </td>
                  <td className="num"><b>{money(row.price)}</b></td>
                  <td>
                    <small style={{ fontFamily: 'monospace' }}>
                      {row.metadata ? Object.entries(row.metadata).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ') : '—'}
                    </small>
                  </td>
                  <td>
                    <Toggle checked={Boolean(row.is_active)} onChange={() => toggleActive(row)} labelOn="Đang bán" labelOff="Ngừng bán" />
                  </td>
                  <td className="admin-actions">
                    <button type="button" onClick={() => openEdit(row)}>Sửa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title={editing ? `Sửa: ${editing.name}` : 'Thêm dịch vụ mở rộng mới'} onClose={() => setForm(null)}>
          <div className="admin-form">
            <Field label="Phân loại dịch vụ">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="tour">Tour & Hoạt động vui chơi</option>
                <option value="airport_transfer">Đưa đón sân bay</option>
                <option value="bus">Xe khách liên tỉnh</option>
                <option value="train">Vé tàu hỏa</option>
                <option value="insurance">Bảo hiểm du lịch</option>
              </select>
            </Field>
            <Field label="Tên dịch vụ" wide>
              <input value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Giá niêm yết (₫)">
              <input value={form.price} inputMode="numeric" onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            <Field label="Mô tả dịch vụ" wide>
              <textarea value={form.description} maxLength={400} rows={2} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Metadata (JSON thông số phụ)" wide>
              <textarea value={form.metadataText} rows={3} style={{ fontFamily: 'monospace', fontSize: '12px' }} onChange={(e) => setForm({ ...form, metadataText: e.target.value })} />
            </Field>
            <label className="admin-check">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Đang kinh doanh
            </label>
            {formError && <p className="admin-login-error" role="alert">{formError}</p>}
            <div className="admin-form-actions">
              <button type="button" onClick={() => setForm(null)}>Hủy</button>
              <button type="button" className="primary" disabled={saving} onClick={save}>
                {saving ? 'Đang lưu…' : 'Lưu lại'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

/* ------------------------------------------------------- promotions CRUD */
const PROMO_COLORS = [
  { id: 'blue', label: 'Xanh dương' },
  { id: 'orange', label: 'Cam' },
  { id: 'green', label: 'Xanh lá' },
  { id: 'purple', label: 'Tím' },
  { id: 'red', label: 'Đỏ' },
]
const SERVICE_LABELS = { flight: 'Vé máy bay', hotel: 'Khách sạn', combo: 'Combo' }

function PromoCrudSection({ call }) {
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const load = async () => {
    setError('')
    const res = await call('/api/admin/promotions')
    if (!res.ok) { setError(res.data?.error || 'Không tải được khuyến mãi.'); return }
    setRows(Array.isArray(res.data?.data) ? res.data.data : [])
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps react/set-state-in-effect
  const openCreate = () => {
    setEditing(null)
    setFormError('')
    setForm({
      code: '', description: '', appliesTo: ['hotel'], ratePercent: '', color: 'blue',
      activeFrom: '', activeTo: '', usageLimit: '', minOrder: '0', isActive: true,
    })
  }

  const openEdit = (row) => {
    setEditing(row)
    setFormError('')
    setForm({
      code: row.code, description: row.desc || row.description || '', appliesTo: [...(row.appliesTo || [])],
      ratePercent: String(Math.round((row.rate || 0) * 1000) / 10), color: row.color || 'blue',
      activeFrom: row.activeFrom || '', activeTo: row.activeTo || '',
      usageLimit: row.usageLimit == null ? '' : String(row.usageLimit),
      minOrder: row.minOrder == null ? '0' : String(row.minOrder), isActive: row.isActive,
    })
  }

  const toggleService = (service) => {
    setForm((cur) => ({
      ...cur,
      appliesTo: cur.appliesTo.includes(service)
        ? cur.appliesTo.filter((s) => s !== service)
        : [...cur.appliesTo, service],
    }))
  }

  const save = async () => {
    if (!form || saving) return
    setSaving(true)
    setFormError('')
    // Validate minOrder phía client để báo lỗi sớm; server vẫn tự kiểm lại lần nữa.
    const minOrderNum = Number(String(form.minOrder).trim() === '' ? '0' : form.minOrder)
    if (!Number.isInteger(minOrderNum) || minOrderNum < 0 || minOrderNum > 100000000) {
      setSaving(false)
      setFormError('Mức đơn tối thiểu phải là số nguyên từ 0 đến 100.000.000 (0 = không yêu cầu).')
      return
    }
    const body = {
      code: form.code,
      description: form.description,
      appliesTo: form.appliesTo,
      rate: Number(form.ratePercent) / 100,
      color: form.color,
      activeFrom: form.activeFrom || null,
      activeTo: form.activeTo || null,
      usageLimit: String(form.usageLimit).trim() === '' ? null : Number(form.usageLimit),
      minOrder: minOrderNum,
      isActive: form.isActive,
    }
    const path = editing ? `/api/admin/promotions/${editing.id}` : '/api/admin/promotions'
    const res = await call(path, { method: editing ? 'PATCH' : 'POST', body })
    setSaving(false)
    if (!res.ok) { setFormError(res.data?.error || 'Không lưu được khuyến mãi.'); return }
    setNotice(editing ? 'Đã cập nhật mã.' : 'Đã tạo mã mới.')
    setForm(null)
    setEditing(null)
    load()
  }

  const toggleActive = async (row) => {
    const res = await call(`/api/admin/promotions/${row.id}`, { method: 'PATCH', body: { isActive: !row.isActive } })
    if (!res.ok) { setError(res.data?.error || 'Không đổi được trạng thái.'); return }
    setNotice(`${row.code}: ${row.isActive ? 'tạm ngừng' : 'kích hoạt'}.`)
    load()
  }

  return (
    <div className="admin-section">
      <div className="admin-toolbar">
        <button type="button" className="primary" onClick={openCreate}>+ Tạo mã giảm giá</button>
        <span className="admin-count">{rows.length} mã</span>
      </div>

      <ErrorBar message={error} onRetry={load} />
      {notice && <div className="admin-notice" role="status">{notice}</div>}

      {rows.length === 0 ? <Empty text="Chưa có mã khuyến mãi nào." /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Mô tả</th>
                <th>Áp dụng</th>
                <th>Giảm</th>
                <th>Đơn tối thiểu</th>
                <th>Dùng / giới hạn</th>
                <th>Thời gian</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.isActive ? '' : 'muted'}>
                  <td><b className={`promo-code ${row.color}`}>{row.code}</b></td>
                  <td>{row.desc || row.description}</td>
                  <td>{(row.appliesTo || []).map((s) => SERVICE_LABELS[s] || s).join(', ')}</td>
                  <td className="num"><b>{Math.round((row.rate || 0) * 1000) / 10}%</b></td>
                  <td className="num">{row.minOrder ? `${row.minOrder.toLocaleString('vi-VN')}₫` : '—'}</td>
                  <td>{row.usedCount}/{row.usageLimit ?? '∞'}</td>
                  <td><small>{row.activeFrom || '—'} - {row.activeTo || '…'}</small></td>
                  <td>
                    <Toggle checked={row.isActive} onChange={() => toggleActive(row)} labelOn="Đang chạy" labelOff="Tạm ngừng" />
                  </td>
                  <td className="admin-actions">
                    <button type="button" onClick={() => openEdit(row)}>Sửa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title={editing ? `Sửa mã: ${editing.code}` : 'Tạo mã giảm giá'} onClose={() => setForm(null)}>
          <div className="admin-form">
            <Field label="Mã (A–Z, 0–9)">
              <input value={form.code} maxLength={24} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Mô tả">
              <input value={form.description} maxLength={200} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Tỷ lệ giảm (%)">
              <input value={form.ratePercent} inputMode="decimal" placeholder="12" onChange={(e) => setForm({ ...form, ratePercent: e.target.value })} />
            </Field>
            <Field label="Màu hiển thị">
              <select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })}>
                {PROMO_COLORS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
            <div className="admin-field wide">
              <span>Áp dụng cho dịch vụ</span>
              <div className="admin-checks">
                {Object.keys(SERVICE_LABELS).map((service) => (
                  <label className="admin-check" key={service}>
                    <input
                      type="checkbox"
                      checked={form.appliesTo.includes(service)}
                      onChange={() => toggleService(service)}
                    />
                    {SERVICE_LABELS[service]}
                  </label>
                ))}
              </div>
            </div>
            <Field label="Hiệu lực từ (YYYY-MM-DD)">
              <input value={form.activeFrom} maxLength={10} onChange={(e) => setForm({ ...form, activeFrom: e.target.value })} />
            </Field>
            <Field label="Hiệu lực đến (YYYY-MM-DD)">
              <input value={form.activeTo} maxLength={10} onChange={(e) => setForm({ ...form, activeTo: e.target.value })} />
            </Field>
            <Field label="Giới hạn lượt dùng (trống = không giới hạn)">
              <input value={form.usageLimit} inputMode="numeric" onChange={(e) => setForm({ ...form, usageLimit: e.target.value })} />
            </Field>
            <Field label="Đơn tối thiểu (₫) — 0 = không yêu cầu">
              <input value={form.minOrder} inputMode="numeric" onChange={(e) => setForm({ ...form, minOrder: e.target.value })} />
            </Field>
            <label className="admin-check">
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Đang hoạt động
            </label>
            {formError && <p className="admin-login-error" role="alert">{formError}</p>}
            <div className="admin-form-actions">
              <button type="button" onClick={() => setForm(null)}>Hủy</button>
              <button type="button" className="primary" disabled={saving} onClick={save}>{saving ? 'Đang lưu…' : 'Lưu lại'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}


/* -------------------------------------------------------------- users */
function UsersSection({ call }) {
  const [rows, setRows] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = async () => {
    setError('')
    const res = await call('/api/admin/users')
    if (!res.ok) { setError(res.data?.error || 'Không tải được danh sách người dùng.'); return }
    setRows(Array.isArray(res.data?.data) ? res.data.data : [])
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const toggleActive = async (row) => {
    const res = await call(`/api/admin/users/${row.id}`, { method: 'PATCH', body: { isActive: !row.isActive } })
    if (!res.ok) { setError(res.data?.error || 'Không đổi được trạng thái tài khoản.'); return }
    setNotice(`${row.email}: ${row.isActive ? 'vô hiệu hóa (đã đăng xuất mọi phiên)' : 'kích hoạt lại'}.`)
    load()
  }

  const changeRole = async (row, nextRole) => {
    if (row.role === nextRole) return
    setError('')
    setNotice('')
    const res = await call(`/api/admin/users/${row.id}/role`, { method: 'PATCH', body: { role: nextRole } })
    if (!res.ok) {
      setError(res.data?.error || 'Không đổi được vai trò người dùng.')
      return
    }
    setNotice(`Đã chuyển vai trò của ${row.email} thành ${nextRole}.`)
    load()
  }

  const filtered = rows.filter((u) => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false
    if (statusFilter === 'active' && !u.isActive) return false
    if (statusFilter === 'banned' && u.isActive) return false
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return u.email?.toLowerCase().includes(q) || u.name?.toLowerCase().includes(q) || u.phone?.toLowerCase().includes(q)
  })

  return (
    <div className="admin-section">
      <div className="admin-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1 }}>
          <input
            className="admin-search"
            placeholder="Tìm email, họ tên, số điện thoại…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">Tất cả vai trò</option>
            <option value="admin">Quản trị viên (admin)</option>
            <option value="staff">Lễ tân (staff)</option>
            <option value="user">Khách hàng (user)</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="banned">Đã khóa / Vô hiệu hóa</option>
          </select>
        </div>
        <span className="admin-count">{filtered.length} / {rows.length} tài khoản</span>
        <a
          href="#/staff/checkin"
          className="admin-btn-secondary"
          style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem' }}
        >
          <Camera size={15} strokeWidth={1.8} /> Mở Cổng Quét QR Check-in Lễ tân
        </a>
      </div>

      <ErrorBar message={error} onRetry={load} />
      {notice && <div className="admin-notice" role="status">{notice}</div>}

      <div className="admin-note">
        <p>
          Phân quyền RBAC 3 tầng: <b>Khách hàng (user)</b>, <b>Lễ tân (staff)</b> và <b>Quản trị viên (admin)</b>.
          Vô hiệu hóa tài khoản sẽ đăng xuất ngay mọi phiên đang hoạt động của người dùng đó và ghi Audit Log.
        </p>
      </div>

      {filtered.length === 0 ? <Empty text="Không có tài khoản nào khớp bộ lọc." /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email & SĐT</th>
                <th>Tên hiển thị</th>
                <th>Hạng & Điểm thưởng</th>
                <th className="num">Số dư Ví</th>
                <th>Vai trò (RBAC)</th>
                <th className="num">Số đơn</th>
                <th>Ngày tạo</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className={row.isActive ? '' : 'muted'}>
                  <td>
                    <b>{row.email}</b>
                    {row.phone && <small>{row.phone}</small>}
                  </td>
                  <td>{row.name}</td>
                  <td>
                    <span className="admin-tag">{row.memberTier || 'Thành viên'}</span>
                    <small>{row.loyaltyPoints || 0} điểm</small>
                  </td>
                  <td className="num"><b>{money(row.balance || 0)}</b></td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`admin-tag ${row.role === 'admin' ? 'ok' : row.role === 'staff' ? 'warn' : ''}`}>
                        {row.role}
                      </span>
                      <select
                        className="admin-role-select"
                        value={row.role}
                        onChange={(e) => changeRole(row, e.target.value)}
                        style={{ padding: '2px 6px', fontSize: '0.8rem', borderRadius: '4px', border: '1px solid var(--adm-border)', background: 'var(--adm-panel)', color: 'var(--adm-text)' }}
                      >
                        <option value="user">user</option>
                        <option value="staff">staff</option>
                        <option value="admin">admin</option>
                      </select>
                    </div>
                  </td>
                  <td className="num">{row.bookingCount}</td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>
                    <Toggle
                      checked={row.isActive}
                      onChange={() => toggleActive(row)}
                      labelOn="Đang hoạt động" labelOff="Đã khóa"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}










/* ------------------------------------------------------------ rooms CRUD */
function RoomCrudSection({ call }) {
  const [rows, setRows] = useState([])
  const [hotels, setHotels] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(null)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')
  const [filterHotel, setFilterHotel] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [checkIn, setCheckIn] = useState(() => new Date().toISOString().slice(0, 10))
  const [checkOut, setCheckOut] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10))
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterHotel) params.set('hotelId', filterHotel)
      if (filterStatus !== 'all') params.set('isActive', filterStatus === 'active')
      if (checkIn) params.set('checkIn', checkIn)
      if (checkOut) params.set('checkOut', checkOut)
      const res = await call(`/api/admin/rooms?${params}`)
      if (!res.ok) {
        setError(res.data?.error || 'Không tải được danh sách phòng.')
        setLoading(false)
        return
      }
      setRows(Array.isArray(res.data?.data?.items) ? res.data.data.items : [])
    } catch {
      setError('Không kết nối được máy chủ.')
    } finally {
      setLoading(false)
    }
  }

  const loadHotels = async () => {
    const res = await call('/api/admin/hotels')
    if (!res.ok) {
      setError(res.data?.error || 'Không tải được danh sách khách sạn.')
      return
    }
    setHotels(Array.isArray(res.data?.data) ? res.data.data : [])
  }

  useEffect(() => {
    load()
    loadHotels()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps react/set-state-in-effect

  const emptyForm = () => ({
    name: '', hotelId: '', price: '', bedType: 'Giường king', sizeSqm: '',
    maxAdults: '2', maxChildren: '0', totalRooms: '5', amenities: '', images: '',
    breakfast: false, freeCancellation: false, checkinTime: '14:00', checkoutTime: '12:00', isActive: true,
  })

  const openCreate = () => {
    setEditing(null)
    setFormError('')
    setForm(emptyForm())
  }

  const openEdit = (row) => {
    setEditing(row)
    setFormError('')
    setForm({
      id: row.id, name: row.name, hotelId: row.hotelId, price: String(row.price),
      bedType: row.bedType, sizeSqm: row.sizeSqm == null ? '' : String(row.sizeSqm),
      maxAdults: String(row.maxAdults), maxChildren: String(row.maxChildren),
      totalRooms: String(row.totalRooms ?? 5),
      amenities: Array.isArray(row.amenities) ? row.amenities.join(', ') : '',
      images: Array.isArray(row.images) ? row.images.join(', ') : '',
      breakfast: !!row.breakfast, freeCancellation: !!row.freeCancellation,
      checkinTime: row.checkinTime || '14:00', checkoutTime: row.checkoutTime || '12:00',
      isActive: row.isActive,
    })
  }

  const save = async () => {
    if (!form || saving) return
    setSaving(true)
    setFormError('')

    const name = String(form.name || '').trim()
    if (!name) { setSaving(false); setFormError('Tên phòng là bắt buộc.'); return }
    if (!form.hotelId) { setSaving(false); setFormError('Vui lòng chọn khách sạn.'); return }
    const price = Number(String(form.price || '').split('').filter((c) => c >= '0' && c <= '9').join('') || '0')
    if (!Number.isFinite(price) || price <= 0) {
      setSaving(false)
      setFormError('Giá phòng phải là số lớn hơn 0.')
      return
    }
    const bedType = String(form.bedType || '').trim()
    if (!bedType) { setSaving(false); setFormError('Loại giường là bắt buộc.'); return }
    let sizeSqm = null
    const sizeRaw = String(form.sizeSqm || '').trim()
    if (sizeRaw !== '') {
      sizeSqm = Number(sizeRaw)
      if (!Number.isInteger(sizeSqm) || sizeSqm < 1) {
        setSaving(false)
        setFormError('Kích thước phải là số nguyên dương.')
        return
      }
    }
    const maxAdults = Number(form.maxAdults)
    if (!Number.isInteger(maxAdults) || maxAdults < 1 || maxAdults > 50) {
      setSaving(false)
      setFormError('Số người lớn phải từ 1 đến 50.')
      return
    }
    const maxChildren = Number(form.maxChildren)
    if (!Number.isInteger(maxChildren) || maxChildren < 0 || maxChildren > 50) {
      setSaving(false)
      setFormError('Số trẻ em phải từ 0 đến 50.')
      return
    }
    const amenities = String(form.amenities || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30)
    const images = String(form.images || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 30)

    const body = {
      name, hotelId: form.hotelId, price, bedType, sizeSqm, maxAdults, maxChildren,
      totalRooms: Number(form.totalRooms) || 5,
      amenities, images,
      breakfast: !!form.breakfast, freeCancellation: !!form.freeCancellation,
      checkinTime: form.checkinTime || '14:00', checkoutTime: form.checkoutTime || '12:00',
      isActive: form.isActive,
    }
    // Mã phòng KHÔNG được gửi trong body — server lấy id từ đường dẫn URL.
    const path = editing ? `/api/admin/rooms/${editing.id}` : '/api/admin/rooms'
    const res = await call(path, { method: editing ? 'PATCH' : 'POST', body })
    setSaving(false)
    if (!res.ok) { setFormError(res.data?.error || 'Không lưu được phòng.'); return }
    setNotice(editing ? 'Đã cập nhật phòng.' : 'Đã tạo phòng mới.')
    setForm(null)
    setEditing(null)
    load()
  }

  const toggleActive = async (row) => {
    const res = await call(`/api/admin/rooms/${row.id}`, {
      method: 'PATCH', body: { isActive: !row.isActive },
    })
    if (!res.ok) { setError(res.data?.error || 'Không đổi được trạng thái phòng.'); return }
    setNotice(`${row.name}: ${row.isActive ? 'đã ngừng kinh doanh' : 'đã kích hoạt lại'}.`)
    load()
  }

  const removeRoom = async (row) => {
    if (!window.confirm(
      `Bạn chắc chắn muốn ngừng kinh doanh phòng "${row.name}"?\n\n`
      + 'Phòng sẽ bị ẩn khỏi danh sách bán, nhưng các đơn đặt cũ vẫn giữ mã phòng và lịch sử.'
    )) return
    setRemoving(row.id)
    const res = await call(`/api/admin/rooms/${row.id}`, { method: 'DELETE' })
    setRemoving(null)
    if (!res.ok) { setError(res.data?.error || 'Không ngừng được phòng.'); return }
    setNotice(`Đã ngừng kinh doanh: ${row.name}.`)
    load()
  }

  if (loading) {
    return (
      <div className="admin-section">
        <div className="admin-toolbar"><span className="admin-count">Đang tải phòng…</span></div>
        <div className="admin-empty">Đang tải danh sách phòng…</div>
      </div>
    )
  }

  const statusLabel = (row) => (row.isActive ? 'Đang kinh doanh' : 'Ngừng kinh doanh')

  return (
    <div className="admin-section">
      <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: '8px' }}>
        <input
          className="admin-search"
          placeholder="Tìm tên phòng, loại giường…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={filterHotel} onChange={(e) => setFilterHotel(e.target.value)}>
          <option value="">Tất cả khách sạn</option>
          {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang kinh doanh</option>
          <option value="inactive">Ngừng kinh doanh</option>
        </select>
        <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} title="Kiểm tra phòng trống từ ngày" />
        <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} title="Đến ngày" />
        <button type="button" onClick={load}>Kiểm tra tồn phòng</button>
        <button type="button" className="primary" onClick={openCreate}>+ Thêm phòng mới</button>
        <span className="admin-count">{rows.length} phòng</span>
      </div>

      <ErrorBar message={error} onRetry={load} />
      {notice && <div className="admin-notice" role="status">{notice}</div>}

      {rows.length === 0 ? (
        <Empty text={search || filterHotel || filterStatus !== 'all'
          ? 'Không tìm thấy phòng nào.' : 'Chưa có phòng nào.'} />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Tên phòng</th>
                <th>Khách sạn</th>
                <th className="num">Giá / đêm</th>
                <th className="num">Sức chứa</th>
                <th className="num">Tồn kho / Trống</th>
                <th>Tiện nghi</th>
                <th>Trạng thái</th>
                <th className="admin-actions">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.isActive ? '' : 'muted'}>
                  <td>
                    <b>{row.name}</b>
                    {row.bedType && <small>{row.bedType} {row.sizeSqm ? `· ${row.sizeSqm} m²` : ''}</small>}
                  </td>
                  <td>{row.hotelName || row.hotelId}</td>
                  <td className="num">{money(row.price)}</td>
                  <td className="num">{row.maxAdults} lớn / {row.maxChildren} nhỏ</td>
                  <td className="num">
                    <span className={`admin-tag ${(row.availableCount ?? 5) > 0 ? 'ok' : 'danger'}`}>
                      {row.availableCount ?? (row.totalRooms || 5)}/{row.totalRooms || 5} trống
                    </span>
                    {row.bookedCount > 0 && <small>{row.bookedCount} đã đặt</small>}
                  </td>
                  <td>
                    {(row.amenities || []).slice(0, 4).map((a, i) => (
                      <span key={i} className="admin-tag" style={{ fontSize: '11px', padding: '2px 6px', margin: '1px' }}>{a}</span>
                    ))}
                    {(row.amenities || []).length > 4 && <small>+{String((row.amenities || []).length - 4)}</small>}
                  </td>
                  <td>
                    <span className={`admin-tag ${row.isActive ? 'ok' : ''}`}>{statusLabel(row)}</span>
                  </td>
                  <td className="admin-actions">
                    <button type="button" onClick={() => openEdit(row)} disabled={removing === row.id}>Sửa</button>
                    <button
                      type="button"
                      onClick={() => toggleActive(row)}
                      disabled={removing === row.id}
                      className={row.isActive ? 'danger' : ''}
                    >
                      {row.isActive ? 'Ngừng' : 'Kích hoạt'}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRoom(row)}
                      disabled={removing === row.id}
                      className="danger"
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal title={editing ? `Sửa phòng: ${form.name}` : 'Thêm phòng mới'} onClose={() => setForm(null)}>
          <div className="admin-form">
            <Field label="Tên phòng" wide>
              <input
                value={form.name} maxLength={120}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field label="Khách sạn">
              <select value={form.hotelId} onChange={(e) => setForm({ ...form, hotelId: e.target.value })}>
                <option value="">— Chọn khách sạn —</option>
                {hotels.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              </select>
            </Field>
            <Field label="Giá / đêm (₫)">
              <input value={form.price} inputMode="numeric"
                onChange={(e) => setForm({ ...form, price: e.target.value })} />
              <small>Ví dụ: 1850000</small>
            </Field>
            <Field label="Loại giường">
              <input value={form.bedType} maxLength={60}
                onChange={(e) => setForm({ ...form, bedType: e.target.value })} />
            </Field>
            <Field label="Kích thước (m2, trống = không ghi)">
              <input value={form.sizeSqm} inputMode="numeric" maxLength={6}
                onChange={(e) => setForm({ ...form, sizeSqm: e.target.value })} />
            </Field>
            <Field label="Tối đa người lớn">
              <input value={form.maxAdults} inputMode="numeric" maxLength={2}
                onChange={(e) => setForm({ ...form, maxAdults: e.target.value })} />
            </Field>
            <Field label="Tối đa trẻ em">
              <input value={form.maxChildren} inputMode="numeric" maxLength={2}
                onChange={(e) => setForm({ ...form, maxChildren: e.target.value })} />
            </Field>
            <Field label="Tổng số lượng phòng">
              <input value={form.totalRooms ?? '5'} inputMode="numeric" maxLength={3}
                onChange={(e) => setForm({ ...form, totalRooms: e.target.value })} />
            </Field>
            <Field label="Tiện nghi (phân cách bằng dấu phẩy)">
              <input value={form.amenities} maxLength={400}
                onChange={(e) => setForm({ ...form, amenities: e.target.value })} />
              <small>Ví dụ: Điều hòa, Wi-Fi miễn phí, Két sắt</small>
            </Field>
            <Field label="Ảnh (URL, phân cách bằng dấu phẩy)">
              <input value={form.images} maxLength={400}
                onChange={(e) => setForm({ ...form, images: e.target.value })} />
            </Field>
            <label className="admin-check">
              <input type="checkbox" checked={form.breakfast}
                onChange={(e) => setForm({ ...form, breakfast: e.target.checked })} />
              Có bữa sáng
            </label>
            <label className="admin-check">
              <input type="checkbox" checked={form.freeCancellation}
                onChange={(e) => setForm({ ...form, freeCancellation: e.target.checked })} />
              Hủy miễn phí
            </label>
            <Field label="Giờ nhận phòng (HH:MM)">
              <input value={form.checkinTime} maxLength={5}
                onChange={(e) => setForm({ ...form, checkinTime: e.target.value })} />
            </Field>
            <Field label="Giờ trả phòng (HH:MM)">
              <input value={form.checkoutTime} maxLength={5}
                onChange={(e) => setForm({ ...form, checkoutTime: e.target.value })} />
            </Field>
            <label className="admin-check">
              <input type="checkbox" checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Đang kinh doanh
            </label>
            {formError && <p className="admin-login-error" role="alert">{formError}</p>}
            <div className="admin-form-actions">
              <button type="button" onClick={() => setForm(null)}>Hủy</button>
              <button type="button" className="primary" disabled={saving} onClick={save}>
                {saving ? 'Đang lưu…' : 'Lưu lại'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

function ErrorBar({ message, onRetry }) {
  if (!message) return null
  return (
    <div className="admin-error" role="alert">
      <span>{message}</span>
      {onRetry && <button type="button" onClick={onRetry}>Thử lại</button>}
    </div>
  )
}

/* ---------------------------------------------------- Task 3 & 4: Sprint 2 */
function ExportExcelModal({ onClose, defaultRange = '30d' }) {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [serviceType, setServiceType] = useState('all')
  const [exporting, setExporting] = useState(false)
  const [err, setErr] = useState('')

  const handleExport = async () => {
    setExporting(true)
    setErr('')
    try {
      const params = new URLSearchParams()
      if (fromDate) params.append('from_date', fromDate)
      if (toDate) params.append('to_date', toDate)
      if (!fromDate && !toDate && defaultRange) params.append('range', defaultRange)
      if (serviceType && serviceType !== 'all') params.append('service_type', serviceType)

      const url = `/api/admin/reports/revenue/export?${params.toString()}`
      const res = await fetch(url, {
        headers: {
          'X-Requested-With': 'fetch',
        },
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const errorJson = await res.json().catch(() => ({}))
        throw new Error(errorJson.error || 'Xuất báo cáo Excel thất bại.')
      }

      const blob = await res.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = `MayAnNhien-BaoCaoDoanhThu-${new Date().toISOString().slice(0, 10)}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(downloadUrl)
      onClose()
    } catch (e) {
      setErr(e.message || 'Lỗi khi tải file Excel.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <Modal title="Xuất Báo Cáo Doanh Thu Ra Excel (.xlsx)" onClose={onClose}>
      <div style={{ padding: '0.5rem 0' }}>
        <p style={{ fontSize: '0.875rem', color: 'var(--adm-text-secondary)', marginTop: 0 }}>
          File Excel gồm 2 sheet: <b>Tổng quan doanh thu</b> (chỉ số KPI & phân bổ dịch vụ) và <b>Chi tiết giao dịch</b> (toàn bộ đơn hàng đối soát).
        </p>

          {err && <div className="admin-error-bar" style={{ marginBottom: '1rem' }}>{err}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '1rem 0' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Từ ngày đặt:</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Đến ngày đặt:</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px' }}>Loại dịch vụ:</label>
              <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} style={{ width: '100%' }}>
                <option value="all">Tất cả dịch vụ</option>
                <option value="flight">Vé máy bay</option>
                <option value="hotel">Khách sạn</option>
                <option value="combo">Combo du lịch</option>
                <option value="activity">Vui chơi & Trải nghiệm</option>
                <option value="car">Đưa đón sân bay</option>
                <option value="bus">Xe khách</option>
                <option value="train">Tàu hỏa</option>
                <option value="insurance">Bảo hiểm</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1.5rem' }}>
            <button type="button" onClick={onClose} disabled={exporting}>Hủy</button>
            <button type="button" className="primary" onClick={handleExport} disabled={exporting}>
              {exporting ? (
                <><Loader2 size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Đang kết xuất...</>
              ) : (
                <><Download size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Tải file Excel (.xlsx)</>
              )}
            </button>
          </div>
      </div>
    </Modal>
  )
}

function AuditLogViewerSection({ call, onBack }) {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [limit] = useState(20)
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async (targetPage = page) => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({
      page: targetPage,
      limit,
    })
    if (action.trim()) params.append('action', action.trim())
    if (actor.trim()) params.append('actor', actor.trim())
    if (fromDate) params.append('from_date', fromDate)
    if (toDate) params.append('to_date', toDate)

    const res = await call(`/api/admin/audit-logs?${params.toString()}`)
    setLoading(false)
    if (!res.ok) {
      setError(res.data?.error || 'Không tải được nhật ký hoạt động.')
      return
    }
    setItems(res.data?.data?.items || [])
    setTotal(res.data?.data?.total || 0)
    setPage(res.data?.data?.page || 1)
  }

  useEffect(() => {
    load(1)
  }, [action, actor, fromDate, toDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="admin-section">
      <div className="admin-toolbar" style={{ flexWrap: 'wrap', gap: '10px' }}>
        <button type="button" onClick={onBack} style={{ marginRight: '8px' }}>
          <ArrowLeft size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Quay lại
        </button>
        <input
          className="admin-search"
          placeholder="Lọc hành động (payment, admin, booking...)"
          value={action}
          onChange={(e) => setAction(e.target.value)}
          style={{ minWidth: '220px' }}
        />
        <input
          className="admin-search"
          placeholder="Tìm theo email người thực hiện…"
          value={actor}
          onChange={(e) => setActor(e.target.value)}
          style={{ minWidth: '220px' }}
        />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <small>Từ:</small>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <small>Đến:</small>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        {(action || actor || fromDate || toDate) && (
          <button type="button" onClick={() => { setAction(''); setActor(''); setFromDate(''); setToDate('') }}>
            Xóa bộ lọc
          </button>
        )}
        <button type="button" onClick={() => load(page)} disabled={loading}>
          <RefreshCw size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Làm mới
        </button>
        <span className="admin-count">{total} sự kiện</span>
      </div>

      <ErrorBar message={error} onRetry={() => load(page)} />

      {loading ? (
        <div className="admin-loading">Đang tải nhật ký hoạt động…</div>
      ) : items.length === 0 ? (
        <Empty text="Không có bản ghi nhật ký nào khớp bộ lọc." />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: '60px' }}>ID</th>
                <th style={{ width: '160px' }}>Thời gian</th>
                <th style={{ width: '200px' }}>Người thực hiện</th>
                <th style={{ width: '180px' }}>Hành động</th>
                <th style={{ width: '130px' }}>Đối tượng</th>
                <th>Chi tiết</th>
                <th style={{ width: '120px' }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {items.map((log) => (
                <tr key={log.id}>
                  <td><code>#{log.id}</code></td>
                  <td><small>{formatDate(log.created_at)}</small></td>
                  <td>
                    {log.actor_email ? (
                      <span title={`ID: ${log.actor_id}`}>{log.actor_email}</span>
                    ) : log.actor_id ? (
                      <span>User #{log.actor_id}</span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>Hệ thống</span>
                    )}
                  </td>
                  <td>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      backgroundColor: log.action.includes('payment') ? 'rgba(16,185,129,0.15)' : log.action.includes('admin') ? 'rgba(59,130,246,0.15)' : 'var(--bg-elevated)',
                      color: log.action.includes('payment') ? 'var(--text-primary)' : log.action.includes('admin') ? 'var(--text-primary)' : 'var(--text-secondary)',
                      border: '1px solid currentColor',
                    }}>
                      {log.action}
                    </span>
                  </td>
                  <td>
                    {log.entity_type && (
                      <small style={{ color: 'var(--text-muted)' }}>
                        {log.entity_type} {log.entity_id ? `(${log.entity_id})` : ''}
                      </small>
                    )}
                  </td>
                  <td style={{ maxWidth: '350px', wordBreak: 'break-word', fontSize: '0.85rem' }}>
                    {log.detail || '—'}
                  </td>
                  <td><small style={{ color: 'var(--text-muted)' }}>{log.ip || '—'}</small></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
        <span>Trang {page} / {totalPages} (Tổng: {total})</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" disabled={page <= 1 || loading} onClick={() => load(page - 1)}>
            <ArrowLeft size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Trang trước
          </button>
          <button type="button" disabled={page >= totalPages || loading} onClick={() => load(page + 1)}>
            Trang sau <ArrowRight size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
          </button>
        </div>
      </div>
    </div>
  )
}
