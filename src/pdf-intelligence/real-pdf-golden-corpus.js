// v1.27 P3.2 — metadata only. No copyrighted PDF bytes are bundled.
import corpus from '../../artifacts/pdf-intelligence/real-pdf-corpus-v1.27.json' with { type: 'json' };

export const REAL_PDF_CORPUS = Object.freeze(corpus);
export const REAL_PDF_DOCUMENTS = Object.freeze(corpus.documents || []);
export const REAL_PDF_CASES = Object.freeze(corpus.cases || []);
