/** Browser/desktop-safe helpers for Pass 8 structural file intake. No engineering math. */

export function parseStructuralJsonText(text, { sourceId = 'PASS8_JSON_FILE' } = {}) {
  let data;
  try { data = JSON.parse(String(text ?? '')); }
  catch { throw new Error('File JSON kết cấu không hợp lệ.'); }

  if (data?.kind === 'DCE_TABLES' || data?.kind === 'CSV') return { ...data, sourceId: data.sourceId ?? sourceId };
  if (data?.tables && typeof data.tables === 'object') {
    return {
      kind: 'DCE_TABLES',
      tables: data.tables,
      sourceId,
      nodalReactionCompressionSign: data.nodalReactionCompressionSign ?? 'compression-positive',
      pierForceCompressionSign: data.pierForceCompressionSign ?? 'compression-negative'
    };
  }
  if (data?.pointCoordinates && data?.nodalReactions && data?.pointSpringAssignments) {
    return {
      kind: 'DCE_TABLES',
      tables: data,
      sourceId,
      nodalReactionCompressionSign: data.nodalReactionCompressionSign ?? 'compression-positive',
      pierForceCompressionSign: data.pierForceCompressionSign ?? 'compression-negative'
    };
  }
  throw new Error('JSON chưa đúng schema Pass 5: cần tables hoặc DCE_TABLES/CSV bundle.');
}

export function buildCsvStructuralBundle(files, { sourceId = 'PASS8_CSV_FILES', unitsProfile = 'kN_m_C' } = {}) {
  const needed = ['pointCoordinatesCsv','nodalReactionsCsv','pointSpringAssignmentsCsv'];
  for (const k of needed) if (!String(files?.[k] ?? '').trim()) throw new Error(`Thiếu ${k}.`);
  if (unitsProfile !== 'kN_m_C') throw new Error('CSV bundle chỉ nhận profile đơn vị đã xác minh kN_m_C.');
  return {
    kind: 'CSV',
    sourceId,
    unitsProfile,
    nodalReactionCompressionSign: 'compression-positive',
    pierForceCompressionSign: 'compression-negative',
    pointCoordinatesCsv: files.pointCoordinatesCsv,
    nodalReactionsCsv: files.nodalReactionsCsv,
    pointSpringAssignmentsCsv: files.pointSpringAssignmentsCsv,
    pierForcesCsv: files.pierForcesCsv ?? '',
    pierSectionCsv: files.pierSectionCsv ?? ''
  };
}
