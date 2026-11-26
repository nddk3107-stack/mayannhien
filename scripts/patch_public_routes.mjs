import fs from 'node:fs'

let code = fs.readFileSync('server/routes-public.js', 'utf8').replace(/\r\n/g, '\n')

// 1. Imports
if (!code.includes("import multer from 'multer'")) {
  code = code.replace(
    "import fs from 'node:fs'\n",
    "import fs from 'node:fs'\nimport path from 'node:path'\nimport multer from 'multer'\n"
  )
}

if (!code.includes('listSavedPassengers')) {
  code = code.replace(
    'getUserWallet, payWithWallet, depositUserWallet,\n',
    'getUserWallet, payWithWallet, depositUserWallet,\n  listSavedPassengers, countSavedPassengers, getSavedPassenger, createSavedPassenger, updateSavedPassenger, deleteSavedPassenger,\n  calculateMemberTier, getTierProgress, addLoyaltyForBooking, revokeAllUserSessions,\n'
  )
}

// 2. Multer upload config
const multerConfig = `
/* ------------------------------------------------ Avatar Upload Setup (Task 2) */
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(process.cwd(), 'server', 'uploads', 'avatars')
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true })
    cb(null, dest)
  },
  filename: (req, file, cb) => {
    const userId = req.session?.user?.id || 'anon'
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, \`avatar_\${userId}_\${Date.now()}\${ext}\`)
  },
})

const avatarUpload = multer({
  storage: avatarStorage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Chỉ chấp nhận file ảnh định dạng JPEG, PNG hoặc WebP.'))
    }
  },
})
`

if (!code.includes('avatarUpload = multer')) {
  code = code.replace('export const publicRouter = Router()', `export const publicRouter = Router()\n${multerConfig}`)
}

// 3. Update GET /profile to return loyalty
const oldGetProfile = `  res.json({
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      role: user.role,
      balance: Number(user.balance) || 0,
      createdAt: user.created_at,
    },
    wallet: getUserWallet(user.id) || { userId: user.id, balance: 0, transactions: [] },
    stats: {
      totalBookings: stats?.totalBookings || 0,
      totalSpent: stats?.totalSpent || 0,
    },
  })`

const newGetProfile = `  res.json({
    ok: true,
    user: publicUser(user),
    wallet: getUserWallet(user.id) || { userId: user.id, balance: 0, transactions: [] },
    loyalty: getTierProgress(user.total_spent),
    stats: {
      totalBookings: stats?.totalBookings || 0,
      totalSpent: stats?.totalSpent || 0,
    },
  })`

if (code.includes(oldGetProfile)) {
  code = code.replace(oldGetProfile, newGetProfile)
}

// 4. Update PUT /profile with strict validation & zero mass assignment
const oldPutProfile = `// PUT /api/profile — Cập nhật họ tên, số điện thoại
publicRouter.put('/profile', requireAuth, (req, res) => {
  const name = txt(req.body?.name, 60, 2)
  if (!name) return bad(res, 'Họ tên phải từ 2 đến 60 ký tự.')
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : ''
  if (phone && !PHONE_RE.test(phone.replace(/\\s+/g, ''))) {
    return bad(res, 'Số điện thoại Việt Nam chưa hợp lệ.')
  }

  db.prepare(\`UPDATE users SET name = ?, phone = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?\`)
    .run(name, phone, req.session.user.id)

  const updated = findUserById(req.session.user.id)
  req.session.user.name = updated.name
  res.json({ ok: true, user: publicUser(updated) })
})`

const newPutProfile = `// PUT /api/profile — Cập nhật họ tên, số điện thoại (Chống Mass Assignment & Validate SĐT VN 10 số)
publicRouter.put('/profile', requireAuth, (req, res) => {
  const name = txt(req.body?.name, 60, 2)
  if (!name) return bad(res, 'Họ và tên bắt buộc và phải từ 2 đến 60 ký tự.')
  const rawPhone = typeof req.body?.phone === 'string' ? req.body.phone.trim().replace(/\\s+/g, '') : ''
  if (!rawPhone || !/^(0|\\+84)[0-9]{9}$/.test(rawPhone)) {
    return bad(res, 'Số điện thoại Việt Nam bắt buộc và phải hợp lệ (10 chữ số).')
  }

  // ZERO MASS ASSIGNMENT: chỉ cho phép cập nhật name và phone, client KHÔNG ĐƯỢC phép sửa email, role, points, tier
  db.prepare(\`UPDATE users SET name = ?, phone = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?\`)
    .run(name, rawPhone, req.session.user.id)

  const updated = findUserById(req.session.user.id)
  req.session.user.name = updated.name
  req.session.user.phone = updated.phone
  res.json({ ok: true, user: publicUser(updated), message: 'Cập nhật thông tin thành công.' })
})`

if (code.includes(oldPutProfile)) {
  code = code.replace(oldPutProfile, newPutProfile)
}

// 5. Add Avatar & Passengers endpoints & Logout-All
const extraProfileEndpoints = `
/* ------------------------------------------- Avatar Management (Task 2) */
// POST /api/profile/avatar — Upload ảnh đại diện (Tự động xóa ảnh cũ)
publicRouter.post('/profile/avatar', requireAuth, (req, res) => {
  avatarUpload.single('avatar')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Tải ảnh lên thất bại.' })
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file ảnh (JPEG, PNG, WebP) tối đa 3MB.' })
    }

    const userId = Number(req.session.user.id)
    const user = findUserById(userId)
    if (!user) return bad(res, 'Không tìm thấy người dùng.', 404)

    // Xóa file ảnh đại diện cũ nếu đã tồn tại
    if (user.avatar_url && user.avatar_url.startsWith('/uploads/avatars/')) {
      try {
        const oldFile = path.join(process.cwd(), 'server', user.avatar_url)
        if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile)
      } catch (unlinkErr) {
        console.warn('[avatar] Lỗi xóa file cũ:', unlinkErr.message)
      }
    }

    const avatarUrl = \`/uploads/avatars/\${req.file.filename}\`
    db.prepare(\`UPDATE users SET avatar_url = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?\`)
      .run(avatarUrl, userId)

    req.session.user.avatarUrl = avatarUrl
    writeAuditLog({
      actorId: userId,
      actorEmail: user.email,
      action: 'user.avatar_update',
      entityType: 'user',
      entityId: String(userId),
      detail: \`Cập nhật ảnh đại diện: \${avatarUrl}\`,
      ip: req.ip || '',
    })

    res.json({ ok: true, avatarUrl, message: 'Cập nhật ảnh đại diện thành công.' })
  })
})

// DELETE /api/profile/avatar — Xóa ảnh đại diện (Về mặc định, xóa file đĩa)
publicRouter.delete('/profile/avatar', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  const user = findUserById(userId)
  if (!user) return bad(res, 'Không tìm thấy người dùng.', 404)

  if (user.avatar_url && user.avatar_url.startsWith('/uploads/avatars/')) {
    try {
      const oldFile = path.join(process.cwd(), 'server', user.avatar_url)
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile)
    } catch (unlinkErr) {
      console.warn('[avatar] Lỗi xóa file đĩa:', unlinkErr.message)
    }
  }

  db.prepare(\`UPDATE users SET avatar_url = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?\`)
    .run(userId)

  req.session.user.avatarUrl = ''
  writeAuditLog({
    actorId: userId,
    actorEmail: user.email,
    action: 'user.avatar_delete',
    entityType: 'user',
    entityId: String(userId),
    detail: 'Xóa ảnh đại diện',
    ip: req.ip || '',
  })

  res.json({ ok: true, avatarUrl: null, message: 'Đã xóa ảnh đại diện.' })
})

/* ------------------------------------------- Saved Passengers (Task 3) */
// GET /api/profile/passengers — Danh sách hành khách đã lưu
publicRouter.get('/profile/passengers', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  const passengers = listSavedPassengers(userId)
  res.json({ ok: true, passengers })
})

// POST /api/profile/passengers — Thêm mới hành khách (Giới hạn tối đa 20)
publicRouter.post('/profile/passengers', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  try {
    const passenger = createSavedPassenger({
      userId,
      fullName: req.body?.fullName,
      dob: req.body?.dob,
      gender: req.body?.gender,
      nationality: req.body?.nationality,
      idNumber: req.body?.idNumber,
      phone: req.body?.phone,
      label: req.body?.label,
    })
    res.status(201).json({ ok: true, passenger, message: 'Thêm hành khách đã lưu thành công.' })
  } catch (err) {
    return bad(res, err.message, 400)
  }
})

// PUT /api/profile/passengers/:id — Cập nhật thông tin hành khách (Chặn IDOR)
publicRouter.put('/profile/passengers/:id', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  const id = Number(req.params.id)
  try {
    const passenger = updateSavedPassenger({
      id,
      userId,
      fullName: req.body?.fullName,
      dob: req.body?.dob,
      gender: req.body?.gender,
      nationality: req.body?.nationality,
      idNumber: req.body?.idNumber,
      phone: req.body?.phone,
      label: req.body?.label,
    })
    res.json({ ok: true, passenger, message: 'Cập nhật hành khách thành công.' })
  } catch (err) {
    return bad(res, err.message, 400)
  }
})

// DELETE /api/profile/passengers/:id — Xóa hành khách đã lưu (Chặn IDOR)
publicRouter.delete('/profile/passengers/:id', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  const id = Number(req.params.id)
  const deleted = deleteSavedPassenger(id, userId)
  if (!deleted) return bad(res, 'Không tìm thấy hành khách hoặc không có quyền thao tác.', 404)
  res.json({ ok: true, message: 'Đã xóa hành khách khỏi danh sách lưu.' })
})

/* ------------------------------------------- Logout All Sessions (Task 4) */
// POST /api/auth/logout-all — Đăng xuất khỏi tất cả các thiết bị (Tăng token_version)
publicRouter.post('/auth/logout-all', requireAuth, (req, res) => {
  const userId = Number(req.session.user.id)
  const user = findUserById(userId)
  revokeAllUserSessions(userId)
  clearSessionCookie(res)
  writeAuditLog({
    actorId: userId,
    actorEmail: user?.email || '',
    action: 'user.logout_all',
    entityType: 'user',
    entityId: String(userId),
    detail: 'Đăng xuất khỏi tất cả thiết bị thành công (vô hiệu hóa toàn bộ phiên)',
    ip: req.ip || '',
  })
  res.json({ ok: true, message: 'Đã đăng xuất khỏi tất cả các thiết bị an toàn.' })
})
`

if (!code.includes('/profile/avatar')) {
  // Chèn vào sau PUT /profile
  const putAnchor = "req.session.user.phone = updated.phone\n  res.json({ ok: true, user: publicUser(updated), message: 'Cập nhật thông tin thành công.' })\n})"
  if (code.includes(putAnchor)) {
    code = code.replace(putAnchor, `${putAnchor}\n${extraProfileEndpoints}`)
  } else {
    code = code.replace('publicRouter.put(\'/profile\'', `${extraProfileEndpoints}\npublicRouter.put('/profile'`)
  }
}

fs.writeFileSync('server/routes-public.js', code.replace(/\n/g, '\r\n'), 'utf8')
console.log('server/routes-public.js patched successfully!')
