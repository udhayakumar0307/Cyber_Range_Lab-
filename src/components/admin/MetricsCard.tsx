import React from 'react';
import { TrendingUp, TrendingDown, type LucideIcon } from 'lucide-react';

interface MetricsCardProps {
  title: string;
  value: string | number;
  change: string;
  isPositive?: boolean;
  period?: string;
  icon: LucideIcon;
  colorTheme?: 'blue' | 'green' | 'orange' | 'purple';
}

export const MetricsCard: React.FC<MetricsCardProps> = ({
  title,
  value,
  change,
  isPositive = true,
  period = 'vs last 30 days',
  icon: Icon,
  colorTheme = 'blue',
}) => {
  const themeStyles = {
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
    purple: {
      bg: 'bg-purple-50',
      text: 'text-[#6F42C1]',
      border: 'border-purple-100',
    },
  };

  const selectedTheme = themeStyles[colorTheme];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        <div className={`p-2.5 rounded-lg ${selectedTheme.bg} ${selectedTheme.text} ${selectedTheme.border} border`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          {value}
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
            {change}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-slate-400 font-medium">
        <span>{period}</span>
        <span className="text-slate-300">●</span>
      </div>
    </div>
  );
};
