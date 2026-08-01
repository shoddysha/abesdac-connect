import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

type Tone = 'green' | 'red' | 'amber' | 'blue' | 'slate';

const toneClasses: Record<Tone, string> = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  blue: 'bg-secondary-50 text-secondary-700 ring-blue-200',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset',
        toneClasses[tone]
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  switch (status) {
    case 'active':
    case 'upcoming':
    case 'completed':
      return 'green';
    case 'archived':
    case 'deceased':
    case 'cancelled':
      return 'red';
    case 'inactive':
    case 'ongoing':
      return 'amber';
    case 'transferred':
      return 'blue';
    default:
      return 'slate';
  }
}
