// src/pages/StaffScannerPage.jsx — Công cụ Webcam QR Check-in cho Lễ tân.
import { useState, useEffect, useRef } from 'react'
import {
  AlertTriangle,
  Camera,
  CameraOff,
  CheckCircle2,
  ImageUp,
  Lock,
  QrCode,
  ReceiptText,
  RefreshCw,
  User,
  XCircle,
} from 'lucide-react'
import { Html5Qrcode } from 'html5-qrcode'
import { apiFetch } from '../services/api.js'
import { useRealtime } from '../realtime/RealtimeContext.jsx'

export function StaffScannerPage({ session, onNavigate }) {
  const isAuthorized = Boolean(session && (session.role === 'staff' || session.role === 'admin'))

  const [manualCode, setManualCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [recentCheckins, setRecentCheckins] = useState([])
  const [cameraError, setCameraError] = useState('')
  const [cameraActive, setCameraActive] = useState(false)
  const [startingCamera, setStartingCamera] = useState(false)
  const [cameras, setCameras] = useState([])
  const [selectedCameraId, setSelectedCameraId] = useState('')
  const html5QrRef = useRef(null)
  const fileInputRef = useRef(null)
  const lastScannedRef = useRef({ text: '', time: 0 })
  const { status, subscribe } = useRealtime()
  const isConnected = status === 'connected'

  const loadRecentCheckins = async () => {
    if (!isAuthorized) return
    try {
      const res = await apiFetch('/api/staff/checkin/recent')
      if (res.ok && Array.isArray(res.data?.checkins)) {
        setRecentCheckins(res.data.checkins)
      }
    } catch (err) {
      console.error('[scanner] Không thể tải lịch sử check-in:', err)
    }
  }

  useEffect(() => {
    if (!isAuthorized) return
    loadRecentCheckins()
    if (!subscribe) return
    const unsub = subscribe('booking:checked_in', () => {
      loadRecentCheckins()
    })
    return () => unsub?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized, subscribe])

  const stopCamera = async () => {
    if (html5QrRef.current) {
      try {
        if (html5QrRef.current.isScanning) {
          await html5QrRef.current.stop()
        }
        await html5QrRef.current.clear()
      } catch {
        // ignore stop errors
      }
    }
    setCameraActive(false)
  }

  const startCamera = async (preferredCameraId = selectedCameraId) => {
    setCameraError('')
    setStartingCamera(true)
    try {
      await stopCamera()
      const elem = document.getElementById('qr-reader')
      if (!elem) return

      const devices = await Html5Qrcode.getCameras()
      if (!devices || devices.length === 0) {
        setCameraError('Không tìm thấy thiết bị Camera / Webcam trên máy. Bạn có thể bấm "Quét từ file ảnh QR" hoặc nhập mã đặt chỗ bên dưới.')
        setStartingCamera(false)
        return
      }
      setCameras(devices)
      const camId = preferredCameraId || devices[devices.length - 1].id
      setSelectedCameraId(camId)

      const qr = new Html5Qrcode('qr-reader')
      html5QrRef.current = qr

      await qr.start(
        camId,
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          const now = Date.now()
          if (lastScannedRef.current.text === decodedText && now - lastScannedRef.current.time < 3500) {
            return
          }
          lastScannedRef.current = { text: decodedText, time: now }
          handleVerify({ qrData: decodedText })
        },
        () => {}
      )
      setCameraActive(true)
    } catch (err) {
      const msg = String(err?.message || err || '')
      if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('notallowed')) {
        setCameraError('Trình duyệt đã chặn quyền truy cập Camera. Vui lòng bấm biểu tượng ổ khóa trên thanh địa chỉ Cốc Cốc -> Cho phép Camera, hoặc chọn "Quét từ file ảnh QR".')
      } else {
        setCameraError('Không thể mở Camera trực tiếp trên thiết bị này. Bạn có thể chọn "Quét từ file ảnh QR" hoặc nhập mã đơn bên dưới.')
      }
    } finally {
      setStartingCamera(false)
    }
  }

  const handleScanImageFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCameraError('')
    try {
      await stopCamera()
      const qr = new Html5Qrcode('qr-reader')
      html5QrRef.current = qr
      const decodedText = await qr.scanFile(file, true)
      handleVerify({ qrData: decodedText })
    } catch {
      setCameraError('Không nhận diện được mã QR trong ảnh đã chọn. Vui lòng chọn ảnh rõ nét hơn hoặc nhập mã đặt chỗ thủ công.')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  useEffect(() => {
    if (!isAuthorized) return
    const timer = setTimeout(() => {
      startCamera()
    }, 300)
    return () => {
      clearTimeout(timer)
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthorized])

  const handleVerify = async (payload) => {
    setLoading(true)
    setResult(null)
    try {
      const res = await apiFetch('/api/staff/checkin/verify', {
        method: 'POST',
        body: payload,
      })

      if (res.ok) {
        setResult({
          success: true,
          message: res.data?.message || 'Check-in thành công!',
          booking: res.data?.booking,
        })
        setManualCode('')
        loadRecentCheckins()
      } else {
        setResult({
          success: false,
          error: res.data?.error || 'Xác thực check-in thất bại.',
          alreadyCheckedIn: res.data?.alreadyCheckedIn,
          checkedInAt: res.data?.checkedInAt,
          checkedInBy: res.data?.checkedInBy,
        })
      }
    } catch {
      setResult({
        success: false,
        error: 'Lỗi mạng hoặc máy chủ không phản hồi.',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleManualSubmit = (e) => {
    e.preventDefault()
    const trimmed = manualCode.trim()
    if (!trimmed) return
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      handleVerify({ qrData: trimmed })
    } else {
      handleVerify({ bookingCode: trimmed })
    }
  }

  // Phân quyền: Chỉ staff hoặc admin mới được truy cập
  if (!isAuthorized) {
    return (
      <div className="container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ maxWidth: '500px', margin: '0 auto', background: 'var(--bg-surface)', padding: '36px', borderRadius: '16px', boxShadow: '0 8px 30px rgba(0,0,0,0.08)' }}>
          <div style={{ marginBottom: '16px', color: 'var(--brand-primary)' }}>
            <Lock size={44} strokeWidth={1.8} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>Khu vực hạn chế quyền truy cập</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px' }}>
            Trang này chỉ dành riêng cho <b>Lễ tân (Staff)</b> hoặc <b>Quản trị viên (Admin)</b> của Mây An Nhiên để thực hiện nghiệp vụ đón tiếp và quét vé điện tử Check-in.
          </p>
          <button
            type="button"
            className="register-btn"
            onClick={() => onNavigate('home')}
            style={{ width: '100%', padding: '12px', borderRadius: '8px', cursor: 'pointer' }}
          >
            Quay về Trang chủ
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ padding: '30px 20px', maxWidth: '1200px' }}>
      {/* Header Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', margin: '0 0 6px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <QrCode size={26} strokeWidth={1.8} /> Cổng Check-in & Quét Mã QR Lễ Tân
          </h1>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.95rem' }}>
            Xác thực vé điện tử E-Ticket HMAC SHA-256 theo thời gian thực và cập nhật trạng thái nhận phòng / lên máy bay.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#10b981' : '#f59e0b' }}></span>
            <span>{isConnected ? 'Real-Time đã kết nối' : 'Đang đồng bộ...'}</span>
          </div>
          <div style={{ background: 'var(--bg-elevated)', color: 'var(--brand-primary)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.88rem', fontWeight: 600, border: '1px solid var(--border)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <User size={14} strokeWidth={1.8} /> {session.name || session.email} ({session.role.toUpperCase()})
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        {/* Left Column: Scanner & Manual Input */}
        <div>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '14px' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Camera size={20} strokeWidth={1.8} /> Camera quét mã QR
              </h2>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {cameraActive ? (
                  <button
                    type="button"
                    onClick={stopCamera}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: '1px solid #ef4444',
                      background: 'rgba(239, 68, 68, 0.12)',
                      color: '#ef4444',
                      fontWeight: 600,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                    }}
                  >
                    <CameraOff size={15} /> Tắt Camera
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={startingCamera}
                    onClick={() => startCamera()}
                    className="register-btn"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontWeight: 600,
                      fontSize: '0.88rem',
                      cursor: 'pointer',
                    }}
                  >
                    <RefreshCw size={15} /> {startingCamera ? 'Đang mở Camera...' : 'Bật Camera quét'}
                  </button>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleScanImageFile}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-elevated)',
                    color: 'var(--text-primary)',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                  }}
                >
                  <ImageUp size={15} /> Quét từ ảnh QR
                </button>
              </div>
            </div>

            {cameras.length > 1 && (
              <div style={{ marginBottom: '12px' }}>
                <select
                  value={selectedCameraId}
                  onChange={(e) => {
                    const nextId = e.target.value
                    setSelectedCameraId(nextId)
                    startCamera(nextId)
                  }}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                  }}
                >
                  {cameras.map((cam, idx) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label || `Camera ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {cameraError && (
              <div style={{ padding: '12px', background: 'rgba(245,158,11,0.18)', color: 'var(--text-primary)', borderRadius: '8px', fontSize: '0.88rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} /> <span>{cameraError}</span>
              </div>
            )}

            <div
              id="qr-reader"
              style={{
                width: '100%',
                maxWidth: '420px',
                margin: '0 auto',
                minHeight: '260px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px dashed var(--border-default)',
                background: 'var(--bg-elevated)',
              }}
            ></div>

            <div style={{ borderTop: '1px solid var(--border-default)', marginTop: '20px', paddingTop: '20px' }}>
              <h3 style={{ fontSize: '1rem', margin: '0 0 10px 0' }}>Hoặc nhập mã đặt chỗ thủ công:</h3>
              <form onSubmit={handleManualSubmit} style={{ display: 'flex', gap: '10px' }}>
                <input
                  id="manual-booking-code"
                  type="text"
                  placeholder="Ví dụ: MAN1234567"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '1rem',
                    textTransform: 'uppercase',
                  }}
                  disabled={loading}
                />
                <button
                  type="submit"
                  disabled={loading || !manualCode.trim()}
                  className="register-btn"
                  style={{
                    padding: '12px 20px',
                    borderRadius: '8px',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {loading ? 'Đang duyệt...' : 'Check-in'}
                </button>
              </form>
            </div>
          </div>

          {/* Result Banner */}
          {result && (
            <div
              className="checkin-result-card"
              style={{
                borderRadius: '16px',
                padding: '20px',
                border: result.success ? '2px solid #10b981' : '2px solid #ef4444',
                background: result.success ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                marginBottom: '24px',
              }}
            >
              {result.success ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'color-mix(in srgb, #10b981 55%, var(--text-primary))', marginBottom: '12px' }}>
                    <CheckCircle2 size={26} strokeWidth={1.8} />
                    <h3 style={{ margin: 0, fontSize: '1.3rem' }}>{result.message}</h3>
                  </div>
                  {result.booking && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.95rem' }}>
                      <div><b>Mã đơn:</b> <span style={{ color: 'var(--brand-primary)', fontWeight: 600 }}>{result.booking.code}</span></div>
                      <div><b>Khách hàng:</b> {result.booking.travelerName}</div>
                      <div><b>Dịch vụ:</b> {result.booking.title}</div>
                      <div><b>Tổng tiền:</b> {new Intl.NumberFormat('vi-VN').format(result.booking.total)}₫</div>
                      {result.booking.roomName && <div><b>Phòng:</b> {result.booking.roomName}</div>}
                      {result.booking.seatCode && <div><b>Ghế:</b> {result.booking.seatCode}</div>}
                      <div style={{ gridColumn: 'span 2' }}>
                        <b>Thời gian check-in:</b> {new Date(result.booking.checkedInAt).toLocaleString('vi-VN')}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'color-mix(in srgb, #ef4444 55%, var(--text-primary))', marginBottom: '10px' }}>
                    <XCircle size={26} strokeWidth={1.8} />
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>Check-in không thành công</h3>
                  </div>
                  <p style={{ margin: '0 0 8px 0', color: 'color-mix(in srgb, #ef4444 55%, var(--text-primary))', fontWeight: 600 }}>{result.error}</p>
                  {result.alreadyCheckedIn && (
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '10px', borderRadius: '8px' }}>
                      Đơn này đã được xác nhận check-in trước đó vào lúc {result.checkedInAt ? new Date(result.checkedInAt).toLocaleString('vi-VN') : '—'} bởi nhân viên {result.checkedInBy || 'hệ thống'}.
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Today's Check-in History */}
        <div>
          <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ReceiptText size={20} strokeWidth={1.8} /> Lịch sử Check-in hôm nay
              </h2>
              <span style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 600 }}>
                {recentCheckins.length} lượt
              </span>
            </div>

            {recentCheckins.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                Chưa có lượt check-in nào trong ngày hôm nay.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', maxHeight: '560px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-default)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '10px 8px' }}>Mã đơn</th>
                      <th style={{ padding: '10px 8px' }}>Khách hàng</th>
                      <th style={{ padding: '10px 8px' }}>Dịch vụ</th>
                      <th style={{ padding: '10px 8px' }}>Giờ</th>
                      <th style={{ padding: '10px 8px' }}>Lễ tân</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCheckins.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                        <td style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--brand-primary)' }}>{item.code}</td>
                        <td style={{ padding: '10px 8px' }}>
                          <div>{item.travelerName}</div>
                          {item.travelerPhone && <small style={{ color: 'var(--text-muted)' }}>{item.travelerPhone}</small>}
                        </td>
                        <td style={{ padding: '10px 8px' }}>
                          <div>{item.title}</div>
                          {item.roomName && <small style={{ color: 'color-mix(in srgb, #10b981 55%, var(--text-primary))', display: 'block' }}>Phòng: {item.roomName}</small>}
                          {item.seatCode && <small style={{ color: 'color-mix(in srgb, #10b981 55%, var(--text-primary))', display: 'block' }}>Ghế: {item.seatCode}</small>}
                        </td>
                        <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                          {item.checkedInAt ? new Date(item.checkedInAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '—'}
                        </td>
                        <td style={{ padding: '10px 8px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {item.checkedInBy ? item.checkedInBy.split('@')[0] : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default StaffScannerPage

