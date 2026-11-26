// src/realtime/RealtimeClient.js
// Client SDK kết nối thời gian thực qua WebSocket với tự động fallback sang Server-Sent Events (SSE).
// Tuân thủ: Zero Mock Data, No Polling Spam, Exponential Backoff + Jitter, Throttling/Batching.

export class RealtimeClient {
  constructor(options = {}) {
    this.options = {
      wsUrl: options.wsUrl || this.getDefaultWsUrl(),
      sseUrl: options.sseUrl || '/api/realtime/sse',
      channels: options.channels || ['all', 'bookings', 'catalog'],
      baseDelay: 1000,
      maxDelay: 30000,
      jitterMax: 400,
      heartbeatInterval: 15000,
      batchWindowMs: 50,
      highFrequencyThreshold: 10,
      ...options,
    }

    this.ws = null
    this.sse = null
    this.transport = null // 'ws' | 'sse' | null
    this.status = 'disconnected' // 'connecting' | 'connected' | 'reconnecting' | 'disconnected'
    this.reconnectAttempts = 0
    this.reconnectTimer = null
    this.heartbeatTimer = null
    this.lastPingSentAt = null
    this.latency = null // Round-Trip Time tính bằng ms

    // Quản lý listener sự kiện: eventName -> Set(callback)
    this.listeners = new Map()

    // Batching buffer để throttle khi lưu lượng sự kiện vượt ngưỡng (>10 events/giây)
    this.eventBuffer = []
    this.batchTimer = null
    this.eventCountPerSecond = 0
    this.rateResetTimer = setInterval(() => {
      this.eventCountPerSecond = 0
    }, 1000)

    this.isManualClosed = false
  }

  getDefaultWsUrl() {
    if (typeof window === 'undefined') return ''
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${protocol}//${window.location.host}/api/realtime/ws`
  }

  connect() {
    if (this.status === 'connected' || this.status === 'connecting') return
    this.isManualClosed = false
    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting')
    this.connectWs()
  }

  connectWs() {
    this.cleanupTransports()

    try {
      this.ws = new WebSocket(this.options.wsUrl)
    } catch {
      this.fallbackToSse()
      return
    }

    this.ws.onopen = () => {
      this.transport = 'ws'
      this.setStatus('connected')
      this.reconnectAttempts = 0

      // Đăng ký các channel ban đầu
      if (this.options.channels.length > 0) {
        this.sendAction('subscribe', { channels: this.options.channels })
      }

      this.startHeartbeat()
    }

    this.ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        this.processPayload(payload)
      } catch {
        // Bỏ qua gói tin không parse được
      }
    }

    this.ws.onclose = () => {
      this.stopHeartbeat()
      this.transport = null

      if (!this.isManualClosed) {
        this.setStatus('reconnecting')
        this.scheduleReconnect()
      } else {
        this.setStatus('disconnected')
      }
    }

    this.ws.onerror = () => {
      if (this.reconnectAttempts >= 3 && !this.sse) {
        this.fallbackToSse()
      }
    }
  }

  fallbackToSse() {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
      this.scheduleReconnect()
      return
    }

    this.cleanupTransports()
    this.transport = 'sse'

    try {
      this.sse = new EventSource(this.options.sseUrl)

      this.sse.onopen = () => {
        this.setStatus('connected')
        this.reconnectAttempts = 0
      }

      this.sse.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          this.processPayload(payload)
        } catch {}
      }

      const domainEvents = [
        'booking:created',
        'booking:updated',
        'booking:cancelled',
        'payment:received',
        'catalog:updated',
        'inventory:changed',
        'telemetry:metrics',
        'connection:ready',
      ]

      for (const evName of domainEvents) {
        this.sse.addEventListener(evName, (event) => {
          try {
            const payload = JSON.parse(event.data)
            this.processPayload(payload)
          } catch {}
        })
      }

      this.sse.onerror = () => {
        if (!this.isManualClosed) {
          this.setStatus('reconnecting')
          this.scheduleReconnect()
        }
      }
    } catch {
      this.scheduleReconnect()
    }
  }

  scheduleReconnect() {
    if (this.isManualClosed || this.reconnectTimer) return

    // Thuật toán Exponential Backoff + Full Jitter:
    // delay = min(maxDelay, baseDelay * 1.5^attempt) + random(0, jitterMax)
    this.reconnectAttempts += 1
    const backoff = Math.min(
      this.options.maxDelay,
      this.options.baseDelay * Math.pow(1.5, Math.min(this.reconnectAttempts, 8)),
    )
    const jitter = Math.random() * this.options.jitterMax
    const delay = Math.round(backoff + jitter)

    this.emit('reconnect:attempt', {
      attempt: this.reconnectAttempts,
      delay,
    })

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }

  startHeartbeat() {
    this.stopHeartbeat()
    this.sendPing()
    this.heartbeatTimer = setInterval(() => {
      this.sendPing()
    }, this.options.heartbeatInterval)
  }

  sendPing() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.lastPingSentAt = performance.now()
      this.sendAction('ping', { clientTimestamp: Date.now() })
    }
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = null
    }
  }

  sendAction(action, data = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action, ...data }))
    }
  }

  subscribeChannel(channel) {
    if (!this.options.channels.includes(channel)) {
      this.options.channels.push(channel)
    }
    this.sendAction('subscribe', { channel })
  }

  unsubscribeChannel(channel) {
    this.options.channels = this.options.channels.filter((c) => c !== channel)
    this.sendAction('unsubscribe', { channel })
  }

  processPayload(payload) {
    if (!payload || typeof payload !== 'object') return
    const { event, timestamp, data: _data } = payload

    if (event === 'pong') {
      if (this.lastPingSentAt) {
        const rtt = Math.round(performance.now() - this.lastPingSentAt)
        this.latency = rtt
        this.emit('latency', { rtt, timestamp })
      }
      return
    }

    this.eventCountPerSecond += 1

    // Throttling / Batching khi tần suất cao (> 10 events/giây)
    if (this.eventCountPerSecond > this.options.highFrequencyThreshold) {
      this.eventBuffer.push(payload)
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.flushBatch()
        }, this.options.batchWindowMs)
      }
      return
    }

    this.dispatchPayload(payload)
  }

  flushBatch() {
    this.batchTimer = null
    const batch = this.eventBuffer.splice(0, this.eventBuffer.length)
    for (const payload of batch) {
      this.dispatchPayload(payload)
    }
  }

  dispatchPayload(payload) {
    const { event, data, timestamp } = payload
    this.emit(event, data, timestamp)
    this.emit('*', payload)
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event).add(callback)
    return () => this.off(event, callback)
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).delete(callback)
    }
  }

  emit(event, ...args) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb(...args)
        } catch {
          // Bảo vệ không làm hỏng chu kỳ dispatch
        }
      }
    }
  }

  setStatus(nextStatus) {
    if (this.status === nextStatus) return
    const prevStatus = this.status
    this.status = nextStatus
    this.emit('status', { status: nextStatus, prevStatus, transport: this.transport })
  }

  cleanupTransports() {
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.onerror = null
      try {
        this.ws.close()
      } catch {}
      this.ws = null
    }

    if (this.sse) {
      this.sse.onopen = null
      this.sse.onmessage = null
      this.sse.onerror = null
      try {
        this.sse.close()
      } catch {}
      this.sse = null
    }
  }

  disconnect() {
    this.isManualClosed = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopHeartbeat()
    this.cleanupTransports()
    this.setStatus('disconnected')
  }

  destroy() {
    this.disconnect()
    clearInterval(this.rateResetTimer)
    if (this.batchTimer) clearTimeout(this.batchTimer)
    this.listeners.clear()
  }
}
