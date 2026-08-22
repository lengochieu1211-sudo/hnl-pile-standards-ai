import { defineConfig } from 'vite';
import fs from 'node:fs';

const pkg = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  base: './',
  define: {
    __HNL_APP_VERSION__: JSON.stringify(pkg.version)
  },
  server: { port: 5173 },
  preview: { port: 4173 }
});
