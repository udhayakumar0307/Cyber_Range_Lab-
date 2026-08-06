import React from 'react';
import { TrendingUp, TrendingDown, ShieldAlert, type LucideIcon } from 'lucide-react';

interface MetricsCardProps {
  title?: string;
  value?: string | number;
  change?: string;
  isPositive?: boolean;
  period?: string;
  icon?: LucideIcon;
  colorTheme?: 'blue' | 'green' | 'orange' | 'purple' | 'amber' | string;
}

export const MetricsCard: React.FC<MetricsCardProps> = ({
  title = 'Metric',
  value = '0',
  change = '0%',
  isPositive = true,
  period = 'Real-time Telemetry',
  icon: Icon = ShieldAlert,
  colorTheme = 'blue',
}) => {
  const themeStyles: Record<string, { bg: string; text: string; border: string }> = {
    blue: {
      bg: 'bg-blue-50',
      text: 'text-[#0052CC]',
      border: 'border-blue-100',
    },
    green: {
      bg: 'bg-emerald-50',
      text: 'text-[#28A745]',
      border: 'border-emerald-100',
    },
    orange: {
      bg: 'bg-amber-50',
      text: 'text-[#FFA500]',
      border: 'border-amber-100',
    },
    amber: {
      bg: 'bg-amber-50',
      text: 'text-[#FFA500]',
      border: 'border-amber-100',
    },
    purple: {
      bg: 'bg-purple-50',
      text: 'text-[#6F42C1]',
      border: 'border-purple-100',
    },
  };

  const selectedTheme = themeStyles[colorTheme] || themeStyles.blue;
  const RenderIcon = Icon || ShieldAlert;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title || 'Metric'}
        </span>
        <div className={`p-2.5 rounded-lg ${selectedTheme.bg} ${selectedTheme.text} ${selectedTheme.border} border`}>
          <RenderIcon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {value ?? 0}
        </h3>

        <div className="flex items-center gap-1">
          <span
            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold ${
              isPositive
                ? 'bg-emerald-50 text-[#28A745]'
                : 'bg-rose-50 text-rose-600'
            }`}
          >
            {isPositive ? (
              <TrendingUp className="w-3 h-3" />
            ) : (
              <TrendingDown className="w-3 h-3" />
            )}
            {change || '0%'}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400 font-medium">
        <span>{period || 'Real-time Telemetry'}</span>
        <span className="text-slate-300">●</span>
      </div>
    </div>
  );
};

