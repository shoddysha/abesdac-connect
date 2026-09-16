import { supabase } from '@/lib/supabase';
import { z } from 'zod';

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

// ─── Row-level Zod validators ──────────────────────────────────────────────
// These guard the restore path so a crafted backup file cannot inject bad data.

const roleEnum = z.enum(['administrator', 'secretary', 'pastor', 'ministry_leader']);

const profileRestoreSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1).max(200),
  phone: z.string().max(30).nullable().optional(),
  role: roleEnum,
  avatar_url: z.string().url().nullable().optional(),
  is_active: z.boolean(),
});

const memberRestoreSchema = z.object({
  id: z.string().uuid(),
  member_code: z.string().min(1).max(20),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  status: z.enum(['active', 'inactive', 'archived', 'transferred', 'deceased']),
  gender: z.enum(['male', 'female']).nullable().optional(),
  is_archived: z.boolean(),
}).passthrough(); // allow extra fields — we only care about critical ones

const ministryRestoreSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  is_active: z.boolean(),
}).passthrough();

const ministryMemberRestoreSchema = z.object({
  id: z.string().uuid(),
  ministry_id: z.string().uuid(),
  member_id: z.string().uuid(),
}).passthrough();

const genericRowSchema = z.object({ id: z.string().uuid() }).passthrough();

const TABLE_SCHEMAS: Record<string, z.ZodTypeAny> = {
  profiles: profileRestoreSchema,
  members: memberRestoreSchema,
  ministries: ministryRestoreSchema,
  ministry_members: ministryMemberRestoreSchema,
};

/**
 * Validate all rows in a backup table section.
 * Returns validated rows and an array of error messages for invalid rows.
 */
function validateTableRows(
  table: string,
  rows: unknown[]
): { valid: unknown[]; skipped: string[] } {
  const schema = TABLE_SCHEMAS[table] ?? genericRowSchema;
  const valid: unknown[] = [];
  const skipped: string[] = [];
  for (const [i, row] of rows.entries()) {
    const result = schema.safeParse(row);
    if (result.success) {
      valid.push(result.data);
    } else {
      const issues = result.error.issues.map((e) => e.message).join(', ');
      skipped.push(`Row ${i + 1}: ${issues}`);
    }
  }
  return { valid, skipped };
}

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

  // ── profiles: validate rows and block role escalation ──────────────────
  const rawProfileRows = (backup.tables.profiles ?? []) as unknown[];
  if (rawProfileRows.length > 0) {
    const { valid: validProfileRows, skipped } = validateTableRows('profiles', rawProfileRows);
    const profileRows = validProfileRows as z.infer<typeof profileRestoreSchema>[];

    const result: RestoreTableResult = {
      table: 'profiles',
      attempted: rawProfileRows.length,
      succeeded: 0,
      errors: [...skipped.map((s) => `Skipped (invalid): ${s}`)],
    };

    // Fetch current roles so we can block escalation attempts
    const { data: currentProfiles } = await supabase.from('profiles').select('id, role');
    const currentRoleMap = new Map(
      (currentProfiles ?? []).map((p: { id: string; role: string }) => [p.id, p.role])
    );

    for (let i = 0; i < profileRows.length; i++) {
      const row = profileRows[i];

      // Block: backup file cannot escalate a user's role
      const existingRole = currentRoleMap.get(row.id);
      if (existingRole && row.role !== existingRole) {
        result.errors.push(
          `${row.full_name ?? row.id}: role change blocked (${existingRole} → ${row.role})`
        );
        onProgress?.('profiles', i + 1, profileRows.length);
        continue;
      }

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
        result.errors.push(`${row.full_name ?? row.id}: ${error.message}`);
      } else {
        result.succeeded++;
      }
      onProgress?.('profiles', i + 1, profileRows.length);
    }
    results.push(result);
  }

  for (const table of UPSERT_TABLES) {
    const rawRows = (backup.tables[table] ?? []) as unknown[];
    if (rawRows.length === 0) continue;

    const { valid: validRows, skipped } = validateTableRows(table, rawRows);
    const result: RestoreTableResult = {
      table,
      attempted: rawRows.length,
      succeeded: 0,
      errors: [...skipped.map((s) => `Skipped (invalid): ${s}`)],
    };

    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      const { error, count } = await supabase.from(table).upsert(batch, { onConflict: 'id', count: 'exact' });
      if (error) {
        result.errors.push(`Rows ${i + 1}-${i + batch.length}: ${error.message}`);
      } else {
        result.succeeded += count ?? batch.length;
      }
      onProgress?.(table, Math.min(i + BATCH_SIZE, validRows.length), validRows.length);
    }

    results.push(result);
  }

  return results;
}