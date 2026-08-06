import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context';

declare global {
  interface Window {
    google?: any;
  }
}

interface GoogleSignInButtonProps {
  portal: 'student' | 'admin';
  onSuccess: (data: any) => void;
  onError: (errorMsg: string) => void;
  buttonText?: string;
  className?: string;
}

export const GoogleSignInButton: React.FC<GoogleSignInButtonProps> = ({
  portal,
  onSuccess,
  onError,
  buttonText = 'Continue with Google',
  className = ''
}) => {
  const { setSessionToken } = useAuth();
  const [isInitializing, setIsInitializing] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const hiddenBtnRef = useRef<HTMLDivElement>(null);

  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '109283749283-exampleclientid.apps.googleusercontent.com';

  const handleCredentialResponse = async (response: any) => {
    if (!response || !response.credential) {
      onError('Failed to obtain Google authentication token.');
      return;
    }

    setIsAuthenticating(true);
    try {
      const res = await fetch('/api/v1/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          credential: response.credential,
          portal: portal
        })
      });

      const data = await res.json();
      setIsAuthenticating(false);

      if (!res.ok || !data.success) {
        const msg = data.detail || data.message || 'Google authentication failed.';
        onError(typeof msg === 'string' ? msg : 'Google authentication failed.');
        return;
      }

      if (data.token) {
        setSessionToken(data.token, data.user);
        localStorage.setItem('token', data.token);
        if (data.role) {
          localStorage.setItem('role', data.role);
        }
      }

      onSuccess(data);
    } catch (err: any) {
      setIsAuthenticating(false);
      onError(err.message || 'Network error during Google authentication.');
    }
  };

  useEffect(() => {
    let intervalId: any = null;

    const initializeGis = () => {
      if (window.google?.accounts?.id) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: handleCredentialResponse,
            auto_select: false,
            cancel_on_tap_outside: true,
          });

          if (hiddenBtnRef.current) {
            window.google.accounts.id.renderButton(hiddenBtnRef.current, {
              theme: 'outline',
              size: 'large',
              width: 280,
              type: 'standard',
            });
          }
          setIsInitializing(true);
        } catch (e) {
          console.error('[GoogleSignInButton] Error initializing GIS:', e);
        }
      }
    };

    if (window.google?.accounts?.id) {
      initializeGis();
    } else {
      intervalId = setInterval(() => {
        if (window.google?.accounts?.id) {
          initializeGis();
          clearInterval(intervalId);
        }
      }, 300);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [clientId, portal]);

  const handleCustomClick = () => {
    if (!clientId || clientId.includes('exampleclientid') || clientId.startsWith('your-')) {
      onError('Google Sign-In is not configured.');
      return;
    }
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification: any) => {
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Fallback to hidden GIS rendered button click if prompt is blocked
            const renderedBtn = hiddenBtnRef.current?.querySelector('div[role="button"]') as HTMLElement;
            if (renderedBtn) {
              renderedBtn.click();
            } else {
              window.google.accounts.id.prompt();
            }
          }
        });
      } catch (e) {
        console.error('[GoogleSignInButton] Prompt error:', e);
      }
    } else {
      onError('Google Identity Services SDK is loading. Please try again in a moment.');
    }
  };

  return (
    <div className="w-full relative">
      <button
        type="button"
        onClick={handleCustomClick}
        disabled={isAuthenticating}
        className={className || `w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 transition-all shadow-sm cursor-pointer disabled:opacity-60`}
      >
        {isAuthenticating ? (
          <>
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <span>Verifying Google Identity...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.15C3.26 21.3 7.31 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.39l3.99-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.61l3.99 3.15c.95-2.85 3.6-4.96 6.72-4.96z" />
            </svg>
            <span>
              {!clientId || clientId.includes('exampleclientid') || clientId.startsWith('your-')
                ? 'Google Sign-In is not configured.'
                : buttonText}
            </span>
          </>
        )}
      </button>

      {/* Hidden GIS Rendered Element for programmatic trigger fallback */}
      <div ref={hiddenBtnRef} className="hidden absolute inset-0 pointer-events-none opacity-0" />
    </div>
  );
};
