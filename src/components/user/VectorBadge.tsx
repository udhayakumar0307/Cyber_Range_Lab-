import React from 'react';

export interface VectorBadgeProps {
  title: string;
  category?: string;
  points?: number;
  variant?: 'gold' | 'emerald' | 'blue' | 'purple';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const VectorBadge: React.FC<VectorBadgeProps> = ({
  title,
  category = 'Cyber Security',
  points = 100,
  variant = 'gold',
  size = 'md',
  className = '',
}) => {
  const getTheme = () => {
    switch (variant) {
      case 'emerald':
        return {
          gradientStart: '#059669',
          gradientEnd: '#064e3b',
          border: '#34d399',
          accent: '#10b981',
          text: '#ecfdf5',
          bannerBg: '#022c22',
        };
      case 'blue':
        return {
          gradientStart: '#2563eb',
          gradientEnd: '#1e3a8a',
          border: '#60a5fa',
          accent: '#3b82f6',
          text: '#eff6ff',
          bannerBg: '#172554',
        };
      case 'purple':
        return {
          gradientStart: '#7c3aed',
          gradientEnd: '#4c1d95',
          border: '#a78bfa',
          accent: '#8b5cf6',
          text: '#f5f3ff',
          bannerBg: '#2e1065',
        };
      case 'gold':
      default:
        return {
          gradientStart: '#d97706',
          gradientEnd: '#78350f',
          border: '#fbbf24',
          accent: '#f59e0b',
          text: '#fffbeb',
          bannerBg: '#451a03',
        };
    }
  };

  const theme = getTheme();

  const dimensions = {
    sm: { width: 140, height: 160, fontSizeTitle: '9px', fontSizeBanner: '8px' },
    md: { width: 200, height: 230, fontSizeTitle: '12px', fontSizeBanner: '10px' },
    lg: { width: 280, height: 320, fontSizeTitle: '16px', fontSizeBanner: '13px' },
  }[size];

  return (
    <div className={`inline-flex flex-col items-center justify-center relative ${className}`}>
      <svg
        width={dimensions.width}
        height={dimensions.height}
        viewBox="0 0 200 230"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="drop-shadow-xl transition-transform hover:scale-105 duration-300"
      >
        <defs>
          <linearGradient id={`bgGrad-${variant}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={theme.gradientStart} />
            <stop offset="100%" stopColor={theme.gradientEnd} />
          </linearGradient>

          <linearGradient id={`goldRibbon-${variant}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="50%" stopColor="#fbbf24" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Hexagon Shield */}
        <polygon
          points="100,10 180,50 180,150 100,190 20,150 20,50"
          fill={`url(#bgGrad-${variant})`}
          stroke={theme.border}
          strokeWidth="6"
          strokeLinejoin="round"
        />

        {/* Inner Circuit Line Ring */}
        <polygon
          points="100,22 168,56 168,144 100,178 32,144 32,56"
          fill="none"
          stroke={theme.border}
          strokeWidth="1.5"
          strokeDasharray="4 2"
          opacity="0.6"
        />

        {/* Laurel Wreath Left */}
        <path
          d="M 50 120 C 40 100 45 75 60 60 C 62 70 58 85 50 120 Z"
          fill="#fbbf24"
          opacity="0.85"
        />
        {/* Laurel Wreath Right */}
        <path
          d="M 150 120 C 160 100 155 75 140 60 C 138 70 142 85 150 120 Z"
          fill="#fbbf24"
          opacity="0.85"
        />

        {/* Center Shield Emblem */}
        <polygon
          points="100,55 130,70 130,110 100,130 70,110 70,70"
          fill="#0f172a"
          stroke={theme.border}
          strokeWidth="2.5"
        />

        {/* Star Icon in Shield */}
        <path
          d="M 100 72 L 105 85 L 118 85 L 108 93 L 112 105 L 100 97 L 88 105 L 92 93 L 82 85 L 95 85 Z"
          fill="#fbbf24"
          filter="url(#glow)"
        />

        {/* Bottom Banner Ribbon */}
        <path
          d="M 15 160 L 40 155 L 160 155 L 185 160 L 175 185 L 160 180 L 100 195 L 40 180 L 25 185 Z"
          fill={`url(#goldRibbon-${variant})`}
          stroke="#78350f"
          strokeWidth="2"
        />

        {/* Points Text */}
        <text
          x="100"
          y="147"
          fill="#ffffff"
          fontSize="11"
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="sans-serif"
        >
          +{points} PTS
        </text>

        {/* Title Banner Text */}
        <text
          x="100"
          y="173"
          fill="#0f172a"
          fontSize="10"
          fontWeight="900"
          textAnchor="middle"
          fontFamily="sans-serif"
          letterSpacing="0.5"
        >
          {title.toUpperCase().slice(0, 20)}
        </text>

        {/* Top Crown Star */}
        <path
          d="M 100 2 L 103 9 L 110 9 L 105 13 L 107 20 L 100 16 L 93 20 L 95 13 L 90 9 L 97 9 Z"
          fill="#fbbf24"
        />
      </svg>
    </div>
  );
};

export default VectorBadge;
