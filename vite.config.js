import { defineConfig } from 'vite';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const releaseMeta = JSON.parse(fs.readFileSync(new URL('./public/release-meta.json', import.meta.url), 'utf8'));
const excelCompatLayer = fileURLToPath(new URL('./src/excel-export-compat.js', import.meta.url));

if (releaseMeta.appVersion !== pkg.version) {
  throw new Error(`Release metadata mismatch: package=${pkg.version}, release-meta=${releaseMeta.appVersion}`);
}

export default defineConfig({
  base: './',
  define: {
    __HNL_APP_VERSION__: JSON.stringify(pkg.version),
    __HNL_CERTIFICATION_STAGE__: JSON.stringify(releaseMeta.certificationStage),
    __HNL_GOLDEN_BASELINE__: JSON.stringify(releaseMeta.goldenBaseline),
    __HNL_SEARCH_BRAIN__: JSON.stringify(releaseMeta.searchBrain)
  },
  resolve: {
    // v1.27.0 Excel Production compatibility layer. Keep the deterministic core
    // exporter untouched; the layer post-processes only user-facing workbook UI,
    // compatibility formulas and native chart OOXML.
    alias: [
      { find: /^\.\/excel-export\.js$/, replacement: excelCompatLayer }
    ]
  },
  server: { port: 5173 },
  preview: { port: 4173 }
});
