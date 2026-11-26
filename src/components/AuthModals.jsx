// src/components/AuthModals.jsx — Hộp thoại đăng nhập & đăng ký hệ thống Mây An Nhiên
import { useState, useEffect, useRef } from 'react'
import {
  Cloud,
  Plane,
  X,
  Globe,
  Share2,
  Smartphone,
  Mail,
  KeyRound,
  UserPlus,
} from 'lucide-react'
import { apiFetch } from '../services/api.js'
import { EMAIL_RE, PHONE_RE } from '../data/constants.js'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const YEARS = Array.from({ length: 2026 - 1950 + 1 }, (_, i) => 2026 - i)

function MayAnNhienPromoBanner() {
  return (
    <div className="tvlk-auth-promo-banner">
      <p className="tvlk-auth-promo-text">
        Chúng tôi có một ưu đãi vô cùng hấp dẫn!
      </p>
      <div className="tvlk-auth-promo-art" aria-hidden="true">
        <svg viewBox="0 0 120 76" width="108" height="68" fill="none">
          {/* Clouds & Mountains background */}
          <path d="M12 64L34 32L54 64H12Z" fill="#BAE6FD" opacity="0.7" />
          <path d="M36 64L58 26L82 64H36Z" fill="#7DD3FC" opacity="0.65" />
          <circle cx="26" cy="22" r="6" fill="#FFFFFF" opacity="0.9" />
          <rect x="20" y="22" width="18" height="6" rx="3" fill="#FFFFFF" opacity="0.9" />
          {/* Smartphone frame */}
          <rect x="68" y="8" width="38" height="62" rx="6" fill="#0284C7" stroke="#0369A1" strokeWidth="2" />
          <rect x="72" y="13" width="30" height="50" rx="3" fill="#E0F2FE" />
          <rect x="82" y="10" width="10" height="2" rx="1" fill="#0369A1" />
          {/* Traveler stepping out */}
          <circle cx="66" cy="27" r="5" fill="#F97316" />
          <path d="M58 43C61 36 69 35 74 40L81 47L76 51L69 44L63 52L55 56L52 51L58 43Z" fill="#22C55E" />
          <path d="M62 50L70 59L77 56" stroke="#1D4ED8" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M59 49L49 57" stroke="#1D4ED8" strokeWidth="4" strokeLinecap="round" />
          <rect x="72" y="33" width="9" height="12" rx="2" fill="#F59E0B" />
        </svg>
      </div>
    </div>
  )
}

function MayAnNhienSuccessShieldCard({ onDismiss }) {
  return (
    <div className="tvlk-auth-success-card" onClick={onDismiss} role="status" aria-live="polite">
      <div className="tvlk-auth-shield-wrap" aria-hidden="true">
        <svg className="tvlk-auth-shield-svg" viewBox="0 0 180 150" width="150" height="125" fill="none">
          {/* Subtle city & tropical leaves outline */}
          <rect x="44" y="18" width="44" height="95" rx="3" stroke="#CBD5E1" strokeWidth="1.5" fill="#F8FAFC" />
          <line x1="52" y1="30" x2="80" y2="30" stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1="52" y1="40" x2="80" y2="40" stroke="#CBD5E1" strokeWidth="1.5" />
          <line x1="52" y1="50" x2="80" y2="50" stroke="#CBD5E1" strokeWidth="1.5" />
          <path d="M34 115C28 96 34 80 44 74C44 90 40 104 34 115Z" stroke="#CBD5E1" strokeWidth="1.5" fill="#F8FAFC" />
          <path d="M136 115C144 94 138 76 126 70C126 88 130 104 136 115Z" stroke="#CBD5E1" strokeWidth="1.5" fill="#F8FAFC" />
          <line x1="56" y1="126" x2="124" y2="126" stroke="#0F172A" strokeWidth="3" strokeLinecap="round" />
          {/* Outer & Inner Blue Shield */}
          <path
            d="M90 22L134 38V72C134 100 114 117 90 124C66 117 46 100 46 72V38L90 22Z"
            fill="#BAE6FD"
            stroke="#0F172A"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <path
            d="M90 31L125 44V71C125 93 109 107 90 113C71 107 55 93 55 71V44L90 31Z"
            fill="#0284C7"
            stroke="#0F172A"
            strokeWidth="3"
            strokeLinejoin="round"
          />
          {/* Green Checkmark */}
          <path
            d="M75 72L86 83L107 60"
            stroke="#22C55E"
            strokeWidth="10"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M75 72L86 83L107 60"
            stroke="#16A34A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h3 className="tvlk-auth-success-title">Đăng nhập thành công</h3>
      <p className="tvlk-auth-success-sub">
        Chào mừng bạn quay lại. Thật tuyệt khi được gặp lại bạn!
      </p>
    </div>
  )
}

export function LoginModal({ open, onClose, onLogin, onSocialLogin, onPhoneLogin, onSwitchToRegister }) {
  const [authTab, setAuthTab] = useState('email') // email | google | facebook | phone | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [socialEmail, setSocialEmail] = useState('')
  const [socialName, setSocialName] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [demoOtp, setDemoOtp] = useState('')
  const [otpInput, setOtpInput] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotOtp, setForgotOtp] = useState('')
  const [forgotNewPassword, setForgotNewPassword] = useState('')
  const [forgotOtpSent, setForgotOtpSent] = useState(false)
  const [forgotHint, setForgotHint] = useState('')
  const [forgotSuccess, setForgotSuccess] = useState('')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const successTimerRef = useRef(null)

  useEffect(() => {
    return () => {
      if (successTimerRef.current) window.clearTimeout(successTimerRef.current)
    }
  }, [])

  if (!open && !showSuccess) return null

  const triggerSuccessOverlay = () => {
    setShowSuccess(true)
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current)
    successTimerRef.current = window.setTimeout(() => {
      setShowSuccess(false)
      onClose?.()
    }, 900)
  }

  const dismissAll = () => {
    if (successTimerRef.current) window.clearTimeout(successTimerRef.current)
    setShowSuccess(false)
    onClose?.()
  }

  const switchTab = (next) => {
    setAuthTab(next)
    setError('')
    setForgotSuccess('')
    if (next === 'google' && !socialEmail) {
      setSocialEmail('khachhang.google@gmail.com')
      setSocialName('Người dùng Google')
    } else if (next === 'facebook' && !socialEmail) {
      setSocialEmail('khachhang.fb@facebook.com')
      setSocialName('Người dùng Facebook')
    }
  }

  const handleSendForgotOtp = async () => {
    const mail = forgotEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(mail)) {
      setError('Vui lòng nhập email hợp lệ.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: mail },
      })
      if (!res.ok) {
        setError(res.data?.error || 'Không thể gửi mã OTP.')
        return
      }
      setForgotOtpSent(true)
      const otp = res.data?.otpHint || res.data?.demoOtp
      if (otp) {
        setForgotHint(`Mã OTP đặt lại mật khẩu: ${otp} (hiệu lực 5 phút)`)
        setForgotOtp(otp)
      } else {
        setForgotHint('Mã OTP đã được gửi tới email của bạn.')
      }
    } finally {
      setBusy(false)
    }
  }

  const handleResetPassword = async (event) => {
    event.preventDefault()
    if (busy) return
    const mail = forgotEmail.trim().toLowerCase()
    if (!forgotOtp.trim()) {
      setError('Vui lòng nhập mã OTP 6 số.')
      return
    }
    if (forgotNewPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: { email: mail, otp: forgotOtp.trim(), newPassword: forgotNewPassword },
      })
      if (!res.ok) {
        setError(res.data?.error || 'Đặt lại mật khẩu thất bại.')
        return
      }
      setForgotSuccess('Đặt lại mật khẩu thành công! Vui lòng đăng nhập với mật khẩu mới.')
      setForgotOtpSent(false)
      setForgotEmail('')
      setForgotOtp('')
      setForgotNewPassword('')
      setAuthTab('email')
    } finally {
      setBusy(false)
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    const mail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(mail)) {
      setError('Email không hợp lệ.')
      return
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }
    setBusy(true)
    try {
      triggerSuccessOverlay()
      const message = await onLogin(mail, password)
      if (message) {
        if (successTimerRef.current) window.clearTimeout(successTimerRef.current)
        setShowSuccess(false)
        setError(message)
        return
      }
      setEmail('')
      setPassword('')
      setError('')
    } finally {
      setBusy(false)
    }
  }

  const handleSocialSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    const mail = socialEmail.trim().toLowerCase()
    if (!EMAIL_RE.test(mail)) {
      setError('Vui lòng nhập email tài khoản liên kết hợp lệ.')
      return
    }
    setBusy(true)
    try {
      triggerSuccessOverlay()
      const msg = await onSocialLogin({
        provider: authTab === 'facebook' ? 'facebook' : 'google',
        email: mail,
        name: socialName.trim() || mail.split('@')[0],
      })
      if (msg) {
        if (successTimerRef.current) window.clearTimeout(successTimerRef.current)
        setShowSuccess(false)
        setError(msg)
        return
      }
      setError('')
      setAuthTab('email')
    } finally {
      setBusy(false)
    }
  }

  const handleSendOtp = () => {
    const cleanPhone = phoneInput.replace(/\s+/g, '')
    if (!PHONE_RE.test(cleanPhone)) {
      setError('Số điện thoại Việt Nam chưa hợp lệ (VD: 0912345678).')
      return
    }
    const generated = String(Math.floor(100000 + Math.random() * 900000))
    setDemoOtp(generated)
    setOtpInput(generated)
    setOtpSent(true)
    setError('')
  }

  const handlePhoneSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    const cleanPhone = phoneInput.replace(/\s+/g, '')
    if (!PHONE_RE.test(cleanPhone)) {
      setError('Số điện thoại không hợp lệ.')
      return
    }
    if (!/^\d{6}$/.test(otpInput.trim())) {
      setError('Vui lòng nhập đủ 6 chữ số mã OTP.')
      return
    }
    if (demoOtp && otpInput.trim() !== demoOtp.trim()) {
      setError('Mã OTP không chính xác. Vui lòng kiểm tra lại.')
      return
    }
    setBusy(true)
    try {
      const msg = await onPhoneLogin({ phone: cleanPhone, otp: otpInput.trim(), name: socialName.trim() })
      if (msg) {
        setError(msg)
        return
      }
      triggerSuccessOverlay()
      setError('')
      setOtpSent(false)
      setAuthTab('email')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-overlay" onClick={dismissAll} role="presentation">
      <div className="login-modal tvlk-auth-modal" role="dialog" aria-modal="true" aria-label="Đăng nhập" onClick={(event) => event.stopPropagation()}>
        <MayAnNhienPromoBanner />
        <button className="login-close" onClick={dismissAll} aria-label="Đóng">
          <X size={18} strokeWidth={1.8} />
        </button>

        {showSuccess ? (
          <MayAnNhienSuccessShieldCard onDismiss={dismissAll} />
        ) : (
          <div className="tvlk-auth-body">
            <span className="login-logo" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Cloud size={20} strokeWidth={1.8} />
              <Plane size={18} strokeWidth={1.8} />
            </span>
            <h2>Đăng nhập Mây An Nhiên</h2>
            <p className="login-sub">Chọn đăng nhập bằng Google, Facebook, Số điện thoại hoặc Email.</p>

            <div className="social-login-section">
              <button type="button" className={`social-btn google ${authTab === 'google' ? 'active' : ''}`} onClick={() => switchTab('google')}>
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                Google
              </button>
              <button type="button" className={`social-btn facebook ${authTab === 'facebook' ? 'active' : ''}`} onClick={() => switchTab('facebook')}>
                <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#fff" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                Facebook
              </button>
              <button type="button" className={`social-btn phone ${authTab === 'phone' ? 'active' : ''}`} onClick={() => switchTab('phone')}>
                <Smartphone size={18} strokeWidth={1.8} />
                SĐT / OTP
              </button>
            </div>

            {(authTab === 'google' || authTab === 'facebook') && (
              <form onSubmit={handleSocialSubmit} className="social-inline-form" noValidate>
                <div className="social-inline-head">
                  <b style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {authTab === 'google' ? <Globe size={16} strokeWidth={1.8} /> : <Share2 size={16} strokeWidth={1.8} />}
                    <span>{authTab === 'google' ? 'Liên kết tài khoản Google' : 'Liên kết tài khoản Facebook'}</span>
                  </b>
                  <button type="button" className="login-link" onClick={() => switchTab('email')}>Dùng Email</button>
                </div>
                <label className="login-field">
                  <span>Email {authTab === 'google' ? 'Google' : 'Facebook'}</span>
                  <input
                    type="email"
                    value={socialEmail}
                    maxLength={80}
                    placeholder="ban@gmail.com"
                    onChange={(e) => { setSocialEmail(e.target.value); setError('') }}
                  />
                </label>
                <label className="login-field">
                  <span>Tên hiển thị</span>
                  <input
                    type="text"
                    value={socialName}
                    maxLength={60}
                    placeholder="Nguyễn Văn An"
                    onChange={(e) => setSocialName(e.target.value)}
                  />
                </label>
                {error && <p className="login-error" role="alert">{error}</p>}
                <button className="login-submit tvlk-auth-primary-btn" type="submit" disabled={busy}>
                  {busy ? 'Đang liên kết…' : `Tiếp tục với ${authTab === 'google' ? 'Google' : 'Facebook'}`}
                </button>
              </form>
            )}

            {authTab === 'phone' && (
              <form onSubmit={handlePhoneSubmit} className="social-inline-form" noValidate>
                <div className="social-inline-head">
                  <b style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <Smartphone size={16} strokeWidth={1.8} />
                    <span>Đăng nhập bằng Số điện thoại</span>
                  </b>
                  <button type="button" className="login-link" onClick={() => switchTab('email')}>Dùng Email</button>
                </div>
                <label className="login-field">
                  <span>Số điện thoại</span>
                  <span className="password-row">
                    <input
                      type="tel"
                      value={phoneInput}
                      maxLength={15}
                      placeholder="0912 345 678"
                      onChange={(e) => { setPhoneInput(e.target.value); setError('') }}
                    />
                    <button type="button" onClick={handleSendOtp}>
                      {otpSent ? 'Gửi lại' : 'Gửi OTP'}
                    </button>
                  </span>
                </label>
                {otpSent && (
                  <>
                    <p className="otp-demo-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={15} strokeWidth={1.8} />
                      <span>Mã OTP xác thực của bạn: <b>{demoOtp}</b></span>
                    </p>
                    <label className="login-field">
                      <span>Nhập mã OTP (6 chữ số)</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otpInput}
                        placeholder="Nhập 6 số OTP"
                        onChange={(e) => { setOtpInput(e.target.value); setError('') }}
                      />
                    </label>
                  </>
                )}
                {error && <p className="login-error" role="alert">{error}</p>}
                <button className="login-submit tvlk-auth-primary-btn" type="submit" disabled={busy || !otpSent}>
                  {busy ? 'Đang xác thực…' : 'Xác nhận & Đăng nhập'}
                </button>
              </form>
            )}

            {authTab === 'email' && (
              <>
                <div className="login-divider">
                  <span>hoặc đăng nhập bằng email</span>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                  <label className="login-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={email}
                      maxLength={80}
                      autoComplete="email"
                      placeholder="ban@email.com"
                      onChange={(event) => { setEmail(event.target.value); setError('') }}
                    />
                  </label>

                  <label className="login-field">
                    <span>Mật khẩu</span>
                    <span className="password-row">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        maxLength={64}
                        autoComplete="current-password"
                        placeholder="Tối thiểu 6 ký tự"
                        onChange={(event) => { setPassword(event.target.value); setError('') }}
                      />
                      <button type="button" onClick={() => setShowPassword((visible) => !visible)}>
                        {showPassword ? 'Ẩn' : 'Hiện'}
                      </button>
                    </span>
                  </label>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -4, marginBottom: 8 }}>
                    <button type="button" className="login-link" onClick={() => switchTab('forgot')}>
                      Quên mật khẩu?
                    </button>
                  </div>

                  {forgotSuccess && <p className="login-note" style={{ color: '#16a34a', margin: '4px 0' }}>{forgotSuccess}</p>}
                  {error && <p className="login-error" role="alert">{error}</p>}

                  <button className="login-submit tvlk-auth-primary-btn" type="submit" disabled={busy}>
                    {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
                  </button>
                </form>
              </>
            )}

            {authTab === 'forgot' && (
              <form onSubmit={handleResetPassword} className="social-inline-form" noValidate>
                <div className="social-inline-head">
                  <b style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <KeyRound size={16} strokeWidth={1.8} />
                    <span>Khôi phục mật khẩu</span>
                  </b>
                  <button type="button" className="login-link" onClick={() => switchTab('email')}>Dùng Email</button>
                </div>
                {!forgotOtpSent ? (
                  <>
                    <label className="login-field">
                      <span>Nhập email tài khoản của bạn</span>
                      <input
                        type="email"
                        value={forgotEmail}
                        maxLength={80}
                        placeholder="ban@email.com"
                        onChange={(e) => { setForgotEmail(e.target.value); setError('') }}
                      />
                    </label>
                    {error && <p className="login-error" role="alert">{error}</p>}
                    <button type="button" className="login-submit tvlk-auth-primary-btn" disabled={busy} onClick={handleSendForgotOtp}>
                      {busy ? 'Đang gửi mã…' : 'Gửi mã OTP (5 phút)'}
                    </button>
                  </>
                ) : (
                  <>
                    {forgotHint && (
                      <p className="otp-demo-hint" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={15} strokeWidth={1.8} />
                        <span>{forgotHint}</span>
                      </p>
                    )}
                    <label className="login-field">
                      <span>Nhập mã OTP (6 chữ số)</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={forgotOtp}
                        placeholder="Nhập 6 số OTP"
                        onChange={(e) => { setForgotOtp(e.target.value); setError('') }}
                      />
                    </label>
                    <label className="login-field">
                      <span>Mật khẩu mới</span>
                      <input
                        type="password"
                        maxLength={64}
                        value={forgotNewPassword}
                        placeholder="Tối thiểu 6 ký tự"
                        onChange={(e) => { setForgotNewPassword(e.target.value); setError('') }}
                      />
                    </label>
                    {error && <p className="login-error" role="alert">{error}</p>}
                    <button type="submit" className="login-submit tvlk-auth-primary-btn" disabled={busy}>
                      {busy ? 'Đang đặt lại…' : 'Xác nhận & Đặt lại mật khẩu'}
                    </button>
                  </>
                )}
              </form>
            )}

            {onSwitchToRegister && (
              <p className="login-note">
                Chưa có tài khoản?{' '}
                <button type="button" onClick={onSwitchToRegister} className="login-link">
                  Đăng ký ngay
                </button>
              </p>
            )}
            <small className="login-note">Mật khẩu chỉ được gửi tới máy chủ Mây An Nhiên (cùng nguồn gốc) để đối soát và không bao giờ lưu ở trình duyệt.</small>
          </div>
        )}

        <div className="tvlk-guest-footer">
          <button type="button" className="tvlk-guest-link" onClick={dismissAll}>
            Tìm kiếm với tư cách là khách
          </button>
        </div>
      </div>
    </div>
  )
}

export function RegisterModal({ open, onClose, onRegister, onSocialLogin, onSwitchToLogin }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [birthDay, setBirthDay] = useState('4')
  const [birthMonth, setBirthMonth] = useState('3')
  const [birthYear, setBirthYear] = useState('2019')
  const [gender, setGender] = useState('nam')
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  if (!open) return null

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (busy) return
    setError('')
    const nameTrim = name.trim()
    const mail = email.trim().toLowerCase()
    const phoneTrim = phone.trim()
    if (!nameTrim) {
      setError('Vui lòng nhập họ và tên.')
      return
    }
    if (!EMAIL_RE.test(mail)) {
      setError('Email không hợp lệ.')
      return
    }
    if (phoneTrim && !PHONE_RE.test(phoneTrim)) {
      setError('Số điện thoại không hợp lệ.')
      return
    }
    if (password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại không khớp.')
      return
    }
    setBusy(true)
    try {
      const message = await onRegister({
        email: mail,
        name: nameTrim,
        phone: phoneTrim,
        password,
        dob: `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`,
        gender,
      })
      if (message) {
        setError(message)
        return
      }
      setName('')
      setEmail('')
      setPhone('')
      setPassword('')
      setConfirmPassword('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-overlay" onClick={onClose} role="presentation">
      <div className="login-modal tvlk-auth-modal" role="dialog" aria-modal="true" aria-label="Đăng ký" onClick={(event) => event.stopPropagation()}>
        <MayAnNhienPromoBanner />
        <button className="login-close" onClick={onClose} aria-label="Đóng">
          <X size={18} strokeWidth={1.8} />
        </button>

        <div className="tvlk-auth-body">
          <span className="login-logo" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Cloud size={20} strokeWidth={1.8} />
            <Plane size={18} strokeWidth={1.8} />
            <UserPlus size={18} strokeWidth={1.8} />
          </span>
          <h2>Đăng ký Mây An Nhiên</h2>
          <p className="login-sub">Tạo tài khoản để đặt vé, khách sạn và theo dõi đơn hàng.</p>

          {onSocialLogin && (
            <>
              <div className="social-login-section two-col">
                <button
                  type="button"
                  className="social-btn google"
                  onClick={() => onSocialLogin({ provider: 'google', email: 'thanhvien.google@gmail.com', name: 'Thành viên Google' })}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                  Google
                </button>
                <button
                  type="button"
                  className="social-btn facebook"
                  onClick={() => onSocialLogin({ provider: 'facebook', email: 'thanhvien.fb@facebook.com', name: 'Thành viên Facebook' })}
                >
                  <svg viewBox="0 0 24 24" width="18" height="18"><path fill="#fff" d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>
                  Facebook
                </button>
              </div>
              <div className="login-divider"><span>hoặc tạo tài khoản bằng email</span></div>
            </>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <label className="login-field">
              <span>Họ và tên</span>
              <input
                type="text"
                value={name}
                maxLength={60}
                autoComplete="name"
                placeholder="Nguyễn Văn An"
                onChange={(event) => { setName(event.target.value); setError('') }}
              />
            </label>

            <label className="login-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                maxLength={80}
                autoComplete="email"
                placeholder="ban@email.com"
                onChange={(event) => { setEmail(event.target.value); setError('') }}
              />
            </label>

            <label className="login-field">
              <span>Số điện thoại</span>
              <input
                type="tel"
                value={phone}
                maxLength={15}
                autoComplete="tel"
                placeholder="0912 345 678"
                onChange={(event) => { setPhone(event.target.value); setError('') }}
              />
            </label>

            <label className="login-field">
              <span>Mật khẩu</span>
              <span className="password-row">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  maxLength={64}
                  autoComplete="new-password"
                  placeholder="Tối thiểu 6 ký tự"
                  onChange={(event) => { setPassword(event.target.value); setError('') }}
                />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)}>
                  {showPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </span>
            </label>

            <label className="login-field">
              <span>Nhập lại mật khẩu</span>
              <span className="password-row">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  maxLength={64}
                  autoComplete="new-password"
                  placeholder="Nhập lại mật khẩu"
                  onChange={(event) => { setConfirmPassword(event.target.value); setError('') }}
                />
                <button type="button" onClick={() => setShowConfirm((visible) => !visible)}>
                  {showConfirm ? 'Ẩn' : 'Hiện'}
                </button>
              </span>
            </label>

            {/* Mây An Nhiên "Thông tin bổ sung" section */}
            <div className="tvlk-extra-info-box">
              <h3 className="tvlk-extra-info-title">Thông tin bổ sung</h3>

              <div className="tvlk-extra-field">
                <span className="tvlk-extra-label">Ngày sinh</span>
                <div className="tvlk-dob-row">
                  <select
                    className="tvlk-dob-select"
                    aria-label="Ngày sinh"
                    value={birthDay}
                    onChange={(e) => setBirthDay(e.target.value)}
                  >
                    {DAYS.map((d) => (
                      <option key={d} value={String(d)}>{d}</option>
                    ))}
                  </select>
                  <select
                    className="tvlk-dob-select"
                    aria-label="Tháng sinh"
                    value={birthMonth}
                    onChange={(e) => setBirthMonth(e.target.value)}
                  >
                    {MONTHS.map((m) => (
                      <option key={m} value={String(m)}>Tháng {m}</option>
                    ))}
                  </select>
                  <select
                    className="tvlk-dob-select"
                    aria-label="Năm sinh"
                    value={birthYear}
                    onChange={(e) => setBirthYear(e.target.value)}
                  >
                    {YEARS.map((y) => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                </div>
                <p className="tvlk-dob-note">
                  Để có thông tin đặt phòng chính xác, vui lòng đảm bảo rằng thông tin đó chính xác như được ghi trong ID/Hộ chiếu do chính phủ cấp.
                </p>
              </div>

              <div className="tvlk-extra-field">
                <span className="tvlk-extra-label">Giới tính (không bắt buộc)</span>
                <div className="tvlk-gender-row">
                  <label className="tvlk-gender-option">
                    <input
                      type="radio"
                      name="tvlk-gender"
                      value="nam"
                      checked={gender === 'nam'}
                      onChange={() => setGender('nam')}
                    />
                    <span>Nam</span>
                  </label>
                  <label className="tvlk-gender-option">
                    <input
                      type="radio"
                      name="tvlk-gender"
                      value="nu"
                      checked={gender === 'nu'}
                      onChange={() => setGender('nu')}
                    />
                    <span>Nữ</span>
                  </label>
                </div>
              </div>
            </div>

            {error && <p className="login-error" role="alert">{error}</p>}

            <button className="tvlk-auth-primary-btn register-btn" type="submit" disabled={busy}>
              {busy ? 'Đang đăng ký…' : 'Đăng ký'}
            </button>

            <button
              className="tvlk-auth-skip-btn"
              type="button"
              onClick={onClose}
            >
              Bỏ qua bước này
            </button>
          </form>

          <p className="login-note">
            Đã có tài khoản?{' '}
            <button type="button" onClick={onSwitchToLogin} className="login-link">
              Đăng nhập ngay
            </button>
          </p>
          <small className="login-note">Mật khẩu được mã hóa trước khi lưu và không bao giờ hiển thị ở trình duyệt.</small>
        </div>
      </div>
    </div>
  )
}

