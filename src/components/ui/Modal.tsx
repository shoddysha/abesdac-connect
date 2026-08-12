import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-2 sm:p-4 sm:items-center">
      <div className={`w-full ${widths[size]} rounded-xl bg-white shadow-xl my-4 sm:my-0`}>
        <div className="flex items-center justify-between border-b border-slate-200 px-4 sm:px-5 py-3 sm:py-4">
          <h2 className="text-base sm:text-lg font-semibold text-ink truncate pr-2">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-ink shrink-0"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-4 sm:px-5 py-4 sm:py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}
