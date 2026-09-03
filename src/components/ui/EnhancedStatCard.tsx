import type { LucideIcon } from 'lucide-react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { cn } from '@/utils/cn';

interface EnhancedStatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: {
    value: number; // Percentage change (e.g., 4.3 for +4.3%)
    isPositive: boolean;
  };
  sparklineData?: number[]; // Array of values for the mini chart
  subtitle?: string;
  tone?: 'blue' | 'green' | 'orange' | 'purple';
}

export function EnhancedStatCard({
  label,
  value,
  icon: Icon,
  trend,
  sparklineData,
  subtitle,
  tone = 'blue',
}: EnhancedStatCardProps) {
  const toneClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    purple: 'bg-purple-50 text-purple-600',
  } as const;

  const sparklineColors = {
    blue: '#3b82f6',
    green: '#10b981',
    orange: '#f97316',
    purple: '#a855f7',
  } as const;

  // Convert sparklineData to recharts format
  const chartData = sparklineData?.map((val) => ({ value: val })) || [];

  return (
    <div className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md">
      {/* Icon and Label */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', toneClasses[tone])}>
              <Icon className="h-4 w-4" />
            </div>
            {trend && (
              <span
                className={cn(
                  'flex items-center gap-0.5 text-xs font-medium',
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                )}
              >
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
            )}
          </div>

          {/* Value */}
          <p className="text-3xl font-bold text-slate-900 mb-1">{value}</p>

          {/* Label */}
          <p className="text-sm text-slate-600">{label}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        {/* Sparkline Chart */}
        {sparklineData && sparklineData.length > 0 && (
          <div className="w-24 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={sparklineColors[tone]}
                  strokeWidth={2}
                  dot={false}
                  animationDuration={300}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
