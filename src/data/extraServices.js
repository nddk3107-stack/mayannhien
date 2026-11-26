// src/data/extraServices.js — Dữ liệu dịch vụ mở rộng (Vui chơi, Xe sân bay, Xe khách, Tàu hỏa, Bảo hiểm) và sơ đồ ghế bay MoMo.

export const formatVND = (value) => `${new Intl.NumberFormat('vi-VN').format(Math.round(value || 0))}đ`

export const formatDateVN = (isoStr) => {
  if (!isoStr) return ''
  const str = String(isoStr).slice(0, 10)
  const parts = str.split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  const d = new Date(isoStr)
  if (Number.isNaN(d.getTime())) return String(isoStr)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export const AIRPORTS = [
  { code: 'SGN', name: 'Sân bay Quốc tế Tân Sơn Nhất', city: 'TP.HCM' },
  { code: 'HAN', name: 'Sân bay Quốc tế Nội Bài', city: 'Hà Nội' },
  { code: 'DAD', name: 'Sân bay Quốc tế Đà Nẵng', city: 'Đà Nẵng' },
  { code: 'PQC', name: 'Sân bay Quốc tế Phú Quốc', city: 'Phú Quốc' },
  { code: 'CXR', name: 'Sân bay Quốc tế Cam Ranh', city: 'Nha Trang' },
  { code: 'DLI', name: 'Sân bay Liên Khương', city: 'Đà Lạt' },
  { code: 'HPH', name: 'Sân bay Cát Bi', city: 'Hải Phòng' },
]

export const airportCodeOf = (city) => {
  if (!city) return 'SGN'
  const found = AIRPORTS.find(
    (a) => a.city === city || a.name.includes(city) || a.code === city || city.includes(a.city),
  )
  return found ? found.code : 'SGN'
}

export const FLIGHT_SEAT_ROWS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
export const FLIGHT_SEAT_COLS = ['A', 'B', 'C', 'D', 'E', 'F']
export const OCCUPIED_FLIGHT_SEATS = new Set(['1A', '1B', '2C', '3D', '4A', '5E', '6F', '7B', '8C', '9D', '10A'])

export const SEAT_CLASSES = [
  {
    id: 'eco',
    label: 'Phổ thông Tiêu chuẩn',
    baggage: '07kg xách tay',
    changeFee: 'Đổi vé có phí',
    addon: 0,
  },
  {
    id: 'eco-plus',
    label: 'Phổ thông Linh hoạt',
    baggage: '07kg + 20kg ký gửi',
    changeFee: 'Đổi vé miễn phí',
    addon: 250000,
  },
  {
    id: 'biz',
    label: 'Thương gia Sang trọng',
    baggage: '14kg + 30kg ký gửi',
    changeFee: 'Phòng chờ VIP + Đổi tự do',
    addon: 950000,
  },
]

export const BAGGAGE_OPTIONS = [
  { id: 'bg-0', label: 'Mặc định (7kg xách tay)', price: 0 },
  { id: 'bg-15', label: '+15kg ký gửi', price: 180000 },
  { id: 'bg-20', label: '+20kg ký gửi', price: 230000 },
  { id: 'bg-30', label: '+30kg ký gửi', price: 350000 },
]

export const ACTIVITIES = [
  {
    id: 'act-bana',
    serviceType: 'activity',
    name: 'Vé Sun World Bà Nà Hills + Cáp treo',
    city: 'Đà Nẵng',
    location: 'Bà Nà, Đà Nẵng',
    tag: 'Bán chạy nhất',
    rating: 9.6,
    reviews: 1420,
    duration: '1 ngày',
    price: 900000,
    image: 'linear-gradient(180deg, rgba(6,24,44,.1), rgba(6,24,44,.65)), url(https://images.unsplash.com/photo-1590523277543-a94d2e4eb00b?auto=format&fit=crop&w=800&q=80)',
    perks: ['Cáp treo khứ hồi', 'Cầu Vàng', 'Làng Pháp', 'Vào cổng nhanh QR'],
  },
  {
    id: 'act-vinwonders',
    serviceType: 'activity',
    name: 'Vé VinWonders Phú Quốc Trọn Gói',
    city: 'Phú Quốc',
    location: 'Bãi Dài, Gành Dầu, Phú Quốc',
    tag: 'Công viên giải trí',
    rating: 9.4,
    reviews: 980,
    duration: '1 ngày',
    price: 950000,
    image: 'linear-gradient(180deg, rgba(6,24,44,.1), rgba(6,24,44,.65)), url(https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?auto=format&fit=crop&w=800&q=80)',
    perks: ['Công viên nước', 'Thủy cung Cung Điện Hải Vương', 'Khu trò chơi cảm giác mạnh'],
  },
  {
    id: 'act-fansipan',
    serviceType: 'activity',
    name: 'Cáp treo Sun World Fansipan Legend',
    city: 'Sa Pa',
    location: 'Sa Pa, Lào Cai',
    tag: 'Chinh phục đỉnh cao',
    rating: 9.5,
    reviews: 1150,
    duration: 'Buổi sáng / chiều',
    price: 800000,
    image: 'linear-gradient(180deg, rgba(6,24,44,.1), rgba(6,24,44,.65)), url(https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=800&q=80)',
    perks: ['Cáp treo 3 dây đạt kỷ lục', 'Ngắm thung lũng Mường Hoa', 'Cột cờ đỉnh Fansipan'],
  },
  {
    id: 'act-hoian',
    serviceType: 'activity',
    name: 'Show Ký Ức Hội An + Công viên Ấn Tượng',
    city: 'Hội An',
    location: 'Cồn Hến, Hội An',
    tag: 'Văn hóa nghệ thuật',
    rating: 9.7,
    reviews: 860,
    duration: '3 giờ',
    price: 600000,
    image: 'linear-gradient(180deg, rgba(6,24,44,.1), rgba(6,24,44,.65)), url(https://images.unsplash.com/photo-1559592413-7cec4d0cae2b?auto=format&fit=crop&w=800&q=80)',
    perks: ['Sân khấu thực cảnh lớn nhất VN', '500 diễn viên', 'Công viên văn hóa'],
  },
  {
    id: 'act-coral',
    serviceType: 'activity',
    name: 'Tour Cano 4 Đảo & Lặn Ngắm San Hô Phú Quốc',
    city: 'Phú Quốc',
    location: 'An Thới, Phú Quốc',
    tag: 'Tour biển cano',
    rating: 9.3,
    reviews: 740,
    duration: '1 ngày',
    price: 750000,
    image: 'linear-gradient(180deg, rgba(6,24,44,.1), rgba(6,24,44,.65)), url(https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80)',
    perks: ['Cano cao tốc', 'Lặn san hô tự nhiên', 'Quay video flycam miễn phí', 'Ăn trưa hải sản'],
  },
]

export const AIRPORT_CARS = [
  {
    id: 'car-sedan4',
    serviceType: 'car',
    name: 'Xe riêng Sedan 4 chỗ (Đưa đón sân bay)',
    model: 'Toyota Vios / Honda City',
    tag: 'Tiết kiệm & Nhanh chóng',
    seats: 4,
    luggage: 2,
    price: 290000,
    perks: ['Chờ đón miễn phí 60 phút', 'Tài xế chuyên nghiệp', 'Không phụ phí cầu đường', 'Hủy miễn phí trước 2h'],
  },
  {
    id: 'car-suv7',
    serviceType: 'car',
    name: 'Xe riêng SUV 7 chỗ (Đưa đón sân bay)',
    model: 'Toyota Innova / Fortuner',
    tag: 'Gia đình & Thoải mái',
    seats: 7,
    luggage: 4,
    price: 390000,
    perks: ['Khoang hành lý rộng rãi', 'Nước suối & khăn lạnh', 'Tài xế cầm bảng đón tại sảnh', 'Xe đời mới'],
  },
  {
    id: 'car-limo9',
    serviceType: 'car',
    name: 'Limousine VIP 9 chỗ (Đưa đón sân bay)',
    model: 'Ford Transit DCar VIP',
    tag: 'Sang trọng bậc nhất',
    seats: 9,
    luggage: 6,
    price: 690000,
    perks: ['Ghế massage bọc da cao cấp', 'Wifi & cổng sạc từng ghế', 'Phục vụ đoàn doanh nghiệp / khách VIP'],
  },
  {
    id: 'car-van16',
    serviceType: 'car',
    name: 'Xe du lịch 16 chỗ (Đưa đón sân bay)',
    model: 'Hyundai Solati / Ford Transit',
    tag: 'Đoàn lớn & Công ty',
    seats: 16,
    luggage: 12,
    price: 850000,
    perks: ['Chở trọn gói cả đoàn', 'Khoang hành lý lớn', 'Tài xế kinh nghiệm tuyến sân bay'],
  },
]

export const BUS_TRIPS = [
  {
    id: 'bus-futa-dl',
    serviceType: 'bus',
    operator: 'Phương Trang FUTA',
    busType: 'Giường nằm 34 phòng cao cấp',
    from: 'TP.HCM',
    to: 'Đà Lạt',
    depart: '23:00',
    arrive: '06:00',
    duration: '7h 00m',
    rating: 4.8,
    tag: 'Bán chạy nhất',
    price: 290000,
  },
  {
    id: 'bus-limo-sp',
    serviceType: 'bus',
    operator: 'Inter Bus Lines',
    busType: 'Cabin đôi VIP lãng mạn',
    from: 'Hà Nội',
    to: 'Sa Pa',
    depart: '22:30',
    arrive: '04:30',
    duration: '6h 00m',
    rating: 4.9,
    tag: 'Cabin hoàng gia',
    price: 420000,
  },
  {
    id: 'bus-tb-nt',
    serviceType: 'bus',
    operator: 'Thành Bưởi',
    busType: 'Limousine 22 phòng massage',
    from: 'TP.HCM',
    to: 'Nha Trang',
    depart: '21:30',
    arrive: '05:30',
    duration: '8h 00m',
    rating: 4.7,
    tag: 'Êm ái thoải mái',
    price: 350000,
  },
  {
    id: 'bus-hv-hue',
    serviceType: 'bus',
    operator: 'Hải Vân Express',
    busType: 'Ghế VIP Limousine điều hòa',
    from: 'Đà Nẵng',
    to: 'Huế',
    depart: '08:30',
    arrive: '10:45',
    duration: '2h 15m',
    rating: 4.8,
    tag: 'Đúng giờ 100%',
    price: 180000,
  },
]

export const TRAIN_TRIPS = [
  {
    id: 'train-se2',
    serviceType: 'train',
    code: 'SE2',
    cabin: 'Ngồi mềm ĐH',
    from: 'Ga Sài Gòn',
    to: 'Ga Đà Nẵng',
    depart: '19:00',
    arrive: '12:30',
    duration: '17h 30m',
    tag: 'Tàu nhanh chất lượng cao',
    price: 720000,
  },
  {
    id: 'train-se4',
    serviceType: 'train',
    code: 'SE4',
    cabin: 'Giường nằm VIP K4',
    from: 'Ga Sài Gòn',
    to: 'Ga Đà Nẵng',
    depart: '19:25',
    arrive: '11:45',
    duration: '16h 20m',
    tag: 'Khoang VIP 4 giường',
    price: 1180000,
  },
  {
    id: 'train-sp3',
    serviceType: 'train',
    code: 'SP3',
    cabin: 'Giường nằm K4',
    from: 'Ga Hà Nội',
    to: 'Ga Lào Cai',
    depart: '22:00',
    arrive: '06:05',
    duration: '8h 05m',
    tag: 'Tàu du lịch Sa Pa',
    price: 560000,
  },
  {
    id: 'train-se8',
    serviceType: 'train',
    code: 'SE8',
    cabin: 'Giường nằm K6',
    from: 'Ga Hà Nội',
    to: 'Ga Huế',
    depart: '06:00',
    arrive: '19:40',
    duration: '13h 40m',
    tag: 'Ngắm cảnh miền Trung',
    price: 690000,
  },
]

export const INSURANCE_PLANS = [
  {
    id: 'ins-basic',
    serviceType: 'insurance',
    tier: 'Cơ Bản',
    tag: 'Tiết kiệm',
    price: 89000,
    recommended: false,
    medical: '50.000.000đ',
    delay: '2.000.000đ',
    baggage: '5.000.000đ',
    cancel: '5.000.000đ',
    perks: [
      'Bảo vệ tai nạn cá nhân chuyến đi',
      'Chi phí y tế cấp cứu cơ bản',
      'Hỗ trợ thất lạc hành lý tối thiểu',
      'Cứu hộ khẩn cấp 24/7',
    ],
  },
  {
    id: 'ins-standard',
    serviceType: 'insurance',
    tier: 'Tiêu Chuẩn',
    tag: 'Phổ biến nhất',
    price: 169000,
    recommended: true,
    medical: '150.000.000đ',
    delay: '5.000.000đ',
    baggage: '15.000.000đ',
    cancel: '15.000.000đ',
    perks: [
      'Quyền lợi y tế nội trú & ngoại trú',
      'Bồi thường trễ chuyến bay từ 4 giờ',
      'Bảo hiểm hư hỏng, mất mát hành lý',
      'Bảo hiểm gián đoạn & hủy chuyến đi',
      'Dịch vụ bảo lãnh viện phí trên toàn quốc',
    ],
  },
  {
    id: 'ins-vip',
    serviceType: 'insurance',
    tier: 'Toàn Diện VIP',
    tag: 'An tâm tuyệt đối',
    price: 299000,
    recommended: false,
    medical: '500.000.000đ',
    delay: '10.000.000đ',
    baggage: '30.000.000đ',
    cancel: '30.000.000đ',
    perks: [
      'Hạn mức y tế tối đa 500 triệu đồng',
      'Vận chuyển y tế cấp cứu bằng máy bay',
      'Bồi thường chậm hành lý & trễ chuyến nhanh',
      'Bảo vệ cả thiết bị điện tử cá nhân',
      'Hỗ trợ pháp lý & đường dây nóng VIP toàn cầu',
    ],
  },
]

export const BANKS = [
  { id: 'vcb', name: 'Vietcombank', short: 'VCB', color: '#00602b' },
  { id: 'tcb', name: 'Techcombank', short: 'TCB', color: '#ed1b24' },
  { id: 'bidv', name: 'BIDV', short: 'BIDV', color: '#003366' },
  { id: 'mbb', name: 'MBBank', short: 'MB', color: '#002855' },
  { id: 'vpb', name: 'VPBank', short: 'VPB', color: '#00843d' },
  { id: 'acb', name: 'ACB', short: 'ACB', color: '#005baa' },
  { id: 'vietin', name: 'VietinBank', short: 'CTG', color: '#004a99' },
  { id: 'tpbank', name: 'TPBank', short: 'TPB', color: '#682a8e' },
]
