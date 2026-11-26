// src/components/PaymentMethodSelector.jsx — Chọn phương thức thanh toán: SePay VietQR, Số dư ví Mây An Nhiên, Thẻ ATM, Ví điện tử, Thẻ quốc tế.
import { useState, useEffect } from 'react'
import {
  Check,
  CreditCard,
  Gift,
  Landmark,
  QrCode,
  Wallet,
  Zap,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { BANKS } from '../data/extraServices.js'
import { apiFetch } from '../services/api.js'
import { formatCurrency } from '../data/constants.js'

export const PAYMENT_METHODS = [
  { id: 'sepay', label: 'Chuyển khoản SePay VietQR (Tự động 24/7)', badge: 'VietQR / SePay', desc: 'Quét QR mọi ngân hàng, tự động xác nhận tức thì', color: 'sepay' },
  { id: 'balance', label: 'Số dư ví Mây An Nhiên', badge: 'Ví Mây An Nhiên', desc: 'Thanh toán trực tiếp bằng số dư khả dụng', color: 'balance' },
  { id: 'atm', label: 'Thẻ ATM nội địa', badge: 'ATM / NAPAS', desc: 'Thẻ nội địa các ngân hàng VN', color: 'bank' },
  { id: 'wallet', label: 'Ví điện tử (MoMo, ZaloPay)', badge: 'Ví điện tử', desc: 'Quét QR MoMo hoặc ZaloPay', color: 'wallet' },
  { id: 'card', label: 'Thẻ quốc tế', badge: 'VISA / MC', desc: 'Visa, Mastercard, JCB', color: 'intl' },
]

export function PaymentMethodSelector({
  method,
  setMethod,
  totalAmount = 0,
  session = null,
  onOpenDeposit = null,
}) {
  const [selectedBank, setSelectedBank] = useState('vcb')
  const [subWallet, setSubWallet] = useState('momo')
  const [walletPhone, setWalletPhone] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardHolder, setCardHolder] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')

  // Trạng thái số dư ví lấy từ backend
  const [walletBalance, setWalletBalance] = useState(0)
  const [walletLoaded, setWalletLoaded] = useState(false)

  useEffect(() => {
    if (!session) return
    let active = true
    apiFetch('/api/payment/wallet')
      .then((res) => {
        if (!active) return
        if (res.ok && res.data) {
          setWalletBalance(Number(res.data.balance) || 0)
          setWalletLoaded(true)
        }
      })
      .catch(() => { })
    return () => {
      active = false
    }
  }, [session, method])

  const activeBank = BANKS.find((b) => b.id === selectedBank) || BANKS[0]
  const isBalanceSufficient = walletBalance >= (totalAmount || 0)
  const shortage = Math.max((totalAmount || 0) - walletBalance, 0)

  return (
    <div className="payment-selector-wrap">
      <div className="pay-methods pay-methods-grid">
        {PAYMENT_METHODS.map((entry) => (
          <button
            type="button"
            key={entry.id}
            className={`pay-method-card pay-${entry.color} ${method === entry.id ? 'active' : ''}`}
            onClick={() => setMethod(entry.id)}
          >
            <span className={`pay-brand-pill pill-${entry.color}`}>{entry.badge}</span>
            <strong className="pay-method-title">{entry.label}</strong>
            <small className="pay-method-desc">
              {entry.id === 'balance' && session && walletLoaded
                ? `Số dư: ${formatCurrency(walletBalance)}`
                : entry.desc}
            </small>
            {method === entry.id && (
              <span className="pay-check-dot" aria-hidden="true">
                <Check size={14} strokeWidth={1.8} />
              </span>
            )}
          </button>
        ))}
      </div>

      {/* CHI TIẾT THANH TOÁN: SEPAY VIETQR */}
      {method === 'sepay' && (
        <div className="pay-detail-panel panel-sepay" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="pay-qr-live sepay-qr" aria-hidden="true" title="Cổng thanh toán SePay VietQR">
            <svg viewBox="0 0 100 100" width="90" height="90" style={{ borderRadius: '8px', background: '#0284c7', padding: '6px' }}>
              <rect x="10" y="10" width="25" height="25" fill="#fff" />
              <rect x="15" y="15" width="15" height="15" fill="#0284c7" />
              <rect x="65" y="10" width="25" height="25" fill="#fff" />
              <rect x="70" y="15" width="15" height="15" fill="#0284c7" />
              <rect x="10" y="65" width="25" height="25" fill="#fff" />
              <rect x="15" y="70" width="15" height="15" fill="#0284c7" />
              <rect x="42" y="42" width="16" height="16" fill="#fff" />
              <circle cx="50" cy="50" r="4" fill="#0284c7" />
            </svg>
            <span className="pay-qr-sublabel sepay-label" style={{ color: '#0284c7', fontWeight: 600 }}>VietQR SePay</span>
          </div>
          <div className="pay-detail-info" style={{ flex: 1, minWidth: '240px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 6px' }}>
              <QrCode size={16} strokeWidth={2} style={{ color: '#0284c7' }} />
              Thanh toán chuyển khoản tự động qua SePay VietQR 24/7
            </h4>
            <p style={{ margin: '0 0 6px', fontSize: '0.9rem' }}>
              Ngân hàng thụ hưởng: <b>MBBank</b> · Chủ tài khoản: <b>PHAM MINH KHOI</b>
            </p>
            <p style={{ margin: '0 0 10px', fontSize: '0.85rem', opacity: 0.85 }}>
              Khi bấm <b>Xác nhận và thanh toán</b>, hệ thống sẽ mở cổng SePay hiển thị mã VietQR động cùng thông tin chuyển khoản chính xác để quét trên App ngân hàng hoặc ví điện tử bất kỳ, hệ thống sẽ tự động xác nhận ngay khi hoàn tất giao dịch.
            </p>
            <span className="pay-perk-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#059669', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <Zap size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Tự động cộng tiền & xác nhận đơn sau 3 giây · Miễn phí giao dịch 100%
            </span>
          </div>
        </div>
      )}

      {/* CHI TIẾT THANH TOÁN: SỐ DƯ VÍ MÂY AN NHIÊN */}
      {method === 'balance' && (
        <div className="pay-detail-panel panel-balance" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="pay-qr-live balance-badge-box" aria-hidden="true" style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '90px', height: '90px', borderRadius: '12px' }}>
            <Wallet size={36} strokeWidth={1.8} />
            <span style={{ fontSize: '11px', fontWeight: 700, marginTop: '4px' }}>Ví MAYAN</span>
          </div>
          <div className="pay-detail-info" style={{ flex: 1, minWidth: '240px' }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 0 6px' }}>
              <Wallet size={16} strokeWidth={2} style={{ color: '#0284c7' }} />
              Thanh toán trực tiếp bằng Số dư ví Mây An Nhiên
            </h4>

            {session ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.95rem' }}>
                    Số dư hiện có: <strong style={{ color: '#0284c7', fontSize: '1.05rem' }}>{formatCurrency(walletBalance)}</strong>
                  </span>
                  {totalAmount > 0 && (
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: isBalanceSufficient ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                        color: isBalanceSufficient ? '#059669' : '#dc2626',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      {isBalanceSufficient ? (
                        <>
                          <CheckCircle2 size={13} /> Đủ số dư thanh toán
                        </>
                      ) : (
                        <>
                          <AlertCircle size={13} /> Thiếu {formatCurrency(shortage)}
                        </>
                      )}
                    </span>
                  )}
                </div>

                {isBalanceSufficient ? (
                  <p style={{ margin: '0 0 8px', fontSize: '0.85rem', opacity: 0.9 }}>
                    Số tiền <b style={{ color: '#0284c7' }}>{formatCurrency(totalAmount)}</b> sẽ được trừ tự động từ ví. Đơn hàng sẽ được xác nhận thành công ngay lập tức không cần chuyển khoản thêm.
                  </p>
                ) : (
                  <div style={{ margin: '8px 0 10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: '#dc2626' }}>
                      Số dư ví không đủ để thanh toán đơn hàng này.
                    </p>
                    {onOpenDeposit && (
                      <button
                        type="button"
                        onClick={onOpenDeposit}
                        style={{
                          background: '#0284c7',
                          color: '#fff',
                          border: 'none',
                          padding: '5px 12px',
                          borderRadius: '6px',
                          fontSize: '0.82rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <PlusCircle size={14} /> Nạp tiền vào ví qua SePay VietQR
                      </button>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p style={{ margin: '0 0 8px', fontSize: '0.88rem', color: '#f59e0b' }}>
                Vui lòng đăng nhập để kiểm tra số dư ví và thanh toán bằng số dư.
              </p>
            )}

            <span className="pay-perk-badge" style={{ background: 'rgba(14, 165, 233, 0.1)', color: '#0284c7', borderColor: 'rgba(14, 165, 233, 0.3)' }}>
              <Zap size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Xác nhận 1-chạm · Không phí giao dịch · Khớp lệnh tức thì 100%
            </span>
          </div>
        </div>
      )}

      {/* CHI TIẾT THANH TOÁN: VÍ MOMO / ZALOPAY */}
      {method === 'wallet' && (
        <div className="pay-detail-panel panel-wallet">
          <div className="wallet-sub-tabs" style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            <button
              type="button"
              className={`momo-pill-btn ${subWallet === 'momo' ? 'active' : ''}`}
              onClick={() => setSubWallet('momo')}
            >
              <Wallet size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Ví MoMo
            </button>
            <button
              type="button"
              className={`momo-pill-btn ${subWallet === 'zalopay' ? 'active' : ''}`}
              onClick={() => setSubWallet('zalopay')}
            >
              <QrCode size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> ZaloPay
            </button>
          </div>

          {subWallet === 'momo' ? (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pay-qr-live momo-qr" aria-hidden="true" title="Cổng thanh toán MoMo Sandbox">
                <svg viewBox="0 0 100 100" width="90" height="90" style={{ borderRadius: '8px', background: '#a50064', padding: '6px' }}>
                  <rect x="10" y="10" width="25" height="25" fill="#fff" />
                  <rect x="15" y="15" width="15" height="15" fill="#a50064" />
                  <rect x="65" y="10" width="25" height="25" fill="#fff" />
                  <rect x="70" y="15" width="15" height="15" fill="#a50064" />
                  <rect x="10" y="65" width="25" height="25" fill="#fff" />
                  <rect x="15" y="70" width="15" height="15" fill="#a50064" />
                  <rect x="42" y="42" width="16" height="16" fill="#fff" />
                  <circle cx="50" cy="50" r="4" fill="#a50064" />
                </svg>
                <span className="pay-qr-sublabel momo-label">MoMo Sandbox</span>
              </div>
              <div className="pay-detail-info" style={{ flex: 1, minWidth: '220px' }}>
                <h4>
                  <Wallet size={16} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Thanh toán qua Cổng MoMo
                </h4>
                <p>Quét mã QR qua ứng dụng <b>MoMo</b> hoặc liên kết thanh toán tức thì.</p>
                <label className="field">
                  <span>Số điện thoại Ví MoMo (tùy chọn)</span>
                  <input
                    type="tel"
                    value={walletPhone}
                    maxLength={15}
                    placeholder="VD: 0912 345 678"
                    onChange={(e) => setWalletPhone(e.target.value)}
                  />
                </label>
                <span className="pay-perk-badge">
                  <Gift size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Hoàn tiền 2% tối đa 50.000đ khi thanh toán qua MoMo
                </span>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="pay-qr-live zalo-qr" aria-hidden="true" title="Cổng thanh toán ZaloPay">
                <svg viewBox="0 0 100 100" width="90" height="90" style={{ borderRadius: '8px', background: '#0068ff', padding: '6px' }}>
                  <rect x="10" y="10" width="25" height="25" fill="#fff" />
                  <rect x="15" y="15" width="15" height="15" fill="#0068ff" />
                  <rect x="65" y="10" width="25" height="25" fill="#fff" />
                  <rect x="70" y="15" width="15" height="15" fill="#0068ff" />
                  <rect x="10" y="65" width="25" height="25" fill="#fff" />
                  <rect x="15" y="70" width="15" height="15" fill="#0068ff" />
                  <rect x="42" y="42" width="16" height="16" fill="#fff" />
                  <circle cx="50" cy="50" r="4" fill="#0068ff" />
                </svg>
                <span className="pay-qr-sublabel zalo-label">ZaloPay QR</span>
              </div>
              <div className="pay-detail-info" style={{ flex: 1, minWidth: '220px' }}>
                <h4>
                  <QrCode size={16} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Thanh toán bằng ZaloPay
                </h4>
                <p>Quét mã bằng ứng dụng <b>Zalo</b> hoặc <b>ZaloPay</b> — xác nhận giao dịch tức thì.</p>
                <label className="field">
                  <span>Số điện thoại ZaloPay (tùy chọn)</span>
                  <input
                    type="tel"
                    value={walletPhone}
                    maxLength={15}
                    placeholder="VD: 0987 654 321"
                    onChange={(e) => setWalletPhone(e.target.value)}
                  />
                </label>
                <span className="pay-perk-badge">
                  <Zap size={14} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 4 }} /> Miễn phí giao dịch · Giảm thêm 30.000đ cho đơn đầu tiên
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CHI TIẾT THANH TOÁN: THẺ ATM NỘI ĐỊA */}
      {method === 'atm' && (
        <div className="pay-detail-panel panel-bank">
          <div className="pay-detail-info full">
            <h4>
              <Landmark size={16} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Chọn ngân hàng nội địa (Thẻ ATM / NAPAS)
            </h4>
            <div className="bank-grid">
              {BANKS.map((bank) => (
                <button
                  type="button"
                  key={bank.id}
                  className={`bank-chip ${selectedBank === bank.id ? 'active' : ''}`}
                  onClick={() => setSelectedBank(bank.id)}
                >
                  <span className="bank-dot" style={{ background: bank.color }}>{bank.short}</span>
                  <span>{bank.name}</span>
                </button>
              ))}
            </div>
            <div className="bank-form-row">
              <label className="field">
                <span>Số thẻ {activeBank.name} (tùy chọn)</span>
                <input
                  value={cardNumber}
                  maxLength={23}
                  placeholder="9704 xxxx xxxx xxxx"
                  onChange={(e) => setCardNumber(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Tên chủ thẻ (không dấu)</span>
                <input
                  value={cardHolder}
                  maxLength={50}
                  placeholder="NGUYEN VAN A"
                  onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* CHI TIẾT THANH TOÁN: THẺ QUỐC TẾ */}
      {method === 'card' && (
        <div className="pay-detail-panel panel-intl">
          <div className="pay-detail-info full">
            <h4>
              <CreditCard size={16} strokeWidth={1.8} style={{ verticalAlign: 'middle', marginRight: 6 }} /> Thanh toán Thẻ quốc tế (Visa / Mastercard / JCB)
            </h4>
            <div className="bank-form-row intl-row">
              <label className="field wide">
                <span>Số thẻ quốc tế</span>
                <input
                  value={cardNumber}
                  maxLength={23}
                  placeholder="4532 xxxx xxxx xxxx"
                  onChange={(e) => setCardNumber(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Hết hạn (MM/YY)</span>
                <input
                  value={cardExpiry}
                  maxLength={5}
                  placeholder="08/29"
                  onChange={(e) => setCardExpiry(e.target.value)}
                />
              </label>
              <label className="field">
                <span>CVV</span>
                <input
                  type="password"
                  value={cardCvv}
                  maxLength={4}
                  placeholder="•••"
                  onChange={(e) => setCardCvv(e.target.value)}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default PaymentMethodSelector
