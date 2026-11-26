// src/components/DepositModal.jsx — Hộp thoại Nạp tiền vào Ví Mây An Nhiên qua SePay VietQR 24/7.
// Tự động nhận diện webhook chuyển khoản, cập nhật số dư tức thì qua WebSocket Realtime & hỗ trợ mô phỏng test.
import React, { useState, useEffect, useRef } from 'react'
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  ShieldCheck,
  Timer,
  X,
  Zap,
  Building,
  CreditCard,
  Wallet,
  ArrowRight,
} from 'lucide-react'
import { apiFetch } from '../services/api.js'
import { useRealtime } from '../realtime/RealtimeContext.jsx'
import { formatCurrency } from '../data/constants.js'

const PRESET_AMOUNTS = [
  100000,
  200000,
  500000,
  1000000,
  2000000,
  5000000,
]

export default function DepositModal({
  isOpen,
  onClose,
  session,
  currentBalance = 0,
  onSuccess,
  notify,
}) {
  const [selectedAmount, setSelectedAmount] = useState(500000)
  const [customAmount, setCustomAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [depositInfo, setDepositInfo] = useState(null)
  const [copiedField, setCopiedField] = useState(null)
  const [isSuccess, setIsSuccess] = useState(false)
  const [newBalance, setNewBalance] = useState(currentBalance)
  const [addedAmount, setAddedAmount] = useState(0)
  const [timeLeft, setTimeLeft] = useState(900) // 15 phút

  const pollTimerRef = useRef(null)
  const countdownTimerRef = useRef(null)
  const initBalanceRef = useRef(currentBalance)
  const { subscribe } = useRealtime()

  const activeAmount = customAmount ? Math.max(Number(customAmount) || 0, 10000) : selectedAmount

  // Khi modal mở hoặc số tiền thay đổi -> gọi API lấy QR và cú pháp memo NAP<userId>
  useEffect(() => {
    if (!isOpen) return

    setIsSuccess(false)
    setTimeLeft(900)
    initBalanceRef.current = currentBalance

    let isMounted = true
    setLoading(true)

    apiFetch(`/api/payment/wallet/deposit/info?amount=${activeAmount}`)
      .then((res) => {
        if (!isMounted) return
        if (res.ok && res.data) {
          setDepositInfo(res.data)
        } else {
          notify?.('Không tải được thông tin VietQR SePay. Vui lòng thử lại.')
        }
      })
      .catch(() => {
        if (isMounted) notify?.('Lỗi kết nối máy chủ khi tạo mã nạp tiền.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, activeAmount]) // eslint-disable-line react-hooks/exhaustive-deps

  // Đếm ngược 15 phút
  useEffect(() => {
    if (!isOpen || isSuccess) return
    countdownTimerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(countdownTimerRef.current)
  }, [isOpen, isSuccess])

  // Lắng nghe Realtime WebSocket sự kiện cập nhật số dư
  useEffect(() => {
    if (!isOpen || isSuccess || !subscribe) return

    const unsubBalance = subscribe('user:balance:updated', (data) => {
      if (!data) return
      // Kiểm tra xem sự kiện cộng tiền có liên quan đến user hiện tại
      if (!data.userId || !session?.id || Number(data.userId) === Number(session.id)) {
        if (data.balance > initBalanceRef.current || data.added) {
          handleDepositSuccess(data.balance, data.added || activeAmount)
        }
      }
    })

    return () => {
      unsubBalance?.()
    }
  }, [isOpen, isSuccess, subscribe, session?.id, activeAmount]) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling dự phòng mỗi 3 giây kiểm tra ví
  useEffect(() => {
    if (!isOpen || isSuccess) return

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await apiFetch('/api/payment/wallet')
        if (res.ok && res.data) {
          const fetchedBalance = Number(res.data.balance) || 0
          if (fetchedBalance > initBalanceRef.current) {
            const added = fetchedBalance - initBalanceRef.current
            handleDepositSuccess(fetchedBalance, added)
          }
        }
      } catch {
        /* bỏ qua lỗi polling mạng */
      }
    }, 3000)

    return () => clearInterval(pollTimerRef.current)
  }, [isOpen, isSuccess]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDepositSuccess = (bal, added) => {
    setIsSuccess(true)
    setNewBalance(bal)
    setAddedAmount(added)
    clearInterval(pollTimerRef.current)
    clearInterval(countdownTimerRef.current)
    notify?.(`Nạp thành công +${formatCurrency(added)} vào ví Mây An Nhiên!`)
    if (onSuccess) onSuccess({ balance: bal, added })
  }

  const copyToClipboard = async (text, fieldName) => {
    try {
      await navigator.clipboard.writeText(String(text))
      setCopiedField(fieldName)
      notify?.(`Đã sao chép ${fieldName}`)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      notify?.('Không thể tự động sao chép. Vui lòng copy thủ công.')
    }
  }

  const formatCountdown = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="sepay-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="sepay-modal-container deposit-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="deposit-modal-title"
      >
        {/* Header */}
        <div className="sepay-modal-header" style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' }}>
          <div className="sepay-header-title">
            <span className="sepay-badge" style={{ background: '#0284c7' }}>
              <Wallet size={15} strokeWidth={2} /> Nạp tiền Ví
            </span>
            <h3 id="deposit-modal-title" style={{ color: '#fff' }}>Nạp tiền Ví Mây An Nhiên qua SePay VietQR</h3>
          </div>
          <button
            type="button"
            className="sepay-close-btn"
            onClick={onClose}
            aria-label="Đóng cửa sổ"
          >
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Trạng thái THÀNH CÔNG */}
        {isSuccess ? (
          <div className="sepay-success-body">
            <div className="sepay-success-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
              <CheckCircle2 size={68} strokeWidth={2.2} />
            </div>
            <h3 className="sepay-success-title">Nạp tiền vào ví thành công!</h3>
            <p className="sepay-success-desc">
              Hệ thống đã nhận được tiền từ SePay VietQR và cộng ngay vào tài khoản của bạn.
            </p>

            <div className="deposit-summary-box">
              <div className="deposit-row">
                <span>Số tiền nạp vừa nhận:</span>
                <strong style={{ color: '#10b981', fontSize: '18px' }}>+{formatCurrency(addedAmount)}</strong>
              </div>
              <div className="deposit-row">
                <span>Số dư khả dụng hiện tại:</span>
                <strong style={{ color: '#0284c7', fontSize: '20px' }}>{formatCurrency(newBalance)}</strong>
              </div>
              <div className="deposit-row">
                <span>Phương thức nạp:</span>
                <span>SePay VietQR 24/7 (MBBank)</span>
              </div>
            </div>

            <div className="sepay-action-row" style={{ marginTop: '20px' }}>
              <button
                type="button"
                className="sepay-btn sepay-btn-primary"
                onClick={onClose}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Hoàn tất & Tiếp tục
              </button>
            </div>
          </div>
        ) : (
          /* Trạng thái CHỜ NẠP TIỀN */
          <div className="sepay-modal-body">
            {/* Thanh đếm ngược & số dư hiện tại */}
            <div className="deposit-top-bar">
              <div className="deposit-current-bal">
                <Wallet size={16} strokeWidth={1.8} style={{ color: '#0284c7' }} />
                <span>Số dư ví hiện tại: <b>{formatCurrency(currentBalance)}</b></span>
              </div>
              <div className="sepay-timer-badge">
                <Timer size={15} strokeWidth={1.8} />
                <span>Thời hạn hiệu lực mã: <b>{formatCountdown(timeLeft)}</b></span>
              </div>
            </div>

            {/* Chọn số tiền nạp */}
            <div className="deposit-amount-picker">
              <label className="deposit-picker-label">
                <b>Chọn số tiền muốn nạp vào ví:</b>
              </label>
              <div className="deposit-presets-grid">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    type="button"
                    key={amt}
                    className={`deposit-preset-btn ${!customAmount && selectedAmount === amt ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedAmount(amt)
                      setCustomAmount('')
                    }}
                  >
                    {formatCurrency(amt)}
                  </button>
                ))}
              </div>

              <div className="deposit-custom-input-wrap">
                <span>Hoặc nhập số tiền khác:</span>
                <div className="deposit-input-box">
                  <input
                    type="number"
                    min={10000}
                    step={10000}
                    placeholder="VD: 300000"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                  />
                  <span className="unit-label">VND</span>
                </div>
              </div>
            </div>

            <div className="sepay-body-grid">
              {/* Cột trái: Mã VietQR động */}
              <div className="sepay-qr-column">
                <div className="sepay-qr-card">
                  {loading ? (
                    <div className="sepay-qr-loading">
                      <Loader2 size={36} className="spin" />
                      <span>Đang tạo VietQR nạp tiền…</span>
                    </div>
                  ) : depositInfo?.qrUrl ? (
                    <div className="sepay-qr-image-wrap">
                      <img
                        src={depositInfo.qrUrl}
                        alt={`Mã VietQR nạp tiền ${formatCurrency(activeAmount)}`}
                        className="sepay-qr-img"
                      />
                    </div>
                  ) : (
                    <div className="sepay-qr-loading">
                      <QrCode size={48} strokeWidth={1.5} />
                      <span>Chưa có mã QR</span>
                    </div>
                  )}
                  <div className="sepay-qr-status">
                    <span className="status-dot-pulse" />
                    <span>Hệ thống tự động kiểm tra giao dịch mỗi 3s</span>
                  </div>
                </div>
              </div>

              {/* Cột phải: Thông tin chuyển khoản */}
              <div className="sepay-info-column">
                <div className="sepay-instruction-alert">
                  <div className="sepay-bank-tag">
                    <Building size={14} strokeWidth={2} />
                    <span>MBBank</span>
                  </div>
                  <h4>Thông tin chuyển khoản nạp tiền</h4>
                  <p>Quét mã VietQR hoặc chuyển khoản đúng số tiền và nội dung bên dưới để được tự động cộng tiền ngay lập tức:</p>
                </div>

                <div className="sepay-fields-list">
                  {/* Ngân hàng */}
                  <div className="sepay-field-item">
                    <span className="field-label">Ngân hàng thụ hưởng</span>
                    <div className="field-value-row">
                      <strong className="field-value">{depositInfo?.bank || 'MBBank'}</strong>
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => copyToClipboard(depositInfo?.bank || 'MBBank', 'Ngân hàng')}
                      >
                        {copiedField === 'Ngân hàng' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        <span>{copiedField === 'Ngân hàng' ? 'Đã sao chép' : 'Sao chép'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Chủ tài khoản */}
                  <div className="sepay-field-item">
                    <span className="field-label">Chủ tài khoản</span>
                    <div className="field-value-row">
                      <strong className="field-value">{depositInfo?.accountName || 'PHAM MINH KHOI'}</strong>
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => copyToClipboard(depositInfo?.accountName || 'PHAM MINH KHOI', 'Tên chủ TK')}
                      >
                        {copiedField === 'Tên chủ TK' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        <span>{copiedField === 'Tên chủ TK' ? 'Đã sao chép' : 'Sao chép'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Số tài khoản */}
                  <div className="sepay-field-item">
                    <span className="field-label">Số tài khoản</span>
                    <div className="field-value-row">
                      <strong className="field-value account-num">{depositInfo?.accountNumber || '0901234567'}</strong>
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => copyToClipboard(depositInfo?.accountNumber || '0901234567', 'Số tài khoản')}
                      >
                        {copiedField === 'Số tài khoản' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        <span>{copiedField === 'Số tài khoản' ? 'Đã sao chép' : 'Sao chép'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Số tiền cần nạp */}
                  <div className="sepay-field-item highlight-amount">
                    <span className="field-label">Số tiền cần nạp</span>
                    <div className="field-value-row">
                      <strong className="field-value amount-val">{formatCurrency(activeAmount)}</strong>
                      <button
                        type="button"
                        className="copy-btn"
                        onClick={() => copyToClipboard(activeAmount, 'Số tiền')}
                      >
                        {copiedField === 'Số tiền' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        <span>{copiedField === 'Số tiền' ? 'Đã sao chép' : 'Sao chép'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Nội dung chuyển khoản */}
                  <div className="sepay-field-item highlight-memo" style={{ background: '#fef3c7', borderColor: '#f59e0b' }}>
                    <span className="field-label" style={{ color: '#b45309' }}>Nội dung chuyển khoản (Bắt buộc giữ nguyên)</span>
                    <div className="field-value-row">
                      <strong className="field-value memo-val" style={{ color: '#b45309' }}>{depositInfo?.content || `NAP${session?.id || '1'}`}</strong>
                      <button
                        type="button"
                        className="copy-btn"
                        style={{ borderColor: '#f59e0b', color: '#b45309' }}
                        onClick={() => copyToClipboard(depositInfo?.content || `NAP${session?.id || '1'}`, 'Nội dung nạp')}
                      >
                        {copiedField === 'Nội dung nạp' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        <span>{copiedField === 'Nội dung nạp' ? 'Đã sao chép' : 'Sao chép'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
