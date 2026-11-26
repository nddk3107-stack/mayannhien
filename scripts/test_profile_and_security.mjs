// scripts/test_profile_and_security.mjs — Kiểm thử tự động toàn diện 4 nghiệp vụ Profile & Security
import fs from 'node:fs'
import path from 'node:path'

const BASE_URL = 'http://localhost:3001'

async function run() {
  console.log('=== BẮT ĐẦU KIỂM THỬ PROFILE, AVATAR, PASSENGERS & SECURITY ===\n')
  let passed = 0
  let failed = 0

  function assert(condition, desc) {
    if (condition) {
      console.log(`  ✓ PASS: ${desc}`)
      passed++
    } else {
      console.error(`  ✗ FAIL: ${desc}`)
      failed++
    }
  }

  const defaultHeaders = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }

  // 1. Tạo và đăng nhập tài khoản test
  console.log('1. Đăng ký và đăng nhập tài khoản test...')
  const testEmail = `test_profile_${Date.now()}@mayan.vn`
  const testPass = 'password123'
  
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({ email: testEmail, password: testPass, name: 'Lê Huân' }),
  })
  
  const setCookie = regRes.headers.get('set-cookie')
  const cookieHeader = setCookie ? setCookie.split(';')[0] : ''
  const regData = await regRes.json()
  
  assert(regRes.status === 201 && regData.ok, 'Đăng ký tài khoản mới thành công')
  assert(cookieHeader.length > 0, 'Nhận HttpOnly session cookie')
  const userId = regData.user.id

  const authHeaders = {
    'Cookie': cookieHeader,
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  }

  // 2. GET /api/profile
  console.log('\n2. Kiểm tra GET /api/profile...')
  const getProfRes = await fetch(`${BASE_URL}/api/profile`, { headers: authHeaders })
  const profData = await getProfRes.json()
  assert(getProfRes.status === 200 && profData.ok, 'GET /api/profile trả về 200')
  assert(profData.user && typeof profData.user.avatarUrl !== 'undefined', 'User profile có trường avatarUrl')
  assert(profData.loyalty && typeof profData.loyalty.tier === 'string', 'Hồ sơ có dữ liệu Loyalty Tier thật')
  assert(typeof profData.loyalty.progressPct === 'number', 'Có thanh tiến trình loyalty progressPct')

  // 3. POST /api/profile/avatar (Upload ảnh đại diện thật)
  console.log('\n3. Kiểm tra upload Avatar (POST /api/profile/avatar)...')
  const dummyPng = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
    0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
    0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
    0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ])

  const boundary = '----WebKitFormBoundaryTest123456'
  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="avatar_test.png"\r\nContent-Type: image/png\r\n\r\n`),
    dummyPng,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])

  const uploadRes = await fetch(`${BASE_URL}/api/profile/avatar`, {
    method: 'POST',
    headers: {
      'Cookie': cookieHeader,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'X-Requested-With': 'XMLHttpRequest',
    },
    body: multipartBody,
  })

  const uploadData = await uploadRes.json()
  assert(uploadRes.status === 200 && uploadData.ok, 'Upload ảnh đại diện thành công')
  assert(uploadData.avatarUrl && uploadData.avatarUrl.startsWith('/uploads/avatars/'), `Avatar URL hợp lệ: ${uploadData.avatarUrl}`)

  // Kiểm tra file thực tế trên ổ cứng
  const localDiskFile = path.join(process.cwd(), 'server', uploadData.avatarUrl)
  assert(fs.existsSync(localDiskFile), `File ảnh tồn tại thực tế trên ổ cứng: ${localDiskFile}`)

  // 4. DELETE /api/profile/avatar (Xóa ảnh & tự dọn file ổ cứng)
  console.log('\n4. Kiểm tra xóa Avatar (DELETE /api/profile/avatar)...')
  const delAvatarRes = await fetch(`${BASE_URL}/api/profile/avatar`, {
    method: 'DELETE',
    headers: authHeaders,
  })
  const delAvatarData = await delAvatarRes.json()
  assert(delAvatarRes.status === 200 && delAvatarData.ok, 'Xóa ảnh đại diện thành công')
  assert(!fs.existsSync(localDiskFile), 'File cũ trên ổ cứng đã được tự động dọn dẹp sạch sẽ')

  // 5. CRUD Danh bạ hành khách (Task 3)
  console.log('\n5. Kiểm tra CRUD Hành khách đã lưu (Saved Passengers)...')
  // POST passenger 1
  const addP1Res = await fetch(`${BASE_URL}/api/profile/passengers`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      fullName: 'PHẠM VĂN AN',
      dob: '1990-05-15',
      gender: 'Nam',
      nationality: 'Việt Nam',
      idNumber: '079090123456',
      phone: '0987654321',
      label: 'Bản thân',
    }),
  })
  const addP1Data = await addP1Res.json()
  assert(addP1Res.status === 201 && addP1Data.ok, 'Thêm hành khách 1 thành công')
  const passengerId = addP1Data.passenger.id

  // GET passengers
  const getPRes = await fetch(`${BASE_URL}/api/profile/passengers`, { headers: authHeaders })
  const getPData = await getPRes.json()
  assert(getPRes.status === 200 && Array.isArray(getPData.passengers), 'Lấy danh sách hành khách thành công')
  assert(getPData.passengers.some((p) => p.id === passengerId), 'Hành khách vừa thêm có trong danh sách')

  // PUT passenger (Cập nhật)
  const updatePRes = await fetch(`${BASE_URL}/api/profile/passengers/${passengerId}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      fullName: 'PHẠM VĂN AN (ĐÃ SỬA)',
      dob: '1990-05-15',
      gender: 'Nam',
      nationality: 'Việt Nam',
      idNumber: '079090999999',
      phone: '0912345678',
      label: 'Gia đình',
    }),
  })
  const updatePData = await updatePRes.json()
  assert(updatePRes.status === 200 && updatePData.ok, 'Cập nhật hành khách thành công')
  assert(updatePData.passenger.full_name === 'PHẠM VĂN AN (ĐÃ SỬA)', 'Họ tên được cập nhật đúng')

  // Chống IDOR: Dùng tài khoản userB thử sửa hành khách của user
  console.log('\n6. Kiểm tra chống IDOR hành khách...')
  const userBRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: defaultHeaders,
    body: JSON.stringify({ email: `user_b_${Date.now()}@mayan.vn`, password: 'password123', name: 'User B' }),
  })
  const userBCookie = userBRes.headers.get('set-cookie')?.split(';')[0] || ''
  const idorRes = await fetch(`${BASE_URL}/api/profile/passengers/${passengerId}`, {
    method: 'PUT',
    headers: { 'Cookie': userBCookie, 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify({ fullName: 'HACKED NAME' }),
  })
  assert(idorRes.status === 400 || idorRes.status === 404, 'Chặn IDOR thành công (tài khoản khác không thể sửa)')

  // Xóa hành khách test
  const delPRes = await fetch(`${BASE_URL}/api/profile/passengers/${passengerId}`, {
    method: 'DELETE',
    headers: authHeaders,
  })
  assert(delPRes.status === 200, 'Xóa hành khách thành công')

  // 7. Chống Mass Assignment & Validate SĐT VN 10 số (Task 4)
  console.log('\n7. Kiểm tra chống Mass Assignment & Validate SĐT VN 10 số...')
  // SĐT sai định dạng
  const badPhoneRes = await fetch(`${BASE_URL}/api/profile`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({ name: 'Hợp Lệ', phone: '123' }),
  })
  assert(badPhoneRes.status === 400, 'Từ chối SĐT không đúng 10 số (123)')

  // Cố tình inject email, role, balance, points
  const massAssignRes = await fetch(`${BASE_URL}/api/profile`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Khách Hàng Chuẩn',
      phone: '0901234567',
      email: 'hacked@evil.com',
      role: 'admin',
      balance: 9999999999,
      loyalty_points: 999999,
      member_tier: 'Kim Cương',
    }),
  })
  const massAssignData = await massAssignRes.json()
  assert(massAssignRes.status === 200 && massAssignData.ok, 'Cập nhật hồ sơ thành công')
  assert(massAssignData.user.name === 'Khách Hàng Chuẩn', 'Họ tên được cập nhật')
  assert(massAssignData.user.phone === '0901234567', 'SĐT được cập nhật')
  assert(massAssignData.user.email === testEmail, 'Email KHÔNG BỊ ghi đè (Chống mass assignment)')
  assert(massAssignData.user.role === 'user', 'Role KHÔNG BỊ leo quyền admin (Chống mass assignment)')

  // 8. Đăng xuất tất cả thiết bị (POST /api/auth/logout-all)
  console.log('\n8. Kiểm tra Đăng xuất tất cả thiết bị (POST /api/auth/logout-all)...')
  const logoutAllRes = await fetch(`${BASE_URL}/api/auth/logout-all`, {
    method: 'POST',
    headers: authHeaders,
  })
  const logoutAllData = await logoutAllRes.json()
  assert(logoutAllRes.status === 200 && logoutAllData.ok, 'Đăng xuất tất cả thiết bị thành công (200 OK)')

  // Thử gọi lại API bằng session cũ -> Phải bị từ chối 401
  const afterLogoutRes = await fetch(`${BASE_URL}/api/profile`, {
    headers: authHeaders,
  })
  assert(afterLogoutRes.status === 401, 'Phiên cũ đã bị vô hiệu hóa hoàn toàn (401 Unauthorized)')

  console.log(`\n=== TỔNG KẾT: ${passed} PASS, ${failed} FAIL ===`)
  if (failed > 0) process.exit(1)
}

run().catch((err) => {
  console.error('LỖI KIỂM THỬ:', err)
  process.exit(1)
})
