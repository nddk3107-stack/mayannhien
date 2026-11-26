import { WebSocketServer, WebSocket } from 'ws'
import { EventEmitter } from 'node:events'
import os from 'node:os'
import { db, findSessionUser, createNotification } from './db.js'

class RealtimeEventBus extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(200)
  }

  publish(event, data, channel = 'all') {
    const payload = {
      event,
      timestamp: Date.now(),
      data,
    }
    this.emit('message', { channel, payload })
    return payload
  }
}

export const realtimeBus = new RealtimeEventBus()

export function broadcast(event, data, channel = 'all') {
  return realtimeBus.publish(event, data, channel)
}

export function broadcastBookingCreated(booking) {
  realtimeBus.publish('booking:created', { booking }, 'bookings')
  if (booking.userId) {
    realtimeBus.publish('booking:created', { booking }, `user:${booking.userId}`)
  }
}

export function broadcastBookingUpdated(booking) {
  realtimeBus.publish('booking:updated', { booking }, 'bookings')
  if (booking.userId) {
    realtimeBus.publish('booking:updated', { booking }, `user:${booking.userId}`)
  }
}

export function broadcastBookingCancelled(code, userId) {
  realtimeBus.publish('booking:cancelled', { code, status: 'Đã hủy', userId }, 'bookings')
  if (userId) {
    realtimeBus.publish('booking:cancelled', { code, status: 'Đã hủy' }, `user:${userId}`)
  }
}

export function broadcastPaymentReceived(paymentData) {
  realtimeBus.publish('payment:received', paymentData, 'bookings')
}

export function broadcastCatalogUpdated(kind, action, item) {
  realtimeBus.publish('catalog:updated', { kind, action, item }, 'catalog')
}

export function broadcastInventoryChanged(kind, id, details) {
  realtimeBus.publish('inventory:changed', { kind, id, details }, 'inventory')
}

export function pushNotification(userId, { title, message, type = 'system', link = '' }) {
  if (!userId) return null
  try {
    const notification = createNotification({ userId, title, message, type, link })
    if (notification) {
      realtimeBus.publish('notification:new', { notification }, `user:${userId}`)
      realtimeBus.publish('notification:new', { notification }, 'all')
    }
    return notification
  } catch (err) {
    console.error('[realtime] pushNotification failed:', err.message)
    return null
  }
}

function parseCookies(cookieHeader = '') {
  const cookies = {}
  if (!cookieHeader) return cookies
  const pairs = cookieHeader.split(';')
  for (const pair of pairs) {
    const idx = pair.indexOf('=')
    if (idx < 0) continue
    const key = pair.slice(0, idx).trim()
    const val = pair.slice(idx + 1).trim()
    cookies[key] = decodeURIComponent(val)
  }
  return cookies
}

function getLiveTelemetry(wsClientsCount = 0) {
  const mem = process.memoryUsage()
  const cpus = os.cpus()
  const load = os.loadavg()

  let totalBookings = 0
  let realRevenue = 0
  let activeUsers = 0
  let confirmedBookings = 0
  let cancelledBookings = 0

  try {
    const bStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status != 'Đã hủy' THEN total ELSE 0 END), 0) as revenue,
        SUM(CASE WHEN status = 'Đã xác nhận' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'Đã hủy' THEN 1 ELSE 0 END) as cancelled
      FROM bookings
    `).get()

    if (bStats) {
      totalBookings = bStats.total || 0
      realRevenue = bStats.revenue || 0
      confirmedBookings = bStats.confirmed || 0
      cancelledBookings = bStats.cancelled || 0
    }

    const uStats = db.prepare('SELECT COUNT(*) as count FROM users WHERE is_active = 1').get()
    if (uStats) activeUsers = uStats.count || 0
  } catch {
    // Fail-safe nếu SQLite đang bận
  }

  return {
    os: {
      uptime: Math.round(os.uptime()),
      loadAvg: [Number(load[0].toFixed(2)), Number(load[1].toFixed(2)), Number(load[2].toFixed(2))],
      freeMemMb: Math.round(os.freemem() / 1024 / 1024),
      totalMemMb: Math.round(os.totalmem() / 1024 / 1024),
      cpuCores: cpus.length,
    },
    process: {
      uptime: Math.round(process.uptime()),
      heapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
      rssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
    },
    realtime: {
      wsClients: wsClientsCount,
    },
    database: {
      totalBookings,
      confirmedBookings,
      cancelledBookings,
      realRevenue,
      activeUsers,
    },
  }
}

export function initRealtimeServer(httpServer, expressApp) {
  const wss = new WebSocketServer({ noServer: true })
  const sseClients = new Set()

  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
    if (url.pathname === '/api/realtime/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request)
      })
    }
  })

  wss.on('connection', (ws, req) => {
    ws.isAlive = true
    ws.channels = new Set(['all', 'bookings', 'catalog'])

    const cookies = parseCookies(req.headers.cookie)
    const sessionToken = cookies.session
    if (sessionToken) {
      try {
        const user = findSessionUser(sessionToken)
        if (user) {
          ws.userId = user.id
          ws.channels.add(`user:${user.id}`)
          if (user.role === 'admin') {
            ws.channels.add('telemetry')
            ws.channels.add('admin')
          }
        }
      } catch {}
    }

    ws.on('pong', () => {
      ws.isAlive = true
    })

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        const action = msg.action

        if (action === 'ping') {
          ws.send(JSON.stringify({
            event: 'pong',
            timestamp: Date.now(),
            data: { clientTimestamp: msg.clientTimestamp || null },
          }))
          return
        }

        if (action === 'subscribe') {
          const channels = Array.isArray(msg.channels) ? msg.channels : [msg.channel].filter(Boolean)
          for (const ch of channels) {
            ws.channels.add(String(ch))
          }
          ws.send(JSON.stringify({
            event: 'subscribed',
            timestamp: Date.now(),
            data: { channels: Array.from(ws.channels) },
          }))
          return
        }

        if (action === 'unsubscribe') {
          const channels = Array.isArray(msg.channels) ? msg.channels : [msg.channel].filter(Boolean)
          for (const ch of channels) {
            ws.channels.delete(String(ch))
          }
          ws.send(JSON.stringify({
            event: 'unsubscribed',
            timestamp: Date.now(),
            data: { channels: Array.from(ws.channels) },
          }))
          return
        }

        if (action === 'get_telemetry') {
          const data = getLiveTelemetry(wss.clients.size)
          ws.send(JSON.stringify({
            event: 'telemetry:metrics',
            timestamp: Date.now(),
            data,
          }))
        }
      } catch {
        ws.send(JSON.stringify({
          event: 'error',
          timestamp: Date.now(),
          data: { error: 'Invalid JSON message' },
        }))
      }
    })

    ws.send(JSON.stringify({
      event: 'connection:ready',
      timestamp: Date.now(),
      data: {
        status: 'connected',
        channels: Array.from(ws.channels),
        userId: ws.userId || null,
      },
    }))
  })

  // Heartbeat ping interval: 20 seconds
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        return ws.terminate()
      }
      ws.isAlive = false
      ws.ping()
    })
  }, 20000)

  // Live Telemetry broadcast interval: 4 seconds (khi có subscriber)
  const telemetryInterval = setInterval(() => {
    let hasTelemetrySubscribers = false
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN && ws.channels.has('telemetry')) {
        hasTelemetrySubscribers = true
      }
    })

    if (!hasTelemetrySubscribers && sseClients.size === 0) return

    const telemetry = getLiveTelemetry(wss.clients.size)
    const payload = {
      event: 'telemetry:metrics',
      timestamp: Date.now(),
      data: telemetry,
    }
    const raw = JSON.stringify(payload)

    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN && ws.channels.has('telemetry')) {
        ws.send(raw)
      }
    })

    sseClients.forEach((res) => {
      res.write(`event: telemetry:metrics\ndata: ${raw}\n\n`)
    })
  }, 4000)

  realtimeBus.on('message', ({ channel, payload }) => {
    const raw = JSON.stringify(payload)

    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (channel === 'all' || ws.channels.has(channel)) {
          ws.send(raw)
        }
      }
    })

    sseClients.forEach((res) => {
      res.write(`event: ${payload.event}\ndata: ${raw}\n\n`)
    })
  })

  if (expressApp) {
    expressApp.get('/api/realtime/sse', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache, no-transform')
      res.setHeader('Connection', 'keep-alive')
      res.setHeader('X-Accel-Buffering', 'no')
      res.flushHeaders?.()

      const ssePing = setInterval(() => {
        res.write(': keepalive\n\n')
      }, 15000)

      sseClients.add(res)

      res.write(`event: connection:ready\ndata: ${JSON.stringify({
        event: 'connection:ready',
        timestamp: Date.now(),
        data: { status: 'connected', transport: 'sse' },
      })}\n\n`)

      req.on('close', () => {
        clearInterval(ssePing)
        sseClients.delete(res)
      })
    })

    expressApp.get('/api/realtime/telemetry', (_req, res) => {
      res.json({
        ok: true,
        data: getLiveTelemetry(wss.clients.size),
        timestamp: Date.now(),
      })
    })
  }

  return {
    wss,
    close: () => {
      clearInterval(heartbeatInterval)
      clearInterval(telemetryInterval)
      wss.close()
    },
  }
}
