import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { templateRoot, tempDir, write, ticket, gitInit } from './helpers.mjs';
import { loadTickets, frontier, renderBoard, writeBoard, setTicketStatus, appendProgressLog, parseBlockers } from '../lib/tickets.mjs';
import { runGate } from '../lib/gates.mjs';
import { detectDrift, markSyncPoint, readMapEntries } from '../lib/drift.mjs';
import { checkCommits, checkMessage } from '../lib/commits.mjs';
import { runLoop } from '../lib/loop.mjs';
import { validateTemplate } from '../lib/validator.mjs';
import { installAssets } from '../lib/install.mjs';

function project() {
  const root = tempDir();
  write(root, 'tickets/shop/01-cart.md', ticket({ n: '01', title: 'Cart', status: 'done', evidence: '- Commits: abc123\n- Tests: npm test passed' }));
  write(root, 'tickets/shop/02-checkout.md', ticket({ n: '02', title: 'Checkout', blockedBy: '01' }));
  write(root, 'tickets/shop/03-receipt.md', ticket({ n: '03', title: 'Receipt', blockedBy: '02' }));
  write(root, 'tickets/shop/04-erd.md', ticket({ n: '04', title: 'ERD', type: 'design' }));
  return root;
}

describe('tickets', () => {
  test('parses fields, blockers, criteria and evidence', () => {
    const tickets = loadTickets(project());
    const t = tickets.find(x => x.id === 'shop/03');
    assert.equal(t.title, 'Receipt');
    assert.equal(t.type, 'dev');
    assert.deepEqual(t.blockedBy, ['shop/02']);
    assert.equal(t.criteriaTotal, 1);
    assert.equal(tickets.find(x => x.id === 'shop/01').hasEvidence, true);
    assert.equal(t.hasEvidence, false);
  });

  test('blocker formats: None, numbers, #n, cross-feature ids', () => {
    assert.deepEqual(parseBlockers('None (can start immediately)', 'f'), []);
    assert.deepEqual(parseBlockers('1, #2, other/07', 'f'), ['f/01', 'f/02', 'other/07']);
  });

  test('frontier is ready and unblocked, filterable by type', () => {
    const tickets = loadTickets(project());
    assert.deepEqual(frontier(tickets).map(t => t.id), ['shop/02', 'shop/04']);
    assert.deepEqual(frontier(tickets, { types: ['dev'] }).map(t => t.id), ['shop/02']);
  });

  test('board groups tickets and links files', () => {
    const root = project();
    const board = renderBoard(loadTickets(root));
    assert.match(board, /## Ready \(frontier\)/);
    assert.match(board, /## Blocked/);
    assert.match(board, /\[shop\/03\]\(shop\/03-receipt\.md\)/);
    assert.ok(fs.existsSync(writeBoard(root)));
  });

  test('status edits and progress log appends', () => {
    const root = project();
    const file = path.join(root, 'tickets/shop/02-checkout.md');
    setTicketStatus(file, 'in-progress');
    appendProgressLog(file, 'agent', ['Did: wrote test', 'Next: implement'], new Date('2026-11-07'));
    const t = loadTickets(root).find(x => x.id === 'shop/02');
    assert.equal(t.status, 'in-progress');
    assert.equal(t.logEntries, 1);
    assert.match(fs.readFileSync(file, 'utf8'), /### 2026-11-07 agent\n- Did: wrote test/);
    assert.throws(() => setTicketStatus(file, 'finished'), /Unknown ticket status/);
  });
});

describe('validate', () => {
  test('done ticket without evidence, unknown blocker and bad status fail', () => {
    const root = project();
    write(root, 'tickets/shop/05-x.md', ticket({ n: '05', status: 'done' }));
    write(root, 'tickets/shop/06-y.md', ticket({ n: '06', blockedBy: '09' }));
    write(root, 'tickets/shop/07-z.md', ticket({ n: '07', status: 'finished' }));
    const v = validateTemplate(root);
    assert.ok(v.errors.some(e => e.includes('05-x.md: status is done but Evidence is empty')));
    assert.ok(v.errors.some(e => e.includes("blocked by unknown ticket 'shop/09'")));
    assert.ok(v.errors.some(e => e.includes("unknown status 'finished'")));
  });

  test('ADR supersede links must resolve', () => {
    const root = tempDir();
    write(root, 'docs/adr/0001-db.md', '# ADR-0001\n\n**Status:** Superseded by ADR-0002\n');
    write(root, 'docs/adr/0003-x.md', '# ADR-0003\n\n**Status:** accepted\n**Supersedes:** ADR-0009\n');
    const v = validateTemplate(root);
    assert.ok(v.errors.some(e => e.includes('0001-db.md: references ADR-0002')));
    assert.ok(v.errors.some(e => e.includes('0003-x.md: references ADR-0009')));
  });

  test('map entries must point at existing paths; placeholders are ignored', () => {
    const root = tempDir();
    write(root, 'src/api/routes.js', '');
    write(root, '.ai/maps/api-map.md', '- Routes → `src/api/routes.js`\n- Old → `src/legacy`\n- <thing> → `<path>`\n');
    assert.equal(readMapEntries(root).length, 2);
    const v = validateTemplate(root);
    assert.ok(v.errors.some(e => e.includes("'Old' points at missing path 'src/legacy'")));
    assert.ok(!v.errors.some(e => e.includes('routes.js')));
  });

  test('task context check blocks on NOT_STARTED reference docs', () => {
    const root = tempDir();
    installAssets({ templateRoot, targetDir: root, size: 'medium', tools: [] });
    const v = validateTemplate(root, { task: 'database' });
    assert.ok(v.errors.some(e => e.includes("[Task Blocked] 'database'")));
  });

  test('the template repository itself validates', () => {
    const v = validateTemplate(templateRoot);
    assert.equal(v.errors.length, 0, v.errors.join('; '));
  });
});

describe('gates', () => {
  test('implement gate: blocked, missing criteria, wrong state, ok', () => {
    const root = project();
    write(root, 'tickets/shop/05-nocrit.md', ticket({ n: '05', criteria: [] }));
    assert.equal(runGate(root, 'implement', { ticket: 'shop/02' }).ok, true);
    assert.match(runGate(root, 'implement', { ticket: 'shop/03' }).reasons.join(), /blocked by shop\/02/);
    assert.match(runGate(root, 'implement', { ticket: 'shop/05' }).reasons.join(), /no acceptance criteria/);
    assert.match(runGate(root, 'implement', { ticket: 'shop/01' }).reasons.join(), /status is 'done'/);
    assert.match(runGate(root, 'implement', { ticket: 'shop/99' }).reasons.join(), /not found/);
  });

  test('release gate needs every ticket closed with evidence', () => {
    const root = project();
    const r = runGate(root, 'release', { feature: 'shop' });
    assert.equal(r.ok, false);
    assert.ok(r.reasons.some(x => x.includes('shop/02')));
    write(root, 'tickets/done/01-a.md', ticket({ n: '01', status: 'done', evidence: '- Commits: abc' }));
    write(root, 'tickets/done/02-b.md', ticket({ n: '02', status: 'wontfix' }));
    assert.equal(runGate(root, 'release', { feature: 'done' }).ok, true);
  });

  test('spec gate needs a real goal and a glossary', () => {
    const root = tempDir();
    installAssets({ templateRoot, targetDir: root, size: 'small', tools: [] });
    assert.equal(runGate(root, 'spec').ok, false);
    const agents = path.join(root, 'AGENTS.md');
    fs.writeFileSync(agents, fs.readFileSync(agents, 'utf8').replace('[State the project goal here.]', 'Sell shoes.').replace('[Runtime or framework]', 'Node 22'));
    assert.equal(runGate(root, 'spec').ok, true);
  });
});

describe('drift', () => {
  test('reports changed files, affected maps, unmapped files and doc hints since the sync point', () => {
    const root = tempDir();
    const g = gitInit(root);
    write(root, 'src/api/routes.js', 'v1');
    write(root, '.ai/maps/api-map.md', '- Routes → `src/api`\n');
    g.commit('initial [no-ticket]');
    markSyncPoint(root);
    write(root, 'src/api/routes.js', 'v2');
    write(root, 'src/db/migrations/001.sql', 'create table');
    write(root, 'docs/notes.md', 'ignored');
    g.commit('teammate change');

    const r = detectDrift(root);
    assert.equal(r.commits.length, 1);
    assert.deepEqual(Object.keys(r.affectedMaps), ['.ai/maps/api-map.md']);
    assert.deepEqual(r.unmapped.map(c => c.path), ['src/db/migrations/001.sql']);
    assert.ok(r.docHints['docs/database/data-model.md']);
    assert.ok(r.docHints['docs/api/api-specification.md']);
  });

  test('requires a sync point', () => {
    const root = tempDir();
    gitInit(root).commit('x [no-ticket]');
    assert.throws(() => detectDrift(root), /No sync point/);
  });
});

describe('commit checks', () => {
  test('message rules', () => {
    const known = new Set(['shop/02']);
    assert.equal(checkMessage('feat: checkout [shop/02]', known).ok, true);
    assert.equal(checkMessage('fix: thing (#12)', known).ok, true);
    assert.equal(checkMessage('chore: bump [no-ticket]', known).ok, true);
    assert.match(checkMessage('feat: x shop/09', known).reason, /unknown ticket/);
    assert.match(checkMessage('feat: x', known).reason, /no ticket reference/);
  });

  test('checks a git range against local tickets', () => {
    const root = project();
    const g = gitInit(root);
    const base = g.commit('base [no-ticket]');
    write(root, 'a.txt', '1');
    g.commit('feat: checkout shop/02');
    write(root, 'b.txt', '2');
    g.commit('wip');
    const r = checkCommits(root, `${base}..HEAD`);
    assert.equal(r.ok, false);
    assert.deepEqual(r.results.map(x => x.ok), [false, true]);
  });
});

describe('loop', () => {
  test('dry run picks the frontier without changing anything', () => {
    const root = project();
    const before = fs.readFileSync(path.join(root, 'tickets/shop/02-checkout.md'), 'utf8');
    const logs = [];
    const r = runLoop({ root, dryRun: true, log: m => logs.push(m) });
    assert.equal(r.worked[0].id, 'shop/02');
    assert.equal(fs.readFileSync(path.join(root, 'tickets/shop/02-checkout.md'), 'utf8'), before);
    assert.ok(logs.some(l => l.includes('next ticket: shop/02')));
  });

  test('refuses to run without an agent or a verify command', () => {
    const root = project();
    assert.throws(() => runLoop({ root, log: () => {} }), /--agent/);
    assert.throws(() => runLoop({ root, agent: 'echo', log: () => {} }), /No check command/);
  });

  test('green checks move the ticket to in-review; dependents stay blocked until it is done', () => {
    const root = project();
    const r = runLoop({ root, agent: 'agent', check: 'checks', maxTickets: 2, log: () => {}, runner: () => true });
    assert.deepEqual(r.worked.map(w => [w.id, w.outcome]), [['shop/02', 'in-review']]);
    assert.equal(r.stoppedBecause, 'frontier empty');
    const t = loadTickets(root).find(x => x.id === 'shop/02');
    assert.equal(t.status, 'in-review');
    assert.ok(t.logEntries >= 2);
  });

  test('failing checks retry up to the cap, then hand to a human and stop', () => {
    const root = project();
    const calls = [];
    const r = runLoop({ root, agent: 'agent', check: 'checks', maxAttempts: 2, maxTickets: 3, log: () => {}, runner: cmd => (calls.push(cmd), !cmd.startsWith('checks')) });
    assert.equal(calls.filter(c => c === 'checks').length, 2);
    assert.equal(loadTickets(root).find(x => x.id === 'shop/02').status, 'ready-for-human');
    assert.match(r.stoppedBecause, /needs a human/);
  });
});
