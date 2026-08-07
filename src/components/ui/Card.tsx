import type { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export function Card({ 
  className, 
  children, 
  onClick 
}: { 
  className?: string; 
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div 
      className={cn('rounded-xl border border-slate-200 bg-card p-5 shadow-card', className, onClick && 'cursor-pointer')}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-base font-semibold text-ink">{title}</h3>
      {action}
    </div>
  );
}
