/**
 * HNL Pile Standards AI v1.25.7
 * Browser-safe structural CSV adapter extracted from Pass 5.2.
 *
 * Boundary:
 *   CSV text -> canonical Pass 5 importer only.
 * No Node.js runtime APIs and no engineering calculations are allowed here.
 */

import { importDceStructuralTableBundle } from './etabs-sap-importer.js';

export function requiredCompressionSign(v, label) {
  if (!['compression-positive', 'compression-negative'].includes(v)) {
    throw new Error(`${label} must explicitly be compression-positive or compression-negative`);
  }
  return v;
}

export function parseCsvText(csvText, { delimiter = ',' } = {}) {
  const text = String(csvText ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else {
      if (c === '"') quoted = true;
      else if (c === delimiter) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }

  if (quoted) throw new Error('CSV has unterminated quoted field');
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }

  const nonempty = rows.filter(r => r.some(x => String(x).trim() !== ''));
  if (!nonempty.length) return [];
  const headers = nonempty[0].map((h, i) => String(h).trim() || `Column${i + 1}`);
  return nonempty.slice(1).map((r, i) => {
    const o = { _sourceRow: i + 2 };
    headers.forEach((h, j) => { o[h] = r[j] ?? ''; });
    return o;
  });
}

export function importStructuralCsvBundle({
  pointCoordinatesCsv,
  nodalReactionsCsv,
  pointSpringAssignmentsCsv,
  pierForcesCsv = '',
  pierSectionCsv = '',
  sourceId = 'CSV_FALLBACK',
  nodalReactionCompressionSign,
  pierForceCompressionSign,
  unitsProfile
}) {
  if (unitsProfile !== 'kN_m_C') throw new Error('CSV fallback unitsProfile must explicitly be kN_m_C');
  return importDceStructuralTableBundle({
    pointCoordinates: parseCsvText(pointCoordinatesCsv),
    nodalReactions: parseCsvText(nodalReactionsCsv),
    pointSpringAssignments: parseCsvText(pointSpringAssignmentsCsv),
    pierForces: parseCsvText(pierForcesCsv),
    pierSection: parseCsvText(pierSectionCsv),
    sourceId,
    nodalReactionCompressionSign: requiredCompressionSign(nodalReactionCompressionSign, 'nodalReactionCompressionSign'),
    pierForceCompressionSign: requiredCompressionSign(pierForceCompressionSign, 'pierForceCompressionSign')
  });
}
