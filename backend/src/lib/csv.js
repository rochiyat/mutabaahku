// Cells starting with these are run as formulas by Excel/Sheets; prefix them so user text stays text.
const FORMULA_START = /^[=+\-@\t\r]/;

function cell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV with a UTF-8 BOM so Excel opens Indonesian text correctly. */
export function toCsv(header, rows) {
  const lines = [header, ...rows].map((r) => r.map(cell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}
