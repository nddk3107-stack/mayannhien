// src/components/SavedPassengerQuickPicker.jsx — Bộ chọn nhanh hành khách đã lưu cho Checkout
import React, { useState, useEffect } from 'react'
import { Users, Zap, Check } from 'lucide-react'
import { apiFetch } from '../services/api.js'

export default function SavedPassengerQuickPicker({ session, onSelect }) {
  const [passengers, setPassengers] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [justSelected, setJustSelected] = useState('')

  useEffect(() => {
    if (!session) return
    let active = true
    apiFetch('/api/profile/passengers').then((res) => {
      if (active && res.ok && Array.isArray(res.data?.passengers)) {
        setPassengers(res.data.passengers)
      }
    }).catch(() => {})
    return () => { active = false }
  }, [session])

  if (!session || passengers.length === 0) return null

  const handlePick = (p) => {
    setSelectedId(String(p.id))
    setJustSelected(p.full_name)
    onSelect(p)
    setTimeout(() => setJustSelected(''), 2500)
  }

  const handleSelectChange = (e) => {
    const val = e.target.value
    setSelectedId(val)
    if (!val) return
    const found = passengers.find((p) => String(p.id) === val)
    if (found) {
      handlePick(found)
    }
  }

  return (
    <div className="quick-passenger-bar" role="region" aria-label="Chọn nhanh từ hành khách đã lưu">
      <div className="quick-passenger-title">
        <Users size={15} strokeWidth={2} />
        <span>Chọn nhanh từ Hành khách đã lưu:</span>
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        {passengers.slice(0, 4).map((p) => (
          <button
            key={p.id}
            type="button"
            className="quick-passenger-pill"
            style={{
              borderColor: selectedId === String(p.id) ? '#0284c7' : undefined,
              background: selectedId === String(p.id) ? 'rgba(2, 132, 199, 0.12)' : undefined,
              color: selectedId === String(p.id) ? '#0284c7' : undefined,
            }}
            onClick={() => handlePick(p)}
            title={`Điền thông tin của ${p.full_name} (${p.phone || p.id_number || ''})`}
          >
            <span>{p.full_name}</span>
            <small style={{ opacity: 0.75, fontSize: '11px' }}>({p.label || 'Khách'})</small>
          </button>
        ))}

        {passengers.length > 4 && (
          <select
            value={selectedId}
            onChange={handleSelectChange}
            style={{
              padding: '3px 8px',
              borderRadius: '999px',
              fontSize: '12px',
              fontWeight: 600,
              border: '1px solid #cbd5e1',
              background: 'var(--tl-panel, #ffffff)',
              color: 'var(--tl-fg, #0f172a)',
              cursor: 'pointer',
            }}
          >
            <option value="">Xem thêm {passengers.length - 4} khách khác…</option>
            {passengers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name} ({p.label || 'Khách'}) {p.phone ? `· ${p.phone}` : ''}
              </option>
            ))}
          </select>
        )}

        {justSelected && (
          <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: '6px' }}>
            <Check size={13} strokeWidth={2.5} /> Đã điền 1-chạm: {justSelected}
          </span>
        )}
      </div>
    </div>
  )
}
