import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function moduleDir(metaUrl) {
  return path.dirname(fileURLToPath(metaUrl));
}

export function resolveCliOutputPath(input, defaultPath, { cwd = process.cwd(), pathImpl = path } = {}) {
  const raw = input || defaultPath;
  if (!raw) throw new Error('resolveCliOutputPath requires input or defaultPath');
  return pathImpl.isAbsolute(raw) ? pathImpl.normalize(raw) : pathImpl.resolve(cwd, raw);
}
