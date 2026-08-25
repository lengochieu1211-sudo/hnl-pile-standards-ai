/** Pass 8.1 Excel export transport. Does not calculate engineering values. */
export async function requestPass8VietnameseExcel(exportContract, { fetchImpl = globalThis.fetch, baseUrl = '' } = {}) {
  if (!exportContract?.enabled) throw new Error(exportContract?.blockedReason || 'Xuất Excel đang bị khóa.');
  if (typeof fetchImpl !== 'function') throw new Error('Không có fetch để gọi dịch vụ xuất Excel.');
  const endpoint = /^https?:\/\//i.test(exportContract.endpoint) ? exportContract.endpoint : `${String(baseUrl || '').replace(/\/$/,'')}${exportContract.endpoint}` || exportContract.endpoint;
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(exportContract.payload)
  });
  if (!response.ok) {
    let message = `Dịch vụ xuất Excel trả lỗi HTTP ${response.status}.`;
    try { const j = await response.json(); if (j?.error) message = j.error; } catch {}
    throw new Error(message);
  }
  const blob = await response.blob();
  const disposition = response.headers?.get?.('content-disposition') || '';
  const utf = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const basic = disposition.match(/filename="?([^";]+)"?/i)?.[1];
  const fileName = utf ? decodeURIComponent(utf) : (basic || exportContract.fileNameSuggestion);
  return {
    blob, fileName,
    exportId: response.headers?.get?.('x-hnl-export-id') || null,
    templateSha256: response.headers?.get?.('x-hnl-template-sha256') || null,
    serverVerified: response.headers?.get?.('x-hnl-server-verified') === 'true'
  };
}
