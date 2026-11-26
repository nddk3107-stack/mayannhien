// src/services/api.js — Lớp gọi API dùng chung cho app người dùng lẫn khu vực quản trị.
// - Tự gắn header chống CSRF (X-Requested-With) + mã trình duyệt (X-Client-Id).
// - KHÔNG BAO GIỜ in lỗi ra console (tránh nhiễu console error trong QA).

export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/+$/, '')

// Mã trình duyệt: đơn hàng hiển thị theo cặp (tài khoản, trình duyệt) — khớp hành vi
// lưu localStorage trước đây; mỗi trình duyệt mới bắt đầu với danh sách trống.
const CLIENT_ID_KEY = 'may-an-nhien-client'

export const getClientId = () => {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY)
    if (!id || String(id).length < 8) {
      id = (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
      localStorage.setItem(CLIENT_ID_KEY, id)
    }
    return String(id)
  } catch {
    return 'anonymous-client'
  }
}

/**
 * Gọi API cùng nguồn gốc.
 * @returns {Promise<{status:number, ok:boolean, data:any, networkError:boolean}>}
 */
export async function apiFetch(path, { method = 'GET', body, timeoutMs = 10000, headers: extraHeaders = {} } = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData
  const headers = {
    'X-Requested-With': 'XMLHttpRequest',
    'X-Client-Id': getClientId(),
    ...extraHeaders,
  }
  if (!isFormData && body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      credentials: 'same-origin',
      signal: controller.signal,
      body: isFormData ? body : (body === undefined ? undefined : JSON.stringify(body)),
    })
    let data = null
    try { data = await res.json() } catch { data = null }
    return { status: res.status, ok: res.ok, data, networkError: false }
  } catch {
    return { status: 0, ok: false, data: null, networkError: true }
  } finally {
    clearTimeout(timer)
  }
}

export const apiGet = (path) => apiFetch(path)
export const apiPost = (path, body) => apiFetch(path, { method: 'POST', body })
export const apiPatch = (path, body) => apiFetch(path, { method: 'PATCH', body })
