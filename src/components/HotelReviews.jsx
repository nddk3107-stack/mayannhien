// src/components/HotelReviews.jsx — Đánh giá & phản ánh khách sạn từ khách hàng
import { useEffect, useState } from 'react'
import {
  BellRing,
  Check,
  CheckCircle2,
  Megaphone,
  MessageSquare,
  Star,
} from 'lucide-react'
import { apiFetch } from '../services/api.js'
import { formatDateVN } from '../data/extraServices.js'
import { todayISO } from '../data/constants.js'
import { useRealtime } from '../realtime/RealtimeContext.jsx'

export const FEEDBACK_CATEGORIES = ['Phòng ốc', 'Vệ sinh', 'Dịch vụ / Nhân viên', 'Tiện nghi / Wi-Fi', 'Khác']

export function HotelReviews({ hotelId, session, compact = false }) {
  const [reviews, setReviews] = useState([])
  const [filterTab, setFilterTab] = useState('all') // all | review | feedback | 5star
  const [mode, setMode] = useState('review') // review | feedback
  const [category, setCategory] = useState(FEEDBACK_CATEGORIES[0])
  const [name, setName] = useState(session?.name || '')
  const [rating, setRating] = useState(5)
  const [text, setText] = useState('')
  const [hoverRating, setHoverRating] = useState(0)
  const [submittedMsg, setSubmittedMsg] = useState('')
  const { subscribe } = useRealtime()

  useEffect(() => {
    let active = true
    apiFetch(`/api/hotels/${hotelId}/reviews`).then((res) => {
      const items = res.data?.reviews || res.data?.items || []
      if (active && res.ok && Array.isArray(items)) {
        setReviews(items.map((r) => ({
          id: r.id,
          userId: r.user_id || r.userId,
          avatar_url: r.avatar_url || r.avatarUrl || '',
          type: r.category ? 'feedback' : 'review',
          category: r.category,
          name: r.user_name || r.userName || r.name || 'Khách hàng',
          rating: r.rating,
          text: r.comment || r.text || '',
          date: (r.created_at || r.createdAt || todayISO).slice(0, 10),
        })))
      }
    }).catch(() => { })
    return () => { active = false }
  }, [hotelId])

  useEffect(() => {
    if (session?.name && !name) setName(session.name)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.name])

  useEffect(() => {
    if (!subscribe) return
    const unsub = subscribe('user:avatar:updated', (payload) => {
      const data = payload?.data || payload
      if (!data?.userId) return
      setReviews((prev) =>
        prev.map((rev) =>
          Number(rev.userId) === Number(data.userId)
            ? { ...rev, avatar_url: data.avatarUrl || '' }
            : rev,
        ),
      )
    })
    return () => unsub?.()
  }, [subscribe])

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '—'

  const filteredReviews = reviews.filter((r) => {
    if (filterTab === 'review') return r.type !== 'feedback'
    if (filterTab === 'feedback') return r.type === 'feedback'
    if (filterTab === '5star') return r.rating === 5
    return true
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !text.trim()) return
    const reviewData = {
      rating,
      comment: text.trim(),
      category: mode === 'feedback' ? category : null,
      userName: name.trim(),
    }

    const res = await apiFetch(`/api/hotels/${hotelId}/reviews`, {
      method: 'POST',
      body: reviewData,
    })
    const newReview = res.ok && res.data?.review ? {
      id: res.data.review.id,
      type: mode,
      category: mode === 'feedback' ? category : undefined,
      name: name.trim(),
      rating,
      text: text.trim(),
      date: todayISO,
    } : {
      id: `rev-${Date.now()}`,
      type: mode,
      category: mode === 'feedback' ? category : undefined,
      name: name.trim(),
      rating,
      text: text.trim(),
      date: todayISO,
    }

    setReviews((prev) => [newReview, ...prev])
    setText('')
    setRating(5)
    setSubmittedMsg(mode === 'feedback'
      ? 'Phản ánh của bạn đã được ghi nhận trực tiếp vào hệ thống!'
      : 'Cảm ơn bạn đã gửi bình luận & đánh giá thật!')
    window.setTimeout(() => setSubmittedMsg(''), 3500)
  }

  const avgStarCount = Math.round(Number(avgRating) || 0)

  return (
    <div className={`hotel-reviews ${compact ? 'compact' : ''}`}>
      <div className="reviews-header">
        <div>
          <h2>
            <MessageSquare size={20} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Đánh giá & Phản ánh từ khách hàng
          </h2>
          <p className="muted">Chia sẻ trải nghiệm lưu trú hoặc gửi phản ánh để khách sạn nâng cao chất lượng.</p>
        </div>
        <div className="reviews-summary">
          <span className="reviews-avg">{avgRating}</span>
          <div>
            <span className="reviews-stars" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              {Array.from({ length: avgStarCount }).map((_, idx) => (
                <Star key={idx} size={14} strokeWidth={1.8} fill="currentColor" />
              ))}
            </span>
            <small>{reviews.length} lượt đánh giá & phản ánh</small>
          </div>
        </div>
      </div>

      <div className="reviews-filter-bar">
        <button
          type="button"
          className={`momo-filter-chip ${filterTab === 'all' ? 'active' : ''}`}
          onClick={() => setFilterTab('all')}
        >
          Tất cả ({reviews.length})
        </button>
        <button
          type="button"
          className={`momo-filter-chip ${filterTab === 'review' ? 'active' : ''}`}
          onClick={() => setFilterTab('review')}
        >
          <Star size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Bình luận ({reviews.filter((r) => r.type !== 'feedback').length})
        </button>
        <button
          type="button"
          className={`momo-filter-chip ${filterTab === 'feedback' ? 'active' : ''}`}
          onClick={() => setFilterTab('feedback')}
        >
          <Megaphone size={13} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Phản ánh ({reviews.filter((r) => r.type === 'feedback').length})
        </button>
        <button
          type="button"
          className={`momo-filter-chip ${filterTab === '5star' ? 'active' : ''}`}
          onClick={() => setFilterTab('5star')}
        >
          5 sao
        </button>
      </div>

      <div className="reviews-list">
        {filteredReviews.map((review) => (
          <article key={review.id} className={`review-card ${review.type === 'feedback' ? 'is-feedback' : ''}`}>
            <div className="review-top">
              <div className="review-avatar">
                {review.avatar_url ? (
                  <img
                    src={review.avatar_url}
                    alt={review.name || review.user_name}
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                  />
                ) : (
                  (review.name || review.user_name || 'K').charAt(0).toUpperCase()
                )}
              </div>
              <div className="review-top-info">
                <div className="review-name-row">
                  <b>{review.name}</b>
                  {review.type === 'feedback' ? (
                    <span className="review-type-badge feedback">
                      <Megaphone size={12} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Phản ánh · {review.category || 'Dịch vụ'}
                    </span>
                  ) : (
                    <span className="review-type-badge verified">
                      <Check size={12} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Đánh giá lưu trú
                    </span>
                  )}
                </div>
                <div className="review-meta">
                  <span className="review-stars" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        size={13}
                        strokeWidth={1.8}
                        fill={s <= review.rating ? 'currentColor' : 'none'}
                      />
                    ))}
                  </span>
                  <small>{formatDateVN(review.date)}</small>
                </div>
              </div>
            </div>
            <p>{review.text}</p>
            {review.type === 'feedback' && (
              <div className="feedback-reply-note">
                <BellRing size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Bộ phận CSKH Mây An Nhiên đã tiếp nhận phản ánh này.
              </div>
            )}
          </article>
        ))}

        {filteredReviews.length === 0 && <p className="muted">Chưa có mục nào trong bộ lọc này. Hãy chia sẻ ý kiến của bạn bên dưới!</p>}
      </div>

      <form className="review-form" onSubmit={handleSubmit}>
        <div className="review-mode-tabs">
          <button
            type="button"
            className={`momo-pill-btn ${mode === 'review' ? 'active' : ''}`}
            onClick={() => setMode('review')}
          >
            <Star size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Viết bình luận / Đánh giá
          </button>
          <button
            type="button"
            className={`momo-pill-btn ${mode === 'feedback' ? 'active' : ''}`}
            onClick={() => setMode('feedback')}
          >
            <Megaphone size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Gửi phản ánh / Góp ý
          </button>
        </div>

        {submittedMsg && (
          <p className="review-success" role="status">
            <CheckCircle2 size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> {submittedMsg}
          </p>
        )}

        <div className="review-form-fields">
          <div className="review-form-row">
            <label className="field">
              <span>Tên của bạn</span>
              <input value={name} maxLength={40} placeholder="VD: Nguyễn Văn A" onChange={(e) => setName(e.target.value)} />
            </label>
            {mode === 'feedback' && (
              <label className="field">
                <span>Hạng mục phản ánh</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {FEEDBACK_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="review-rating-input">
            <span>Mức hài lòng:</span>
            <div className="star-selector">
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = star <= (hoverRating || rating)
                return (
                  <button
                    type="button"
                    key={star}
                    className={isActive ? 'star active' : 'star'}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    aria-label={`${star} sao`}
                  >
                    <Star size={18} strokeWidth={1.8} fill={isActive ? 'currentColor' : 'none'} />
                  </button>
                )
              })}
            </div>
          </div>
          <label className="field wide">
            <span>{mode === 'feedback' ? 'Nội dung phản ánh / góp ý' : 'Nội dung bình luận'}</span>
            <textarea
              value={text}
              maxLength={500}
              rows={3}
              placeholder={mode === 'feedback'
                ? 'Mô tả vấn đề bạn gặp phải để khách sạn xử lý kịp thời...'
                : 'Chia sẻ trải nghiệm của bạn về phòng, dịch vụ, vị trí...'}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
        </div>
        <button type="submit" className="review-submit" disabled={!name.trim() || !text.trim()}>
          {mode === 'feedback' ? (
            <><Megaphone size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Gửi phản ánh ngay</>
          ) : (
            <><Star size={15} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Gửi đánh giá</>
          )}
        </button>
      </form>
    </div>
  )
}

export default HotelReviews
