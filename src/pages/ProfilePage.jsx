import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Lock,
  User,
  Wallet,
  Zap,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  PlusCircle,
  Clock,
  ShieldCheck,
  Camera,
  Trash2,
  Award,
  Users,
  AlertTriangle,
  Edit2,
  Plus,
  Sparkles,
  LogOut,
  X,
  Phone,
  Mail,
  CreditCard,
} from 'lucide-react'
import { PageHero } from '../components/SharedUI.jsx'
import DepositModal from '../components/DepositModal.jsx'
import { apiFetch } from '../services/api.js'
import { useRealtime } from '../realtime/RealtimeContext.jsx'
import { formatCurrency } from '../data/constants.js'

const PHONE_REGEX = /^(0|\+84)[0-9]{9}$/

export default function ProfilePage({ session, onUpdateSession, onRequireLogin, onBack, notify, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview') // 'overview' | 'passengers' | 'security'
  const [profile, setProfile] = useState(null)
  const [loyalty, setLoyalty] = useState(null)

  // Avatar states
  const fileInputRef = useRef(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarErr, setAvatarErr] = useState('')
  const [avatarSuccess, setAvatarSuccess] = useState('')

  // Form Thông tin cá nhân
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileMsg, setProfileMsg] = useState('')
  const [profileErr, setProfileErr] = useState('')

  // Form Đổi mật khẩu
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordMsg, setPasswordMsg] = useState('')
  const [passwordErr, setPasswordErr] = useState('')

  // Danh bạ hành khách
  const [passengers, setPassengers] = useState([])
  const [loadingPassengers, setLoadingPassengers] = useState(false)
  const [passengerModalOpen, setPassengerModalOpen] = useState(false)
  const [editingPassenger, setEditingPassenger] = useState(null)
  const [passengerForm, setPassengerForm] = useState({
    fullName: '',
    dob: '',
    gender: 'Nam',
    nationality: 'Việt Nam',
    idNumber: '',
    phone: '',
    label: 'Bản thân',
  })
  const [savingPassenger, setSavingPassenger] = useState(false)
  const [passengerErr, setPassengerErr] = useState('')

  // Logout all modal/state
  const [loggingOutAll, setLoggingOutAll] = useState(false)

  // Trạng thái Ví Mây An Nhiên
  const [wallet, setWallet] = useState({ balance: 0, transactions: [] })
  const [depositOpen, setDepositOpen] = useState(false)
  const [refreshingWallet, setRefreshingWallet] = useState(false)
  const { subscribe } = useRealtime()

  // 1. Tải thông tin hồ sơ & loyalty
  const loadProfile = useCallback(async () => {
    try {
      const res = await apiFetch('/api/profile')
      if (res.ok && res.data?.user) {
        setProfile(res.data.user)
        setName(res.data.user.name || '')
        setPhone(res.data.user.phone || '')
        if (res.data.loyalty) {
          setLoyalty(res.data.loyalty)
        }
        if (res.data.wallet) {
          setWallet(res.data.wallet)
        }
      }
    } catch {
      // offline / lỗi mạng
    }
  }, [])

  // 2. Tải số dư ví
  const loadWallet = useCallback(async () => {
    setRefreshingWallet(true)
    try {
      const res = await apiFetch('/api/payment/wallet')
      if (res.ok && res.data) {
        setWallet({
          balance: Number(res.data.balance) || 0,
          transactions: Array.isArray(res.data.transactions) ? res.data.transactions : [],
        })
      }
    } catch {
      /* bỏ qua */
    } finally {
      setRefreshingWallet(false)
    }
  }, [])

  // 3. Tải danh sách hành khách đã lưu
  const loadPassengers = useCallback(async () => {
    setLoadingPassengers(true)
    try {
      const res = await apiFetch('/api/profile/passengers')
      if (res.ok && Array.isArray(res.data?.passengers)) {
        setPassengers(res.data.passengers)
      }
    } catch {
      /* ignore */
    } finally {
      setLoadingPassengers(false)
    }
  }, [])

  useEffect(() => {
    if (!session) return
    loadProfile()
    loadWallet()
    loadPassengers()
  }, [session, loadProfile, loadWallet, loadPassengers])

  // Lắng nghe sự kiện Real-Time qua WebSocket
  useEffect(() => {
    if (!session || !subscribe) return

    const unsubBalance = subscribe('user:balance:updated', (payload) => {
      const data = payload?.data || payload
      if (data && (Number(data.userId) === Number(session.id) || !data.userId)) {
        loadWallet()
      }
    })

    const unsubAvatar = subscribe('user:avatar:updated', (payload) => {
      const data = payload?.data || payload
      if (data && (Number(data.userId) === Number(session.id) || !data.userId)) {
        setProfile((prev) => ({ ...prev, avatarUrl: data.avatarUrl || '' }))
        onUpdateSession({ avatarUrl: data.avatarUrl || '' })
      }
    })

    const unsubPassengers = subscribe('user:passengers:updated', (payload) => {
      const data = payload?.data || payload
      if (data && (Number(data.userId) === Number(session.id) || !data.userId)) {
        loadPassengers()
      }
    })

    return () => {
      unsubBalance?.()
      unsubAvatar?.()
      unsubPassengers?.()
    }
  }, [session, subscribe, loadWallet, loadPassengers, onUpdateSession])

  if (!session) {
    return (
      <section className="page container profile-page">
        <PageHero icon={<User size={28} strokeWidth={1.8} />} title="Hồ sơ cá nhân" text="Quản lý thông tin tài khoản và đổi mật khẩu an toàn." />
        <div className="empty-bookings login-required">
          <span><Lock size={36} strokeWidth={1.8} /></span>
          <h2>Bạn cần đăng nhập</h2>
          <p>Vui lòng đăng nhập để xem và cập nhật hồ sơ cá nhân của bạn.</p>
          <div className="empty-actions">
            <button className="login-required-btn" onClick={onRequireLogin}>Đăng nhập ngay</button>
            <button onClick={onBack}>Về trang chủ</button>
          </div>
        </div>
      </section>
    )
  }

  // UPLOAD AVATAR
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarErr('')
    setAvatarSuccess('')

    // Validate size (max 3MB)
    if (file.size > 3 * 1024 * 1024) {
      setAvatarErr('File ảnh quá lớn. Vui lòng chọn ảnh dung lượng dưới 3MB.')
      return
    }

    // Validate type
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowed.includes(file.type)) {
      setAvatarErr('Chỉ chấp nhận file ảnh định dạng JPEG, PNG hoặc WebP.')
      return
    }

    const formData = new FormData()
    formData.append('avatar', file)

    setUploadingAvatar(true)
    try {
      const res = await apiFetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) {
        setAvatarErr(res.data?.error || 'Tải ảnh lên thất bại.')
        return
      }

      const avatarUrl = res.data?.avatarUrl
      setAvatarSuccess('Cập nhật ảnh đại diện thành công!')
      setProfile((prev) => ({ ...prev, avatarUrl }))
      onUpdateSession({ avatarUrl })
      notify('Đã cập nhật ảnh đại diện mới')
    } catch {
      setAvatarErr('Lỗi kết nối máy chủ khi tải ảnh.')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // DELETE AVATAR
  const handleDeleteAvatar = async () => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa ảnh đại diện hiện tại?')) return
    setAvatarErr('')
    setAvatarSuccess('')
    try {
      const res = await apiFetch('/api/profile/avatar', { method: 'DELETE' })
      if (!res.ok) {
        setAvatarErr(res.data?.error || 'Xóa ảnh thất bại.')
        return
      }
      setAvatarSuccess('Đã xóa ảnh đại diện.')
      setProfile((prev) => ({ ...prev, avatarUrl: '' }))
      onUpdateSession({ avatarUrl: '' })
      notify('Đã xóa ảnh đại diện')
    } catch {
      setAvatarErr('Lỗi kết nối khi xóa ảnh.')
    }
  }

  // SAVE PERSONAL PROFILE (Strict 10-digit phone & zero mass assignment)
  const handleSaveProfile = async (e) => {
    e.preventDefault()
    setProfileMsg('')
    setProfileErr('')
    const trimmedName = name.trim()
    const trimmedPhone = phone.trim().replace(/\s+/g, '')

    if (!trimmedName || trimmedName.length < 2) {
      setProfileErr('Họ và tên bắt buộc và phải từ 2 đến 60 ký tự.')
      return
    }

    if (!trimmedPhone || !PHONE_REGEX.test(trimmedPhone)) {
      setProfileErr('Số điện thoại Việt Nam bắt buộc và phải hợp lệ (10 chữ số, VD: 0912345678).')
      return
    }

    setSavingProfile(true)
    const res = await apiFetch('/api/profile', {
      method: 'PUT',
      body: { name: trimmedName, phone: trimmedPhone },
    })
    setSavingProfile(false)
    if (!res.ok) {
      setProfileErr(res.data?.error || 'Cập nhật hồ sơ thất bại.')
      return
    }
    setProfileMsg('Cập nhật thông tin thành công!')
    setProfile((prev) => ({ ...prev, name: trimmedName, phone: trimmedPhone }))
    onUpdateSession({ name: trimmedName, phone: trimmedPhone })
    notify('Đã cập nhật thông tin cá nhân')
  }

  // CHANGE PASSWORD
  const handleChangePassword = async (e) => {
    e.preventDefault()
    setPasswordMsg('')
    setPasswordErr('')
    if (newPassword.length < 6) {
      setPasswordErr('Mật khẩu mới phải có ít nhất 6 ký tự.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordErr('Xác nhận mật khẩu mới không khớp.')
      return
    }
    setSavingPassword(true)
    const res = await apiFetch('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: oldPassword, oldPassword, newPassword },
    })
    setSavingPassword(false)
    if (!res.ok) {
      setPasswordErr(res.data?.error || 'Đổi mật khẩu thất bại.')
      return
    }
    setPasswordMsg('Đổi mật khẩu thành công!')
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    notify('Đã đổi mật khẩu thành công')
  }

  // LOGOUT ALL SESSIONS
  const handleLogoutAll = async () => {
    if (!window.confirm('CẢNH BÁO: Thao tác này sẽ đăng xuất tài khoản khỏi tất cả các thiết bị và trình duyệt khác. Bạn có chắc chắn muốn tiếp tục?')) {
      return
    }
    setLoggingOutAll(true)
    try {
      const res = await apiFetch('/api/auth/logout-all', { method: 'POST' })
      if (res.ok) {
        notify('Đã đăng xuất khỏi tất cả thiết bị thành công!')
        if (onLogout) {
          onLogout()
        } else {
          window.location.reload()
        }
      } else {
        alert(res.data?.error || 'Đăng xuất tất cả thiết bị thất bại.')
      }
    } catch {
      alert('Lỗi kết nối khi thực hiện đăng xuất tất cả thiết bị.')
    } finally {
      setLoggingOutAll(false)
    }
  }

  // OPEN PASSENGER MODAL
  const openPassengerModal = (passenger = null) => {
    setPassengerErr('')
    if (passenger) {
      setEditingPassenger(passenger)
      setPassengerForm({
        fullName: passenger.full_name || '',
        dob: passenger.dob || '',
        gender: passenger.gender || 'Nam',
        nationality: passenger.nationality || 'Việt Nam',
        idNumber: passenger.id_number || '',
        phone: passenger.phone || '',
        label: passenger.label || 'Bản thân',
      })
    } else {
      setEditingPassenger(null)
      setPassengerForm({
        fullName: '',
        dob: '',
        gender: 'Nam',
        nationality: 'Việt Nam',
        idNumber: '',
        phone: '',
        label: 'Gia đình',
      })
    }
    setPassengerModalOpen(true)
  }

  // SAVE PASSENGER
  const handleSavePassenger = async (e) => {
    e.preventDefault()
    setPassengerErr('')
    if (!passengerForm.fullName.trim() || passengerForm.fullName.trim().length < 2) {
      setPassengerErr('Họ và tên hành khách bắt buộc (tối thiểu 2 ký tự).')
      return
    }

    setSavingPassenger(true)
    const isEdit = Boolean(editingPassenger?.id)
    const url = isEdit ? `/api/profile/passengers/${editingPassenger.id}` : '/api/profile/passengers'
    const method = isEdit ? 'PUT' : 'POST'

    const res = await apiFetch(url, {
      method,
      body: passengerForm,
    })
    setSavingPassenger(false)

    if (!res.ok) {
      setPassengerErr(res.data?.error || 'Lưu hành khách thất bại.')
      return
    }

    setPassengerModalOpen(false)
    notify(isEdit ? 'Đã cập nhật hành khách' : 'Đã thêm hành khách vào danh bạ')
    loadPassengers()
  }

  // DELETE PASSENGER
  const handleDeletePassenger = async (id, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa "${name}" khỏi danh bạ hành khách?`)) return
    const res = await apiFetch(`/api/profile/passengers/${id}`, { method: 'DELETE' })
    if (res.ok) {
      notify('Đã xóa hành khách khỏi danh bạ')
      loadPassengers()
    } else {
      alert(res.data?.error || 'Xóa hành khách thất bại.')
    }
  }

  const formatTxDate = (isoStr) => {
    if (!isoStr) return ''
    try {
      const d = new Date(isoStr)
      return `${d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ${d.toLocaleDateString('vi-VN')}`
    } catch {
      return String(isoStr)
    }
  }

  const currentTier = loyalty?.tier || profile?.memberTier || 'Thành viên'
  const currentTierKey = currentTier === 'Kim Cương' ? 'diamond' : currentTier === 'Vàng' ? 'gold' : currentTier === 'Bạc' ? 'silver' : 'member'

  const userInitial = (profile?.name || session.name || 'U').charAt(0).toUpperCase()
  const currentAvatar = profile?.avatarUrl || session.avatarUrl

  return (
    <section className="page container profile-page">
      <button type="button" className="back-btn" onClick={onBack}>
        <ArrowLeft size={16} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Quay lại trang chủ
      </button>

      <PageHero
        icon={<User size={28} strokeWidth={1.8} />}
        title="Hồ sơ khách hàng Mây An Nhiên"
        text="Quản lý ảnh đại diện, danh bạ hành khách đã lưu, số dư ví SePay và bảo mật tài khoản."
      />

      {/* MODAL NẠP TIỀN VÍ */}
      <DepositModal
        isOpen={depositOpen}
        onClose={() => setDepositOpen(false)}
        session={session}
        currentBalance={wallet.balance}
        onSuccess={({ balance: nextBal }) => {
          setWallet((prev) => ({ ...prev, balance: nextBal }))
          loadWallet()
        }}
        notify={notify}
      />

      {/* THẺ TỔNG QUAN USER & AVATAR (HERO AVATAR CARD) */}
      <div className="profile-user-summary-card">
        <div className="avatar-upload-wrapper">
          {currentAvatar ? (
            <img src={currentAvatar} alt={profile?.name || session.name} className="avatar-large-preview" />
          ) : (
            <div className="avatar-large-fallback">{userInitial}</div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
          />

          <div className="avatar-btn-group">
            <button
              type="button"
              className="avatar-action-btn"
              disabled={uploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
              title="Tải ảnh mới (JPEG, PNG, WebP tối đa 3MB)"
            >
              <Camera size={14} strokeWidth={2} />
              <span>{uploadingAvatar ? 'Đang tải…' : 'Đổi ảnh'}</span>
            </button>
            {currentAvatar && (
              <button
                type="button"
                className="avatar-action-btn delete"
                onClick={handleDeleteAvatar}
                title="Xóa ảnh đại diện"
              >
                <Trash2 size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        <div className="profile-user-info-meta">
          <h2>{profile?.name || session.name}</h2>
          <p>{profile?.email || session.email} · {profile?.phone || 'Chưa cập nhật SĐT'}</p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`profile-tier-badge tier-${currentTierKey}`}>
              <Award size={14} strokeWidth={2} />
              Hạng: {currentTier}
            </span>
            <span className="profile-tier-badge" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
              <Sparkles size={14} strokeWidth={2} />
              {loyalty?.points || profile?.loyaltyPoints || 0} điểm thưởng
            </span>
            <span className="profile-tier-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669' }}>
              <Wallet size={14} strokeWidth={2} />
              Ví: {formatCurrency(wallet.balance || 0)}
            </span>
          </div>
          {avatarErr && <p style={{ color: '#ef4444', fontSize: '13px', margin: '8px 0 0' }}>{avatarErr}</p>}
          {avatarSuccess && <p style={{ color: '#16a34a', fontSize: '13px', margin: '8px 0 0' }}>{avatarSuccess}</p>}
        </div>
      </div>

      {/* THANH ĐIỀU HƯỚNG TAB */}
      <nav className="profile-tabs-header" aria-label="Profile navigation tabs">
        <button
          type="button"
          className={`profile-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <Wallet size={17} strokeWidth={2} />
          <span>Tổng quan, Thẻ hạng & Ví</span>
        </button>
        <button
          type="button"
          className={`profile-tab-btn ${activeTab === 'passengers' ? 'active' : ''}`}
          onClick={() => setActiveTab('passengers')}
        >
          <Users size={17} strokeWidth={2} />
          <span>Hành khách đã lưu ({passengers.length})</span>
        </button>
        <button
          type="button"
          className={`profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          <ShieldCheck size={17} strokeWidth={2} />
          <span>Thông tin cá nhân & Bảo mật</span>
        </button>
      </nav>

      {/* ========================================================================= */}
      {/* TAB 1: TỔNG QUAN, HẠNG THÀNH VIÊN & VÍ MÂY AN NHIÊN                       */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div>
          {/* THẺ HẠNG THÀNH VIÊN (LOYALTY TIER CARD) */}
          <div className={`loyalty-hero-card ${currentTierKey}`}>
            <div className="loyalty-top-row">
              <div className="loyalty-tier-title">
                <Award size={28} strokeWidth={2.2} />
                <span>Hạng Thành Viên: {currentTier}</span>
              </div>
              <div className="loyalty-points-pill">
                <Sparkles size={16} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                <span>{loyalty?.points || profile?.loyaltyPoints || 0} Điểm thưởng (1đ = 1đ)</span>
              </div>
            </div>

            <p style={{ margin: '0 0 12px', fontSize: '14px', opacity: 0.9 }}>
              Tích lũy tự động <b>1%</b> giá trị cho mọi đơn phòng khách sạn, vé máy bay & combo du lịch khi hoàn tất thanh toán.
            </p>

            {/* THANH TIẾN TRÌNH LÊN HẠNG */}
            <div className="loyalty-progress-container">
              <div className="loyalty-progress-bar-bg">
                <div
                  className="loyalty-progress-bar-fill"
                  style={{ width: `${loyalty?.progressPct || 0}%` }}
                />
              </div>
              <div className="loyalty-progress-meta">
                <span>Tổng chi tiêu: <b>{formatCurrency(loyalty?.totalSpent || profile?.totalSpent || 0)}</b></span>
                <span>
                  {loyalty?.nextTier
                    ? `Còn thiếu ${formatCurrency(loyalty.needed)} để thăng hạng ${loyalty.nextTier}`
                    : 'Chúc mừng! Bạn đã đạt hạng Kim Cương cao nhất.'}
                </span>
              </div>
            </div>

            {/* QUYỀN LỢI HẠNG THÀNH VIÊN */}
            <div className="loyalty-perks-row">
              <span>✓ Tích lũy 1% tiền thưởng</span>
              <span>✓ Hỗ trợ CSKH 24/7</span>
              <span>✓ Đổi điểm thanh toán trực tiếp</span>
              {currentTierKey !== 'member' && <span>✓ Giảm thêm 3-5% phòng khách sạn chọn lọc</span>}
              {currentTierKey === 'diamond' && <span>✓ Quyền sử dụng phòng chờ thương gia sân bay</span>}
            </div>
          </div>

          {/* KHỐI VÍ MÂY AN NHIÊN PAY */}
          <div className="wallet-card-container" style={{ marginBottom: 28 }}>
            <div className="wallet-hero-card">
              <div className="wallet-hero-left">
                <div className="wallet-pill-label">
                  <Wallet size={16} strokeWidth={2} />
                  <span>Ví Mây An Nhiên Pay</span>
                  <span className="wallet-status-dot" title="Sẵn sàng 24/7" />
                </div>
                <div className="wallet-balance-row">
                  <span className="wallet-balance-label">Số dư khả dụng</span>
                  <h2 className="wallet-balance-amount">{formatCurrency(wallet.balance || 0)}</h2>
                </div>
                <p className="wallet-hero-desc">
                  Tự động thanh toán ngay lập tức cho Vé máy bay, Khách sạn, Combo du lịch. Nạp tiền qua SePay VietQR khớp lệnh sau 3 giây.
                </p>
              </div>

              <div className="wallet-hero-right">
                <button
                  type="button"
                  className="wallet-deposit-cta-btn"
                  onClick={() => setDepositOpen(true)}
                >
                  <PlusCircle size={18} strokeWidth={2.2} />
                  <span>Nạp tiền qua SePay VietQR</span>
                </button>
                <button
                  type="button"
                  className="wallet-refresh-btn"
                  onClick={loadWallet}
                  disabled={refreshingWallet}
                  title="Làm mới số dư"
                >
                  <RefreshCw size={15} className={refreshingWallet ? 'spin' : ''} />
                  <span>{refreshingWallet ? 'Đang cập nhật…' : 'Làm mới số dư'}</span>
                </button>
              </div>
            </div>

            {/* LỊCH SỬ GIAO DỊCH VÍ */}
            <div className="wallet-history-card">
              <div className="wallet-history-head">
                <div className="history-head-title">
                  <Clock size={18} strokeWidth={1.8} style={{ color: '#0284c7' }} />
                  <h3>Lịch sử biến động số dư</h3>
                </div>
                <span className="tx-count-pill">{wallet.transactions?.length || 0} giao dịch gần nhất</span>
              </div>

              {Array.isArray(wallet.transactions) && wallet.transactions.length > 0 ? (
                <div className="wallet-tx-list">
                  {wallet.transactions.map((tx) => {
                    const isDeposit = tx.type === 'deposit' || tx.amount > 0
                    return (
                      <div key={tx.id} className="wallet-tx-item">
                        <div
                          className="tx-icon-wrap"
                          style={{
                            background: isDeposit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                            color: isDeposit ? '#059669' : '#dc2626',
                          }}
                        >
                          {isDeposit ? <ArrowDownLeft size={18} strokeWidth={2.2} /> : <ArrowUpRight size={18} strokeWidth={2.2} />}
                        </div>
                        <div className="tx-info-wrap">
                          <strong className="tx-title">
                            {isDeposit ? 'Nạp tiền vào ví qua SePay VietQR' : `Thanh toán đơn hàng ${tx.booking_code || ''}`}
                          </strong>
                          <span className="tx-meta">
                            {formatTxDate(tx.created_at)}
                            {tx.reference_code && ` · Mã: ${tx.reference_code}`}
                            {tx.description && ` · ${tx.description}`}
                          </span>
                        </div>
                        <div className="tx-amount-wrap">
                          <strong className={`tx-amount ${isDeposit ? 'deposit' : 'payment'}`}>
                            {isDeposit ? `+${formatCurrency(tx.amount)}` : `-${formatCurrency(Math.abs(tx.amount))}`}
                          </strong>
                          <small className="tx-balance-after">
                            Số dư sau: {formatCurrency(tx.balance_after)}
                          </small>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="wallet-empty-tx">
                  <Zap size={32} strokeWidth={1.5} style={{ color: '#94a3b8' }} />
                  <p>Chưa có giao dịch biến động số dư nào.</p>
                  <small>Bấm "Nạp tiền qua SePay VietQR" để nạp tiền vào ví và trải nghiệm thanh toán 1-chạm thuận tiện.</small>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: HÀNH KHÁCH ĐÃ LƯU (SAVED PASSENGERS CRUD)                           */}
      {/* ========================================================================= */}
      {activeTab === 'passengers' && (
        <div className="checkout-card" style={{ marginBottom: 24 }}>
          <div className="passengers-head">
            <div>
              <h2 style={{ margin: '0 0 4px', fontSize: '20px' }}>Danh bạ hành khách đã lưu</h2>
              <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
                Lưu tối đa 20 hành khách để tự động điền thông tin người đặt & khách đi cùng chỉ với 1 chạm tại bước Checkout.
              </p>
            </div>
            <button
              type="button"
              className="pay-btn"
              style={{ width: 'auto', padding: '8px 16px', fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              disabled={passengers.length >= 20}
              onClick={() => openPassengerModal()}
            >
              <Plus size={16} strokeWidth={2} />
              <span>Thêm hành khách ({passengers.length}/20)</span>
            </button>
          </div>

          {loadingPassengers ? (
            <p className="muted" style={{ textAlign: 'center', padding: '30px' }}>Đang tải danh bạ hành khách…</p>
          ) : passengers.length === 0 ? (
            <div className="wallet-empty-tx" style={{ padding: '36px 20px' }}>
              <Users size={38} strokeWidth={1.5} style={{ color: '#94a3b8' }} />
              <p style={{ fontWeight: 600, fontSize: '15px' }}>Chưa có hành khách nào trong danh bạ.</p>
              <small>Thêm thông tin bản thân, người thân hoặc bạn bè để tự động điền nhanh khi đặt vé máy bay & phòng khách sạn.</small>
              <button
                type="button"
                className="wallet-deposit-cta-btn"
                style={{ marginTop: 14 }}
                onClick={() => openPassengerModal()}
              >
                <Plus size={16} strokeWidth={2} /> Thêm hành khách đầu tiên
              </button>
            </div>
          ) : (
            <div className="passengers-grid">
              {passengers.map((p) => (
                <div key={p.id} className="passenger-item-card">
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <strong style={{ fontSize: '16px', color: 'var(--tl-fg, #0f172a)' }}>{p.full_name}</strong>
                      <span className="passenger-label-badge">{p.label || 'Khách'}</span>
                    </div>
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px', opacity: 0.85 }}>
                      {p.phone && <span>📞 SĐT: <b>{p.phone}</b></span>}
                      {p.id_number && <span>🪪 CCCD/Hộ chiếu: <b>{p.id_number}</b></span>}
                      {p.dob && <span>🎂 Ngày sinh: <b>{p.dob}</b></span>}
                      <span>⚧ Giới tính: <b>{p.gender || 'Nam'}</b> · Quốc tịch: <b>{p.nationality || 'Việt Nam'}</b></span>
                    </div>
                  </div>

                  <div className="passenger-actions">
                    <button
                      type="button"
                      className="passenger-icon-btn"
                      onClick={() => openPassengerModal(p)}
                    >
                      <Edit2 size={13} strokeWidth={2} /> Sửa
                    </button>
                    <button
                      type="button"
                      className="passenger-icon-btn danger"
                      onClick={() => handleDeletePassenger(p.id, p.full_name)}
                    >
                      <Trash2 size={13} strokeWidth={2} /> Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* MODAL THÊM / SỬA HÀNH KHÁCH */}
          {passengerModalOpen && (
            <div className="sepay-modal-overlay" onClick={() => setPassengerModalOpen(false)}>
              <div
                className="sepay-modal-container"
                style={{ maxWidth: '500px' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="sepay-modal-head">
                  <div className="sepay-head-brand">
                    <Users size={20} strokeWidth={2} style={{ color: '#0284c7' }} />
                    <h3 style={{ margin: 0, fontSize: '17px' }}>
                      {editingPassenger ? 'Chỉnh sửa thông tin hành khách' : 'Thêm hành khách mới'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    className="sepay-close-btn"
                    onClick={() => setPassengerModalOpen(false)}
                  >
                    <X size={18} strokeWidth={2} />
                  </button>
                </div>

                <form onSubmit={handleSavePassenger} className="checkout-form" style={{ padding: '20px' }}>
                  <label className="field">
                    <span>Họ và tên (bắt buộc, theo giấy tờ)</span>
                    <input
                      type="text"
                      maxLength={60}
                      required
                      placeholder="VD: NGUYEN VAN A"
                      value={passengerForm.fullName}
                      onChange={(e) => setPassengerForm({ ...passengerForm, fullName: e.target.value })}
                    />
                  </label>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <label className="field">
                      <span>Mối quan hệ / Nhãn</span>
                      <select
                        value={passengerForm.label}
                        onChange={(e) => setPassengerForm({ ...passengerForm, label: e.target.value })}
                      >
                        <option value="Bản thân">Bản thân</option>
                        <option value="Gia đình">Gia đình</option>
                        <option value="Bạn bè">Bạn bè</option>
                        <option value="Đối tác">Đối tác</option>
                        <option value="Đồng nghiệp">Đồng nghiệp</option>
                      </select>
                    </label>

                    <label className="field">
                      <span>Giới tính</span>
                      <select
                        value={passengerForm.gender}
                        onChange={(e) => setPassengerForm({ ...passengerForm, gender: e.target.value })}
                      >
                        <option value="Nam">Nam</option>
                        <option value="Nữ">Nữ</option>
                        <option value="Khác">Khác</option>
                      </select>
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <label className="field">
                      <span>Ngày sinh</span>
                      <input
                        type="date"
                        value={passengerForm.dob}
                        onChange={(e) => setPassengerForm({ ...passengerForm, dob: e.target.value })}
                      />
                    </label>

                    <label className="field">
                      <span>Quốc tịch</span>
                      <input
                        type="text"
                        maxLength={40}
                        value={passengerForm.nationality}
                        onChange={(e) => setPassengerForm({ ...passengerForm, nationality: e.target.value })}
                      />
                    </label>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <label className="field">
                      <span>CCCD / Hộ chiếu</span>
                      <input
                        type="text"
                        maxLength={20}
                        placeholder="Số giấy tờ tùy thân"
                        value={passengerForm.idNumber}
                        onChange={(e) => setPassengerForm({ ...passengerForm, idNumber: e.target.value })}
                      />
                    </label>

                    <label className="field">
                      <span>Số điện thoại</span>
                      <input
                        type="tel"
                        maxLength={15}
                        placeholder="0912345678"
                        value={passengerForm.phone}
                        onChange={(e) => setPassengerForm({ ...passengerForm, phone: e.target.value })}
                      />
                    </label>
                  </div>

                  {passengerErr && <p className="field-error-hint" role="alert">{passengerErr}</p>}

                  <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                    <button
                      type="submit"
                      className="pay-btn"
                      disabled={savingPassenger}
                      style={{ flex: 1 }}
                    >
                      {savingPassenger ? 'Đang lưu…' : (editingPassenger ? 'Cập nhật' : 'Thêm hành khách')}
                    </button>
                    <button
                      type="button"
                      className="plain-btn"
                      onClick={() => setPassengerModalOpen(false)}
                      style={{ padding: '10px 18px' }}
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: THÔNG TIN CÁ NHÂN & BẢO MẬT (PROFILE, PASS, LOGOUT-ALL)             */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="checkout-layout">
          <div className="checkout-main">
            {/* THÔNG TIN TÀI KHOẢN (CHỐNG MASS ASSIGNMENT & STRICT VN PHONE) */}
            <div className="checkout-card" style={{ marginBottom: 24 }}>
              <h2>Cập nhật thông tin cá nhân</h2>
              <form onSubmit={handleSaveProfile} className="checkout-form">
                <label className="field">
                  <span>Email đăng nhập (Không thể thay đổi)</span>
                  <input type="text" value={profile?.email || session.email} disabled style={{ opacity: 0.7 }} />
                </label>
                <label className="field">
                  <span>Vai trò tài khoản</span>
                  <input
                    type="text"
                    value={profile?.role === 'admin' ? 'Quản trị viên (Admin)' : (profile?.role === 'staff' ? 'Nhân viên lễ tân (Staff)' : 'Khách hàng')}
                    disabled
                    style={{ opacity: 0.7 }}
                  />
                </label>
                <label className="field">
                  <span>Họ và tên</span>
                  <input
                    type="text"
                    maxLength={60}
                    value={name}
                    required
                    onChange={(e) => { setName(e.target.value); setProfileErr('') }}
                  />
                </label>
                <label className="field">
                  <span>Số điện thoại liên hệ (10 chữ số)</span>
                  <input
                    type="tel"
                    maxLength={15}
                    value={phone}
                    required
                    placeholder="VD: 0912345678"
                    onChange={(e) => { setPhone(e.target.value); setProfileErr('') }}
                  />
                </label>
                {profileErr && <p className="field-error-hint" role="alert">{profileErr}</p>}
                {profileMsg && (
                  <p className="login-note" style={{ color: '#16a34a' }}>
                    <CheckCircle2 size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {profileMsg}
                  </p>
                )}
                <button type="submit" className="pay-btn" disabled={savingProfile}>
                  {savingProfile ? 'Đang lưu…' : 'Lưu thay đổi'}
                </button>
              </form>
            </div>

            {/* ĐỔI MẬT KHẨU */}
            <div className="checkout-card" style={{ marginBottom: 24 }}>
              <h2>Đổi mật khẩu bảo mật</h2>
              <form onSubmit={handleChangePassword} className="checkout-form">
                <label className="field">
                  <span>Mật khẩu hiện tại</span>
                  <input
                    type="password"
                    value={oldPassword}
                    maxLength={64}
                    placeholder="Nhập mật khẩu cũ"
                    onChange={(e) => { setOldPassword(e.target.value); setPasswordErr('') }}
                  />
                </label>
                <label className="field">
                  <span>Mật khẩu mới</span>
                  <input
                    type="password"
                    value={newPassword}
                    maxLength={64}
                    placeholder="Tối thiểu 6 ký tự"
                    onChange={(e) => { setNewPassword(e.target.value); setPasswordErr('') }}
                  />
                </label>
                <label className="field">
                  <span>Xác nhận mật khẩu mới</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    maxLength={64}
                    placeholder="Nhập lại mật khẩu mới"
                    onChange={(e) => { setConfirmPassword(e.target.value); setPasswordErr('') }}
                  />
                </label>
                {passwordErr && <p className="field-error-hint" role="alert">{passwordErr}</p>}
                {passwordMsg && (
                  <p className="login-note" style={{ color: '#16a34a' }}>
                    <CheckCircle2 size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {passwordMsg}
                  </p>
                )}
                <button type="submit" className="pay-btn" disabled={savingPassword}>
                  {savingPassword ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
                </button>
              </form>
            </div>

            {/* DANGER ZONE: ĐĂNG XUẤT KHỎI TẤT CẢ THIẾT BỊ (TASK 4) */}
            <div className="security-danger-card">
              <h3>
                <AlertTriangle size={20} strokeWidth={2} />
                Quản lý phiên đăng nhập & Thiết bị
              </h3>
              <p style={{ fontSize: '13px', lineHeight: 1.6, margin: '0 0 14px', opacity: 0.9 }}>
                Nếu bạn nghi ngờ tài khoản bị lộ hoặc đăng nhập trên thiết bị công cộng, hãy sử dụng tính năng này để tăng phiên bảo mật (Token Version), hủy toàn bộ token và phiên làm việc đang mở trên tất cả các trình duyệt.
              </p>
              <button
                type="button"
                className="plain-btn"
                style={{
                  background: '#dc2626',
                  color: '#ffffff',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                disabled={loggingOutAll}
                onClick={handleLogoutAll}
              >
                <LogOut size={16} strokeWidth={2} />
                <span>{loggingOutAll ? 'Đang vô hiệu hóa phiên…' : 'Đăng xuất khỏi tất cả thiết bị'}</span>
              </button>
            </div>
          </div>

          <aside className="checkout-side">
            <div className="booking-summary">
              <h3>Bảo mật & Kiểm soát</h3>
              <p className="muted" style={{ fontSize: '13px', lineHeight: 1.6 }}>
                Hệ thống Mây An Nhiên áp dụng chuẩn bảo mật phiên làm việc và kiểm soát thiết bị đăng nhập để chống chiếm đoạt tài khoản.
              </p>
              <ul className="ins-perks" style={{ marginTop: 16 }}>
                <li><Check size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Chống Mass Assignment (không cho phép sửa email, quyền, điểm)</li>
                <li><Check size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Kiểm soát phiên đồng thời qua Token Version</li>
                <li><Check size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Mã hóa mật khẩu an toàn với Scrypt / Argon2</li>
                <li><Check size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Ghi vết lịch sử Audit Logs cho mọi hành vi nhạy cảm</li>
              </ul>
            </div>
          </aside>
        </div>
      )}
    </section>
  )
}
