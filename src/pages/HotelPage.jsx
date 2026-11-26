// src/pages/HotelPage.jsx — Trang tìm kiếm & danh sách khách sạn
import { useContext, useEffect, useMemo, useState } from 'react'
import { Building2, Navigation } from 'lucide-react'
import { CatalogCtx } from '../data/CatalogContext.js'
import {
  calculateDistanceKm,
  getHotelCoords,
} from '../data/constants.js'
import {
  EmptyResult,
  FilterPanel,
  HotelCard,
  InteractiveMapModal,
  PageHero,
  SearchSummary,
  SkeletonList,
} from '../components/SharedUI.jsx'

const BASE_SORT_OPTIONS = [
  { id: 'popular', label: 'Phổ biến nhất' },
  { id: 'price-asc', label: 'Giá thấp nhất' },
  { id: 'price-desc', label: 'Giá cao nhất' },
  { id: 'rating-desc', label: 'Đánh giá cao nhất' },
]

export function HotelPage({ onChoose, onOpenReviews, filters, setFilters, search, onClearSearch }) {
  const { catalog, catalogStatus } = useContext(CatalogCtx)
  const [sortBy, setSortBy] = useState('popular')
  const [isMapModalOpen, setIsMapModalOpen] = useState(false)
  const keyword = (search?.keyword || '').trim().toLowerCase()

  // Tự động chuyển xếp theo khoảng cách khi người dùng bật vị trí trực tiếp
  useEffect(() => {
    if (filters.userLocation && sortBy === 'popular') {
      const timer = setTimeout(() => setSortBy('distance-asc'), 0)
      return () => clearTimeout(timer)
    }
  }, [filters.userLocation, sortBy])

  // Gắn khoảng cách thực tế (km) theo GPS vị trí người dùng
  const hotelsWithDistance = useMemo(() => {
    const loc = filters.userLocation
    return catalog.hotels.map((hotel) => {
      if (!loc) return hotel
      const coords = getHotelCoords(hotel)
      const dist = calculateDistanceKm(loc.lat, loc.lng, coords.lat, coords.lng)
      return { ...hotel, distanceKm: dist }
    })
  }, [catalog.hotels, filters.userLocation])

  // Danh sách tùy chọn sắp xếp: tự động bổ sung "Gần tôi nhất" khi có tọa độ
  const sortOptions = useMemo(() => {
    const list = [...BASE_SORT_OPTIONS]
    if (filters.userLocation) {
      list.unshift({ id: 'distance-asc', label: '📍 Gần tôi nhất' })
    }
    return list
  }, [filters.userLocation])

  const filteredHotels = useMemo(() => {
    const base = hotelsWithDistance.filter((hotel) => (
      hotel.price <= filters.maxPrice
      && (!filters.promoOnly || hotel.hasPromo || hotel.promo)
      && (!filters.freeCancel || (hotel.perks || []).includes('Miễn phí hủy'))
      && (!filters.highRating || hotel.rating >= 8.5)
      && (!filters.central || (hotel.perks || []).includes('Trung tâm') || hotel.location.includes('Trung tâm'))
      && (!keyword || `${hotel.name} ${hotel.location}`.toLowerCase().includes(keyword))
    ))

    const sorted = [...base]
    if (sortBy === 'distance-asc') {
      sorted.sort((a, b) => (a.distanceKm ?? 999999) - (b.distanceKm ?? 999999))
    } else if (sortBy === 'price-asc') {
      sorted.sort((a, b) => a.price - b.price)
    } else if (sortBy === 'price-desc') {
      sorted.sort((a, b) => b.price - a.price)
    } else if (sortBy === 'rating-desc') {
      sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    }
    return sorted
  }, [hotelsWithDistance, filters, keyword, sortBy])

  return (
    <section className="page container man-hotel-page">
      <nav className="man-breadcrumb" aria-label="Breadcrumb">
        <span>Trang chủ</span>
        <span className="man-breadcrumb-sep">/</span>
        <span>Khách sạn Việt Nam</span>
        <span className="man-breadcrumb-sep">/</span>
        <strong>{search?.keyword ? `Khách sạn tại ${search.keyword}` : 'Tất cả khách sạn ưu đãi'}</strong>
      </nav>

      <PageHero
        icon={<Building2 size={28} strokeWidth={1.8} />}
        title="Khách sạn và resort nổi bật"
        text="Chọn phòng nghỉ dưỡng chất lượng, xem tiện ích, đánh giá thực tế từ khách lưu trú và đặt chỗ trực tuyến tại Mây An Nhiên."
      />
      <SearchSummary search={search} onClear={onClearSearch} />

      <div className="content-layout man-hotel-content-layout">
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          onOpenMapModal={() => setIsMapModalOpen(true)}
          hotels={hotelsWithDistance}
        />

        <div className="man-hotel-results-col">
          <div className="man-sort-bar">
            <div className="man-sort-count">
              <strong>Tìm thấy {filteredHotels.length} nơi lưu trú phù hợp tại Mây An Nhiên</strong>
              <div className="man-sort-subrow">
                <small>Giá hiển thị đã bao gồm thuế & phí dịch vụ</small>
                {filters.userLocation && (
                  <span className="man-sort-loc-pill">
                    <Navigation size={12} strokeWidth={2} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    Vị trí của bạn: <b>{filters.userLocation.cityName}</b> ({filters.userLocation.isLiveGPS ? 'GPS' : 'Thủ công'})
                  </span>
                )}
              </div>
            </div>
            <div className="man-sort-controls">
              <span className="man-sort-label">Xếp theo:</span>
              <div className="man-sort-pills" role="group" aria-label="Sắp xếp khách sạn">
                {sortOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`man-sort-pill ${sortBy === opt.id ? 'active' : ''}`}
                    onClick={() => setSortBy(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="man-hotel-stack">
            {catalogStatus === 'loading' ? (
              <SkeletonList count={3} />
            ) : filteredHotels.length > 0 ? (
              filteredHotels.map((hotel) => (
                <HotelCard
                  key={hotel.id}
                  hotel={hotel}
                  onChoose={onChoose}
                  onOpenReviews={onOpenReviews}
                  chooseLabel="Chọn phòng"
                />
              ))
            ) : (
              <EmptyResult text="Không có khách sạn phù hợp. Hãy thử từ khóa khác hoặc gỡ bộ lọc." />
            )}
          </div>
        </div>
      </div>

      {/* Modal bản đồ khám phá khách sạn toàn màn hình */}
      <InteractiveMapModal
        isOpen={isMapModalOpen}
        onClose={() => setIsMapModalOpen(false)}
        hotels={hotelsWithDistance}
        userLocation={filters.userLocation}
        onChooseHotel={onChoose}
      />
    </section>
  )
}

export default HotelPage
