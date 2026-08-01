import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
}

const fieldBase =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-secondary focus:outline-none focus:ring-2 focus:ring-secondary-50 disabled:bg-slate-50';

function FieldShell({ label, error, hint, children }: FieldWrapperProps & { children: ReactNode }) {
  return (
    <label className="block">
      {label && <span className="mb-1 block text-sm font-medium text-ink">{label}</span>}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & FieldWrapperProps>(
  ({ className, label, error, hint, ...props }, ref) => (
    <FieldShell label={label} error={error} hint={hint}>
      <input
        ref={ref}
        className={cn(fieldBase, error && 'border-red-400 focus:border-red-500 focus:ring-red-50', className)}
        {...props}
      />
    </FieldShell>
  )
);
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrapperProps
>(({ className, label, error, hint, ...props }, ref) => (
  <FieldShell label={label} error={error} hint={hint}>
    <textarea
      ref={ref}
      className={cn(fieldBase, 'min-h-[90px] resize-y', error && 'border-red-400', className)}
      {...props}
    />
  </FieldShell>
));
Textarea.displayName = 'Textarea';

interface SelectOption {
  value: string;
  label: string;
}

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement> & FieldWrapperProps & { options: SelectOption[]; placeholder?: string }
>(({ className, label, error, hint, options, placeholder, ...props }, ref) => (
  <FieldShell label={label} error={error} hint={hint}>
    <select ref={ref} className={cn(fieldBase, 'pr-8', error && 'border-red-400', className)} {...props}>
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  </FieldShell>
));
Select.displayName = 'Select';
