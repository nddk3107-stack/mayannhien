#!/usr/bin/env node
// scripts/seed-admin.mjs — Tạo hoặc cấp lại mật khẩu tài khoản QUẢN TRỊ VIÊN đầu tiên.
// KHÔNG hard-code bất kỳ mật khẩu nào trong source; mật khẩu lấy từ argv/env hoặc
// được nhập ẩn tại chỗ / sinh ngẫu nhiên (chỉ in ra MỘT lần).
//
// Cách dùng:
//   npm run seed:admin                                 → hỏi email + mật khẩu (ẩn khi gõ)
//   npm run seed:admin -- --email admin@mayan.test     → hỏi mật khẩu
//   npm run seed:admin -- --email a@b.c --generate     → sinh mật khẩu mạnh, in ra 1 lần
//   npm run seed:admin -- --email a@b.c --password ... → chạy non-interactive (CI)
//   npm run seed:admin -- --email a@b.c --rotate       → cấp lại mật khẩu
import readline from 'node:readline'
import { randomBytes } from 'node:crypto'
import { db, createUser, findUserByEmail, hashPassword, deleteSessionsOfUser } from '../server/db.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function flag(args, name) {
  const i = args.indexOf(`--${name}`)
  return i >= 0 ? args[i + 1] : undefined
}

function promptLine(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()) })
  })
}

// Nhập ẩn: không echo mật khẩu ra terminal (dùng mã ký tự thay cho ký tự điều khiển).
function promptHidden(question) {
  process.stdout.write(question)
  return new Promise((resolve) => {
    const chunks = []
    process.stdin.setRawMode?.(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf8')
    const onData = (ch) => {
      const code = ch.charCodeAt(0)
      if (code === 10 || code === 13 || code === 4) { // Enter / Ctrl+D
        process.stdin.setRawMode?.(false)
        process.stdin.pause()
        process.stdin.removeListener('data', onData)
        process.stdout.write('\n')
        resolve(chunks.join(''))
      } else if (code === 3) { // Ctrl+C
        process.exit(130)
      } else if (code === 127 || code === 8) { // Backspace
        chunks.pop()
      } else {
        chunks.push(ch)
      }
    }
    process.stdin.on('data', onData)
  })
}

const generatePassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%'
  const bytes = randomBytes(18)
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out
}

async function main() {
  const args = process.argv.slice(2)
  let email = flag(args, 'email') || process.env.ADMIN_EMAIL
  let password = flag(args, 'password') || process.env.ADMIN_PASSWORD
  const rotate = args.includes('--rotate')
  const generate = args.includes('--generate')

  if (!email) email = await promptLine('Email quản trị: ')
  email = String(email || '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    console.error('Email không hợp lệ.')
    process.exit(1)
  }

  if (generate) {
    password = generatePassword()
  } else if (!password) {
    password = await promptHidden('Mật khẩu (tối thiểu 10 ký tự, không echo): ')
  }
  if (typeof password !== 'string' || password.length < 10) {
    console.error('Mật khẩu phải có ít nhất 10 ký tự.')
    process.exit(1)
  }
  if (password.length > 64) {
    console.error('Mật khẩu tối đa 64 ký tự.')
    process.exit(1)
  }

  const existing = findUserByEmail(email)
  const passwordHash = await hashPassword(password)

  if (existing) {
    if (!rotate) {
      console.error(`Tài khoản ${email} đã tồn tại (role=${existing.role}).`)
      console.error('  Dùng --rotate để cấp lại mật khẩu, hoặc chọn email khác.')
      process.exit(1)
    }
    db.prepare(`UPDATE users SET password_hash = ?, role = 'admin', is_active = 1,
                updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`).run(passwordHash, existing.id)
    deleteSessionsOfUser(existing.id) // đá mọi phiên cũ sau khi đổi mật khẩu
    console.log(`Đã cấp lại mật khẩu admin: ${email} (các phiên cũ đã bị đăng xuất).`)
  } else {
    createUser({ email, name: email.split('@')[0], passwordHash, role: 'admin' })
    console.log(`Đã tạo tài khoản admin: ${email}`)
  }

  if (generate) console.log(`Mật khẩu (chỉ hiển thị một lần, hãy lưu vào nơi an toàn): ${password}`)
  console.log('Đăng nhập tại: http://localhost:5175/#/admin')
  db.close()
}

main().catch((err) => {
  console.error('Lỗi:', err.message || err)
  process.exit(1)
})
