// src/realtime/RealtimeContext.jsx
// React Context và Hook cung cấp kết nối Real-Time cho toàn bộ ứng dụng.
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { RealtimeClient } from './realtimeClient.js'

const RealtimeContext = createContext(null)

export function RealtimeProvider({ children }) {
  const [status, setStatus] = useState('connecting')
  const [transport, setTransport] = useState(null)
  const [latency, setLatency] = useState(null)
  const [lastTelemetry, setLastTelemetry] = useState(null)
  const [lastEvent, setLastEvent] = useState(null)

  const client = useMemo(() => new RealtimeClient(), [])

  useEffect(() => {
    const unsubStatus = client.on('status', ({ status, transport }) => {
      setStatus(status)
      setTransport(transport)
    })

    const unsubLatency = client.on('latency', ({ rtt }) => {
      setLatency(rtt)
    })

    const unsubTelemetry = client.on('telemetry:metrics', (data) => {
      setLastTelemetry(data)
    })

    const unsubAll = client.on('*', (payload) => {
      setLastEvent(payload)
    })

    client.connect()

    return () => {
      unsubStatus()
      unsubLatency()
      unsubTelemetry()
      unsubAll()
      client.destroy()
    }
  }, [client])

  const contextValue = useMemo(
    () => ({
      client,
      status,
      transport,
      latency,
      lastTelemetry,
      lastEvent,
      subscribe: (event, handler) => client.on(event, handler),
      sendAction: (action, data) => client.sendAction(action, data),
    }),
    [client, status, transport, latency, lastTelemetry, lastEvent],
  )

  return <RealtimeContext.Provider value={contextValue}>{children}</RealtimeContext.Provider>
}

export function useRealtime() {
  const ctx = useContext(RealtimeContext)
  if (!ctx) {
    throw new Error('useRealtime phải được dùng bên trong <RealtimeProvider>')
  }
  return ctx
}
