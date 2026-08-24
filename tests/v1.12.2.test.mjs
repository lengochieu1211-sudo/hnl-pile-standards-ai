import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const ai = fs.readFileSync(new URL('../src/ai.js', import.meta.url), 'utf8');
test('v1.12.2 normalizes mixed display-math delimiters', () => {
  assert.match(main, /normalizeMathDelimiters/);
  assert.match(main, /HNL_DISPLAY_MATH/);
  assert.match(main, /math-display/);
});
test('v1.12.2 renders engineering latex tokens offline', () => {
  assert.match(main, /latexReadableHtml/);
  assert.match(main, /gamma:'γ'/);
  assert.match(main, /sum:'∑'/);
  assert.match(main, /math-frac/);
});
test('v1.12.2 tells AI to use consistent math delimiters', () => {
  assert.match(ai, /CÔNG THỨC TOÁN/);
  assert.match(ai, /Không trộn/);
});
