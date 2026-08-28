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

export function CardHeader({ 
  title, 
  action, 
  icon: Icon 
}: { 
  title: string; 
  action?: ReactNode; 
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-5 w-5 text-primary" />}
        <h3 className="text-base font-semibold text-ink">{title}</h3>
      </div>
      {action}
    </div>
  );
}
