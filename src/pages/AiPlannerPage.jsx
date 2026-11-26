// src/pages/AiPlannerPage.jsx — Trợ lý AI Lập Lịch trình Du lịch (AI Travel Planner).
import { useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Building2,
  Calendar,
  Camera,
  CheckCircle2,
  CloudSun,
  Compass,
  FerrisWheel,
  Flower2,
  Globe,
  MapPin,
  Moon,
  Plane,
  Sailboat,
  Sparkles,
  Star,
  Sun,
  Sunrise,
  Utensils,
  Waves,
  XCircle,
} from 'lucide-react'
import { apiFetch } from '../services/api.js'

const PRESET_CHIPS = [
  { icon: Compass, label: 'Đà Nẵng 3 ngày 2 đêm', prompt: 'Du lịch Đà Nẵng 3 ngày 2 đêm ngân sách 5 triệu cho 2 người' },
  { icon: Waves, label: 'Nghỉ dưỡng Phú Quốc 4 ngày', prompt: 'Nghỉ dưỡng Phú Quốc 4 ngày 3 đêm cho gia đình 4 người ngân sách 15 triệu' },
  { icon: Flower2, label: 'Khám phá Đà Lạt ngắm hoa', prompt: 'Du lịch Đà Lạt 3 ngày 2 đêm lãng mạn tiết kiệm cho 2 người ngân sách 4 triệu' },
  { icon: Sailboat, label: 'Du ngoạn Vịnh Hạ Long', prompt: 'Du ngoạn Vịnh Hạ Long 2 ngày 1 đêm cao cấp cho 2 người ngân sách 6 triệu' },
]

export function AiPlannerPage({ session: _session, onNavigate, onChooseItem }) {
  const [prompt, setPrompt] = useState('Du lịch Đà Nẵng 3 ngày 2 đêm ngân sách 5 triệu cho 2 người')
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const [bookingLoading] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState(null)

  const handleGenerate = async (targetPrompt) => {
    const textToUse = targetPrompt || prompt
    if (!textToUse.trim()) return
    setLoading(true)
    setError('')
    setBookingSuccess(null)
    try {
      const res = await apiFetch('/api/ai/travel-planner', {
        method: 'POST',
        body: { prompt: textToUse.trim() },
      })
      if (res.ok && res.data?.data) {
        setPlan(res.data.data)
      } else {
        setError(res.data?.error || 'Không thể lập lịch trình. Vui lòng thử lại.')
      }
    } catch {
      setError('Lỗi kết nối máy chủ. Vui lòng thử lại sau.')
    } finally {
      setLoading(false)
    }
  }

    const handleOneClickBooking = () => {
    if (!plan) return
    const departDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
    const returnDate = new Date(Date.now() + (7 + plan.nights) * 86400000).toISOString().slice(0, 10)
    const comboPackageItem = {
      id: "ai-pkg-" + plan.selectedHotel.id,
      serviceType: "combo",
      name: "Gói Du Lịch AI: " + plan.destination + " (" + plan.days + "N" + plan.nights + "Đ)",
      price: plan.pricing?.totalRealCost || plan.totalCost || 0,
      location: plan.destination,
      description: plan.summary,
      selectedMeta: {
        destination: plan.destination,
        departDate,
        returnDate,
        hotelName: plan.selectedHotel.name,
        roomName: plan.selectedRoom.name,
        flightInfo: plan.selectedFlight.airline + " (" + plan.selectedFlight.from + " → " + plan.selectedFlight.to + ")",
        seatClass: "Phổ thông",
        seat: "2A",
        extras: (plan.pricing?.breakdown?.extras || plan.costBreakdown?.extraServices || plan.selectedExtraServices || []).map((e) => e.name).join(", "),
      },
    }
    if (typeof onChooseItem === "function") {
      onChooseItem(comboPackageItem, "checkout")
    } else {
      onNavigate?.("checkout")
    }
  }

  return (
    <div className="container" style={{ padding: '30px 20px', maxWidth: '1100px' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '6px 16px', borderRadius: '20px', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>
            <Sparkles size={15} strokeWidth={1.8} /> MÂY AN NHIÊN AI TRAVEL PLANNER
          </div>
        </div>
        <h1 style={{ fontSize: '2.4rem', margin: '0 0 12px 0', color: 'var(--text-primary)' }}>
          Trợ Lý AI Lập Lịch Trình Du Lịch Thông Minh
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', maxWidth: '700px', margin: '0 auto' }}>
          Nhập kế hoạch du lịch bằng lời tự nhiên. AI sẽ tự động phân tích và xây dựng lịch trình từng ngày tối ưu nhất cho bạn.
        </p>
      </div>

      {/* Input Box & Preset Chips */}
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '20px', padding: '28px', boxShadow: '0 8px 30px rgba(0,0,0,0.06)', marginBottom: '32px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Mô tả nhu cầu của bạn (VD: Du lịch Phú Quốc 4 ngày 3 đêm cho 2 người ngân sách 8 triệu...)"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleGenerate() }}
            style={{
              flex: 1,
              minWidth: '280px',
              padding: '16px 20px',
              borderRadius: '12px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              fontSize: '1.05rem',
              outline: 'none',
              transition: 'border-color 0.2s',
            }}
          />
          <button
            type="button"
            onClick={() => handleGenerate()}
            disabled={loading || !prompt.trim()}
            className="register-btn"
            style={{
              padding: '16px 32px',
              borderRadius: '12px',
              fontSize: '1.05rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            {loading ? (
              <><Bot size={18} strokeWidth={1.8} /> Đang phân tích...</>
            ) : (
              <><Sparkles size={18} strokeWidth={1.8} /> Lập lịch trình</>
            )}
          </button>
        </div>

        {/* Preset Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <small style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Gợi ý nhanh:</small>
          {PRESET_CHIPS.map((chip, idx) => {
            const ChipIcon = chip.icon
            return (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPrompt(chip.prompt)
                  handleGenerate(chip.prompt)
                }}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-primary)',
                  borderRadius: '20px',
                  padding: '6px 14px',
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <ChipIcon size={14} strokeWidth={1.8} /> {chip.label}
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div style={{ padding: '16px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.5)', color: 'var(--text-primary)', borderRadius: '12px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <XCircle size={18} strokeWidth={1.8} /> {error}
        </div>
      )}

      {/* Plan Details Output */}
      {plan && (
        <div className="ai-plan-container">
          {/* Summary Card */}
          <div style={{ background: 'linear-gradient(135deg, #1e1b4b, #312e81)', color: '#fff', borderRadius: '20px', padding: '28px', marginBottom: '28px', boxShadow: '0 10px 30px rgba(49, 46, 129, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
              <span style={{ background: 'rgba(255,255,255,0.2)', padding: '4px 12px', borderRadius: '14px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <MapPin size={14} strokeWidth={1.8} /> Điểm đến: {plan.destination} · {plan.days} Ngày {plan.nights} Đêm · {plan.guests} Khách
              </span>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#38bdf8' }}>
                Tổng dự toán: {new Intl.NumberFormat('vi-VN').format(plan.totalCost)}₫
              </span>
            </div>
            <p style={{ fontSize: '1.05rem', lineHeight: '1.6', margin: 0, opacity: 0.95 }}>
              {plan.summary}
            </p>
          </div>

          {/* Budget Progress Bar */}
          {plan.userBudget > 0 && (
            <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: '20px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.95rem' }}>
                <span>
                  <b>Ngân sách dự kiến:</b> {new Intl.NumberFormat('vi-VN').format(plan.userBudget)}₫
                </span>
                <span>
                  <b>Chi phí thực tế:</b> {new Intl.NumberFormat('vi-VN').format(plan.totalCost)}₫
                </span>
              </div>
              <div style={{ width: '100%', height: '12px', background: 'var(--bg-elevated)', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min((plan.totalCost / plan.userBudget) * 100, 100)}%`,
                    background: plan.budgetStatus === 'within_budget' ? '#10b981' : '#f59e0b',
                    borderRadius: '6px',
                    transition: 'width 0.5s ease',
                  }}
                ></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {plan.budgetStatus === 'within_budget' ? (
                  <span style={{ color: 'color-mix(in srgb, #059669 55%, var(--text-primary))', fontWeight: 600, fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} strokeWidth={1.8} /> Tiết kiệm {new Intl.NumberFormat('vi-VN').format(plan.budgetDifference)}₫ so với ngân sách!
                  </span>
                ) : (
                  <span style={{ color: 'color-mix(in srgb, #d97706 55%, var(--text-primary))', fontWeight: 600, fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={16} strokeWidth={1.8} /> Vượt ngân sách {new Intl.NumberFormat('vi-VN').format(plan.budgetDifference)}₫ (do chọn dịch vụ tiêu chuẩn cao)
                  </span>
                )}
                <small style={{ color: 'var(--text-muted)' }}>Giá niêm yết trực tiếp</small>
              </div>
            </div>
          )}

          {/* Destination Web Insights Section */}
          {plan.webData && (
            <div className="ai-web-insights-card" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: '24px', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
                  <Globe size={20} color="#0194f3" /> Thông tin & Mẹo du lịch từ Web ({plan.destination})
                </h3>
                <span style={{ fontSize: '0.8rem', background: 'rgba(1, 148, 243, 0.12)', color: '#0194f3', border: '1px solid rgba(1, 148, 243, 0.25)', borderRadius: '12px', padding: '3px 10px', fontWeight: 700 }}>
                  Đồng bộ Live Web 2026
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-default)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CloudSun size={16} /> Thời tiết & Mùa lý tưởng
                  </div>
                  <p style={{ margin: '0 0 4px', fontSize: '0.88rem', color: 'var(--text-primary)' }}>{plan.webData.weather}</p>
                  <small style={{ color: 'var(--text-muted)' }}>Mùa đẹp nhất: <b>{plan.webData.bestSeason}</b></small>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-default)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Utensils size={16} /> Món ngon bản địa đặc sắc
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                    {plan.webData.topFoods?.join(' · ')}
                  </p>
                </div>
                <div style={{ background: 'var(--bg-elevated)', borderRadius: '12px', padding: '14px', border: '1px solid var(--border-default)' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '6px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Camera size={16} /> Điểm check-in hot trend
                  </div>
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                    {plan.webData.trendingAttractions?.join(' · ')}
                  </p>
                </div>
              </div>
              {plan.webData.localTips && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: 'rgba(56, 189, 248, 0.08)', borderRadius: '10px', fontSize: '0.88rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sparkles size={16} color="#38bdf8" style={{ flexShrink: 0 }} />
                  <span><b>Mẹo du lịch bản địa:</b> {plan.webData.localTips}</span>
                </div>
              )}
            </div>
          )}

          {/* Selected Real Services Grid */}
          <h2 style={{ fontSize: '1.4rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={22} strokeWidth={1.8} /> Dịch vụ thực tế được đề xuất
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            {/* Flight Card */}
            {plan.selectedFlight && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ background: 'rgba(14,165,233,0.15)', color: 'var(--brand-primary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Plane size={14} strokeWidth={1.8} /> Chuyến bay
                    </span>
                    <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{plan.selectedFlight.airline}</span>
                  </div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {plan.selectedFlight.from} <ArrowRight size={15} strokeWidth={1.8} /> {plan.selectedFlight.to}
                  </h3>
                  <p style={{ margin: '0 0 12px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Giờ bay: {plan.selectedFlight.depart} - {plan.selectedFlight.arrive} ({plan.selectedFlight.duration})
                  </p>
                </div>
                <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{plan.guests} vé</span>
                  <span style={{ fontWeight: 700, color: 'color-mix(in srgb, #dc2626 55%, var(--text-primary))' }}>{new Intl.NumberFormat('vi-VN').format(plan.selectedFlight.price * plan.guests)}₫</span>
                </div>
              </div>
            )}

            {/* Hotel Card */}
            {plan.selectedHotel && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ background: 'rgba(245,158,11,0.18)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Building2 size={14} strokeWidth={1.8} /> Khách sạn
                    </span>
                    <span style={{ color: 'color-mix(in srgb, #f59e0b 55%, var(--text-primary))', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                      {Array.from({ length: Number(plan.selectedHotel.stars) || 4 }).map((_, idx) => (
                        <Star key={idx} size={13} strokeWidth={1.8} fill="currentColor" />
                      ))}
                    </span>
                  </div>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '1.1rem' }}>{plan.selectedHotel.name}</h3>
                  <p style={{ margin: '0 0 8px 0', color: 'var(--text-muted)', fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <MapPin size={14} strokeWidth={1.8} /> {plan.selectedHotel.location}
                  </p>
                  {plan.selectedRoom && (
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-primary)' }}>
                      Phòng: <b>{plan.selectedRoom.name}</b> ({plan.selectedRoom.bedType})
                    </div>
                  )}
                </div>
                <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{plan.nights} đêm</span>
                  <span style={{ fontWeight: 700, color: 'color-mix(in srgb, #dc2626 55%, var(--text-primary))' }}>{new Intl.NumberFormat('vi-VN').format(plan.costBreakdown.room.total)}₫</span>
                </div>
              </div>
            )}

            {/* Extra Services Card */}
            {plan.selectedExtraServices && plan.selectedExtraServices.length > 0 && (
              <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ background: 'rgba(34,197,94,0.18)', color: 'var(--text-primary)', padding: '4px 10px', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <FerrisWheel size={14} strokeWidth={1.8} /> Dịch vụ trải nghiệm
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{plan.selectedExtraServices.length} mục</span>
                  </div>
                  {plan.selectedExtraServices.map((extra) => (
                    <div key={extra.id} style={{ marginBottom: '10px' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>• {extra.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>{extra.description}</div>
                    </div>
                  ))}
                </div>
                <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Tất cả dịch vụ</span>
                  <span style={{ fontWeight: 700, color: 'color-mix(in srgb, #dc2626 55%, var(--text-primary))' }}>
                    {new Intl.NumberFormat('vi-VN').format(plan.costBreakdown.extraServices.reduce((acc, c) => acc + c.total, 0))}₫
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Day by Day Itinerary */}
          <h2 style={{ fontSize: '1.4rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={22} strokeWidth={1.8} /> Lịch trình khám phá chi tiết
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
            {plan.itinerary.map((day) => (
              <div key={day.day} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-default)', borderRadius: '16px', padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--brand-primary)' }}>{day.title}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '14px', borderRadius: '10px', color: 'var(--text-primary)' }}>
                    <div style={{ fontWeight: 600, color: 'var(--brand-primary)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sunrise size={16} strokeWidth={1.8} /> Buổi sáng:
                    </div>
                    <div style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{day.morning}</div>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '14px', borderRadius: '10px', color: 'var(--text-primary)' }}>
                    <div style={{ fontWeight: 600, color: 'color-mix(in srgb, #f97316 55%, var(--text-primary))', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sun size={16} strokeWidth={1.8} /> Buổi chiều:
                    </div>
                    <div style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{day.afternoon}</div>
                  </div>
                  <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', padding: '14px', borderRadius: '10px', color: 'var(--text-primary)' }}>
                    <div style={{ fontWeight: 600, color: 'color-mix(in srgb, #818cf8 55%, var(--text-primary))', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Moon size={16} strokeWidth={1.8} /> Buổi tối:
                    </div>
                    <div style={{ fontSize: '0.95rem', lineHeight: '1.5' }}>{day.evening}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Booking Success Banner */}
          {bookingSuccess && (
            <div style={{ background: 'rgba(16,185,129,0.12)', border: '2px solid #10b981', borderRadius: '16px', padding: '24px', marginBottom: '24px', textAlign: 'center' }}>
              <div style={{ marginBottom: '8px', color: 'color-mix(in srgb, #059669 55%, var(--text-primary))' }}>
                <CheckCircle2 size={42} strokeWidth={1.8} />
              </div>
              <h2 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>Đặt trọn gói thành công!</h2>
              <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)' }}>
                Mã đơn hàng: <b>{bookingSuccess.code}</b> ({bookingSuccess.title}) · Tổng tiền: <b>{new Intl.NumberFormat('vi-VN').format(bookingSuccess.total)}₫</b>
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
                <button
                  type="button"
                  className="register-btn"
                  onClick={() => onNavigate('bookings')}
                  style={{ padding: '10px 24px', borderRadius: '8px' }}
                >
                  Xem đơn tại "Đặt chỗ của tôi"
                </button>
              </div>
            </div>
          )}

          {/* One-Click Booking Action Bar */}
          {!bookingSuccess && (
            <div style={{ background: 'var(--bg-surface)', border: '2px solid #6366f1', borderRadius: '20px', padding: '24px', textAlign: 'center', boxShadow: '0 10px 30px rgba(99, 102, 241, 0.15)' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.3rem' }}>Sẵn sàng cho chuyến du lịch trong mơ?</h3>
              <p style={{ color: 'var(--text-muted)', margin: '0 0 20px 0' }}>
                Tất cả dịch vụ đã được chuẩn hóa và tính toán khớp 100% với giá niêm yết trong hệ thống.
              </p>
              <button
                type="button"
                className="register-btn"
                onClick={handleOneClickBooking}
                disabled={bookingLoading}
                style={{
                  padding: '16px 36px',
                  borderRadius: '14px',
                  fontSize: '1.15rem',
                  fontWeight: 700,
                  cursor: bookingLoading ? 'not-allowed' : 'pointer',
                  background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {bookingLoading ? 'Đang tạo đơn đặt hàng...' : (
                  <><Sparkles size={18} strokeWidth={1.8} /> Đặt trọn gói 1 chạm ngay</>
                )}
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  )
}

export default AiPlannerPage

