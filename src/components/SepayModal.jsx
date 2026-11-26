// src/components/SepayModal.jsx — Cổng thanh toán VietQR tự động qua SePay 24/7.
// Hỗ trợ quét mã VietQR, thanh toán trực tiếp trên Cốc Cốc, tự động cập nhật Real-Time qua WebSocket và kiểm thử tức thì.
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
  FileDown,
} from 'lucide-react'
import { apiFetch, API_BASE } from '../services/api.js'
import { useRealtime } from '../realtime/RealtimeContext.jsx'
import { formatCurrency } from '../data/constants.js'

export default function SepayModal({
  isOpen,
  onClose,
  booking,
  onSuccess,
  notify,
}) {
  const [loading, setLoading] = useState(true)
  const [payInfo, setPayInfo] = useState(null)
  const [copiedField, setCopiedField] = useState(null)
  const [isPaid, setIsPaid] = useState(false)
  const [timeLeft, setTimeLeft] = useState(900) // 15 phút đếm ngược
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const pollTimerRef = useRef(null)
  const countdownTimerRef = useRef(null)
  const { subscribe } = useRealtime()

  // Reset và load thông tin thanh toán khi mở modal
  useEffect(() => {
    if (!isOpen || !booking?.code) return

    setIsPaid(booking.payment_status === 'paid' || booking.status === 'Đã thanh toán')
    setTimeLeft(900)
    setLoading(true)

    let isMounted = true
    apiFetch(`/api/payment/sepay/info/${encodeURIComponent(booking.code)}`)
      .then((res) => {
        if (!isMounted) return
        if (res.ok && res.data) {
          setPayInfo(res.data)
          if (res.data.paid) {
            setIsPaid(true)
          }
        } else {
          notify?.('Không tải được thông tin thanh toán SePay. Thử lại sau.')
        }
      })
      .catch(() => {
        if (isMounted) notify?.('Lỗi kết nối máy chủ khi tạo mã VietQR.')
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [isOpen, booking?.code]) // eslint-disable-line react-hooks/exhaustive-deps

  // Đếm ngược thời gian thanh toán 15 phút
  useEffect(() => {
    if (!isOpen || isPaid) return
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
  }, [isOpen, isPaid])

  // Lắng nghe sự kiện Real-Time khi thanh toán thành công qua WebSocket
  useEffect(() => {
    if (!isOpen || isPaid || !subscribe || !booking?.code) return

    const unsubBookingUpdated = subscribe('booking:updated', ({ booking: updated }) => {
      if (updated?.code === booking.code && (updated.status === 'Đã thanh toán' || updated.payment_status === 'paid')) {
        handlePaymentSuccess(updated)
      }
    })

    const unsubPaymentReceived = subscribe('payment:received', (data) => {
      if (data?.bookingCode === booking.code) {
        handlePaymentSuccess({ ...booking, status: 'Đã thanh toán', payment_status: 'paid' })
      }
    })

    return () => {
      unsubBookingUpdated?.()
      unsubPaymentReceived?.()
    }
  }, [isOpen, isPaid, subscribe, booking?.code]) // eslint-disable-line react-hooks/exhaustive-deps

  // Polling dự phòng mỗi 3 giây trong trường hợp WebSocket bị gián đoạn
  useEffect(() => {
    if (!isOpen || isPaid || !booking?.code) return

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await apiFetch(`/api/payment/sepay/status/${encodeURIComponent(booking.code)}`)
        if (res.ok && res.data?.paid) {
          clearInterval(pollTimerRef.current)
          handlePaymentSuccess({ ...booking, status: 'Đã thanh toán', payment_status: 'paid' })
        }
      } catch {
        /* bỏ qua lỗi mạng poll ngầm */
      }
    }, 3000)

    return () => clearInterval(pollTimerRef.current)
  }, [isOpen, isPaid, booking?.code]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePaymentSuccess = (updatedData) => {
    setIsPaid(true)
    clearInterval(pollTimerRef.current)
    clearInterval(countdownTimerRef.current)
    notify?.(`Thanh toán thành công đơn ${booking.code}! Đã tự động cộng tiền và xuất vé điện tử.`)
    if (onSuccess) onSuccess(updatedData)
  }

  // Sao chép nhanh số tài khoản / số tiền / nội dung chuyển khoản
  const copyToClipboard = async (text, fieldName) => {
    try {
      await navigator.clipboard.writeText(String(text))
      setCopiedField(fieldName)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      notify?.('Không thể tự động sao chép. Vui lòng chọn và sao chép thủ công.')
    }
  }

  // Tải vé điện tử PDF
  const handleDownloadPdf = async () => {
    try {
      setDownloadingPdf(true)
      const res = await fetch(`${API_BASE}/api/bookings/${booking.id}/eticket`, {
        headers: { 'X-Requested-With': 'fetch' },
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error('Không thể tải vé điện tử.')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `MayAnNhien-ETicket-${booking.code}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      notify?.(err.message || 'Lỗi khi tải vé điện tử PDF.')
    } finally {
      setDownloadingPdf(false)
    }
  }

  if (!isOpen || !booking) return null

  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const amount = payInfo?.amount || booking.total || 0
  const qrUrl = payInfo?.qrUrl || `https://qr.sepay.vn/img?acc=${encodeURIComponent(payInfo?.accountNumber || '0901234567')}&bank=${encodeURIComponent(payInfo?.bank || 'MBBank')}&amount=${amount}&des=${encodeURIComponent(booking.code)}&template=compact`
  const directSepayUrl = payInfo?.directUrl || 'https://my.sepay.vn'

  return (
    <div className="sepay-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="sepay-modal-container"
        role="dialog"
        aria-modal="true"
        aria-label="Cổng thanh toán SePay VietQR"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="sepay-modal-header">
          <div className="sepay-header-title">
            <span className="sepay-logo-badge">
              <QrCode size={18} strokeWidth={2} /> SePay VietQR
            </span>
            <h3>Thanh toán chuyển khoản ngân hàng 24/7</h3>
          </div>
          <button type="button" className="sepay-close-btn" onClick={onClose} aria-label="Đóng cửa sổ">
            <X size={20} strokeWidth={2} />
          </button>
        </div>

        {/* Nội dung thanh toán thành công */}
        {isPaid ? (
          <div className="sepay-success-pane">
            <div className="sepay-success-icon-wrap">
              <CheckCircle2 size={64} strokeWidth={2} color="#10b981" />
            </div>
            <h2>Thanh toán thành công!</h2>
            <p className="sepay-success-desc">
              Hệ thống SePay đã tự động xác nhận giao dịch chuyển khoản cho đơn hàng <strong>{booking.code}</strong>.
            </p>
            <div className="sepay-success-card">
              <div className="sepay-info-row">
                <span>Mã đơn đặt:</span>
                <strong>{booking.code}</strong>
              </div>
              <div className="sepay-info-row">
                <span>Tổng tiền đã thanh toán:</span>
                <strong className="sepay-highlight-green">{formatCurrency(amount)}</strong>
              </div>
              <div className="sepay-info-row">
                <span>Trạng thái:</span>
                <span className="sepay-status-pill success">Đã thanh toán & Xuất vé</span>
              </div>
            </div>

            <div className="sepay-success-actions">
              <button
                type="button"
                className="sepay-btn-primary"
                onClick={handleDownloadPdf}
                disabled={downloadingPdf}
              >
                {downloadingPdf ? (
                  <><Loader2 size={16} className="spinning" /> Đang tạo PDF...</>
                ) : (
                  <><FileDown size={16} /> Tải vé điện tử (PDF) ngay</>
                )}
              </button>
              <button type="button" className="sepay-btn-secondary" onClick={onClose}>
                Hoàn tất & Về danh sách đơn đặt
              </button>
            </div>
          </div>
        ) : (
          /* Nội dung quét mã & thanh toán */
          <div className="sepay-modal-body">
            {loading ? (
              <div className="sepay-loading-box">
                <Loader2 size={36} className="spinning" color="#0284c7" />
                <p>Đang khởi tạo mã QR và kết nối cổng SePay...</p>
              </div>
            ) : (
              <>
                {/* Banner đếm ngược */}
                <div className="sepay-countdown-bar">
                  <div className="sepay-countdown-left">
                    <Timer size={16} strokeWidth={2} />
                    <span>Thời gian giữ chỗ & chờ thanh toán:</span>
                  </div>
                  <div className={`sepay-countdown-time ${timeLeft < 180 ? 'urgent' : ''}`}>
                    {formattedTime}
                  </div>
                </div>

                <div className="sepay-content-grid">
                  {/* Cột trái: Mã VietQR */}
                  <div className="sepay-qr-column">
                    <div className="sepay-qr-card">
                      <div className="sepay-qr-image-wrapper">
                        <img
                          src={qrUrl}
                          alt={`Mã VietQR thanh toán SePay đơn hàng ${booking.code}`}
                          className="sepay-qr-image"
                        />
                      </div>
                      <div className="sepay-qr-caption">
                        <span className="sepay-pulse-dot" />
                        <span>Hệ thống tự động kiểm tra giao dịch mỗi 3s</span>
                      </div>
                    </div>
                  </div>

                  {/* Cột phải: Thông tin tài khoản & Hướng dẫn */}
                  <div className="sepay-details-column">
                    <div className="sepay-bank-summary">
                      <div className="sepay-bank-badge">
                        <Building size={16} strokeWidth={2} /> {payInfo?.bank || 'MBBank'}
                      </div>
                      <h4>Thông tin chuyển khoản chính xác</h4>
                      <p className="sepay-note-text">
                        Mở App Ngân hàng bất kỳ hoặc ví điện tử để quét mã QR bên cạnh, hoặc chuyển khoản theo thông tin dưới đây:
                      </p>
                    </div>

                    <div className="sepay-fields-list">
                      {/* Ngân hàng */}
                      <div className="sepay-field-item">
                        <div className="sepay-field-meta">
                          <small>Ngân hàng thụ hưởng</small>
                          <strong>{payInfo?.bank || 'MBBank (Ngân hàng Quân Đội)'}</strong>
                        </div>
                        <button
                          type="button"
                          className="sepay-copy-btn"
                          onClick={() => copyToClipboard(payInfo?.bank || 'MBBank', 'bank')}
                        >
                          {copiedField === 'bank' ? 'Đã chép' : <><Copy size={13} /> Sao chép</>}
                        </button>
                      </div>

                      {/* Chủ tài khoản */}
                      <div className="sepay-field-item">
                        <div className="sepay-field-meta">
                          <small>Chủ tài khoản</small>
                          <strong>{payInfo?.accountName || 'PHAM MINH KHOI'}</strong>
                        </div>
                        <button
                          type="button"
                          className="sepay-copy-btn"
                          onClick={() => copyToClipboard(payInfo?.accountName || 'PHAM MINH KHOI', 'name')}
                        >
                          {copiedField === 'name' ? 'Đã chép' : <><Copy size={13} /> Sao chép</>}
                        </button>
                      </div>

                      {/* Số tài khoản */}
                      <div className="sepay-field-item highlighted">
                        <div className="sepay-field-meta">
                          <small>Số tài khoản</small>
                          <strong className="sepay-val-accent">{payInfo?.accountNumber || '0901234567'}</strong>
                        </div>
                        <button
                          type="button"
                          className="sepay-copy-btn active"
                          onClick={() => copyToClipboard(payInfo?.accountNumber || '0901234567', 'acc')}
                        >
                          {copiedField === 'acc' ? 'Đã chép' : <><Copy size={13} /> Sao chép</>}
                        </button>
                      </div>

                      {/* Số tiền */}
                      <div className="sepay-field-item highlighted">
                        <div className="sepay-field-meta">
                          <small>Số tiền cần chuyển</small>
                          <strong className="sepay-val-amount">{formatCurrency(amount)}</strong>
                        </div>
                        <button
                          type="button"
                          className="sepay-copy-btn active"
                          onClick={() => copyToClipboard(amount, 'amount')}
                        >
                          {copiedField === 'amount' ? 'Đã chép' : <><Copy size={13} /> Sao chép</>}
                        </button>
                      </div>

                      {/* Nội dung chuyển khoản */}
                      <div className="sepay-field-item highlighted sepay-memo-box">
                        <div className="sepay-field-meta">
                          <small>Nội dung chuyển khoản (Bắt buộc giữ nguyên)</small>
                          <strong className="sepay-val-memo">{booking.code}</strong>
                        </div>
                        <button
                          type="button"
                          className="sepay-copy-btn active"
                          onClick={() => copyToClipboard(booking.code, 'memo')}
                        >
                          {copiedField === 'memo' ? 'Đã chép' : <><Copy size={13} /> Sao chép</>}
                        </button>
                      </div>
                    </div>

                    <div className="sepay-security-callout">
                      <ShieldCheck size={16} strokeWidth={2} color="#10b981" />
                      <span>
                        Hệ thống đối soát SePay tự động khớp lệnh ngay khi tài khoản nhận được tiền. Không cần chụp màn hình chuyển khoản.
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
