import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { UploadCloud, Image as ImageIcon, CheckCircle2, AlertTriangle, Download } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { validateRow, type ParsedRow } from '@/features/import/importSchema';
import { uploadMemberImage } from '@/services/storage';
import { createMember } from '@/services/members';
import { fetchMinistries } from '@/services/ministries';
import { useAuth } from '@/contexts/AuthContext';
import { exportToExcel } from '@/utils/export';

type Step = 'upload' | 'preview' | 'importing' | 'done';

export function ImportMembersModal({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>('upload');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [imageFiles, setImageFiles] = useState<Map<string, File>>(new Map());
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState({ imported: 0, failed: 0, errors: [] as string[] });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setStep('upload');
    setRows([]);
    setImageFiles(new Map());
    setProgress({ done: 0, total: 0 });
    setResult({ imported: 0, failed: 0, errors: [] });
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSpreadsheet(file: File) {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' });

    if (json.length === 0) {
      toast.error('No rows found in that spreadsheet.');
      return;
    }

    const parsed = json.map((row, i) => validateRow(i + 2, row)); // +2: header row + 1-indexing
    setRows(parsed);
    setStep('preview');
  }

  function handleImageFiles(files: FileList) {
    const map = new Map(imageFiles);
    Array.from(files).forEach((f) => map.set(f.name.toLowerCase(), f));
    setImageFiles(map);
    toast.success(`${files.length} image(s) added`);
  }

  function updateCell(rowNumber: number, field: string, value: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowNumber !== rowNumber) return r;
        const revalidated = validateRow(rowNumber, { ...r.raw, [field]: value });
        return revalidated;
      })
    );
  }

  const validRows = rows.filter((r) => r.errors.length === 0);
  const invalidRows = rows.filter((r) => r.errors.length > 0);

  async function handleImport() {
    if (validRows.length === 0) return;
    setStep('importing');
    setProgress({ done: 0, total: validRows.length });

    const ministries = await fetchMinistries();
    let imported = 0;
    const errors: string[] = [];

    for (const row of validRows) {
      try {
        const d = row.data!;
        let profileImageUrl: string | null = null;

        if (d.image) {
          const file = imageFiles.get(d.image.toLowerCase());
          if (file) {
            profileImageUrl = await uploadMemberImage(file, `${d.first_name}-${d.last_name}`.toLowerCase());
          }
        }

        const ministry = d.ministry ? ministries.find((m) => m.name.toLowerCase() === d.ministry!.toLowerCase()) : undefined;

        await createMember({
          first_name: d.first_name,
          last_name: d.last_name,
          date_of_birth: d.date_of_birth || null,
          gender: (d.gender as 'male' | 'female' | undefined) || null,
          marital_status: d.marital_status as any,
          occupation: d.occupation || null,
          nationality: d.nationality || null,
          phone: d.phone || null,
          alternate_phone: d.alternate_phone || null,
          email: d.email || null,
          residential_address: d.residential_address || null,
          gps_address: d.gps_address || null,
          baptism_date: d.baptism_date || null,
          date_joined: d.date_joined || new Date().toISOString().slice(0, 10),
          district: d.district || null,
          ministry_id: ministry?.id ?? null,
          status: (d.status as any) || 'active',
          spouse_name: d.spouse_name || null,
          children_names: d.children_names || null,
          emergency_contact_name: d.emergency_contact_name || null,
          emergency_contact_phone: d.emergency_contact_phone || null,
          profile_image_url: profileImageUrl,
          created_by: profile?.id,
        });
        imported++;
      } catch (err) {
        errors.push(`Row ${row.rowNumber}: ${(err as Error).message}`);
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    setResult({ imported, failed: errors.length, errors });
    setStep('done');
    onImported();
  }

  function downloadTemplate() {
    exportToExcel(
      'member-import-template',
      [
        {
          'First Name': 'John',
          'Last Name': 'Doe',
          'Date of Birth': '1990-05-14',
          Gender: 'male',
          'Marital Status': 'married',
          Occupation: 'Teacher',
          Nationality: 'Ghanaian',
          Phone: '0244000000',
          'Alternate Phone': '',
          Email: 'john.doe@example.com',
          'Residential Address': 'Abeka, Accra',
          'GPS Address': 'GA-123-4567',
          'Baptism Date': '2010-06-01',
          'Date Joined': '2015-01-10',
          District: 'Abeka',
          Ministry: 'Choir',
          Status: 'active',
          Spouse: 'Jane Doe',
          Children: 'Sam, Ama',
          'Emergency Contact': 'Mary Doe',
          'Emergency Contact Phone': '0201234567',
          Image: 'john.jpg',
        },
      ],
      'Members'
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Import members from spreadsheet" size="xl">
      {step === 'upload' && (
        <div className="space-y-5">
          <button
            onClick={downloadTemplate}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-secondary hover:bg-slate-100"
          >
            <Download className="h-4 w-4" /> Download the Excel template
          </button>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-6 py-10 text-center hover:border-secondary"
          >
            <UploadCloud className="h-8 w-8 text-slate-400" />
            <p className="text-sm font-medium text-ink">Click to choose a spreadsheet</p>
            <p className="text-xs text-slate-500">Supports .xlsx, .xls, and .csv</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleSpreadsheet(e.target.files[0])}
            />
          </div>

          <div
            onClick={() => imageInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-6 py-8 text-center hover:border-secondary"
          >
            <ImageIcon className="h-7 w-7 text-slate-400" />
            <p className="text-sm font-medium text-ink">
              Optional: select member photos ({imageFiles.size} added)
            </p>
            <p className="text-xs text-slate-500">
              File names must match the "Image" column in your spreadsheet (e.g. john.jpg)
            </p>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleImageFiles(e.target.files)}
            />
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 font-medium text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> {validRows.length} ready to import
            </span>
            {invalidRows.length > 0 && (
              <span className="flex items-center gap-1.5 font-medium text-amber-700">
                <AlertTriangle className="h-4 w-4" /> {invalidRows.length} need correction
              </span>
            )}
          </div>

          <div className="table-scroll max-h-[45vh]">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">First name</th>
                  <th className="px-3 py-2">Last name</th>
                  <th className="px-3 py-2">Gender</th>
                  <th className="px-3 py-2">Phone</th>
                  <th className="px-3 py-2">Image</th>
                  <th className="px-3 py-2">Issues</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr key={row.rowNumber} className={row.errors.length ? 'bg-red-50/50' : ''}>
                    <td className="px-3 py-2 text-slate-400">{row.rowNumber}</td>
                    {(['first_name', 'last_name', 'gender', 'phone', 'image'] as const).map((field) => (
                      <td key={field} className="px-3 py-1.5">
                        <input
                          defaultValue={row.raw[field] ?? ''}
                          onBlur={(e) => updateCell(row.rowNumber, field, e.target.value)}
                          className="w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-slate-200 focus:border-secondary focus:bg-white focus:outline-none"
                        />
                      </td>
                    ))}
                    <td className="px-3 py-2 text-xs text-red-600">{row.errors.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep('upload')}>
              Back
            </Button>
            <Button onClick={handleImport} disabled={validRows.length === 0}>
              Import {validRows.length} member{validRows.length === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      )}

      {step === 'importing' && (
        <div className="py-10 text-center">
          <div className="mx-auto mb-4 h-2 w-full max-w-sm overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full bg-secondary transition-all"
              style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }}
            />
          </div>
          <p className="text-sm text-slate-600">
            Importing {progress.done} of {progress.total}…
          </p>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4 py-4 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <p className="text-lg font-semibold text-ink">
            {result.imported} member{result.imported === 1 ? '' : 's'} imported successfully
          </p>
          {result.failed > 0 && (
            <div className="mx-auto max-w-md rounded-lg bg-red-50 p-3 text-left text-xs text-red-700">
              <p className="mb-1 font-medium">{result.failed} row(s) failed:</p>
              {result.errors.map((e, i) => (
                <p key={i}>{e}</p>
              ))}
            </div>
          )}
          <Button onClick={handleClose}>Done</Button>
        </div>
      )}
    </Modal>
  );
}
