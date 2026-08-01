import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToCSV(filename: string, rows: Record<string, unknown>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  downloadBlob(csv, `${filename}.csv`, 'text/csv;charset=utf-8;');
}

export function exportToExcel(filename: string, rows: Record<string, unknown>[], sheetName = 'Sheet1') {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportToPDF(title: string, filename: string, head: string[], body: (string | number)[][]) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  autoTable(doc, {
    head: [head],
    body,
    startY: 22,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [15, 42, 95] }, // primary color
  });
  doc.save(`${filename}.pdf`);
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
