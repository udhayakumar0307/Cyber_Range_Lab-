import React from 'react';

/**
 * PageLoader — shown while a lazy route chunk is being downloaded.
 * Lightweight pulsing skeleton; no external dependencies.
 */
export const PageLoader: React.FC = () => {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary, #0f172a)',
        gap: '1rem',
      }}
      aria-label="Loading page…"
      role="status"
    >
      {/* Spinner ring */}
      <div
        style={{
          width: 48,
          height: 48,
          border: '3px solid rgba(99,102,241,0.2)',
          borderTop: '3px solid #6366f1',
          borderRadius: '50%',
          animation: 'cr-spin 0.7s linear infinite',
        }}
      />

      {/* Skeleton content blocks */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', width: 260 }}>
        {[80, 60, 90, 50].map((w, i) => (
          <div
            key={i}
            style={{
              height: 12,
              width: `${w}%`,
              borderRadius: 6,
              background: 'rgba(99,102,241,0.12)',
              animation: `cr-pulse 1.4s ease-in-out ${i * 0.15}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Injected keyframes (once per document) */}
      <style>{`
        @keyframes cr-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes cr-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default PageLoader;
