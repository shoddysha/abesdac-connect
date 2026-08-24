import type { LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';

export function StatCard({
  label,
  value,
  icon: Icon,
  tone = 'primary',
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: 'primary' | 'secondary' | 'accent';
}) {
  const toneClasses = {
    primary: 'bg-primary-50 text-primary',
    secondary: 'bg-secondary-50 text-secondary',
    accent: 'bg-accent-50 text-accent',
  } as const;

  return (
    <div className="rounded-xl border border-slate-200 bg-card p-5 shadow-card">
      <div className="flex items-center gap-4">
        <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-lg', toneClasses[tone])}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-slate-500">{label}</p>
          <p className="truncate text-xl font-bold text-ink" title={String(value)}>{value}</p>
        </div>
      </div>
    </div>
  );
}
