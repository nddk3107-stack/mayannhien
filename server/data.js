// server/data.js — Dữ liệu mặc định của Mây An Nhiên.
// Được dùng để (1) seed database lần đầu và (2) làm dữ liệu dự phòng khi DB lỗi.
// GIỮ NGUYÊN giá trị hiện có vì 104 bài test E2E đang kiểm tra chính xác các con số này.
export const DEFAULT_FLIGHTS = [
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
]

export const DEFAULT_HOTELS = [
  {
    id: 'hotel-1',
    name: 'Marina Bay Đà Nẵng Resort',
    location: 'Biển Mỹ Khê, Đà Nẵng',
    rating: 9.2,
    stars: 5,
    price: 1850000,
    hasPromo: true,
    image: 'linear-gradient(180deg, rgba(6,24,44,.05), rgba(6,24,44,.55)), url(https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1100&q=90)',
    perks: ['Sát biển', 'Bữa sáng', 'Hồ bơi'],
    description: 'Khu nghỉ dưỡng 5 sao bên bờ biển Mỹ Khê, hồ bơi vô cực và nhà hàng view biển.',
  },
  {
    id: 'hotel-2',
    name: 'Sapa Cloud Boutique Hotel',
    location: 'Trung tâm Sa Pa',
    rating: 8.9,
    stars: 4,
    price: 990000,
    hasPromo: false,
    image: 'linear-gradient(180deg, rgba(6,24,44,.05), rgba(6,24,44,.58)), url(https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?auto=format&fit=crop&w=1100&q=90)',
    perks: ['View núi', 'Gần chợ', 'Miễn phí hủy'],
    description: 'Boutique hotel trong trung tâm Sa Pa, tầm nhìn núi Hoàng Liên Sơn.',
  },
  {
    id: 'hotel-3',
    name: 'Hanoi Old Quarter Stay',
    location: 'Phố cổ Hà Nội',
    rating: 9.0,
    stars: 4,
    price: 1250000,
    hasPromo: true,
    image: 'linear-gradient(180deg, rgba(6,24,44,.05), rgba(6,24,44,.58)), url(https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1100&q=90)',
    perks: ['Trung tâm', 'Family room', 'Ăn sáng'],
    description: 'Nơi lưu trú trong khu phố cổ, thuận tiện tham quan hồ Hoàn Kiếm.',
  },
]

// Promotions: rate + phạm vi áp dụng lưu Ở DATABASE (backend quyết định mức giảm).
// p1/p2/p3 phải trùng khớp luật cũ trong App.jsx để 104 test không đổi kết quả.
export const DEFAULT_PROMOTIONS = [
  {
    id: 'p1',
    code: 'SALECUOITUAN',
    description: 'Giảm thêm 12% cho khách sạn',
    color: 'blue',
    rate: 0.12,
    appliesTo: ['hotel', 'combo'],
    usageLimit: 1000,
  },
  {
    id: 'p2',
    code: 'BAYNGAY',
    description: 'Mã vé máy bay nội địa từ 99K',
    color: 'orange',
    rate: 0.08,
    appliesTo: ['flight', 'combo'],
    usageLimit: 1000,
  },
  {
    id: 'p3',
    code: 'COMBOHE',
    description: 'Tiết kiệm đến 25% khi đặt combo',
    color: 'green',
    rate: 0.25,
    appliesTo: ['combo'],
    usageLimit: 1000,
  },
]

// Phòng mặc định cho từng khách sạn seed sẵn.
// Mỗi phòng có tiện nghi RIÊNG (không hard-code chung) — chỉ ghi những gì dữ liệu xác nhận.
export const DEFAULT_ROOMS = [
  // -------- hotel-1: Marina Bay Đà Nẵng Resort (1.850.000/đêm) --------
  {
    id: 'room-hotel-1-1', hotelId: 'hotel-1',
    name: 'Phòng Deluxe Giáp Biển', price: 1850000,
    bedType: 'Giường king', sizeSqm: 35, maxAdults: 2, maxChildren: 1,
    breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00',
    amenities: ['Giường king', 'Điều hòa', 'TV màn hình phẳng', 'Tủ lạnh mini', 'Vòi hoa sen', 'Khăn tắm', 'Wi-Fi miễn phí', 'Két sắt', 'Máy sấy tóc', 'Bàn làm việc'],
    images: [
      'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32?auto=format&fit=crop&w=1000&q=85',
    ],
  },
  {
    id: 'room-hotel-1-2', hotelId: 'hotel-1',
    name: 'Phòng Suite View Biển', price: 2650000,
    bedType: 'Giường king + giường phụ', sizeSqm: 55, maxAdults: 3, maxChildren: 2,
    breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00',
    amenities: ['Giường king', 'Phòng khách riêng', 'Bồn tắm', 'Điều hòa', 'TV màn hình phẳng', 'Minibar', 'Wi-Fi miễn phí', 'Két sắt', 'Ấm đun nước', 'Áo choàng tắm'],
    images: [
      'https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1000&q=85',
    ],
  },
  {
    id: 'room-hotel-1-3', hotelId: 'hotel-1',
    name: 'Phòng Twin Tiêu Chuẩn', price: 1450000,
    bedType: '2 giường đơn', sizeSqm: 28, maxAdults: 2, maxChildren: 1,
    breakfast: false, freeCancellation: false, checkinTime: '14:00', checkoutTime: '12:00',
    amenities: ['2 giường đơn', 'Điều hòa', 'TV màn hình phẳng', 'Vòi hoa sen', 'Khăn tắm', 'Wi-Fi miễn phí', 'Máy sấy tóc'],
    images: [
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1000&q=85',
    ],
  },
  // -------- hotel-2: Sapa Cloud Boutique (990.000/đêm) --------
  {
    id: 'room-hotel-2-1', hotelId: 'hotel-2',
    name: 'Phòng Standard View Núi', price: 990000,
    bedType: 'Giường queen', sizeSqm: 22, maxAdults: 2, maxChildren: 1,
    breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00',
    amenities: ['Giường queen', 'Điều hòa', 'TV', 'Vòi hoa sen', 'Khăn tắm', 'Wi-Fi miễn phí', 'Bàn làm việc'],
    images: [
      'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1595576508898-0ad5c879a061?auto=format&fit=crop&w=1000&q=85',
    ],
  },
  {
    id: 'room-hotel-2-2', hotelId: 'hotel-2',
    name: 'Phòng Family Giữa Mây', price: 1450000,
    bedType: '1 giường king + 1 giường đơn', sizeSqm: 35, maxAdults: 3, maxChildren: 2,
    breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00',
    amenities: ['Giường king + giường đơn', 'Phòng khách', 'Tủ lạnh', 'Ấm đun nước', 'Vòi hoa sen', 'Wi-Fi miễn phí', 'Két sắt', 'Bàn làm việc'],
    images: [
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1000&q=85',
    ],
  },
  // -------- hotel-3: Hanoi Old Quarter Stay (1.250.000/đêm) --------
  {
    id: 'room-hotel-3-1', hotelId: 'hotel-3',
    name: 'Phòng Deluxe Phố Cổ', price: 1250000,
    bedType: 'Giường king', sizeSqm: 26, maxAdults: 2, maxChildren: 1,
    breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00',
    amenities: ['Giường king', 'Điều hòa', 'TV màn hình phẳng', 'Tủ lạnh', 'Vòi hoa sen', 'Wi-Fi miễn phí', 'Máy sấy tóc'],
    images: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1000&q=85',
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=1000&q=85',
    ],
  },
  {
    id: 'room-hotel-3-2', hotelId: 'hotel-3',
    name: 'Phòng Junior Suite Hồ Gươm', price: 1750000,
    bedType: 'Giường king', sizeSqm: 40, maxAdults: 3, maxChildren: 2,
    breakfast: true, freeCancellation: true, checkinTime: '14:00', checkoutTime: '12:00',
    amenities: ['Giường king', 'Phòng khách riêng', 'Bồn tắm', 'Minibar', 'Két sắt', 'Ấm đun nước', 'Wi-Fi miễn phí', 'Áo choàng tắm', 'Bàn làm việc'],
    images: [
      'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=1000&q=85',
    ],
  },
]

// Combo mặc định ghép theo cặp (khách sạn[i] + chuyến bay[i] - 450.000đ) —
// đúng công thức mà ComboPage của frontend đang dùng.
export const COMBO_SAVING = 450000
export const DEFAULT_COMBOS = DEFAULT_HOTELS.map((hotel, index) => {
  const flight = DEFAULT_FLIGHTS[index]
  return {
    id: `combo-${hotel.id}`,
    name: `Combo ${hotel.name} + vé bay`,
    hotelId: hotel.id,
    flightId: flight.id,
    saving: COMBO_SAVING,
    priceOverride: null,
    description: `Trọn gói vé ${flight.airline} (${flight.from} - ${flight.to}) + ${hotel.name}.`,
    image: hotel.image,
    validFrom: null,
    validTo: null,
  }
})
