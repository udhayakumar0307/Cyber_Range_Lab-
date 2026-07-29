import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export const CryptographyLabPage: React.FC = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('token') || localStorage.getItem('access_token');
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
  const iframeUrl = `/api/v1/crypto/view${tokenQuery}`;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      if (
        data === 'EXIT_SESSION' ||
        (data && typeof data === 'object' && (data.type === 'EXIT_SESSION' || data.action === 'EXIT_SESSION'))
      ) {
        navigate('/labs', { replace: true });
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

  return (
    <div className="w-full h-screen bg-[#F8FAFC] flex flex-col overflow-hidden">
      <iframe
        src={iframeUrl}
        title="Cryptography Lab"
        className="w-full h-full border-0 flex-1"
        style={{ width: '100%', height: '100vh', border: 'none' }}
      />
    </div>
  );
};
