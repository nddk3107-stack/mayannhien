#!/usr/bin/env node
// scripts/run-tests.mjs — Chạy toàn bộ bộ kiểm thử QA theo thứ tự.
// Mỗi suite non-standalone nhận DB tạm riêng (API khởi động lại + health check).
// Standalone (payment, rooms-admin, voucher, audit) tự quản lý server + DB.
//
// Cách dùng: npm run test:all  |  node scripts/run-tests.mjs e2e audit
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_PORT = Number(process.env.QA_API_PORT) || 3001
const WEB_PORT = Number(process.env.QA_WEB_PORT) || 5175


const ALL = ['e2e', 'flight', 'hotel', 'room', 'combo', 'voucher', 'final', 'admin', 'audit', 'payment', 'rooms-admin']
const SUITES = { e2e:'qa-e2e.mjs', flight:'qa-flight.mjs', hotel:'qa-hotel.mjs', room:'qa-room.mjs', combo:'qa-combo.mjs', voucher:'qa-voucher.mjs', final:'qa-final.mjs', admin:'qa-admin.mjs', audit:'qa-audit.mjs', payment:'qa-payment.mjs', 'rooms-admin':'qa-rooms-admin.mjs' }
const STANDALONE = new Set(['payment','rooms-admin','voucher','audit'])
const wants = process.argv.slice(2).filter((a) => !a.startsWith('-'))
const selected = wants.length ? wants.filter((s) => SUITES[s]) : ALL


const waitFor = async (label, check, timeoutMs = 45000) => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) { if (await check()) return true; await new Promise((r) => setTimeout(r, 300)) }
  throw new Error(`${label} không sẵn sàng sau ${timeoutMs / 1000}s`)
}

const killPort = (port) => {
  try { const out = spawnSync('lsof', ['-tiTCP:' + port, '-sTCP:LISTEN'], { encoding: 'utf8' }); for (const pid of String(out.stdout || '').trim().split('\n').filter(Boolean)) { try { process.kill(Number(pid), 'SIGKILL') } catch {} } } catch {}
}


const children = []
const cleanup = () => { for (const child of children) { try { child.kill('SIGKILL') } catch {} } }
process.on('exit', cleanup)
process.on('SIGINT', () => { cleanup(); process.exit(130) })

const start = (name, cmd, args, env) => {
  const child = spawn(cmd, args, { cwd: ROOT, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
  children.push(child)
  const log = []
  child.stdout.on('data', (d) => log.push(String(d)))
  child.stderr.on('data', (d) => log.push(String(d)))
  return { name, child, log }
}


const tmpDbPaths = []
let apiProc = null
let currentDbPath = null

const removeTmpDb = (dbPath) => {
  try { const stat = fs.statSync(dbPath); if (stat.isFile()) { for (const s of ['', '-wal', '-shm']) fs.rmSync(dbPath + s, { force: true }) } } catch {}
}


let webProc = null
const needsWeb = selected.some((s) => !STANDALONE.has(s))
if (needsWeb) {
  killPort(WEB_PORT)
  webProc = start('web', process.execPath, [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', 'localhost', '--port', String(WEB_PORT), '--strictPort'], {})
  await waitFor('Vite', async () => {
    if (webProc.child.exitCode !== null) throw new Error(`Vite đã thoát (code=${webProc.child.exitCode}):\n${webProc.log.join('')}`)
    return fetch(`http://localhost:${WEB_PORT}/`).then((r) => r.ok).catch(() => false)
  })
  console.log(`[runner] Vite sẵn sàng tại http://127.0.0.1:${WEB_PORT}`)
}


const startApiForSuite = async (suite) => {
  if (apiProc) { try { apiProc.child.kill('SIGKILL') } catch {}; apiProc = null; await new Promise((r) => setTimeout(r, 400)) }
  killPort(API_PORT)
  if (currentDbPath) removeTmpDb(currentDbPath)
  const dbPath = path.resolve('data', `qa-runner-${suite}-${Date.now()}-${randomBytes(4).toString('hex')}.db`)
  for (const s of ['', '-wal', '-shm']) fs.rmSync(dbPath + s, { force: true })
  currentDbPath = dbPath; tmpDbPaths.push(dbPath)
  apiProc = start('api', process.execPath, ['server.js'], { PORT: String(API_PORT), DB_PATH: dbPath })
  await waitFor('API', async () => {
    if (apiProc.child.exitCode !== null) throw new Error(`API server đã thoát (code=${apiProc.child.exitCode}):\n${apiProc.log.join('')}`)
    return fetch(`http://127.0.0.1:${API_PORT}/api/health`).then((r) => r.ok).catch(() => false)
  })
  console.log(`[runner] Suite ${suite}: API sẵn sàng http://127.0.0.1:${API_PORT} (DB: ${dbPath})`)
  return dbPath
}

const failures = []
const summary = []
try {
  for (const suite of selected) {
    const file = SUITES[suite]; if (!file) continue
    console.log(`\n──────── SUITE: ${suite} (${file}) ────────`)
    if (STANDALONE.has(suite)) {
      const env = { ...process.env }; delete env.DB_PATH
      const res = spawnSync(process.execPath, [file], { cwd: ROOT, env, stdio: 'inherit' })
      const code = res.status ?? 1; summary.push({ suite, exitCode: code })
      if (code !== 0) failures.push(suite)
      console.log(`──────── SUITE ${suite}: exit=${code} ────────`)
      continue
    }


    const dbPath = await startApiForSuite(suite)
    const env = { ...process.env, DB_PATH: dbPath }
    const res = spawnSync(process.execPath, [file], { cwd: ROOT, env, stdio: 'inherit' })
    const code = res.status ?? 1; summary.push({ suite, exitCode: code })
    if (code !== 0) failures.push(suite)
    console.log(`──────── SUITE ${suite}: exit=${code} ────────`)
  }


} finally {
  cleanup()
  for (const dbPath of tmpDbPaths) removeTmpDb(dbPath)
}
console.log('\n================= TỔNG KẾT =================')
for (const s of summary) console.log(`  ${s.exitCode === 0 ? 'PASS' : 'FAIL'}  ${s.suite} (exit=${s.exitCode})`)
console.log(`=============================================`)
if (failures.length) { console.error(`CÓ SUITE FAIL: ${failures.join(', ')}`); process.exit(1) }
console.log('TẤT CẢ SUITE PASS')
process.exit(0)
