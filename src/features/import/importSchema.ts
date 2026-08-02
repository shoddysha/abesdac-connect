import { z } from 'zod';
import { format, isValid } from 'date-fns';

// Recognized spreadsheet column headers, matched case-insensitively and
// ignoring extra spaces, so "First Name", "first_name", "FIRST NAME" all work.
export const COLUMN_ALIASES: Record<string, string[]> = {
  first_name: ['first name', 'firstname'],
  last_name: ['last name', 'lastname', 'surname'],
  date_of_birth: ['date of birth', 'dob', 'birth date'],
  gender: ['gender', 'sex'],
  marital_status: ['marital status'],
  occupation: ['occupation', 'job'],
  nationality: ['nationality'],
  phone: ['phone', 'phone number', 'mobile'],
  alternate_phone: ['alternate phone', 'alternate phone number', 'secondary phone'],
  email: ['email', 'email address'],
  residential_address: ['residential address', 'address', 'home address'],
  gps_address: ['gps address', 'digital address', 'ghana post gps'],
  baptism_date: ['baptism date'],
  date_joined: ['date joined', 'joined date'],
  district: ['district'],
  ministry: ['ministry'],
  status: ['status'],
  spouse_name: ['spouse', 'spouse name'],
  children_names: ['children', 'children names'],
  emergency_contact_name: ['emergency contact', 'emergency contact name'],
  emergency_contact_phone: ['emergency contact phone', 'emergency phone'],
  image: ['image', 'image filename', 'photo'],
};

export function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Cells that Excel/Google Sheets formats as a "Date" come through from the
 * spreadsheet-reading library as real JS Date objects (as long as the
 * workbook is read with `cellDates: true` — see ImportMembersModal.tsx).
 * Without this, they'd arrive as raw Excel serial numbers like "45353"
 * (days since 1899-12-30), which Postgres correctly rejects as an invalid
 * date. We convert any such Date object into a clean "YYYY-MM-DD" string
 * here so it always reaches the database in a format it understands.
 */
function normalizeCellValue(value: unknown): string {
  if (value instanceof Date) {
    return isValid(value) ? format(value, 'yyyy-MM-dd') : '';
  }
  return String(value).trim();
}

/** Maps a raw spreadsheet row (keyed by original header text) to our internal field names. */
export function mapRowToFields(rawRow: Record<string, unknown>): Record<string, string> {
  const normalizedEntries = Object.entries(rawRow).map(([k, v]) => [normalizeHeader(k), v] as const);
  const mapped: Record<string, string> = {};

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const match = normalizedEntries.find(([header]) => aliases.includes(header));
    if (match && match[1] !== undefined && match[1] !== null) {
      mapped[field] = normalizeCellValue(match[1]);
    }
  }
  return mapped;
}

const optionalTrim = () =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.trim() : undefined));

export const importRowSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  date_of_birth: optionalTrim(),
  gender: z
    .string()
    .optional()
    .transform((v) => v?.toLowerCase())
    .refine((v) => !v || ['male', 'female'].includes(v), 'Gender must be male or female'),
  marital_status: z
    .string()
    .optional()
    .transform((v) => v?.toLowerCase())
    .refine(
      (v) => !v || ['single', 'married', 'divorced', 'widowed'].includes(v),
      'Marital status must be single, married, divorced, or widowed'
    ),
  occupation: optionalTrim(),
  nationality: optionalTrim(),
  phone: optionalTrim(),
  alternate_phone: optionalTrim(),
  email: z
    .string()
    .optional()
    .transform((v) => (v ? v.trim() : undefined))
    .refine((v) => !v || z.string().email().safeParse(v).success, 'Invalid email address'),
  residential_address: optionalTrim(),
  gps_address: optionalTrim(),
  baptism_date: optionalTrim(),
  date_joined: optionalTrim(),
  district: optionalTrim(),
  ministry: optionalTrim(),
  status: z
    .string()
    .optional()
    .transform((v) => v?.toLowerCase() || 'active')
    .refine(
      (v) => ['active', 'inactive', 'archived', 'transferred', 'deceased'].includes(v),
      'Status must be active, inactive, archived, transferred, or deceased'
    ),
  spouse_name: optionalTrim(),
  children_names: optionalTrim(),
  emergency_contact_name: optionalTrim(),
  emergency_contact_phone: optionalTrim(),
  image: optionalTrim(),
});

export type ImportRow = z.infer<typeof importRowSchema>;

export interface ParsedRow {
  rowNumber: number;
  raw: Record<string, string>;
  data: ImportRow | null;
  errors: string[];
}

export function validateRow(rowNumber: number, rawRow: Record<string, unknown>): ParsedRow {
  const mapped = mapRowToFields(rawRow);
  const result = importRowSchema.safeParse(mapped);
  if (result.success) {
    return { rowNumber, raw: mapped, data: result.data, errors: [] };
  }
  const errors = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
  return { rowNumber, raw: mapped, data: null, errors };
}