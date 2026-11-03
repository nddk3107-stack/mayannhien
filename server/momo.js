// server/momo.js — Lớp tích hợp MoMo (server-side) theo SDK chính thức của MoMo.
// Tài liệu tham chiếu: github.com/momo-wallet/payment (nodejs/MoMo.js, php/PayMoMo/*).
//
// QUY TẮC BẮT BUỘC:
//  - KHÔNG đưa secretKey/accessKey ra frontend, vào log, hay vào báo cáo.
//  - Chỉ BACKEND được tạo yêu cầu ký và xác minh chữ ký.
//  - URL redirect (payUrl) KHÔNG phải bằng chứng thanh toán -> chỉ IPN/query đủ chuẩn mới đổi trạng thái.
//  - Sandbox KHÔNG BAO GIỜ được ghi nhận là doanh thu thật.
import { createHmac, timingSafeEqual, randomBytes } from 'node:crypto'
import { MOMO_CONFIG, MOMO_ENABLED, MOMO_LIVE_ENABLED } from './config.js'

/* ------------------------------------------------------------ chữ ký HMAC */
// Chuỗi gốc để ký — thứ tự trường cố định theo tài liệu MoMo:
// accessKey, amount, extraData, ipnUrl, orderId, orderInfo, partnerCode,
// redirectUrl, requestId, requestType  (nối bằng "&", không URL-encode).
export function buildCreateRawSignature({
  accessKey, amount, extraData, ipnUrl, orderId, orderInfo, partnerCode, redirectUrl, requestId, requestType,
}) {
  return [
    `accessKey=${accessKey}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `ipnUrl=${ipnUrl}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `partnerCode=${partnerCode}`,
    `redirectUrl=${redirectUrl}`,
    `requestId=${requestId}`,
    `requestType=${requestType}`,
  ].join('&')
}

// Chuỗi gốc để xác minh IPN — thứ tự trường theo tài liệu MoMo:
// accessKey, amount, extraData, message, orderId, orderInfo, orderType,
// partnerCode, payType, requestId, responseTime, resultCode, transId.
export function buildIpnRawSignature({
  accessKey, amount, extraData, message, orderId, orderInfo, orderType,
  partnerCode, payType, requestId, responseTime, resultCode, transId,
}) {
  return [
    `accessKey=${accessKey}`,
    `amount=${amount}`,
    `extraData=${extraData}`,
    `message=${message}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `orderType=${orderType}`,
    `partnerCode=${partnerCode}`,
    `payType=${payType}`,
    `requestId=${requestId}`,
    `responseTime=${responseTime}`,
    `resultCode=${resultCode}`,
    `transId=${transId}`,
  ].join('&')
}

// Chuỗi gốc để xác minh phản hồi của API truy vấn giao dịch.
export function buildQueryRawSignature({
  partnerCode, accessKey, requestId, orderId, errorCode, transId,
  amount, message, localMessage, requestType, payType, extraData,
}) {
  return [
    `partnerCode=${partnerCode}`,
    `accessKey=${accessKey}`,
    `requestId=${requestId}`,
    `orderId=${orderId}`,
    `errorCode=${errorCode}`,
    `transId=${transId}`,
    `amount=${amount}`,
    `message=${message}`,
    `localMessage=${localMessage}`,
    `requestType=${requestType}`,
    `payType=${payType}`,
    `extraData=${extraData}`,
  ].join('&')
}

export const signHmac = (raw, secretKey) =>
  createHmac('sha256', String(secretKey || '')).update(String(raw)).digest('hex')

/** So sánh chữ ký theo thời gian hằng số (chống timing attack). */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''), 'utf8')
  const bufB = Buffer.from(String(b || ''), 'utf8')
  if (bufA.length !== bufB.length || bufA.length === 0) return false
  return timingSafeEqual(bufA, bufB)
}

/* --------------------------------------------------------------- helpers */
const REQUEST_TYPE = 'captureWallet'

/** Mã đơn hàng duy nhất, không trùng giữa các lần thanh toán. */
export const newOrderId = () => `MAN${Date.now()}${randomBytes(4).toString('hex').toUpperCase()}`
export const newRequestId = () => `REQ${Date.now()}${randomBytes(4).toString('hex').toUpperCase()}`

/** Số tiền VND là số nguyên; MoMo yêu cầu >= 1000đ. */
export const toAmount = (value) => {
  const n = Math.round(Number(value) || 0)
  return Number.isFinite(n) && n > 0 ? n : 0
}


/* ---------------------------------------------------------- tạo thanh toán */
/**
 * Tạo yêu cầu thanh toán MoMo và trả về payUrl.
 * @returns {Promise<{ok:boolean, payUrl?:string, orderId?:string, requestId?:string, error?:string}>}
 */
export async function createPayment({ orderId, amount, orderInfo, returnUrl, ipnUrl, extraData = '' }) {
  if (!MOMO_ENABLED) {
    return { ok: false, error: 'Cổng thanh toán chưa được cấu hình (thiếu MOMO_PARTNER_CODE / MOMO_ACCESS_KEY / MOMO_SECRET_KEY).' }
  }
  const requestId = newRequestId()
  const body = {
    partnerCode: MOMO_CONFIG.partnerCode,
    partnerName: process.env.MOMO_PARTNER_NAME || 'MAY AN NHIEN',
    accessKey: MOMO_CONFIG.accessKey,
    requestId,
    amount: String(toAmount(amount)),
    orderId,
    orderInfo: String(orderInfo || ''),
    redirectUrl: returnUrl || MOMO_CONFIG.returnUrl,
    ipnUrl: ipnUrl || MOMO_CONFIG.ipnUrl,
    lang: 'vi',
    extraData: String(extraData || ''),
    requestType: REQUEST_TYPE,
  }
  body.signature = signHmac(
    buildCreateRawSignature({
      accessKey: body.accessKey,
      amount: body.amount,
      extraData: body.extraData,
      ipnUrl: body.ipnUrl,
      orderId: body.orderId,
      orderInfo: body.orderInfo,
      partnerCode: body.partnerCode,
      redirectUrl: body.redirectUrl,
      requestId: body.requestId,
      requestType: body.requestType,
    }),
    MOMO_CONFIG.secretKey,
  )

  let response
  try {
    response = await fetch(MOMO_CONFIG.createUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    // Timeout / mất kết nối: KHÔNG được coi là đã thanh toán.
    return { ok: false, error: 'Không kết nối được cổng thanh toán. Vui lòng thử lại.' }
  }

  let data = null
  try { data = await response.json() } catch { data = null }
  if (!response.ok || !data) {
    return { ok: false, error: 'Cổng thanh toán từ chối yêu cầu.' }
  }
  if (Number(data.resultCode) !== 0 || !data.payUrl) {
    return { ok: false, error: 'Cổng thanh toán từ chối giao dịch.' }
  }
  return { ok: true, payUrl: data.payUrl, orderId, requestId }
}

/* ------------------------------------------------------------- xác minh IPN */
/**
 * Xác minh chữ ký IPN của MoMo.
 * @returns {{valid:boolean, reason?:string, data?:object, amount?:number}}
 */
export function verifyIpn(payload) {
  const p = payload || {}
  const required = ['partnerCode', 'orderId', 'requestId', 'amount', 'transId', 'resultCode', 'signature']
  for (const key of required) {
    if (p[key] === undefined || p[key] === null || p[key] === '') {
      return { valid: false, reason: `Thiếu trường bắt buộc: ${key}` }
    }
  }
  if (String(p.partnerCode) !== String(MOMO_CONFIG.partnerCode)) {
    return { valid: false, reason: 'partnerCode không khớp merchant.' }
  }
  const raw = buildIpnRawSignature({
    accessKey: MOMO_CONFIG.accessKey,
    amount: p.amount,
    extraData: p.extraData || '',
    message: p.message || '',
    orderId: p.orderId,
    orderInfo: p.orderInfo || '',
    orderType: p.orderType || '',
    partnerCode: p.partnerCode,
    payType: p.payType || '',
    requestId: p.requestId,
    responseTime: p.responseTime || '',
    resultCode: p.resultCode,
    transId: p.transId,
  })
  const expected = signHmac(raw, MOMO_CONFIG.secretKey)
  if (!safeEqual(expected, p.signature)) {
    return { valid: false, reason: 'Chữ ký IPN không hợp lệ.' }
  }
  return { valid: true, data: p, amount: Number(p.amount) || 0 }
}

/* ------------------------------------------------------------ truy vấn giao dịch */
/**
 * Truy vấn trạng thái giao dịch từ MoMo (dùng để đối soát khi IPN bị lỡ).
 * @returns {Promise<{ok:boolean, paid?:boolean, transId?:string, error?:string}>}
 */
export async function queryPayment(orderId) {
  if (!MOMO_ENABLED) return { ok: false, error: 'Cổng thanh toán chưa được cấu hình.' }
  const requestId = newRequestId()
  const body = {
    partnerCode: MOMO_CONFIG.partnerCode,
    requestId,
    orderId,
    requestType: REQUEST_TYPE,
    lang: 'vi',
  }
  body.signature = signHmac(
    buildQueryRawSignature({
      partnerCode: MOMO_CONFIG.partnerCode,
      accessKey: MOMO_CONFIG.accessKey,
      requestId,
      orderId,
      errorCode: '',
      transId: '',
      amount: '',
      message: '',
      localMessage: '',
      requestType: REQUEST_TYPE,
      payType: '',
      extraData: '',
    }),
    MOMO_CONFIG.secretKey,
  )
  let response
  try {
    response = await fetch(MOMO_CONFIG.queryUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    })
  } catch {
    return { ok: false, error: 'Không kết nối được cổng thanh toán.' }
  }
  let data = null
  try { data = await response.json() } catch { data = null }
  if (!response.ok || !data) return { ok: false, error: 'Không đọc được phản hồi truy vấn giao dịch.' }

  // Xác minh chữ ký phản hồi truy vấn (theo tài liệu MoMo).
  const expected = signHmac(
    buildQueryRawSignature({
      partnerCode: data.partnerCode,
      accessKey: data.accessKey,
      requestId: data.requestId,
      orderId: data.orderId,
      errorCode: data.errorCode,
      transId: data.transId,
      amount: data.amount,
      message: data.message,
      localMessage: data.localMessage,
      requestType: data.requestType,
      payType: data.payType,
      extraData: data.extraData || '',
    }),
    MOMO_CONFIG.secretKey,
  )
  if (!safeEqual(expected, data.signature)) {
    return { ok: false, error: 'Chữ ký phản hồi truy vấn không hợp lệ.' }
  }
  if (String(data.partnerCode) !== String(MOMO_CONFIG.partnerCode)) {
    return { ok: false, error: 'partnerCode không khớp merchant.' }
  }
  return { ok: true, paid: Number(data.errorCode) === 0, transId: data.transId, amount: Number(data.amount) || 0, data }
}

export { MOMO_ENABLED, MOMO_LIVE_ENABLED, MOMO_CONFIG }

