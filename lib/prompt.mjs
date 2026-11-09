import readline from 'node:readline';

/**
 * Zero-dependency terminal pickers.
 * select:      ↑/↓ to move, Enter to choose.
 * multiSelect: ↑/↓ to move, Space to toggle, a = all, n = none, Enter to confirm.
 * The key handling is a pure reducer so it can be tested without a terminal.
 */

export function initialState(choices, { multi = false, selected = [], cursor = null } = {}) {
  const values = choices.map(c => c.value);
  const start = cursor ?? Math.max(0, multi ? 0 : values.indexOf(selected[0]));
  return { choices, multi, cursor: start, selected: new Set(selected.filter(v => values.includes(v))), done: false, cancelled: false, error: null };
}

export function reduce(state, key) {
  const s = { ...state, selected: new Set(state.selected), error: null };
  const n = s.choices.length;
  const name = key?.name;
  if (key?.ctrl && name === 'c') return { ...s, done: true, cancelled: true };
  if (name === 'up' || name === 'k') s.cursor = (s.cursor - 1 + n) % n;
  else if (name === 'down' || name === 'j' || name === 'tab') s.cursor = (s.cursor + 1) % n;
  else if (s.multi && name === 'space') {
    const v = s.choices[s.cursor].value;
    if (s.selected.has(v)) s.selected.delete(v);
    else s.selected.add(v);
  } else if (s.multi && name === 'a') s.choices.forEach(c => s.selected.add(c.value));
  else if (s.multi && name === 'n') s.selected.clear();
  else if (name === 'return' || name === 'enter') {
    if (s.multi && s.selected.size === 0) return { ...s, error: 'Pick at least one (Space to select)' };
    s.done = true;
  } else if (name === 'escape') return { ...s, done: true, cancelled: true };
  return s;
}

export function result(state) {
  if (state.cancelled) return null;
  if (state.multi) return state.choices.map(c => c.value).filter(v => state.selected.has(v));
  return state.choices[state.cursor].value;
}

export function render(question, state) {
  const lines = [question];
  lines.push(state.multi ? '  (↑/↓ move · Space select · a all · n none · Enter confirm)' : '  (↑/↓ move · Enter choose)');
  state.choices.forEach((c, i) => {
    const pointer = i === state.cursor ? '❯' : ' ';
    const box = state.multi ? (state.selected.has(c.value) ? '◉ ' : '◯ ') : '';
    const hint = c.hint ? `  — ${c.hint}` : '';
    lines.push(`${pointer} ${box}${c.label || c.value}${hint}`);
  });
  if (state.error) lines.push(`  ${state.error}`);
  return lines;
}

/** Clip lines to the terminal width. A line that wraps takes two rows, so the cursor-up redraw would miscount and leave copies behind. */
export function fitLines(lines, columns) {
  if (!columns || columns < 10) return lines;
  const max = columns - 1;
  return lines.map(l => (l.length > max ? l.slice(0, max - 1) + '…' : l));
}

function interactive(question, state, { input = process.stdin, output = process.stdout } = {}) {
  return new Promise(resolve => {
    readline.emitKeypressEvents(input);
    const wasRaw = input.isRaw;
    if (input.isTTY) input.setRawMode(true);
    input.resume();
    let drawn = 0;
    const draw = () => {
      if (drawn) output.write(`\x1b[${drawn}A\x1b[0J`);
      const lines = fitLines(render(question, state), output.columns);
      output.write(lines.join('\n') + '\n');
      drawn = lines.length;
    };
    const onKey = (_str, key) => {
      state = reduce(state, key || {});
      draw();
      if (state.done) {
        input.off('keypress', onKey);
        if (input.isTTY) input.setRawMode(!!wasRaw);
        input.pause();
        const value = result(state);
        const shown = value === null ? 'cancelled' : Array.isArray(value) ? value.join(', ') : value;
        output.write(`\x1b[${drawn}A\x1b[0J${question} ${shown}\n`);
        resolve(value);
      }
    };
    input.on('keypress', onKey);
    draw();
  });
}

/** Non-TTY fallback: one line of text (comma-separated for multi). */
async function lineFallback(question, choices, { multi, fallback, input, output }) {
  const rl = readline.createInterface({ input, output });
  const ask = q => new Promise(r => rl.question(q, r));
  const opts = choices.map(c => c.value).join(multi ? ',' : '/');
  const answer = String(await ask(`${question} [${opts}] (${Array.isArray(fallback) ? fallback.join(',') : fallback}): `)).trim();
  rl.close();
  if (!answer) return fallback;
  return multi ? answer.split(',').map(s => s.trim()).filter(Boolean) : answer;
}

export async function select(question, choices, { initial, input = process.stdin, output = process.stdout } = {}) {
  const list = choices.map(c => (typeof c === 'string' ? { value: c } : c));
  if (!input.isTTY) return lineFallback(question, list, { multi: false, fallback: initial ?? list[0].value, input, output });
  return interactive(question, initialState(list, { selected: initial ? [initial] : [] }), { input, output });
}

export async function multiSelect(question, choices, { initial = [], input = process.stdin, output = process.stdout } = {}) {
  const list = choices.map(c => (typeof c === 'string' ? { value: c } : c));
  if (!input.isTTY) return lineFallback(question, list, { multi: true, fallback: initial, input, output });
  return interactive(question, initialState(list, { multi: true, selected: initial }), { input, output });
}

export async function textInput(question, fallback, { input = process.stdin, output = process.stdout } = {}) {
  const rl = readline.createInterface({ input, output });
  const answer = await new Promise(r => rl.question(`${question} (${fallback}): `, r));
  rl.close();
  return String(answer).trim() || fallback;
}
