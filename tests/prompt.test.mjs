import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitLines, render, initialState } from '../lib/prompt.mjs';

test('fitLines clips lines so a redraw never counts wrapped rows', () => {
  const choices = [{ value: 'small', hint: 'x'.repeat(200) }];
  const lines = fitLines(render('2. Project size?', initialState(choices)), 80);
  assert.ok(lines.every(l => l.length <= 79));
  assert.equal(lines.length, render('2. Project size?', initialState(choices)).length);
});

test('fitLines leaves short lines and unknown widths alone', () => {
  assert.deepEqual(fitLines(['short'], 80), ['short']);
  assert.deepEqual(fitLines(['x'.repeat(300)], undefined), ['x'.repeat(300)]);
});

import { fitRows } from '../lib/prompt.mjs';

test('fitRows keeps the picker shorter than the terminal and the cursor visible', () => {
  const lines = ['q', 'hint', ...Array.from({ length: 12 }, (_, i) => `c${i}`)];
  const out = fitRows(lines, 8, 2 + 10);
  assert.ok(out.length <= 7);
  assert.ok(out.includes('c10'));
  assert.deepEqual(fitRows(lines, 40, 3), lines);
});
