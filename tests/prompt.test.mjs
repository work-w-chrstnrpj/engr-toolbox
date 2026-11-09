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
