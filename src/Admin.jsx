// src/Admin.jsx — Khu vực quản trị Mây An Nhiên (SPA riêng, hash #/admin/*).
// Nguyên tắc bảo mật:
//  - KHÔNG TIN role trong localStorage: mọi dữ liệu đều do /api/admin/* trả về
//    sau khi server xác thực cookie phiên + role='admin'.
//  - Giao diện admin KHÔNG trộn vào menu/điều hướng của người dùng.
import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'
import './admin.css'

const ADMIN_SECTIONS = [
  { id: 'dashboard', label: 'Tổng quan', icon: '▦' },
  { id: 'bookings', label: 'Đơn đặt chỗ', icon: '▤' },
  { id: 'hotels', label: 'Khách sạn', icon: '▰' },
  { id: 'rooms', label: 'Phòng', icon: '🏨' },
  { id: 'flights', label: 'Chuyến bay', icon: '✈' },
  { id: 'combos', label: 'Combo', icon: '✦' },
  { id: 'promotions', label: 'Khuyến mãi', icon: '%' },
  { id: 'users', label: 'Người dùng', icon: '◉' },
]

const STATUS_OPTIONS = ['Đã tạo', 'Chờ thanh toán', 'Đã thanh toán', 'Đã xác nhận', 'Đã hủy']
const PAYMENT_LABELS = {
  pending: 'Chưa thanh toán',
  simulated: 'Thanh toán mô phỏng (demo)',
  paid: 'Đã thanh toán thật (đã đối soát)',
  refunded: 'Đã hoàn tiền',
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
  return ADMIN_SECTIONS.some((s) => s.id === section) ? section : 'dashboard'
}

/* ----------------------------------------------------------- primitives */
function Modal({ title, onClose, children }) {
  return (
    <div className="admin-modal-overlay" role="presentation" onClick={onClose}>
      <div className="admin-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head">
          <h3>{title}</h3>
          <button type="button" onClick={onClose} aria-label="Đóng">✕</button>
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
        <span className="admin-brand-mark">☁</span>
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
  const [blockedReason, setBlockedReason] = useState('')

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

  const goto = (id) => {
    setSection(id) // effect phía trên sẽ ghi hash tương ứng
  }

  // Kiểm tra phiên THẬT với server ngay khi vào /admin (không tin localStorage)
  useEffect(() => {
    let active = true
    ;(async () => {
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
          <span className="admin-brand-mark">⛔</span>
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
          <span className="admin-brand-mark">☁</span>
          <div>
            <b>Mây An Nhiên</b>
            <small>Trung tâm quản trị</small>
          </div>
        </div>
        <nav className="admin-nav">
          {ADMIN_SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={section === item.id ? 'active' : ''}
              onClick={() => goto(item.id)}
            >
              <i>{item.icon}</i> {item.label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-foot">
          <button type="button" className="ghost" onClick={onExit}>← Trang người dùng</button>
          <button type="button" onClick={logout}>Đăng xuất</button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <h2>{ADMIN_SECTIONS.find((s) => s.id === section)?.label || 'Tổng quan'}</h2>
          <div className="admin-topbar-right">
            <span className="admin-chip" title={user.email}>👑 {user.name} · admin</span>
          </div>
        </header>

        <main className="admin-content">
          <ErrorBar message={blockedReason} onRetry={() => setBlockedReason('')} />
          {section === 'dashboard' && <DashboardSection call={call} onGoto={goto} />}
          {section === 'bookings' && <BookingsSection call={call} />}
          {section === 'hotels' && <CatalogCrudSection kind="hotels" call={call} />}
          {section === 'rooms' && <RoomCrudSection call={call} />}
          {section === 'flights' && <CatalogCrudSection kind="flights" call={call} />}
          {section === 'combos' && <ComboCrudSection call={call} />}
          {section === 'promotions' && <PromoCrudSection call={call} />}
          {section === 'users' && <UsersSection call={call} />}
        </main>
      </div>
    </div>
  )
}


/* ------------------------------------------------------------ dashboard */
function DashboardSection({ call, onGoto }) {
  const [stats, setStats] = useState(null)
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    const res = await call('/api/admin/stats')
    if (!res.ok) { setError(res.data?.error || 'Không tải được thống kê.'); return }
    setStats(res.data?.data || null)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps react/set-state-in-effect
  if (error) return <ErrorBar message={error} onRetry={load} />
  if (!stats) return <div className="admin-loading">Đang tải thống kê…</div>

  const cards = [
    { label: 'Tổng đơn đặt chỗ', value: stats.totalBookings, sub: 'tất cả thời gian' },
    { label: 'Doanh thu (đơn xác nhận)', value: money(stats.revenue), sub: 'phần lớn là thanh toán mô phỏng' },
    { label: 'Người dùng', value: stats.users, sub: `${stats.admins} quản trị viên` },
    { label: 'Sản phẩm đang bán', value: stats.hotels + stats.flights + stats.combos, sub: `${stats.hotels}KS · ${stats.flights} chuyến · ${stats.combos} combo` },
  ]
  const maxTrend = Math.max(1, ...stats.trend.map((t) => t.count))

  return (
    <div className="admin-dashboard">
      <div className="admin-stat-grid">
        {cards.map((c) => (
          <div className="admin-stat" key={c.label}>
            <span>{c.label}</span>
            <strong>{c.value}</strong>
            <small>{c.sub}</small>
          </div>
        ))}
      </div>

      <div className="admin-panel-row">
        <section className="admin-panel">
          <h3>Đơn theo trạng thái</h3>
          {Object.keys(stats.byStatus).length === 0
            ? <Empty text="Chưa có đơn đặt chỗ nào." />
            : (
              <ul className="admin-status-list">
                {Object.entries(stats.byStatus).map(([status, info]) => (
                  <li key={status}>
                    <span className={`admin-dot ${status === 'Đã hủy' ? 'danger' : status === 'Đã xác nhận' ? 'ok' : 'warn'}`} />
                    <b>{status}</b>
                    <em>{info.count} đơn</em>
                    <strong>{money(info.amount)}</strong>
                  </li>
                ))}
              </ul>
            )}
        </section>

        <section className="admin-panel">
          <h3>Đơn mới 7 ngày qua</h3>
          <div className="admin-trend">
            {stats.trend.map((t) => (
              <div className="admin-trend-col" key={t.day} title={`${t.day}: ${t.count} đơn`}>
                <span className="admin-trend-bar" style={{ height: `${Math.round((t.count / maxTrend) * 100)}%` }} />
                <em>{t.count}</em>
                <small>{t.day.slice(5)}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="admin-panel admin-note">
        <h3>Lưu ý về dữ liệu thanh toán</h3>
        <p>{stats.revenueNote}</p>
        <p>
          Trang người dùng mô phỏng thanh toán (~700ms) — đơn được ghi <b>Đã xác nhận</b> kèm
          trạng thái <b>Thanh toán mô phỏng (demo)</b>; không có giao dịch tiền thật nào được thực hiện.
        </p>
        <button type="button" onClick={() => onGoto('bookings')}>Xem tất cả đơn →</button>
      </section>
    </div>
  )
}

/* ------------------------------------------------------------- bookings */
// Đồ thị chuyển trạng thái — phải khớp với quy tắc phía server (routes-admin.js)
// P1-01: Admin KHÔNG được tự chuyển sang 'Đã thanh toán' — trạng thái này chỉ được
// hệ thống đặt sau khi cổng thanh toán (MoMo) xác minh giao dịch thành công.
const ADMIN_TRANSITIONS = {
  'Đã tạo': ['Chờ thanh toán', 'Đã xác nhận', 'Đã hủy'],
  'Chờ thanh toán': ['Đã xác nhận', 'Đã hủy'],
  'Đã thanh toán': ['Đã xác nhận', 'Đã hủy'],
  'Đã xác nhận': ['Đã hủy'],
  'Đã hủy': [],
}

function BookingsSection({ call }) {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [paymentEdit, setPaymentEdit] = useState(null) // booking id đang chỉnh sửa thanh toán hoặc null
  const [paymentReason, setPaymentReason] = useState('')
  const [newPaymentStatus, setNewPaymentStatus] = useState('') // giá trị thanh toán đang chỉnh sửa
  const limit = 20

  const load = async (nextPage = page, nextQ = q, nextStatus = status) => {
    setLoading(true)
    setError('')
    const params = new URLSearchParams({ page: String(nextPage), limit: String(limit) })
    if (nextQ.trim()) params.set('q', nextQ.trim())
    if (nextStatus !== 'all') params.set('status', nextStatus)
    const res = await call(`/api/admin/bookings?${params.toString()}`)
    setLoading(false)
    if (!res.ok) { setError(res.data?.error || 'Không tải được danh sách đơn.'); return }
    const data = res.data?.data || {}
    setRows(data.items || [])
    setTotal(data.total || 0)
  }

  useEffect(() => { load(1, '', 'all') }, []) // eslint-disable-line react-hooks/exhaustive-deps react/set-state-in-effect
  const applyFilter = () => { setPage(1); load(1, q, status) }

  const changeStatus = async (booking, nextStatus) => {
    const res = await call(`/api/admin/bookings/${booking.id}`, { method: 'PATCH', body: { status: nextStatus } })
    if (!res.ok) { setError(res.data?.error || 'Không chuyển được trạng thái.'); return }
    setNotice(`Đơn ${booking.code}: ${booking.status} → ${nextStatus}`)
    load()
  }

  // P1-01: Ghi nhận thủ công trạng thái thanh toán (pending/simulated/refunded) —
  // KHÔNG bao gồm 'paid'. Bắt buộc lý do, ghi audit log ở server.
  const changePaymentStatus = async (booking, nextPayment) => {
    if (!paymentReason.trim()) { setError('Bắt buộc nhập lý do khi thay đổi trạng thái thanh toán.'); return }
    const res = await call(`/api/admin/bookings/${booking.id}`, {
      method: 'PATCH',
      body: { paymentStatus: nextPayment, paymentReason: paymentReason.trim() },
    })
    if (!res.ok) { setError(res.data?.error || 'Không cập nhật được trạng thái thanh toán.'); return }
    setNotice(`Đơn ${booking.code}: thanh toán → ${nextPayment}`)
    setPaymentEdit(null)
    setPaymentReason('')
    load()
  }

  const totalPages = Math.max(1, Math.ceil(total / limit))

  return (
    <div className="admin-section">
      <div className="admin-toolbar">
        <input
          className="admin-search" value={q} maxLength={120}
          placeholder="Tìm mã đơn, tên người đặt, email, tên dịch vụ…"
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') applyFilter() }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Tất cả trạng thái</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button type="button" className="primary" onClick={applyFilter}>Lọc</button>
        <span className="admin-count">{total} đơn</span>
      </div>

      <ErrorBar message={error} onRetry={() => load()} />
      {notice && <div className="admin-notice" role="status">{notice}</div>}

      {loading ? <div className="admin-loading">Đang tải…</div>
        : rows.length === 0 ? <Empty text="Không có đơn đặt chỗ nào khớp bộ lọc." />
          : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Mã đơn</th>
                    <th>Dịch vụ</th>
                    <th>Chủ đơn</th>
                    <th>Tổng tiền</th>
                    <th>Trạng thái</th>
                    <th>Thanh toán</th>
                    <th>Ngày tạo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => {
                    const options = [b.status, ...(ADMIN_TRANSITIONS[b.status] || [])]
                    return (
                      <tr key={b.id}>
                        <td><code>{b.code}</code></td>
                        <td>
                          <b>{b.serviceType === 'flight' ? 'Vé máy bay' : b.serviceType === 'hotel' ? 'Khách sạn' : 'Combo'}</b>
                          <small>{b.title}</small>
                          <small>{b.traveler.name} · {b.traveler.phone} · {b.passengers} khách</small>
                        </td>
                        <td>{b.ownerEmail}<small>{b.traveler.email}</small></td>
                        <td className="num">
                          <b>{money(b.total)}</b>
                          {b.discount > 0 && <small>giảm {money(b.discount)} ({b.promo})</small>}
                        </td>
                        <td>
                          <select value={b.status} onChange={(e) => changeStatus(b, e.target.value)}>
                            {options.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td>
                          {paymentEdit === b.id ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <select
                                value={newPaymentStatus}
                                onChange={(e) => setNewPaymentStatus(e.target.value)}
                              >
                                {['pending', 'simulated', 'refunded'].map((p) => (
                                  <option key={p} value={p}>{PAYMENT_LABELS[p]}</option>
                                ))}
                              </select>
                              <textarea
                                value={paymentReason}
                                onChange={(e) => setPaymentReason(e.target.value)}
                                placeholder="Lý do thay đổi…"
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
                              <span className={`admin-tag ${b.paymentStatus === 'paid' ? 'ok' : b.paymentStatus === 'simulated' ? 'warn' : ''}`}>
                                {PAYMENT_LABELS[b.paymentStatus] || b.paymentStatus}
                              </span>
                              <small>{b.paymentMethod || '—'}</small>
                              <button
                                type="button"
                                onClick={() => { setPaymentEdit(b.id); setNewPaymentStatus(b.paymentStatus); setPaymentReason('') }}
                                className="danger"
                                style={{ marginTop: '4px', fontSize: '11px', padding: '2px 8px' }}
                              >
                                Sửa thanh toán
                              </button>
                            </>
                          )}
                        </td>
                        <td>{formatDate(b.createdAt)}</td>
                        <td>
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
        <button type="button" disabled={page <= 1} onClick={() => { const p = page - 1; setPage(p); load(p) }}>← Trước</button>
        <span>Trang {page}/{totalPages}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => { const p = page + 1; setPage(p); load(p) }}>Sau →</button>
      </div>
    </div>
  )
}

/* -------------------------------------------------- hotels & flights CRUD */
function CatalogCrudSection({ kind, call }) {
  const isHotel = kind === 'hotels'
  const [rows, setRows] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState(null) // null = đóng modal; object = đang tạo/sửa
  const [editing, setEditing] = useState(null) // null = tạo mới
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const emptyForm = () => (isHotel
    ? { name: '', location: '', rating: '', stars: '5', price: '', hasPromo: false, image: '', description: '', perks: '', isActive: true }
    : { airline: '', logo: '', from: '', to: '', depart: '07:00', arrive: '09:00', duration: '2h 00m', price: '', tag: '', hasPromo: false, isActive: true })

  const load = async () => {
    setError('')
    const res = await call(`/api/admin/${kind}`)
    if (!res.ok) { setError(res.data?.error || 'Không tải được dữ liệu.'); return }
    setRows(Array.isArray(res.data?.data) ? res.data.data : [])
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps react/set-state-in-effect
  const openCreate = () => { setEditing(null); setFormError(''); setForm(emptyForm()) }

  const openEdit = (row) => {
    setEditing(row)
    setFormError('')
    setForm(isHotel
      ? {
        name: row.name, location: row.location, rating: String(row.rating), stars: String(row.stars),
        price: String(row.price), hasPromo: row.hasPromo, image: row.image || '',
        description: row.description || '', perks: (row.perks || []).join(', '), isActive: row.isActive,
      }
      : {
        airline: row.airline, logo: row.logo || '', from: row.from, to: row.to, depart: row.depart,
        arrive: row.arrive, duration: row.duration, price: String(row.price), tag: row.tag || '',
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
        name: form.name, location: form.location, rating: Number(form.rating),
        stars: Number(form.stars), price: numericPrice, hasPromo: form.hasPromo,
        image: form.image, description: form.description,
        perks: String(form.perks || '').split(',').map((s) => s.trim()).filter(Boolean),
        isActive: form.isActive,
      }
      : {
        airline: form.airline, logo: form.logo, from: form.from, to: form.to,
        depart: form.depart, arrive: form.arrive, duration: form.duration,
        price: numericPrice, tag: form.tag, hasPromo: form.hasPromo, isActive: form.isActive,
      }
    const path = editing ? `/api/admin/${kind}/${editing.id}` : `/api/admin/${kind}`
    const res = await call(path, { method: editing ? 'PATCH' : 'POST', body })
    setSaving(false)
    if (!res.ok) { setFormError(res.data?.error || 'Không lưu được dữ liệu.'); return }
    setNotice(editing ? 'Đã cập nhật.' : 'Đã tạo mới.')
    setForm(null)
    setEditing(null)
    load()
  }

  const toggleActive = async (row) => {
    const res = await call(`/api/admin/${kind}/${row.id}`, { method: 'PATCH', body: { isActive: !row.isActive } })
    if (!res.ok) { setError(res.data?.error || 'Không đổi được trạng thái.'); return }
    setNotice(`${row.name || row.airline}: ${row.isActive ? 'ngừng kinh doanh' : 'bán lại'}.`)
    load()
  }

  return (
    <div className="admin-section">
      <div className="admin-toolbar">
        <button type="button" className="primary" onClick={openCreate}>
          + Thêm {isHotel ? 'khách sạn' : 'chuyến bay'}
        </button>
        <span className="admin-count">{rows.length} bản ghi</span>
      </div>

      <ErrorBar message={error} onRetry={load} />
      {notice && <div className="admin-notice" role="status">{notice}</div>}

      {rows.length === 0 ? <Empty text="Chưa có dữ liệu." /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{isHotel ? 'Khách sạn' : 'Chuyến bay'}</th>
                <th>{isHotel ? 'Địa điểm' : 'Tuyến'}</th>
                <th>{isHotel ? 'Đánh giá' : 'Giờ bay'}</th>
                <th>Giá</th>
                <th>Khuyến mãi</th>
                <th>Trạng thái</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.isActive ? '' : 'muted'}>
                  <td>
                    <b>{isHotel ? row.name : `${row.airline} (${row.id})`}</b>
                    <small>{isHotel ? row.description : `${row.logo} · ${row.duration}`}</small>
                  </td>
                  <td>{isHotel ? row.location : `${row.from} → ${row.to}`}</td>
                  <td>{isHotel ? `${row.rating}★ / ${row.stars} sao` : `${row.depart} – ${row.arrive}`}</td>
                  <td className="num"><b>{money(row.price)}</b></td>
                  <td>{row.hasPromo ? 'Có' : '—'}</td>
                  <td>
                    <Toggle
                      checked={row.isActive}
                      onChange={() => toggleActive(row)}
                      labelOn="Đang bán" labelOff="Ngừng bán"
                    />
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
        <Modal
          title={editing ? `Sửa: ${editing.name || editing.airline}` : `Thêm ${isHotel ? 'khách sạn' : 'chuyến bay'}`}
          onClose={() => setForm(null)}
        >
          <div className="admin-form">
            {isHotel ? (
              <>
                <Field label="Tên khách sạn"><input value={form.name} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
                <Field label="Địa điểm"><input value={form.location} maxLength={120} onChange={(e) => setForm({ ...form, location: e.target.value })} /></Field>
                <Field label="Điểm đánh giá (0–10)"><input value={form.rating} inputMode="decimal" onChange={(e) => setForm({ ...form, rating: e.target.value })} /></Field>
                <Field label="Số sao (1–5)"><input value={form.stars} inputMode="numeric" onChange={(e) => setForm({ ...form, stars: e.target.value })} /></Field>
                <Field label="Giá / đêm (₫)"><input value={form.price} inputMode="numeric" onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
                <Field label="Tiện ích (cách nhau dấu phẩy)"><input value={form.perks} maxLength={200} onChange={(e) => setForm({ ...form, perks: e.target.value })} /></Field>
                <Field label="Ảnh (URL hoặc gradient)" wide><input value={form.image} maxLength={800} onChange={(e) => setForm({ ...form, image: e.target.value })} /></Field>
                <Field label="Mô tả" wide><textarea value={form.description} maxLength={600} rows={3} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
              </>
            ) : (
              <>
                <Field label="Hãng bay"><input value={form.airline} maxLength={60} onChange={(e) => setForm({ ...form, airline: e.target.value })} /></Field>
                <Field label="Mã hiệu (logo)"><input value={form.logo} maxLength={6} onChange={(e) => setForm({ ...form, logo: e.target.value })} /></Field>
                <Field label="Sân bay đi"><input value={form.from} maxLength={60} onChange={(e) => setForm({ ...form, from: e.target.value })} /></Field>
                <Field label="Sân bay đến"><input value={form.to} maxLength={60} onChange={(e) => setForm({ ...form, to: e.target.value })} /></Field>
                <Field label="Giờ đi (HH:MM)"><input value={form.depart} maxLength={5} onChange={(e) => setForm({ ...form, depart: e.target.value })} /></Field>
                <Field label="Giờ đến (HH:MM)"><input value={form.arrive} maxLength={5} onChange={(e) => setForm({ ...form, arrive: e.target.value })} /></Field>
                <Field label="Thời lượng"><input value={form.duration} maxLength={24} onChange={(e) => setForm({ ...form, duration: e.target.value })} /></Field>
                <Field label="Giá vé (₫)"><input value={form.price} inputMode="numeric" onChange={(e) => setForm({ ...form, price: e.target.value })} /></Field>
                <Field label="Nhãn (tag)"><input value={form.tag} maxLength={40} onChange={(e) => setForm({ ...form, tag: e.target.value })} /></Field>
              </>
            )}
            <label className="admin-check">
              <input type="checkbox" checked={form.hasPromo} onChange={(e) => setForm({ ...form, hasPromo: e.target.checked })} />
              Có chương trình khuyến mãi
            </label>
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

/* ----------------------------------------------------------- combos CRUD */
function ComboCrudSection({ call }) {
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
        <button type="button" className="primary" onClick={openCreate}>+ Tạo combo</button>
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
                  <td><b>{row.name}</b><small>{row.description}</small></td>
                  <td><small>{row.hotelId}</small><small>{row.flightId}</small></td>
                  <td className="num"><b>{money(row.price)}</b></td>
                  <td className="num">{money(row.saving)}</td>
                  <td><small>{row.validFrom || '—'} → {row.validTo || '…'}</small></td>
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
                {activeFlights.map((f) => <option key={f.id} value={f.id}>{f.id} {f.from}→{f.to} ({money(f.price)})</option>)}
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
                  <td><small>{row.activeFrom || '—'} → {row.activeTo || '…'}</small></td>
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
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = async () => {
    setError('')
    const res = await call('/api/admin/users')
    if (!res.ok) { setError(res.data?.error || 'Không tải được danh sách người dùng.'); return }
    setRows(Array.isArray(res.data?.data) ? res.data.data : [])
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps react/set-state-in-effect
  const toggleActive = async (row) => {
    const res = await call(`/api/admin/users/${row.id}`, { method: 'PATCH', body: { isActive: !row.isActive } })
    if (!res.ok) { setError(res.data?.error || 'Không đổi được trạng thái tài khoản.'); return }
    setNotice(`${row.email}: ${row.isActive ? 'vô hiệu hóa (đã đăng xuất mọi phiên)' : 'kích hoạt lại'}.`)
    load()
  }

  return (
    <div className="admin-section">
      <div className="admin-toolbar">
        <span className="admin-count">{rows.length} tài khoản</span>
      </div>

      <ErrorBar message={error} onRetry={load} />
      {notice && <div className="admin-notice" role="status">{notice}</div>}

      <div className="admin-note">
        <p>
          Vai trò chỉ thay đổi trực tiếp trên máy chủ (script <code>npm run seed:admin</code>);
          API quản trị <b>không cho đổi role</b> để không thể leo thang đặc quyền.
          Vô hiệu hóa tài khoản sẽ đăng xuất ngay mọi phiên đang hoạt động.
        </p>
      </div>

      {rows.length === 0 ? <Empty text="Chưa có tài khoản nào." /> : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Tên hiển thị</th>
                <th>Vai trò</th>
                <th>Số đơn</th>
                <th>Ngày tạo</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className={row.isActive ? '' : 'muted'}>
                  <td>{row.email}</td>
                  <td>{row.name}</td>
                  <td>
                    <span className={`admin-tag ${row.role === 'admin' ? 'ok' : ''}`}>{row.role}</span>
                  </td>
                  <td className="num">{row.bookingCount}</td>
                  <td>{formatDate(row.createdAt)}</td>
                  <td>
                    <Toggle
                      checked={row.isActive}
                      onChange={() => toggleActive(row)}
                      labelOn="Đang hoạt động" labelOff="Đã vô hiệu hóa"
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
  const [form, setForm] = useState(null) // null = đóng modal; object = đang tạo/sửa
  const [editing, setEditing] = useState(null) // null = tạo mới
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(null) // id phòng đang xóa
  const [formError, setFormError] = useState('')
  const [search, setSearch] = useState('')
  const [filterHotel, setFilterHotel] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (search) params.set('q', search)
      if (filterHotel) params.set('hotelId', filterHotel)
      if (filterStatus !== 'all') params.set('isActive', filterStatus === 'active')
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
    maxAdults: '2', maxChildren: '0', amenities: '', images: '',
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
      <div className="admin-toolbar">
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
                <th className="num">Kích thước</th>
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
                    {row.bedType && <small>{row.bedType}</small>}
                  </td>
                  <td>{row.hotelName || row.hotelId}</td>
                  <td className="num">{money(row.price)}</td>
                  <td className="num">{row.maxAdults} lớn / {row.maxChildren} nhỏ</td>
                  <td className="num">{row.sizeSqm == null ? '—' : `${row.sizeSqm} m2`}</td>
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
