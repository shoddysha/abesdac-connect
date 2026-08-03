import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UploadCloud, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { parseBackupFile, restoreFromBackup, type ParsedBackup, type RestoreTableResult } from '@/services/backup';

type Step = 'choose' | 'confirm' | 'restoring' | 'done';

const CONFIRM_PHRASE = 'RESTORE';

const TABLE_LABELS: Record<string, string> = {
  profiles: 'Users',
  ministries: 'Ministries',
  members: 'Members',
  ministry_members: 'Ministry rosters',
  events: 'Events',
  attendance: 'Attendance records',
  announcements: 'Announcements',
};

export function RestoreBackupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('choose');
  const [backup, setBackup] = useState<ParsedBackup | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [progress, setProgress] = useState({ table: '', done: 0, total: 0 });
  const [results, setResults] = useState<RestoreTableResult[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep('choose');
    setBackup(null);
    setConfirmText('');
    setProgress({ table: '', done: 0, total: 0 });
    setResults([]);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleFileChosen(file: File) {
    try {
      const parsed = await parseBackupFile(file);
      setBackup(parsed);
      setStep('confirm');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleRestore() {
    if (!backup) return;
    setStep('restoring');
    try {
      const restoreResults = await restoreFromBackup(backup, (table, done, total) =>
        setProgress({ table, done, total })
      );
      setResults(restoreResults);
      setStep('done');
      queryClient.invalidateQueries();
    } catch (err) {
      toast.error((err as Error).message);
      setStep('confirm');
    }
  }

  const rowCounts = backup
    ? Object.entries(backup.tables)
        .filter(([, rows]) => Array.isArray(rows) && rows.length > 0)
        .map(([table, rows]) => [table, (rows as unknown[]).length] as const)
    : [];

  return (
    <Modal open={open} onClose={handleClose} title="Restore from backup" size="lg">
      {step === 'choose' && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This adds back or updates records found in the backup file. It will <strong>not</strong> delete anything
              currently in your database that isn't in the file.
            </p>
          </div>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-secondary"
          >
            <UploadCloud className="h-8 w-8 text-slate-400" />
            <p className="text-sm font-medium text-ink">Click to choose a backup file</p>
            <p className="text-xs text-slate-500">A .json file downloaded from the Backup button above</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileChosen(e.target.files[0])}
            />
          </div>
        </div>
      )}

      {step === 'confirm' && backup && (
        <div className="space-y-4">
          <div>
            <p className="text-sm text-ink">
              This file was created{' '}
              <strong>{backup.generated_at ? format(new Date(backup.generated_at), 'MMM d, yyyy \'at\' h:mm a') : 'at an unknown time'}</strong>
              {backup.church ? ` for ${backup.church}` : ''}.
            </p>
            <div className="mt-3 space-y-1 rounded-lg border border-slate-200 p-3 text-sm">
              {rowCounts.length === 0 ? (
                <p className="text-slate-400">This backup file is empty.</p>
              ) : (
                rowCounts.map(([table, count]) => (
                  <div key={table} className="flex justify-between">
                    <span className="text-slate-600">{TABLE_LABELS[table] ?? table}</span>
                    <span className="font-medium text-ink">{count}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This will overwrite any current record that matches one in this file. Type <strong>{CONFIRM_PHRASE}</strong> below
              to confirm you understand.
            </p>
          </div>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            autoFocus
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep('choose')}>
              Back
            </Button>
            <Button variant="danger" onClick={handleRestore} disabled={confirmText !== CONFIRM_PHRASE}>
              Restore now
            </Button>
          </div>
        </div>
      )}

      {step === 'restoring' && (
        <div className="py-10 text-center">
          <div className="mx-auto mb-4 h-2 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-secondary transition-all"
              style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
            />
          </div>
          <p className="text-sm text-slate-600">
            Restoring {TABLE_LABELS[progress.table] ?? progress.table}… ({progress.done}/{progress.total})
          </p>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4 py-2 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <p className="text-lg font-semibold text-ink">Restore complete</p>
          <div className="mx-auto max-w-sm space-y-2 text-left text-sm">
            {results.map((r) => (
              <div key={r.table} className="rounded-lg border border-slate-200 px-3 py-2">
                <div className="flex justify-between">
                  <span className="text-ink">{TABLE_LABELS[r.table] ?? r.table}</span>
                  <span className="font-medium text-emerald-600">
                    {r.succeeded}/{r.attempted} restored
                  </span>
                </div>
                {r.errors.length > 0 && (
                  <div className="mt-1 flex items-start gap-1.5 text-xs text-red-600">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{r.errors.slice(0, 3).join('; ')}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Button onClick={handleClose}>Done</Button>
        </div>
      )}
    </Modal>
  );
}