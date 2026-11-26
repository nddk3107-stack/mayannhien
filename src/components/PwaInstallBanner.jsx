// src/components/PwaInstallBanner.jsx — Banner cài đặt PWA Mây An Nhiên (Android beforeinstallprompt & iOS Add to Home Screen)
import React, { useEffect, useState } from 'react'
import { Cloud, Download, Share, PlusSquare, X } from 'lucide-react'

const DISMISS_KEY = 'mayan_pwa_install_dismissed_v1'

export default function PwaInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  const [isStandalone, setIsStandalone] = useState(false)
  const [showGuide, setShowGuide] = useState(false)

  useEffect(() => {
    const checkStandalone = () => {
      const standalone =
        window.matchMedia?.('(display-mode: standalone)')?.matches ||
        window.navigator?.standalone === true
      setIsStandalone(Boolean(standalone))
    }
    checkStandalone()

    const onBeforeInstallPrompt = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }

    const onAppInstalled = () => {
      setDeferredPrompt(null)
      setIsStandalone(true)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  const handleDismiss = () => {
    setDismissed(true)
    setShowGuide(false)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // ignore storage block
    }
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt()
        const choice = await deferredPrompt.userChoice
        if (choice?.outcome === 'accepted') {
          setDeferredPrompt(null)
          handleDismiss()
        }
      } catch {
        setShowGuide((prev) => !prev)
      }
      return
    }
    setShowGuide((prev) => !prev)
  }

  if (isStandalone || dismissed) return null

  return (
    <div className="pwa-install-banner" role="region" aria-label="Cài đặt ứng dụng Mây An Nhiên">
      <div className="pwa-install-inner">
        <div className="pwa-install-brand">
          <span className="pwa-install-icon" aria-hidden="true">
            <Cloud size={20} strokeWidth={2.2} />
          </span>
          <div className="pwa-install-copy">
            <strong>Cài đặt App Mây An Nhiên</strong>
            <span>Trải nghiệm toàn màn hình mượt mà trên iOS & Android</span>
          </div>
        </div>

        <div className="pwa-install-actions">
          <button
            type="button"
            className="pwa-install-cta"
            onClick={handleInstallClick}
          >
            <Download size={15} strokeWidth={2.2} />
            <span>{deferredPrompt ? 'Cài đặt ngay' : 'Cài đặt App'}</span>
          </button>
          <button
            type="button"
            className="pwa-install-close"
            onClick={handleDismiss}
            aria-label="Đóng gợi ý cài đặt ứng dụng"
            title="Đóng"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
      </div>

      {showGuide && (
        <div className="pwa-install-guide">
          <div className="pwa-guide-step">
            <Share size={16} strokeWidth={2} />
            <span>
              <b>Trên iPhone / iPad (Safari):</b> Bấm nút <b>Chia sẻ (Share)</b> ở thanh dưới trình duyệt → Chọn <b>&ldquo;Thêm vào MH chính&rdquo; (Add to Home Screen)</b>.
            </span>
          </div>
          <div className="pwa-guide-step">
            <PlusSquare size={16} strokeWidth={2} />
            <span>
              <b>Trên Android / Chrome / Cốc Cốc:</b> Bấm biểu tượng <b>Cài đặt ứng dụng</b> trên thanh địa chỉ hoặc mở menu <b>(⋮)</b> → Chọn <b>&ldquo;Cài đặt ứng dụng&rdquo; / &ldquo;Thêm vào màn hình chính&rdquo;</b>.
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
