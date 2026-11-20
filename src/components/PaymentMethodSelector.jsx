// src/components/PaymentMethodSelector.jsx — Chọn phương thức thanh toán tách riêng MoMo, ZaloPay, Thẻ ngân hàng, Thẻ quốc tế.
import { useState } from 'react'
import { BANKS } from '../data/extraServices.js'

export const PAYMENT_METHODS = [
  { id: 'momo', label: 'Ví MoMo', badge: 'MoMo', desc: 'Quét QR hoặc SĐT ví MoMo', color: 'momo' },
  { id: 'zalopay', label: 'ZaloPay', badge: 'ZaloPay', desc: 'Thanh toán nhanh qua ZaloPay', color: 'zalopay' },
  { id: 'atm', label: 'Thẻ ngân hàng', badge: 'ATM / NAPAS', desc: 'Thẻ nội địa các ngân hàng VN', color: 'bank' },
  { id: 'card', label: 'Thẻ quốc tế', badge: 'VISA / MC', desc: 'Visa, Mastercard, JCB', color: 'intl' },
]

export function PaymentMethodSelector({ method, setMethod }) {
  const [selectedBank, setSelectedBank] = useState('vcb')
  const [walletPhone, setWalletPhone] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardHolder, setCardHolder] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')

  const activeBank = BANKS.find((b) => b.id === selectedBank) || BANKS[0]

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
            <small className="pay-method-desc">{entry.desc}</small>
            {method === entry.id && <span className="pay-check-dot" aria-hidden="true">✓</span>}
          </button>
        ))}
      </div>

      {method === 'momo' && (
        <div className="pay-detail-panel panel-momo">
          <div className="pay-qr-mock momo-qr" aria-hidden="true">
            <div className="qr-grid" />
            <span>MoMo QR</span>
          </div>
          <div className="pay-detail-info">
            <h4>💜 Thanh toán bằng Ví MoMo</h4>
            <p>Mở ứng dụng <b>MoMo</b> để quét mã QR hoặc nhập số điện thoại liên kết ví.</p>
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
            <span className="pay-perk-badge">🎁 Hoàn tiền 2% tối đa 50.000đ khi thanh toán qua MoMo</span>
          </div>
        </div>
      )}

      {method === 'zalopay' && (
        <div className="pay-detail-panel panel-zalopay">
          <div className="pay-qr-mock zalo-qr" aria-hidden="true">
            <div className="qr-grid" />
            <span>ZaloPay QR</span>
          </div>
          <div className="pay-detail-info">
            <h4>💙 Thanh toán bằng ZaloPay</h4>
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
            <span className="pay-perk-badge">⚡ Miễn phí giao dịch · Giảm thêm 30.000đ cho đơn đầu tiên</span>
          </div>
        </div>
      )}

      {method === 'atm' && (
        <div className="pay-detail-panel panel-bank">
          <div className="pay-detail-info full">
            <h4>🏦 Chọn ngân hàng nội địa (Thẻ ATM / NAPAS)</h4>
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

      {method === 'card' && (
        <div className="pay-detail-panel panel-intl">
          <div className="pay-detail-info full">
            <h4>🌐 Thanh toán Thẻ quốc tế (Visa / Mastercard / JCB)</h4>
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
