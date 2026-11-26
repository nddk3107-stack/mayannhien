import React, { useState } from 'react'
import {
  Armchair,
  ArrowLeft,
  Bath,
  BedDouble,
  Building2,
  Check,
  Coffee,
  KeyRound,
  Lock,
  Refrigerator,
  ShowerHead,
  Snowflake,
  Sofa,
  Sparkles,
  Star,
  Tv,
  Wifi,
  Wind,
} from 'lucide-react'
import { formatCurrency, groupAmenities } from '../data/constants.js'
import { SkeletonList } from '../components/SharedUI.jsx'
import HotelReviews from '../components/HotelReviews.jsx'

function renderGroupIcon(groupName) {
  if (/giường|nội thất/i.test(groupName)) return <BedDouble size={16} strokeWidth={1.8} />
  if (/thiết bị/i.test(groupName)) return <Snowflake size={16} strokeWidth={1.8} />
  if (/phòng tắm/i.test(groupName)) return <ShowerHead size={16} strokeWidth={1.8} />
  if (/kết nối/i.test(groupName)) return <Wifi size={16} strokeWidth={1.8} />
  return <KeyRound size={16} strokeWidth={1.8} />
}

function renderAmenityIcon(name) {
  if (/wi-?fi/i.test(name)) return <Wifi size={14} strokeWidth={1.8} />
  if (/điều hòa/i.test(name)) return <Snowflake size={14} strokeWidth={1.8} />
  if (/^tv|tv /i.test(name)) return <Tv size={14} strokeWidth={1.8} />
  if (/giường/i.test(name)) return <BedDouble size={14} strokeWidth={1.8} />
  if (/vòi hoa sen/i.test(name)) return <ShowerHead size={14} strokeWidth={1.8} />
  if (/bồn tắm/i.test(name)) return <Bath size={14} strokeWidth={1.8} />
  if (/khăn|áo choàng/i.test(name)) return <Sparkles size={14} strokeWidth={1.8} />
  if (/két/i.test(name)) return <Lock size={14} strokeWidth={1.8} />
  if (/ấm đun/i.test(name)) return <Coffee size={14} strokeWidth={1.8} />
  if (/tủ lạnh|minibar/i.test(name)) return <Refrigerator size={14} strokeWidth={1.8} />
  if (/máy sấy/i.test(name)) return <Wind size={14} strokeWidth={1.8} />
  if (/bàn làm việc/i.test(name)) return <Armchair size={14} strokeWidth={1.8} />
  if (/phòng khách/i.test(name)) return <Sofa size={14} strokeWidth={1.8} />
  return <Check size={14} strokeWidth={1.8} />
}

// Ảnh phòng có dự phòng: ảnh hỏng/không có -> placeholder gradient của khách sạn (không vỡ ảnh).
export function RoomImage({ src, fallback, alt, className = '' }) {
  const [failed, setFailed] = useState(!src)
  if (failed || !src) {
    return (
      <div className={`room-img-fallback ${className}`} style={{ backgroundImage: fallback }} role="img" aria-label={alt || 'ảnh phòng'}>
        <span><Building2 size={28} strokeWidth={1.8} /></span>
      </div>
    )
  }
  return <img className={className} src={src} alt={alt || ''} loading="lazy" onError={() => setFailed(true)} />
}

// Thư viện ảnh phòng: ảnh lớn + thumbnail chọn được (1 ảnh -> chỉ ảnh lớn).
export function RoomGallery({ hotel, room }) {
  const images = Array.isArray(room?.images) ? room.images.filter(Boolean) : []
  const [active, setActive] = useState(0)
  if (images.length === 0) {
    return <RoomImage fallback={hotel?.image} alt={room?.name} className="room-gallery-main" />
  }
  return (
    <div className="room-gallery">
      <RoomImage src={images[Math.min(active, images.length - 1)]} fallback={hotel?.image} alt={room?.name} className="room-gallery-main" />
      {images.length > 1 && (
        <div className="room-gallery-thumbs">
          {images.map((img, index) => (
            <button key={img} type="button" className={index === active ? 'active' : ''} onClick={() => setActive(index)} aria-label={`Ảnh ${index + 1}`}>
              <RoomImage src={img} alt={`${room.name} ${index + 1}`} className="room-thumb-img" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// "Phòng có gì?" — nhóm icon theo dữ liệu tiện nghi của từng phòng.
export function AmenityGroups({ amenities }) {
  const groups = groupAmenities(amenities)
  if (groups.length === 0) {
    return <p className="muted">Loại phòng này chưa có thông tin tiện nghi chi tiết.</p>
  }
  return (
    <div className="amenity-groups">
      {groups.map((group) => (
        <div key={group.name} className="amenity-group">
          <h4 style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {renderGroupIcon(group.name)} {group.name}
          </h4>
          <ul>
            {group.items.map((item) => (
              <li key={item}>
                <span className="amenity-ic">{renderAmenityIcon(item)}</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// Trang chọn phòng: danh sách phòng của khách sạn đã chọn
export default function RoomsPage({ hotel, rooms, loading, session, onBack, onPick }) {
  if (!hotel) {
    return (
      <section className="page container rooms-page">
        <div className="empty-bookings">
          <span><BedDouble size={36} strokeWidth={1.8} /></span>
          <h2>Bạn chưa chọn khách sạn</h2>
          <p>Hãy chọn một khách sạn để xem danh sách phòng còn trống.</p>
          <div className="empty-actions">
            <button onClick={onBack}>Xem khách sạn</button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="page container rooms-page">
      <nav className="man-breadcrumb" aria-label="Breadcrumb">
        <button type="button" className="man-breadcrumb-link" onClick={onBack}>Khách sạn</button>
        <span className="man-breadcrumb-sep">/</span>
        <span>{hotel.name}</span>
        <span className="man-breadcrumb-sep">/</span>
        <strong>Chọn hạng phòng</strong>
      </nav>

      <div className="rooms-head">
        <button className="back-btn" onClick={onBack}>
          <ArrowLeft size={16} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Xem tất cả khách sạn
        </button>
        <div className="hotel-strip" style={{ backgroundImage: hotel.image }}>
          <div className="hotel-strip-info">
            <span className="hotel-strip-stars" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              {Array.from({ length: Number(hotel.stars) || 4 }).map((_, idx) => (
                <Star key={idx} size={14} strokeWidth={1.8} fill="currentColor" />
              ))}
            </span>
            <h1>{hotel.name}</h1>
            <p>{hotel.location} · Đánh giá <b>{hotel.rating}</b>/10</p>
          </div>
        </div>

        <div className="man-stay-guarantee-bar">
          <span><Check size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Xác nhận tức thì</span>
          <span className="man-guarantee-dot">·</span>
          <span><Check size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Bảo đảm giá tốt nhất từ Mây An Nhiên</span>
          <span className="man-guarantee-dot">·</span>
          <span><Check size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Hỗ trợ 24/7</span>
        </div>

        <h2 className="rooms-title">Chọn phòng lưu trú</h2>
      </div>

      <div className="room-list">
        {loading ? (
          <SkeletonList count={2} label="Đang tải danh sách phòng..." />
        ) : rooms.length === 0 ? (
          <div className="empty-result">
            <strong>Chưa có phòng nào</strong>
            <p>Khách sạn này chưa có thông tin phòng. Vui lòng chọn khách sạn khác hoặc thử lại sau.</p>
          </div>
        ) : (
          rooms.map((room) => (
            <article key={room.id} className="room-card">
              <RoomImage src={room.images?.[0]} fallback={hotel.image} alt={room.name} className="room-card-img" />
              <div className="room-card-body">
                <div className="room-card-head">
                  <div>
                    <h3>{room.name}</h3>
                    <p className="room-beds">
                      <BedDouble size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {room.bedType}{room.sizeSqm ? ` · ${room.sizeSqm} m²` : ''}
                    </p>
                  </div>
                  <div className="room-card-badges">
                    {room.breakfast && <span className="badge ok">Ăn sáng</span>}
                    {room.freeCancellation && <span className="badge ok">Hoàn hủy</span>}
                  </div>
                </div>
                <p className="room-capacity">
                  Tối đa {room.maxAdults} người lớn{room.maxChildren > 0 ? ` + ${room.maxChildren} trẻ em` : ''} · Nhận từ {room.checkinTime} · Trả trước {room.checkoutTime}
                </p>
                <ul className="room-amenity-chips">
                  {(room.amenities || []).slice(0, 6).map((item) => (
                    <li key={item} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {renderAmenityIcon(item)} {item}
                    </li>
                  ))}
                  {(room.amenities || []).length > 6 && <li className="more">+{room.amenities.length - 6} tiện nghi</li>}
                </ul>
                <div className="room-card-bottom">
                  <div className="room-price">
                    <small>Giá mỗi đêm</small>
                    <strong>{formatCurrency(room.price)}</strong>
                  </div>
                  <button className="pick-room-btn" onClick={() => onPick(hotel, room)}>Đặt phòng</button>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      <HotelReviews hotelId={hotel.id} session={session} />
    </section>
  )
}
