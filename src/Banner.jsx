// ============================================================
// Banner.jsx — 상단 고정 배너
// props: { bannerId, message, type, onClose }
// type: "info" | "warning" | "success"
// ============================================================

import { useState } from 'react';

const TYPE_STYLES = {
  info:    { bg: '#f9f5ed', border: '#e8e0d0', color: '#1a1a14' },
  warning: { bg: '#fef9ec', border: '#f5d97a', color: '#7a4f00' },
  success: { bg: '#f2f7f2', border: '#7aad7a', color: '#2d6e2d' },
};

export default function Banner({ bannerId, message, type = 'info' }) {
  const [dismissed, setDismissed] = useState(
    sessionStorage.getItem(`banner_dismissed_${bannerId}`) === 'true'
  );

  if (dismissed) return null;

  const s = TYPE_STYLES[type] ?? TYPE_STYLES.info;

  function handleClose() {
    sessionStorage.setItem(`banner_dismissed_${bannerId}`, 'true');
    setDismissed(true);
  }

  return (
    <div style={{
      width: '100%', height: '40px',
      background: s.bg,
      borderBottom: `1px solid ${s.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'relative',
      padding: '0 40px',
    }}>
      <span style={{
        fontSize: '0.78rem', fontWeight: '500',
        color: s.color, textAlign: 'center',
        lineHeight: 1,
      }}>
        {message}
      </span>
      <button
        onClick={handleClose}
        style={{
          position: 'absolute', right: '12px',
          background: 'none', border: 'none',
          cursor: 'pointer', color: s.color,
          fontSize: '1rem', lineHeight: 1,
          opacity: 0.5, padding: '4px',
        }}
        aria-label="배너 닫기"
      >
        ×
      </button>
    </div>
  );
}
