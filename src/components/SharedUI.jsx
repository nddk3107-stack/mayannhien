// src/components/SharedUI.jsx — Các thành phần giao diện dùng chung (Card, Filter, Loader, Hero)
import React, { useMemo, useState } from 'react'
import {
  ArrowRight,
  Building2,
  Check,
  Coffee,
  Crosshair,
  ExternalLink,
  Globe,
  Loader2,
  Map,
  MapPin,
  MessageSquare,
  Navigation,
  Plane,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tag,
  Wifi,
  X,
} from 'lucide-react'
import {
  formatCurrency,
  formatDistance,
  calculateDistanceKm,
  findNearestCity,
  getHotelCoords,
  VIETNAM_CITIES,
} from '../data/constants.js'

export function PageHero({ icon, title, text }) {
  const IconComp =
    typeof icon === 'function' ||
    (typeof icon === 'object' && icon !== null && !React.isValidElement(icon))
      ? icon
      : null

  return (
    <div className="page-hero">
      <span>{IconComp ? <IconComp size={28} strokeWidth={1.8} /> : icon}</span>
      <div>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </div>
  )
}

export function FilterPanel({ filters, setFilters, onOpenMapModal, hotels = [] }) {
  const [isLocating, setIsLocating] = useState(false)
  const [geoError, setGeoError] = useState(null)

  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }))
  const resetFilters = () => setFilters((current) => ({
    promoOnly: false,
    freeCancel: false,
    highRating: false,
    central: false,
    maxPrice: 5000000,
    userLocation: current.userLocation,
  }))

  const handleGetLocation = () => {
    if (typeof window === 'undefined' || !navigator?.geolocation) {
      setGeoError('Trình duyệt không hỗ trợ Geolocation.')
      return
    }
    setIsLocating(true)
    setGeoError(null)

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false)
        const { latitude, longitude, accuracy } = position.coords
        const nearest = findNearestCity(latitude, longitude)
        setFilters((current) => ({
          ...current,
          userLocation: {
            lat: latitude,
            lng: longitude,
            accuracy: Math.round(accuracy || 0),
            cityName: nearest?.shortName || nearest?.name || 'Vị trí hiện tại',
            isLiveGPS: true,
            timestamp: Date.now(),
          },
        }))
      },
      (err) => {
        setIsLocating(false)
        let msg = 'Không thể xác định vị trí GPS tự động.'
        if (err.code === 1) msg = 'Trình duyệt từ chối quyền truy cập vị trí.'
        else if (err.code === 2) msg = 'Không tìm thấy tín hiệu vị trí GPS.'
        else if (err.code === 3) msg = 'Quá thời gian kết nối GPS.'
        setGeoError(msg)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    )
  }

  const selectQuickCity = (cityKey) => {
    const city = VIETNAM_CITIES.find((c) => c.key === cityKey || c.name === cityKey || c.shortName === cityKey)
    if (city) {
      setFilters((current) => ({
        ...current,
        userLocation: {
          lat: city.lat,
          lng: city.lng,
          accuracy: 50,
          cityName: city.shortName || city.name,
          isLiveGPS: false,
          timestamp: Date.now(),
        },
      }))
      setGeoError(null)
    }
  }

  const clearUserLocation = () => {
    setFilters((current) => ({
      ...current,
      userLocation: null,
    }))
    setGeoError(null)
  }

  const userLocation = filters.userLocation
  const closestHotel = useMemo(() => {
    if (!userLocation || !Array.isArray(hotels) || hotels.length === 0) return null
    let minD = Infinity
    let closest = null
    for (const h of hotels) {
      const coords = getHotelCoords(h)
      const dist = calculateDistanceKm(userLocation.lat, userLocation.lng, coords.lat, coords.lng)
      if (dist != null && dist < minD) {
        minD = dist
        closest = { ...h, distanceKm: dist }
      }
    }
    return closest
  }, [userLocation, hotels])

  return (
    <aside className="filter-panel man-filter-sidebar">
      <div className="man-minimap-card">
        <div
          className="man-minimap-art"
          role="button"
          tabIndex={0}
          onClick={onOpenMapModal}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onOpenMapModal?.()}
          title="Bấm để mở bản đồ tương tác toàn màn hình"
          style={{ cursor: onOpenMapModal ? 'pointer' : 'default' }}
        >
          <svg viewBox="0 0 240 100" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
            <rect width="240" height="100" fill="#dbeafe" />
            <path d="M0,30 Q80,10 150,45 T240,25" fill="none" stroke="#93c5fd" strokeWidth="8" />
            <path d="M20,0 L70,100 M140,0 L110,100 M195,0 L215,100 M0,68 L240,58" stroke="#ffffff" strokeWidth="3.5" />
            <circle cx="88" cy="44" r="7" fill="#0194f3" stroke="#ffffff" strokeWidth="2" />
            <circle cx="152" cy="56" r="7" fill="#ff5e1f" stroke="#ffffff" strokeWidth="2" />
            <circle cx="122" cy="28" r="6" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />

            {/* Radar pin vị trí người dùng khi đã kích hoạt GPS */}
            {userLocation && (
              <g className="man-user-map-pin">
                <circle cx="105" cy="48" r="16" fill="rgba(16, 185, 129, 0.28)" className="man-gps-pulse-ring" />
                <circle cx="105" cy="48" r="7" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />
                <circle cx="105" cy="48" r="2.5" fill="#ffffff" />
              </g>
            )}
          </svg>
          <span className="man-minimap-badge">
            <Map size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Khám phá trên bản đồ khu vực
          </span>
        </div>

        {/* Nút Lấy vị trí trực tiếp theo GPS người dùng */}
        <div className="man-geo-action-box">
          <button
            type="button"
            className={`man-geolocation-btn ${userLocation ? 'active' : ''} ${isLocating ? 'loading' : ''}`}
            onClick={handleGetLocation}
            disabled={isLocating}
            title="Lấy vị trí GPS thực tế để tìm khách sạn gần bạn nhất"
          >
            {isLocating ? (
              <><Loader2 size={14} className="spin" style={{ verticalAlign: 'middle', marginRight: 6 }} /> Đang định vị GPS...</>
            ) : userLocation ? (
              <><Crosshair size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Cập nhật lại GPS trực tiếp</>
            ) : (
              <><Crosshair size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Lấy vị trí trực tiếp</>
            )}
          </button>
          <a
            href="https://www.google.com/maps/@10.8593152,106.7843584,14z?hl=vi&entry=ttu"
            target="_blank"
            rel="noopener noreferrer"
            className="man-gmaps-link-btn"
            title="Mở Google Maps trực tiếp tại Thủ Đức (10.8593152, 106.7843584)"
          >
            <ExternalLink size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 5 }} />
            Mở trên Google Maps (10.8593°B, 106.7844°Đ)
          </a>
        </div>

        {/* Hiển thị chi tiết vị trí GPS khi đã có dữ liệu */}
        {userLocation && (
          <div className="man-user-location-info">
            <div className="man-location-header">
              <div className="man-location-status">
                <span className="man-live-dot" />
                <strong>{userLocation.isLiveGPS ? 'GPS Trực tiếp' : 'Vị trí đã chọn'}: {userLocation.cityName}</strong>
              </div>
              <button
                type="button"
                className="man-clear-loc-btn"
                onClick={clearUserLocation}
                title="Tắt vị trí"
                aria-label="Tắt vị trí"
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>
            <div className="man-location-coords">
              <span>{userLocation.lat.toFixed(4)}°B, {userLocation.lng.toFixed(4)}°Đ</span>
              {userLocation.accuracy ? <small>±{userLocation.accuracy}m</small> : null}
            </div>
            {closestHotel && (
              <div className="man-closest-hotel-tag">
                Gần nhất: <b>{closestHotel.name}</b> ({formatDistance(closestHotel.distanceKm)})
              </div>
            )}
          </div>
        )}

        {/* Gợi ý chọn nhanh khi trình duyệt không cho lấy GPS */}
        {geoError && (
          <div className="man-geo-fallback-box">
            <p className="man-geo-err-text">{geoError}</p>
            <span className="man-geo-fallback-label">Chọn nhanh vị trí của bạn:</span>
            <div className="man-city-quick-pills">
              {VIETNAM_CITIES.slice(0, 6).map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => selectQuickCity(c.key)}
                  className="man-city-pill"
                >
                  {c.shortName}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          className={`man-minimap-toggle-btn ${filters.central ? 'active' : ''}`}
          onClick={() => update('central', !filters.central)}
        >
          {filters.central ? (
            <><Check size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Đang lọc khu vực trung tâm</>
          ) : (
            <><MapPin size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Lọc khu vực trung tâm</>
          )}
        </button>
      </div>

      <div className="man-filter-head">
        <h3>
          <SlidersHorizontal size={16} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Bộ lọc tìm kiếm
        </h3>
        <button type="button" className="man-filter-reset-btn" onClick={resetFilters}>
          <RotateCcw size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Đặt lại
        </button>
      </div>

      <div className="man-filter-group">
        <h4>Khoảng giá mỗi đêm</h4>
        <div className="range-box man-range-box">
          <div className="man-range-labels">
            <span>500.000 ₫</span>
            <strong>Tối đa: {formatCurrency(filters.maxPrice)}</strong>
          </div>
          <input
            type="range"
            min="500000"
            max="5000000"
            step="100000"
            value={filters.maxPrice}
            onChange={(event) => update('maxPrice', Number(event.target.value))}
          />
        </div>
      </div>

      <div className="man-filter-group">
        <h4>Ưu đãi & Chính sách</h4>
        <label className="man-filter-check">
          <input
            type="checkbox"
            checked={filters.promoOnly}
            onChange={(event) => update('promoOnly', event.target.checked)}
          />
          <span><Tag size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Đang có khuyến mãi đặc biệt</span>
        </label>
        <label className="man-filter-check">
          <input
            type="checkbox"
            checked={filters.freeCancel}
            onChange={(event) => update('freeCancel', event.target.checked)}
          />
          <span><Check size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Miễn phí hủy phòng</span>
        </label>
      </div>

      <div className="man-filter-group">
        <h4>Điểm đánh giá & Vị trí</h4>
        <label className="man-filter-check">
          <input
            type="checkbox"
            checked={filters.highRating}
            onChange={(event) => update('highRating', event.target.checked)}
          />
          <span><Star size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Điểm đánh giá từ 8.5+ trở lên</span>
        </label>
        <label className="man-filter-check">
          <input
            type="checkbox"
            checked={filters.central}
            onChange={(event) => update('central', event.target.checked)}
          />
          <span><Building2 size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Gần trung tâm thành phố</span>
        </label>
      </div>
    </aside>
  )
}

export function EmptyResult({ text }) {
  return (
    <div className="empty-result">
      <strong>Không tìm thấy kết quả</strong>
      <p>{text}</p>
    </div>
  )
}

export function FlightCard({ flight, onChoose }) {
  const originalPrice = Math.round((flight.price * 1.18) / 10000) * 10000

  return (
    <article className="flight-card man-flight-card">
      <div className="airline-logo">{flight.logo || <Plane size={18} strokeWidth={1.8} />}</div>
      <div className="flight-main">
        <div className="flight-top">
          <h3>{flight.airline}</h3>
          <span className="flight-tag-badge">{flight.tag}</span>
        </div>
        <div className="route-row">
          <div><b>{flight.depart}</b><small>{flight.from}</small></div>
          <div className="route-line"><span>{flight.duration}</span></div>
          <div><b>{flight.arrive}</b><small>{flight.to}</small></div>
        </div>
      </div>
      <div className="price-box">
        <span className="flight-original-price">{formatCurrency(originalPrice)}</span>
        <strong className="flight-final-price">{formatCurrency(flight.price)}</strong>
        <small>/khách · Đã gồm thuế phí</small>
        <button type="button" className="pay-cta-btn" onClick={() => onChoose(flight)}>Chọn vé</button>
      </div>
    </article>
  )
}

export function HotelCard({ hotel, onChoose, onOpenReviews, chooseLabel = 'Chọn phòng' }) {
  const originalPrice = Math.round(hotel.price * 1.22)
  const hasPromoFlag = Boolean(hotel.promo || hotel.hasPromo)
  const starsCount = Math.max(1, Math.min(5, Number(hotel.stars) || 4))
  const extraPerks = Array.isArray(hotel.perks) ? hotel.perks : []

  return (
    <article className="hotel-card man-horizontal-hotel-card">
      {/* Left Zone: Media */}
      <div className="man-hotel-media" style={{ backgroundImage: hotel.image }}>
        <span className="man-media-loc-badge">
          <MapPin size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> {hotel.location}
        </span>
        {hasPromoFlag && (
          <span className="man-media-discount-ribbon">
            <Tag size={12} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Tiết kiệm 25%
          </span>
        )}
        <span className="man-media-curated-badge">
          <Sparkles size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Mây An Nhiên Tuyển Chọn
        </span>
      </div>

      {/* Middle Zone: Property Info */}
      <div className="man-hotel-info">
        <div className="man-hotel-type-row">
          <span className="man-hotel-type-chip">
            <Building2 size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Khách sạn & Resort
          </span>
          <span className="man-hotel-stars" aria-label={`${starsCount} sao`} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
            {Array.from({ length: starsCount }).map((_, idx) => (
              <Star key={idx} size={13} strokeWidth={1.8} fill="currentColor" />
            ))}
          </span>
          {hotel.distanceKm != null && (
            <span className="man-hotel-dist-chip" title="Khoảng cách tính theo vị trí trực tiếp của bạn">
              <Navigation size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 3 }} />
              Cách bạn {formatDistance(hotel.distanceKm)}
            </span>
          )}
        </div>

        <h3 className="man-hotel-title">{hotel.name}</h3>
        <p className="man-hotel-address">
          <MapPin size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          {hotel.location} {hotel.distanceKm != null ? `· Cách bạn ${formatDistance(hotel.distanceKm)}` : '· Gần điểm tham quan trung tâm'}
        </p>

        <div className="man-hotel-rating-row">
          <span className="man-score-badge">
            <b>{hotel.rating || '9.0'}</b>
            <small>/10</small>
          </span>
          <span className="man-score-sentiment">
            {(hotel.rating || 9) >= 9 ? 'Tuyệt hảo' : 'Ấn tượng'}
          </span>
          {onOpenReviews && (
            <button
              type="button"
              className="man-review-btn"
              onClick={() => onOpenReviews(hotel)}
            >
              <MessageSquare size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Xem đánh giá
            </button>
          )}
        </div>

        <div className="man-hotel-perks">
          <span className="man-perk-chip highlight">
            <Check size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Miễn phí hủy phòng
          </span>
          <span className="man-perk-chip">
            <Coffee size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Bữa sáng tự chọn
          </span>
          <span className="man-perk-chip">
            <Wifi size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Wi-Fi tốc độ cao
          </span>
          {hotel.note && <span className="man-perk-chip">{hotel.note}</span>}
          {extraPerks.map((perk) => (
            <span key={perk} className="man-perk-chip">{perk}</span>
          ))}
        </div>
      </div>

      {/* Right Zone: Price & CTA Column */}
      <div className="man-hotel-cta-col">
        <div className="man-hotel-price-group">
          <span className="man-price-caption">Giá mỗi đêm từ</span>
          <span className="man-price-old">{formatCurrency(originalPrice)}</span>
          <strong className="man-price-now">{formatCurrency(hotel.price)}</strong>
          <span className="man-price-tax-note">
            <Check size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Đã gồm thuế & phí
          </span>
        </div>
        <button
          type="button"
          className="man-choose-room-btn pay-cta-btn"
          onClick={() => onChoose(hotel)}
        >
          {chooseLabel}
        </button>
      </div>
    </article>
  )
}

export function SearchSummary({ search, onClear }) {
  if (!search) return null
  const dateText = search.tripType === 'Một chiều'
    ? search.dates.depart
    : (
      <>
        {search.dates.depart} <ArrowRight size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle' }} /> {search.dates.ret}
      </>
    )

  return (
    <div className="search-summary">
      <div>
        <b>Kết quả cho "{search.keyword}"</b>
        <span>{search.tripType} · {dateText} · {search.passengers} khách</span>
      </div>
      <button type="button" onClick={onClear}>Xóa bộ tìm kiếm</button>
    </div>
  )
}

export function ResultsCount({ count, unit }) {
  return <p className="results-count">{count} {unit} phù hợp với yêu cầu của bạn</p>
}

export function SkeletonList({ count = 3, label = 'Đang tải dữ liệu...' }) {
  return (
    <div className="skeleton-wrap" aria-hidden="true">
      {Array.from({ length: count }).map((_, index) => (
        <div className="skeleton-block" key={index} />
      ))}
      <p className="skeleton-label">{label}</p>
    </div>
  )
}

export function InteractiveMapModal({
  isOpen,
  onClose,
  hotels = [],
  userLocation,
  onChooseHotel,
  onGetLocation,
  isLocating,
}) {
  const [selectedHotelId, setSelectedHotelId] = useState(hotels[0]?.id || 'hotel-1')
  const [mapFilter, setMapFilter] = useState('all')
  const [mapSource, setMapSource] = useState('gmaps')
  const [customCenter, setCustomCenter] = useState(null)

  const DEFAULT_GMAPS = { lat: 10.8593152, lng: 106.7843584, name: 'TP. Thủ Đức (10.8593°B, 106.7844°Đ)' }

  React.useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const filteredMapHotels = hotels.filter((h) => {
    if (mapFilter === 'central') return (h.perks || []).includes('Trung tâm') || (h.location || '').includes('Trung tâm')
    if (mapFilter === '5star') return Number(h.stars) >= 5
    if (mapFilter === 'near' && userLocation) return (h.distanceKm ?? 9999) <= 50
    return true
  })

  const selectedHotel = hotels.find((h) => h.id === selectedHotelId) || hotels[0] || null

  // Geocoding projection on 650x500 viewport
  // Vietnam bbox: minLat = 9.5, maxLat = 22.8, minLng = 103.0, maxLng = 109.8
  const getSvgCoords = (lat, lng) => {
    const y = 460 - ((lat - 9.5) / (22.8 - 9.5)) * 390
    const x = 70 + ((lng - 103.0) / (109.8 - 103.0)) * 490
    return {
      x: Math.max(50, Math.min(600, Math.round(x))),
      y: Math.max(40, Math.min(480, Math.round(y))),
    }
  }

  const userSvg = userLocation ? getSvgCoords(userLocation.lat, userLocation.lng) : null
  const selectedCoords = selectedHotel ? getHotelCoords(selectedHotel) : null
  const selectedSvg = selectedCoords ? getSvgCoords(selectedCoords.lat, selectedCoords.lng) : null

  return (
    <div className="login-overlay man-map-modal-overlay" onClick={onClose} role="presentation">
      <div
        className="login-modal man-map-modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Bản đồ khám phá khách sạn trực tiếp"
      >
        {/* Modal Header */}
        <div className="man-map-modal-header">
          <div className="man-map-modal-title">
            <span className="man-map-title-icon"><Map size={22} strokeWidth={1.8} /></span>
            <div>
              <h3>Bản đồ khách sạn & Vị trí trực tiếp</h3>
              <p>Khám phá hệ thống điểm nghỉ dưỡng Mây An Nhiên theo khoảng cách địa lý thực tế</p>
            </div>
          </div>
          <div className="man-map-modal-actions">
            {onGetLocation && (
              <button
                type="button"
                className={`man-map-locate-btn ${userLocation ? 'active' : ''} ${isLocating ? 'loading' : ''}`}
                onClick={onGetLocation}
                disabled={isLocating}
                title="Định vị GPS trực tiếp của bạn"
              >
                {isLocating ? (
                  <><Loader2 size={14} className="spin" style={{ verticalAlign: 'middle', marginRight: 5 }} /> Đang định vị...</>
                ) : userLocation ? (
                  <><Crosshair size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Đã định vị: {userLocation.cityName}</>
                ) : (
                  <><Crosshair size={14} style={{ verticalAlign: 'middle', marginRight: 5 }} /> Lấy vị trí của tôi</>
                )}
              </button>
            )}
            <button
              type="button"
              className="login-close man-map-close-btn"
              onClick={onClose}
              aria-label="Đóng bản đồ"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Filter Pills & Map Source Switcher Toolbar */}
        <div className="man-map-toolbar">
          <div className="man-map-mode-switch">
            <button
              type="button"
              className={`man-source-btn ${mapSource === 'gmaps' ? 'active' : ''}`}
              onClick={() => setMapSource('gmaps')}
            >
              <Globe size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 5 }} />
              Google Maps trực tiếp
            </button>
            <button
              type="button"
              className={`man-source-btn ${mapSource === 'svg' ? 'active' : ''}`}
              onClick={() => setMapSource('svg')}
            >
              <Map size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 5 }} />
              Bản đồ minh hoạ khu vực
            </button>
          </div>

          <div className="man-map-pills">
            <button
              type="button"
              className={`man-map-pill ${mapFilter === 'all' ? 'active' : ''}`}
              onClick={() => setMapFilter('all')}
            >
              Tất cả ({hotels.length})
            </button>
            {userLocation && (
              <button
                type="button"
                className={`man-map-pill ${mapFilter === 'near' ? 'active' : ''}`}
                onClick={() => setMapFilter('near')}
              >
                Gần tôi nhất (&lt; 50 km)
              </button>
            )}
            <button
              type="button"
              className={`man-map-pill ${mapFilter === 'central' ? 'active' : ''}`}
              onClick={() => setMapFilter('central')}
            >
              Khu vực trung tâm
            </button>
            <button
              type="button"
              className={`man-map-pill ${mapFilter === '5star' ? 'active' : ''}`}
              onClick={() => setMapFilter('5star')}
            >
              Resort & 5 sao
            </button>
          </div>

          {mapSource === 'gmaps' && (
            <div className="man-gmaps-quick-locations">
              <button
                type="button"
                className={`man-loc-jump-btn ${customCenter?.lat === DEFAULT_GMAPS.lat ? 'active' : ''}`}
                onClick={() => setCustomCenter(DEFAULT_GMAPS)}
                title="Xem bản đồ Thủ Đức (10.8593152, 106.7843584)"
              >
                📍 Thủ Đức (10.8593, 106.7844)
              </button>
              {userLocation && (
                <button
                  type="button"
                  className={`man-loc-jump-btn ${customCenter?.lat === userLocation.lat ? 'active' : ''}`}
                  onClick={() => setCustomCenter({ lat: userLocation.lat, lng: userLocation.lng, name: userLocation.cityName })}
                >
                  📍 GPS của tôi ({userLocation.cityName})
                </button>
              )}
              {selectedHotel && (
                <button
                  type="button"
                  className={`man-loc-jump-btn ${customCenter === null ? 'active' : ''}`}
                  onClick={() => setCustomCenter(null)}
                >
                  🏨 {selectedHotel.name}
                </button>
              )}
            </div>
          )}

          {userLocation && mapSource === 'svg' && (
            <div className="man-map-gps-status">
              <span className="man-live-dot" />
              <span>{userLocation.isLiveGPS ? 'GPS Trực tiếp' : 'Vị trí đã chọn'}: <b>{userLocation.cityName}</b> ({userLocation.lat.toFixed(2)}°B, {userLocation.lng.toFixed(2)}°Đ)</span>
            </div>
          )}
        </div>

        {/* Map Viewport: Google Maps or Interactive SVG */}
        {mapSource === 'gmaps' ? (
          <div className="man-map-gmaps-viewport">
            {(() => {
              const currentCoords = customCenter || (selectedCoords ? { lat: selectedCoords.lat, lng: selectedCoords.lng, name: selectedHotel.name } : (userLocation ? { lat: userLocation.lat, lng: userLocation.lng, name: userLocation.cityName } : DEFAULT_GMAPS))
              return (
                <>
                  <iframe
                    title="Bản đồ Google Maps trực tiếp"
                    src={`https://maps.google.com/maps?q=${currentCoords.lat},${currentCoords.lng}&z=14&output=embed&hl=vi`}
                    width="100%"
                    height="100%"
                    style={{ border: 0, width: '100%', height: '480px' }}
                    allowFullScreen=""
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                  <div className="man-gmaps-floating-bar">
                    <span className="man-gmaps-coords-label">
                      <Globe size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                      Đang xem: <b>{currentCoords.name || `${currentCoords.lat.toFixed(4)}°B, ${currentCoords.lng.toFixed(4)}°Đ`}</b>
                    </span>
                    <a
                      href={`https://www.google.com/maps/@${currentCoords.lat},${currentCoords.lng},14z?hl=vi`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="man-gmaps-ext-pill"
                    >
                      <ExternalLink size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                      Mở trong Google Maps tab mới
                    </a>
                  </div>
                </>
              )
            })()}
          </div>
        ) : (
          <div className="man-map-viewport">
          <svg viewBox="0 0 650 500" width="100%" height="100%" className="man-map-svg" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="oceanGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0b1b36" />
                <stop offset="100%" stopColor="#071326" />
              </linearGradient>
              <pattern id="mapGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255, 255, 255, 0.04)" strokeWidth="1" />
              </pattern>
            </defs>

            {/* Ocean & grid background */}
            <rect width="650" height="500" fill="url(#oceanGrad)" />
            <rect width="650" height="500" fill="url(#mapGrid)" />

            {/* Stylized Vietnam coast land outline */}
            <path
              d="M 120 70 Q 180 60 250 100 Q 320 105 340 120 Q 360 140 380 180 Q 420 240 430 270 Q 450 330 490 360 Q 460 380 430 380 Q 370 400 320 410 Q 260 420 200 440 Q 150 450 120 430 Q 100 410 120 390 Q 170 370 230 360 Q 310 330 320 280 Q 330 220 300 170 Q 270 140 210 120 Q 140 100 120 70 Z"
              fill="rgba(30, 58, 102, 0.45)"
              stroke="rgba(56, 189, 248, 0.35)"
              strokeWidth="2"
            />

            {/* Geographic Sea Labels */}
            <text x="500" y="240" fill="rgba(148, 163, 184, 0.35)" fontSize="15" fontWeight="700" letterSpacing="4">BIỂN ĐÔNG</text>
            <text x="360" y="80" fill="rgba(148, 163, 184, 0.25)" fontSize="12" letterSpacing="2">VỊNH BẮC BỘ</text>
            <text x="90" y="460" fill="rgba(148, 163, 184, 0.25)" fontSize="11" letterSpacing="2">VỊNH THÁI LAN</text>

            {/* Islands */}
            <g opacity="0.6">
              <circle cx="560" cy="220" r="4" fill="#38bdf8" />
              <circle cx="570" cy="235" r="3" fill="#38bdf8" />
              <text x="560" y="208" fill="rgba(148, 163, 184, 0.5)" fontSize="10" textAnchor="middle">QĐ. Hoàng Sa (VN)</text>
              <circle cx="530" cy="390" r="4" fill="#38bdf8" />
              <circle cx="545" cy="405" r="3" fill="#38bdf8" />
              <text x="530" y="378" fill="rgba(148, 163, 184, 0.5)" fontSize="10" textAnchor="middle">QĐ. Trường Sa (VN)</text>
            </g>

            {/* Connecting distance line from User GPS to Selected Hotel */}
            {userSvg && selectedSvg && (
              <g className="man-map-dist-connector">
                <line
                  x1={userSvg.x}
                  y1={userSvg.y}
                  x2={selectedSvg.x}
                  y2={selectedSvg.y}
                  stroke="#10b981"
                  strokeWidth="2"
                  strokeDasharray="5 4"
                  opacity="0.8"
                />
                <g transform={`translate(${(userSvg.x + selectedSvg.x) / 2}, ${(userSvg.y + selectedSvg.y) / 2})`}>
                  <rect x="-42" y="-12" width="84" height="24" rx="12" fill="rgba(15, 23, 42, 0.92)" stroke="#10b981" strokeWidth="1" />
                  <text x="0" y="4" textAnchor="middle" fill="#6ee7b7" fontSize="11" fontWeight="700">
                    {formatDistance(selectedHotel?.distanceKm)}
                  </text>
                </g>
              </g>
            )}

            {/* Hotel Pins */}
            {filteredMapHotels.map((h) => {
              const coords = getHotelCoords(h)
              const pt = getSvgCoords(coords.lat, coords.lng)
              const isSelected = selectedHotel?.id === h.id
              const priceText = `${Math.round(h.price / 1000)}K ₫`

              return (
                <g
                  key={h.id}
                  className={`man-map-pin-group ${isSelected ? 'selected' : ''}`}
                  transform={`translate(${pt.x}, ${pt.y})`}
                  onClick={() => setSelectedHotelId(h.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Selected halo */}
                  {isSelected && (
                    <circle cx="0" cy="0" r="24" fill="rgba(1, 148, 243, 0.25)" className="man-pin-halo" />
                  )}

                  {/* Price Tag Pill above pin */}
                  <g transform="translate(0, -22)">
                    <rect
                      x={-priceText.length * 4.4 - 10}
                      y="-12"
                      width={priceText.length * 8.8 + 20}
                      height="22"
                      rx="11"
                      fill={isSelected ? '#0194f3' : '#1e293b'}
                      stroke={isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.25)'}
                      strokeWidth={isSelected ? '2' : '1'}
                    />
                    <text
                      x="0"
                      y="3.5"
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="11"
                      fontWeight="700"
                    >
                      {priceText}
                    </text>
                  </g>

                  {/* Marker Pin */}
                  <circle cx="0" cy="0" r="9" fill={isSelected ? '#ff5e1f' : '#0194f3'} stroke="#ffffff" strokeWidth="2.5" />
                  <circle cx="0" cy="0" r="3.5" fill="#ffffff" />
                </g>
              )
            })}

            {/* User Live GPS Marker */}
            {userSvg && (
              <g className="man-map-user-pin" transform={`translate(${userSvg.x}, ${userSvg.y})`}>
                <circle cx="0" cy="0" r="26" fill="rgba(16, 185, 129, 0.22)" className="man-gps-pulse-ring" />
                <circle cx="0" cy="0" r="14" fill="rgba(16, 185, 129, 0.4)" />
                <circle cx="0" cy="0" r="8" fill="#10b981" stroke="#ffffff" strokeWidth="2.5" />
                <circle cx="0" cy="0" r="3" fill="#ffffff" />
                <g transform="translate(0, 20)">
                  <rect x="-56" y="-10" width="112" height="20" rx="10" fill="rgba(15, 23, 42, 0.9)" stroke="#10b981" strokeWidth="1" />
                  <text x="0" y="4" textAnchor="middle" fill="#10b981" fontSize="10.5" fontWeight="700">
                    📍 Bạn đang ở đây
                  </text>
                </g>
              </g>
            )}
          </svg>
        </div>
        )}

        {/* Selected Hotel Preview Dock */}
        {selectedHotel && (
          <div className="man-map-hotel-dock">
            <div className="man-dock-thumb" style={{ backgroundImage: selectedHotel.image }} />
            <div className="man-dock-content">
              <div className="man-dock-header">
                <div>
                  <h4 className="man-dock-title">{selectedHotel.name}</h4>
                  <p className="man-dock-loc">
                    <MapPin size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {selectedHotel.location}
                    {selectedHotel.distanceKm != null && (
                      <span className="man-dock-dist">
                        <Navigation size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginLeft: 8, marginRight: 3 }} />
                        Cách bạn {formatDistance(selectedHotel.distanceKm)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="man-dock-score">
                  <span className="man-score-badge">
                    <b>{selectedHotel.rating || '9.0'}</b>
                    <small>/10</small>
                  </span>
                  <small>{(selectedHotel.rating || 9) >= 9 ? 'Tuyệt hảo' : 'Ấn tượng'}</small>
                </div>
              </div>
            </div>
            <div className="man-dock-cta">
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedHotel.name + ' ' + selectedHotel.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="man-dock-gmaps-btn"
                title="Xem vị trí khách sạn trên Google Maps"
              >
                <ExternalLink size={13} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                Google Maps
              </a>
              <div className="man-dock-price">
                <small>Giá từ</small>
                <strong>{formatCurrency(selectedHotel.price)}</strong>
                <span>/đêm</span>
              </div>
              <button
                type="button"
                className="pay-cta-btn man-dock-btn"
                onClick={() => {
                  onClose()
                  onChooseHotel?.(selectedHotel)
                }}
              >
                Chọn phòng ngay <ArrowRight size={14} strokeWidth={2} style={{ verticalAlign: 'middle', marginLeft: 4 }} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
