import React, { useState } from 'react'
import {
  Cloud,
  FileDown,
  Loader2,
  ReceiptText,
  QrCode,
} from 'lucide-react'
import { formatCurrency } from '../data/constants.js'
import { PageHero } from '../components/SharedUI.jsx'
import { API_BASE } from '../services/api.js'

export default function BookingsPage({ bookings, onCancel, onExplore, notify, onOpenSepay }) {
  const [downloadingCode, setDownloadingCode] = useState(null)

  const handleDownloadEticket = async (booking) => {
    try {
      setDownloadingCode(booking.code)
      const res = await fetch(`${API_BASE}/api/bookings/${booking.id}/eticket`, {
        headers: {
          'X-Requested-With': 'fetch',
        },
        credentials: 'same-origin',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Không thể tải vé điện tử.')
      }
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
      if (notify) notify(err.message || 'Lỗi khi tải vé điện tử.')
      else alert(err.message || 'Lỗi khi tải vé điện tử.')
    } finally {
      setDownloadingCode(null)
    }
  }

  return (
    <section className="page container bookings-page">
      <PageHero
        icon={<ReceiptText size={28} strokeWidth={1.8} />}
        title="Đặt chỗ của tôi"
        text="Theo dõi các đơn vé máy bay, khách sạn và combo đã đặt trên Mây An Nhiên."
      />
      {bookings.length === 0 ? (
        <div className="empty-bookings">
          <span><Cloud size={36} strokeWidth={1.8} /></span>
          <h2>Bạn chưa có đặt chỗ nào</h2>
          <p>Hãy chọn vé máy bay, khách sạn hoặc combo để bắt đầu chuyến đi an nhiên.</p>
          <button onClick={onExplore}>Khám phá dịch vụ</button>
        </div>
      ) : (
        <div className="booking-list">
          {bookings.map((booking) => (
            <article key={booking.code} className="booking-card">
              <div>
                <span className={`status-pill ${booking.status === 'Đã hủy' ? 'cancelled' : (booking.status === 'Đã thanh toán' || booking.payment_status === 'paid') ? 'paid' : booking.status === 'Chờ thanh toán' ? 'pending' : ''}`}>
                  {booking.status === 'checked_in' ? 'Đã check-in' : booking.status}
                </span>
                <h3>{booking.title}</h3>
                <p>{booking.serviceName} · {booking.passengers} khách · Mã {booking.code}</p>
                {booking.roomName && (
                  <p className="booking-room">
                    Phòng: {booking.roomName} · {booking.nights} đêm · {booking.roomsCount} phòng · {booking.adults} người lớn{booking.children > 0 ? `, ${booking.children} trẻ em` : ''}
                  </p>
                )}
                <p>Người đặt: {booking.traveler?.name} · {booking.traveler?.phone}</p>
                {booking.dates && (
                  <p className="booking-route">
                    Lịch trình: {booking.destination || '—'} · {booking.dates.depart}
                    {booking.tripType !== 'Một chiều' && booking.dates.ret ? ` - ${booking.dates.ret}` : ''} · {booking.tripType || ''}
                  </p>
                )}
                <small>Ngày tạo: {booking.createdAt} · Mã ưu đãi: {booking.promo}{booking.paymentMethod ? ` · Thanh toán: ${booking.paymentMethod}` : ''}</small>
              </div>
              <div className="booking-actions">
                <strong>{formatCurrency(booking.total)}</strong>
                {booking.status !== 'Đã hủy' && (booking.payment_status !== 'paid' && booking.status !== 'Đã thanh toán') && (
                  <button
                    type="button"
                    className="sepay-pay-now-btn"
                    onClick={() => onOpenSepay?.(booking)}
                    title="Mở cổng thanh toán SePay VietQR"
                  >
                    <QrCode size={14} strokeWidth={2} /> Thanh toán VietQR
                  </button>
                )}
                {booking.status !== 'Đã hủy' && (
                  <a
                    role="button"
                    tabIndex={0}
                    className="eticket-btn"
                    style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
                    onClick={(e) => {
                      e.preventDefault()
                      if (!downloadingCode) handleDownloadEticket(booking)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        if (!downloadingCode) handleDownloadEticket(booking)
                      }
                    }}
                    title="Tải vé điện tử PDF kèm mã QR check-in"
                  >
                    {downloadingCode === booking.code ? (
                      <><Loader2 size={15} strokeWidth={1.8} /> Đang tạo PDF...</>
                    ) : (
                      <><FileDown size={15} strokeWidth={1.8} /> Vé điện tử (PDF)</>
                    )}
                  </a>
                )}
                <button disabled={booking.status === 'Đã hủy'} onClick={() => onCancel(booking.code)}>
                  {booking.status === 'Đã hủy' ? 'Đã hủy' : 'Hủy đặt chỗ'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
