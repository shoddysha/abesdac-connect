import { supabase } from '@/lib/supabase';

const BACKUP_TABLES = [
  'profiles',
  'ministries',
  'members',
  'ministry_members',
  'events',
  'attendance',
  'announcements',
  'audit_logs',
] as const;

export async function generateFullBackup() {
  const tables: Record<string, unknown[]> = {};

  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase.from(table).select('*');
    if (error) throw new Error(`Could not back up "${table}": ${error.message}`);
    tables[table] = data ?? [];
  }

  return {
    system: 'ABESDAC_Connect',
    church: 'Abeka SDA Church',
    generated_at: new Date().toISOString(),
    tables,
  };
}

export function downloadBackupFile(backup: unknown) {
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `abesdac-connect-backup-${timestamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

// =====================================================================
// RESTORE
// =====================================================================

export interface ParsedBackup {
  system?: string;
  church?: string;
  generated_at?: string;
  tables: Record<string, unknown[]>;
}

export async function parseBackupFile(file: File): Promise<ParsedBackup> {
  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('That file is not valid JSON. Make sure you selected a backup file downloaded from this app.');
  }
  const backup = parsed as ParsedBackup;
  if (!backup || typeof backup !== 'object' || typeof backup.tables !== 'object' || backup.tables === null) {
    throw new Error('That file doesn\'t look like an ABESDAC_Connect backup (missing "tables" section).');
  }
  return backup;
}

const UPSERT_TABLES = ['ministries', 'members', 'ministry_members', 'events', 'attendance', 'announcements'] as const;

const BATCH_SIZE = 200;

export interface RestoreTableResult {
  table: string;
  attempted: number;
  succeeded: number;
  errors: string[];
}

export async function restoreFromBackup(
  backup: ParsedBackup,
  onProgress?: (table: string, done: number, total: number) => void
): Promise<RestoreTableResult[]> {
  const results: RestoreTableResult[] = [];

  const profileRows = (backup.tables.profiles ?? []) as any[];
  if (profileRows.length > 0) {
    const result: RestoreTableResult = { table: 'profiles', attempted: profileRows.length, succeeded: 0, errors: [] };
    for (let i = 0; i < profileRows.length; i++) {
      const row = profileRows[i];
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: row.full_name,
          phone: row.phone,
          role: row.role,
          avatar_url: row.avatar_url,
          is_active: row.is_active,
        })
        .eq('id', row.id);
      if (error) {
        result.errors.push(`${row.email ?? row.id}: ${error.message}`);
      } else {
        result.succeeded++;
      }
      onProgress?.('profiles', i + 1, profileRows.length);
    }
    results.push(result);
  }

  for (const table of UPSERT_TABLES) {
    const rows = (backup.tables[table] ?? []) as any[];
    if (rows.length === 0) continue;

    const result: RestoreTableResult = { table, attempted: rows.length, succeeded: 0, errors: [] };

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const { error, count } = await supabase.from(table).upsert(batch, { onConflict: 'id', count: 'exact' });
      if (error) {
        result.errors.push(`Rows ${i + 1}-${i + batch.length}: ${error.message}`);
      } else {
        result.succeeded += count ?? batch.length;
      }
      onProgress?.(table, Math.min(i + BATCH_SIZE, rows.length), rows.length);
    }

    results.push(result);
  }

  return results;
}