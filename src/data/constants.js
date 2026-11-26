// src/data/constants.js — Hằng số dữ liệu và tiện ích định dạng dùng chung
import { createElement } from 'react'
import {
  Plane,
  Building2,
  Gift,
  FerrisWheel,
  CarTaxiFront,
  Bus,
  TrainFront,
  ShieldCheck,
  BedDouble,
  Snowflake,
  ShowerHead,
  Wifi,
  KeyRound,
  Tv,
  Bath,
  Shirt,
  Lock,
  Coffee,
  Refrigerator,
  Wind,
  Armchair,
  Sofa,
  Check,
} from 'lucide-react'

const ic = (Comp, size = 16) => createElement(Comp, { size, strokeWidth: 1.8 })

export const formatCurrency = (value) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)

export const services = [
  { id: 'flight', icon: ic(Plane, 20), label: 'Vé máy bay' },
  { id: 'hotel', icon: ic(Building2, 20), label: 'Khách sạn' },
  { id: 'combo', icon: ic(Gift, 20), label: 'Combo tiết kiệm' },
  { id: 'activity', icon: ic(FerrisWheel, 20), label: 'Vui chơi' },
  { id: 'car', icon: ic(CarTaxiFront, 20), label: 'Đưa đón sân bay' },
  { id: 'bus', icon: ic(Bus, 20), label: 'Xe khách' },
  { id: 'train', icon: ic(TrainFront, 20), label: 'Tàu hỏa' },
  { id: 'insurance', icon: ic(ShieldCheck, 20), label: 'Bảo hiểm' },
]

export const navItems = [
  { id: 'home', label: 'Trang chủ' },
  { id: 'flight', label: 'Vé máy bay' },
  { id: 'hotel', label: 'Khách sạn' },
  { id: 'combo', label: 'Combo' },
  { id: 'bookings', label: 'Đặt chỗ của tôi' },
]

export const flights = [
  {
    id: 'VN-184',
    airline: 'Vietnam Airlines',
    logo: 'VN',
    from: 'TP.HCM',
    to: 'Đà Nẵng',
    depart: '07:30',
    arrive: '08:50',
    duration: '1h 20m',
    price: 1290000,
    tag: 'Bay thẳng',
    hasPromo: true,
  },
  {
    id: 'VJ-642',
    airline: 'Vietjet Air',
    logo: 'VJ',
    from: 'TP.HCM',
    to: 'Hà Nội',
    depart: '10:15',
    arrive: '12:25',
    duration: '2h 10m',
    price: 1690000,
    tag: 'Giá tốt',
    hasPromo: true,
  },
  {
    id: 'QH-202',
    airline: 'Bamboo Airways',
    logo: 'QH',
    from: 'Hà Nội',
    to: 'Phú Quốc',
    depart: '14:40',
    arrive: '16:55',
    duration: '2h 15m',
    price: 1990000,
    tag: 'Có hành lý',
    hasPromo: false,
  },
  {
    id: 'VJ-321',
    airline: 'Vietjet Air',
    logo: 'VJ',
    from: 'TP.HCM',
    to: 'Phú Quốc',
    depart: '08:15',
    arrive: '09:20',
    duration: '1h 05m',
    price: 990000,
    tag: 'Giá tốt',
    hasPromo: true,
  },
  {
    id: 'VN-156',
    airline: 'Vietnam Airlines',
    logo: 'VN',
    from: 'TP.HCM',
    to: 'Đà Lạt',
    depart: '09:40',
    arrive: '10:35',
    duration: '55m',
    price: 1150000,
    tag: 'Bay thẳng',
    hasPromo: true,
  },
  {
    id: 'VN-118',
    airline: 'Vietnam Airlines',
    logo: 'VN',
    from: 'TP.HCM',
    to: 'Hạ Long',
    depart: '06:30',
    arrive: '08:45',
    duration: '2h 15m',
    price: 1350000,
    tag: 'Bay thẳng',
    hasPromo: true,
  },
  {
    id: 'VN-134',
    airline: 'Vietnam Airlines',
    logo: 'VN',
    from: 'TP.HCM',
    to: 'Nha Trang',
    depart: '11:20',
    arrive: '12:30',
    duration: '1h 10m',
    price: 1050000,
    tag: 'Bay thẳng',
    hasPromo: true,
  },
  {
    id: 'VN-215',
    airline: 'Vietnam Airlines',
    logo: 'VN',
    from: 'Hà Nội',
    to: 'TP.HCM',
    depart: '17:00',
    arrive: '19:15',
    duration: '2h 15m',
    price: 1750000,
    tag: 'Chuyến chiều',
    hasPromo: false,
  },
]

export const hotels = [
  {
    id: 'hotel-1',
    name: 'Marina Bay Đà Nẵng Resort',
    location: 'Biển Mỹ Khê, Đà Nẵng',
    city: 'Đà Nẵng',
    lat: 16.0592,
    lng: 108.2435,
    rating: 9.2,
    stars: 5,
    price: 1850000,
    hasPromo: true,
    image: 'linear-gradient(180deg, rgba(6,24,44,.05), rgba(6,24,44,.55)), url(https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1100&q=90)',
    perks: ['Sát biển', 'Bữa sáng', 'Hồ bơi'],
  },
  {
    id: 'hotel-2',
    name: 'Sapa Cloud Boutique Hotel',
    location: 'Trung tâm Sa Pa',
    city: 'Sa Pa',
    lat: 22.3352,
    lng: 103.8412,
    rating: 8.9,
    stars: 4,
    price: 990000,
    hasPromo: false,
    image: 'linear-gradient(180deg, rgba(6,24,44,.05), rgba(6,24,44,.58)), url(https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1100&q=90)',
    perks: ['View núi', 'Gần chợ', 'Miễn phí hủy'],
  },
  {
    id: 'hotel-3',
    name: 'Hanoi Old Quarter Stay',
    location: 'Phố cổ Hà Nội',
    city: 'Hà Nội',
    lat: 21.0333,
    lng: 105.8500,
    rating: 9.0,
    stars: 4,
    price: 1250000,
    hasPromo: true,
    image: 'linear-gradient(180deg, rgba(6,24,44,.05), rgba(6,24,44,.58)), url(https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1100&q=90)',
    perks: ['Trung tâm', 'Family room', 'Ăn sáng'],
  },
  {
    id: 'hotel-4',
    name: 'Vinpearl Resort & Spa Phú Quốc',
    location: 'Bãi Dài, Gành Dầu, Phú Quốc',
    city: 'Phú Quốc',
    lat: 10.3345,
    lng: 103.8567,
    rating: 9.5,
    stars: 5,
    price: 2150000,
    hasPromo: true,
    image: 'linear-gradient(180deg, rgba(6,24,44,.05), rgba(6,24,44,.55)), url(https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1100&q=90)',
    perks: ['Bãi biển riêng', 'VinWonders', 'Hồ bơi vô cực'],
  },
  {
    id: 'hotel-5',
    name: 'Dalat Edensee Lake Resort & Spa',
    location: 'Hồ Tuyền Lâm, Đà Lạt, Lâm Đồng',
    city: 'Đà Lạt',
    lat: 11.8972,
    lng: 108.4312,
    rating: 9.3,
    stars: 5,
    price: 1650000,
    hasPromo: true,
    image: 'linear-gradient(180deg, rgba(6,24,44,.05), rgba(6,24,44,.55)), url(https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1100&q=90)',
    perks: ['View hồ Tuyền Lâm', 'Spa cao cấp', 'Bữa sáng'],
  },
  {
    id: 'hotel-6',
    name: 'Vinpearl Resort & Spa Hạ Long',
    location: 'Đảo Rều, Bãi Cháy, TP. Hạ Long',
    city: 'Hạ Long',
    lat: 20.9482,
    lng: 107.0392,
    rating: 9.4,
    stars: 5,
    price: 1950000,
    hasPromo: true,
    image: 'linear-gradient(180deg, rgba(6,24,44,.05), rgba(6,24,44,.55)), url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1100&q=90)',
    perks: ['Biệt lập đảo Rều', 'View Vịnh 360°', 'Bể bơi 4 mùa'],
  },
  {
    id: 'hotel-7',
    name: 'InterContinental Nha Trang',
    location: '32-34 Trần Phú, Lộc Thọ, Nha Trang',
    city: 'Nha Trang',
    lat: 12.2465,
    lng: 109.1965,
    rating: 9.4,
    stars: 5,
    price: 2350000,
    hasPromo: false,
    image: 'linear-gradient(180deg, rgba(6,24,44,.05), rgba(6,24,44,.55)), url(https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1100&q=90)',
    perks: ['Mặt biển Trần Phú', 'Hồ bơi tràn viền', 'Club lounge'],
  },
  {
    id: 'hotel-8',
    name: 'Caravelle Saigon Hotel',
    location: '19-23 Lam Sơn Square, Bến Nghé, Quận 1, TP.HCM',
    city: 'TP.HCM',
    lat: 10.7766,
    lng: 106.7032,
    rating: 9.3,
    stars: 5,
    price: 2450000,
    hasPromo: true,
    image: 'linear-gradient(180deg, rgba(6,24,44,.05), rgba(6,24,44,.55)), url(https://images.unsplash.com/photo-1561501900-3701fa6a0864?auto=format&fit=crop&w=1100&q=90)',
    perks: ['Trung tâm Quận 1', 'Rooftop Bar', 'Di sản lịch sử'],
  },
]

export const HOTEL_LOCATIONS = {
  'hotel-1': { lat: 16.0592, lng: 108.2435, city: 'Đà Nẵng', district: 'Biển Mỹ Khê, Sơn Trà' },
  'hotel-2': { lat: 22.3352, lng: 103.8412, city: 'Sa Pa', district: 'Trung tâm Thị xã Sa Pa' },
  'hotel-3': { lat: 21.0333, lng: 105.8500, city: 'Hà Nội', district: 'Phố Cổ, Hoàn Kiếm' },
  'hotel-4': { lat: 10.3345, lng: 103.8567, city: 'Phú Quốc', district: 'Bãi Dài, Gành Dầu' },
  'hotel-5': { lat: 11.8972, lng: 108.4312, city: 'Đà Lạt', district: 'Hồ Tuyền Lâm' },
  'hotel-6': { lat: 20.9482, lng: 107.0392, city: 'Hạ Long', district: 'Bãi Cháy, Đảo Rều' },
  'hotel-7': { lat: 12.2465, lng: 109.1965, city: 'Nha Trang', district: 'Đường Trần Phú, Lộc Thọ' },
  'hotel-8': { lat: 10.7766, lng: 106.7032, city: 'TP.HCM', district: 'Lam Sơn Square, Quận 1' },
}

export const VIETNAM_CITIES = [
  { name: 'TP. Hồ Chí Minh', shortName: 'TP.HCM', lat: 10.7769, lng: 106.7009, key: 'hcm' },
  { name: 'Hà Nội', shortName: 'Hà Nội', lat: 21.0285, lng: 105.8542, key: 'hanoi' },
  { name: 'Đà Nẵng', shortName: 'Đà Nẵng', lat: 16.0544, lng: 108.2022, key: 'danang' },
  { name: 'Đà Lạt', shortName: 'Đà Lạt', lat: 11.9404, lng: 108.4583, key: 'dalat' },
  { name: 'Nha Trang', shortName: 'Nha Trang', lat: 12.2388, lng: 109.1967, key: 'nhatrang' },
  { name: 'Phú Quốc', shortName: 'Phú Quốc', lat: 10.2899, lng: 103.9840, key: 'phuquoc' },
  { name: 'Hạ Long', shortName: 'Hạ Long', lat: 20.9505, lng: 107.0734, key: 'halong' },
  { name: 'Sa Pa', shortName: 'Sa Pa', lat: 22.3364, lng: 103.8438, key: 'sapa' },
]

export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const numLat1 = Number(lat1)
  const numLon1 = Number(lon1)
  const numLat2 = Number(lat2)
  const numLon2 = Number(lon2)
  if (Number.isNaN(numLat1) || Number.isNaN(numLon1) || Number.isNaN(numLat2) || Number.isNaN(numLon2)) return null
  const R = 6371
  const dLat = (numLat2 - numLat1) * Math.PI / 180
  const dLon = (numLon2 - numLon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(numLat1 * Math.PI / 180) * Math.cos(numLat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return Math.round(R * c * 10) / 10
}

export function formatDistance(km) {
  if (km == null || Number.isNaN(Number(km))) return ''
  const val = Number(km)
  if (val < 1) return `${Math.round(val * 1000)} m`
  if (val < 20) return `${val.toFixed(1)} km`
  return `${Math.round(val)} km`
}

export function findNearestCity(lat, lng) {
  let nearest = VIETNAM_CITIES[0]
  let minDistance = Infinity
  for (const city of VIETNAM_CITIES) {
    const dist = calculateDistanceKm(lat, lng, city.lat, city.lng)
    if (dist != null && dist < minDistance) {
      minDistance = dist
      nearest = { ...city, distanceKm: dist }
    }
  }
  return nearest
}

export function getHotelCoords(hotel) {
  if (hotel?.lat != null && hotel?.lng != null) {
    return { lat: Number(hotel.lat), lng: Number(hotel.lng), city: hotel.city || '' }
  }
  const byId = HOTEL_LOCATIONS[hotel?.id]
  if (byId) return byId
  const loc = (hotel?.location || '').toLowerCase()
  if (loc.includes('đà nẵng')) return HOTEL_LOCATIONS['hotel-1']
  if (loc.includes('sa pa') || loc.includes('sapa')) return HOTEL_LOCATIONS['hotel-2']
  if (loc.includes('hà nội') || loc.includes('phố cổ')) return HOTEL_LOCATIONS['hotel-3']
  if (loc.includes('phú quốc')) return HOTEL_LOCATIONS['hotel-4']
  if (loc.includes('đà lạt')) return HOTEL_LOCATIONS['hotel-5']
  if (loc.includes('hạ long')) return HOTEL_LOCATIONS['hotel-6']
  if (loc.includes('nha trang')) return HOTEL_LOCATIONS['hotel-7']
  if (loc.includes('hcm') || loc.includes('sài gòn') || loc.includes('quận 1')) return HOTEL_LOCATIONS['hotel-8']
  return { lat: 16.0592, lng: 108.2435, city: 'Đà Nẵng' }
}

export const promos = [
  { id: 'p1', title: 'SALECUOITUAN', desc: 'Giảm thêm 12% cho khách sạn', color: 'blue' },
  { id: 'p2', title: 'BAYNGAY', desc: 'Mã vé máy bay nội địa từ 99K', color: 'orange' },
  { id: 'p3', title: 'COMBOHE', desc: 'Tiết kiệm đến 25% khi đặt combo', color: 'green' },
]

export const destinations = [
  ['Đà Nẵng', 'Biển xanh, resort đẹp', 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=80'],
  ['Phú Quốc', 'Thiên đường nghỉ dưỡng', 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80'],
  ['Đà Lạt', 'Không khí se lạnh', 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=900&q=80'],
  ['Bangkok', 'Ăn chơi mua sắm', 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=900&q=80'],
]

export const collections = [
  {
    title: 'Resort biển riêng tư',
    text: 'Không gian nghỉ dưỡng cao cấp, bữa sáng riêng và dịch vụ đưa đón tận nơi.',
    image: 'https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1100&q=90',
  },
  {
    title: 'City break cuối tuần',
    text: 'Khách sạn trung tâm, lịch trình ngắn ngày và ưu đãi linh hoạt.',
    image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1100&q=90',
  },
  {
    title: 'Retreat giữa thiên nhiên',
    text: 'Villa yên tĩnh, trải nghiệm wellness và không gian tái tạo năng lượng.',
    image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1100&q=90',
  },
]

export const toISO = (date) => date.toISOString().slice(0, 10)
export const defaultDepart = toISO(new Date(Date.now() + 7 * 86400000))
export const defaultReturn = toISO(new Date(Date.now() + 10 * 86400000))
export const todayISO = toISO(new Date())

export const KNOWN_PAGES = [
  'home', 'flight', 'hotel', 'combo',
  'activity', 'car', 'bus', 'train', 'insurance',
  'checkout', 'rooms', 'checkout-hotel', 'bookings', 'admin', 'profile',
  'staff/scanner', 'ai-planner',
]

export const pageFromHash = () => {
  const raw = window.location.hash.replace(/^#\/?/, '').trim().split('?')[0]
  if (!raw) return 'home'
  if (raw === 'admin' || raw.startsWith('admin/')) return 'admin'
  if (raw === 'staff/scanner' || raw.startsWith('staff/')) return 'staff/scanner'
  if (raw === 'ai-planner') return 'ai-planner'
  return KNOWN_PAGES.includes(raw) ? raw : 'notfound'
}

export const localRooms = hotels.flatMap((hotel) => hotel.id === 'hotel-1' ? [
  { id: 'room-hotel-1-1', hotelId: 'hotel-1', name: 'Phòng Deluxe Giáp Biển', price: 1850000, bedType: 'Giường king', sizeSqm: 35, maxAdults: 2, maxChildren: 1, breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00', amenities: ['Giường king', 'Điều hòa', 'TV màn hình phẳng', 'Tủ lạnh mini', 'Vòi hoa sen', 'Khăn tắm', 'Wi-Fi miễn phí', 'Két sắt'], images: [] },
  { id: 'room-hotel-1-2', hotelId: 'hotel-1', name: 'Phòng Suite View Biển', price: 2650000, bedType: 'Giường king + giường phụ', sizeSqm: 55, maxAdults: 3, maxChildren: 2, breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00', amenities: ['Giường king', 'Phòng khách riêng', 'Bồn tắm', 'Minibar', 'Wi-Fi miễn phí', 'Ấm đun nước'], images: [] },
] : hotel.id === 'hotel-2' ? [
  { id: 'room-hotel-2-1', hotelId: 'hotel-2', name: 'Phòng Standard View Núi', price: 990000, bedType: 'Giường queen', sizeSqm: 22, maxAdults: 2, maxChildren: 1, breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00', amenities: ['Giường queen', 'Điều hòa', 'TV', 'Vòi hoa sen', 'Wi-Fi miễn phí', 'Bàn làm việc'], images: [] },
  { id: 'room-hotel-2-2', hotelId: 'hotel-2', name: 'Phòng Family Giữa Mây', price: 1450000, bedType: '1 giường king + 1 giường đơn', sizeSqm: 35, maxAdults: 3, maxChildren: 2, breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00', amenities: ['Giường king + giường đơn', 'Tủ lạnh', 'Ấm đun nước', 'Két sắt', 'Wi-Fi miễn phí'], images: [] },
] : [
  { id: 'room-hotel-3-1', hotelId: 'hotel-3', name: 'Phòng Deluxe Phố Cổ', price: 1250000, bedType: 'Giường king', sizeSqm: 26, maxAdults: 2, maxChildren: 1, breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00', amenities: ['Giường king', 'Điều hòa', 'TV màn hình phẳng', 'Tủ lạnh', 'Vòi hoa sen', 'Wi-Fi miễn phí'], images: [] },
  { id: 'room-hotel-3-2', hotelId: 'hotel-3', name: 'Phòng Junior Suite Hồ Gươm', price: 1750000, bedType: 'Giường king', sizeSqm: 40, maxAdults: 3, maxChildren: 2, breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00', amenities: ['Phòng khách riêng', 'Bồn tắm', 'Minibar', 'Két sắt', 'Wi-Fi miễn phí', 'Áo choàng tắm'], images: [] },
])

export const ROOM_SEL_KEY = 'may-an-nhien-room-sel'
export const HOTEL_SEL_KEY = 'may-an-nhien-hotel-sel'
export const loadRoomSelection = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(ROOM_SEL_KEY))
    if (saved && typeof saved.hotelId === 'string' && typeof saved.roomId === 'string') return saved
  } catch { /* dữ liệu hỏng */ }
  return null
}
export const loadHotelSelection = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem(HOTEL_SEL_KEY))
    if (typeof saved === 'string' && saved) return saved
  } catch { /* dữ liệu hỏng */ }
  return null
}

export const nightsBetween = (start, end) => {
  const n = Math.round((Date.parse(end) - Date.parse(start)) / 86400000)
  return Number.isFinite(n) ? n : 0
}

export const AMENITY_GROUPS = [
  { name: 'Giường và nội thất', icon: ic(BedDouble, 16), test: [/giường/i, /bàn làm việc/i, /tủ quần áo/i, /phòng khách/i, /sofa/i] },
  { name: 'Thiết bị', icon: ic(Snowflake, 16), test: [/điều hòa/i, /^tv/i, /tv /i, /tivi/i, /tủ lạnh/i, /minibar/i, /máy sấy/i] },
  { name: 'Phòng tắm', icon: ic(ShowerHead, 16), test: [/vòi hoa sen/i, /bồn tắm/i, /khăn/i, /áo choàng/i, /đồ vệ sinh/i] },
  { name: 'Kết nối', icon: ic(Wifi, 16), test: [/wi-?fi/i, /internet/i] },
  { name: 'Tiện ích khác', icon: ic(KeyRound, 16), test: [/.*/] },
]

export const amenityIcon = (name) => {
  const rules = [
    [/wi-?fi/i, Wifi], [/điều hòa/i, Snowflake], [/^tv|tv /i, Tv], [/giường/i, BedDouble],
    [/vòi hoa sen/i, ShowerHead], [/bồn tắm/i, Bath], [/khăn|áo choàng/i, Shirt], [/két/i, Lock],
    [/ấm đun/i, Coffee], [/tủ lạnh|minibar/i, Refrigerator], [/máy sấy/i, Wind],
    [/bàn làm việc/i, Armchair], [/phòng khách/i, Sofa],
  ]
  for (const [re, Comp] of rules) if (re.test(name)) return ic(Comp, 15)
  return ic(Check, 15)
}

export const groupAmenities = (amenities) => {
  const buckets = AMENITY_GROUPS.map((group) => ({ ...group, items: [] }))
  for (const item of amenities || []) {
    const target = buckets.find((bucket) => bucket.test.some((re) => re.test(item)))
    ;(target || buckets[buckets.length - 1]).items.push(item)
  }
  return buckets.filter((bucket) => bucket.items.length > 0 && bucket.name !== 'Tiện ích khác')
    .concat(buckets.filter((bucket) => bucket.name === 'Tiện ích khác' && bucket.items.length > 0))
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
export const PHONE_RE = /^(0|\+84)\d{8,10}$/

export const SERVICE_LABELS = {
  flight: 'Vé máy bay',
  hotel: 'Khách sạn',
  combo: 'Combo du lịch',
  activity: 'Vui chơi & Trải nghiệm',
  car: 'Đưa đón sân bay',
  bus: 'Xe khách',
  train: 'Tàu hỏa',
  insurance: 'Bảo hiểm du lịch',
}

export const getServiceTypeOfItem = (item) => {
  if (!item) return 'flight'
  if (item.serviceType && SERVICE_LABELS[item.serviceType]) return item.serviceType
  if (item.airline) return 'flight'
  if (typeof item.id === 'string' && item.id.startsWith('combo')) return 'combo'
  return 'hotel'
}

export const getPromoRate = (promoItem, item) => {
  if (!promoItem || !item) return 0
  const isFlight = Boolean(item.airline)
  const isCombo = typeof item.id === 'string' && item.id.startsWith('combo')
  const service = isFlight ? 'flight' : isCombo ? 'combo' : 'hotel'
  if (Number.isFinite(promoItem.rate) && Array.isArray(promoItem.appliesTo)) {
    return promoItem.appliesTo.includes(service) ? promoItem.rate : 0
  }
  if (promoItem.id === 'p3') return isCombo ? 0.25 : 0
  if (promoItem.id === 'p2') return isFlight || isCombo ? 0.08 : 0
  return isFlight ? 0 : 0.12
}

export const bookingsKey = (email) => (email ? `may-an-nhien-bookings:${email}` : 'may-an-nhien-bookings')
export const syncedBookingsKey = (email) => (email ? `may-an-nhien-bookings:synced:${email}` : 'may-an-nhien-bookings:synced')
export const legacyImportedKey = (email) => `${bookingsKey(email)}:imported-v1`

export const loadBookings = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key))
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry) => entry && typeof entry === 'object' && typeof entry.code === 'string' && typeof entry.title === 'string')
      .map((entry) => ({
        ...entry,
        status: entry.status === 'Đã hủy' ? 'Đã hủy' : 'Đã xác nhận',
        traveler: {
          name: String(entry.traveler?.name || '—'),
          phone: String(entry.traveler?.phone || '—'),
          email: String(entry.traveler?.email || ''),
        },
        passengers: Number(entry.passengers) > 0 ? Number(entry.passengers) : 1,
        promo: String(entry.promo || 'Không dùng'),
        total: Number.isFinite(Number(entry.total)) ? Number(entry.total) : 0,
        createdAt: String(entry.createdAt || ''),
      }))
  } catch {
    return []
  }
}

export const TRAVELER_KEY = 'may-an-nhien-traveler:v2'

export const loadTraveler = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(TRAVELER_KEY))
    if (saved && typeof saved === 'object' && typeof saved.name === 'string' && typeof saved.phone === 'string' && typeof saved.email === 'string') {
      return {
        name: saved.name.slice(0, 60),
        phone: saved.phone.slice(0, 15),
        email: saved.email.slice(0, 80),
      }
    }
  } catch { /* dữ liệu hỏng */ }
  return { name: '', phone: '', email: '' }
}

export const loadSession = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('may-an-nhien-session'))
    if (saved && typeof saved.email === 'string' && typeof saved.name === 'string') return saved
  } catch { /* dữ liệu hỏng */ }
  return null
}
