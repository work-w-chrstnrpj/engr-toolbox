import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { templateRoot, tempDir, write, ticket, gitInit } from './helpers.mjs';
import { loadTickets, frontier, renderBoard, writeBoard, setTicketStatus, appendProgressLog, parseBlockers } from '../lib/tickets.mjs';
import { runGate, gateDeliver } from '../lib/gates.mjs';
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

describe('deliver gate', () => {
  test('needs every criterion ticked and named by a test, no open blockers, commits and tests evidence', () => {
    const root = tempDir();
    write(root, 'tickets/f/01-a.md', ticket({ n: '01', status: 'in-progress', criteria: ['- [x] AC1: one', '- [ ] AC2: two'] }));
    let r = gateDeliver(root, 'f/01');
    assert.equal(r.ok, false);
    assert.ok(r.reasons.some(x => x.includes('not ticked: AC2')));
    assert.ok(r.reasons.some(x => x.includes('no automated test names f/01#AC1, f/01#AC2')));
    assert.ok(r.reasons.some(x => x.includes('evidence missing: Commits')));

    write(root, 'tickets/f/01-a.md', ticket({ n: '01', status: 'in-progress', criteria: ['- [x] AC1: one', '- [x] AC2: two'], evidence: '- Commits: abc\n- Tests: npm test, 4 passed' }));
    write(root, 'src/a.test.js', "it('f/01#AC1 one'); it('f/01#AC2 two')");
    r = gateDeliver(root, 'f/01');
    assert.equal(r.ok, true, r.reasons.join('; '));
  });

  test('qa tickets need ticked criteria and evidence, not automated tests; "Not committed" is not evidence', () => {
    const root = tempDir();
    write(root, 'tickets/f/02-qa.md', ticket({ n: '02', type: 'qa', status: 'in-progress', criteria: ['- [x] AC1: checked'], evidence: '- Commits: n/a run only\n- Tests: qa/runs/2026-11-07-f.md' }));
    assert.equal(gateDeliver(root, 'f/02').ok, true);
    write(root, 'tickets/f/03-dev.md', ticket({ n: '03', status: 'in-progress', criteria: ['- [x] AC1: x'], evidence: '- Commits: Not committed yet\n- Tests: ok' }));
    write(root, 'a.test.js', "it('f/03#AC1')");
    assert.match(gateDeliver(root, 'f/03').reasons.join(), /evidence missing: Commits/);
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

  test('delivered ticket (tests named, criteria ticked, evidence) moves to in-review; dependents stay blocked', () => {
    const root = project();
    const deliver = cmd => {
      if (cmd.startsWith('agent')) {
        const f = path.join(root, 'tickets/shop/02-checkout.md');
        fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('- [ ] works', '- [x] AC1: works').replace('- Commits:', '- Commits: abc123').replace('- Tests:', '- Tests: npm test passed'));
        write(root, 'tests/checkout.test.js', "test('shop/02#AC1 works', () => {})");
      }
      return true;
    };
    const r = runLoop({ root, agent: 'agent', check: 'checks', maxTickets: 2, log: () => {}, runner: deliver });
    assert.deepEqual(r.worked.map(w => [w.id, w.outcome]), [['shop/02', 'in-review']]);
    assert.equal(r.stoppedBecause, 'frontier empty');
    const t = loadTickets(root).find(x => x.id === 'shop/02');
    assert.equal(t.status, 'in-review');
    assert.ok(t.logEntries >= 2);
  });

  test('green checks without delivery retry with the gate reasons as feedback, then hand to a human', () => {
    const root = project();
    const prompts = [];
    const r = runLoop({ root, agent: 'agent', check: 'checks', maxAttempts: 2, log: () => {}, runner: cmd => (cmd.startsWith('agent') && prompts.push(cmd), true) });
    assert.equal(r.worked[0].outcome, 'ready-for-human');
    assert.doesNotMatch(prompts[0], /previous attempt/);
    assert.match(prompts[1], /previous attempt was not delivered/);
    assert.match(prompts[1], /acceptance criteria not ticked: AC1/);
    assert.match(prompts[1], /no automated test names shop\/02#AC1/);
    assert.match(fs.readFileSync(path.join(root, 'tickets/shop/02-checkout.md'), 'utf8'), /Gave up after 2 attempts\. Still failing: acceptance criteria not ticked/);
  });

  test('bugs raised during a run are reported; an S1 stops the loop; a blocking bug hands back', () => {
    const root = project();
    write(root, 'tickets/shop/05-other.md', ticket({ n: '05', title: 'Other' }));
    const run = cmd => {
      if (cmd.startsWith('agent')) {
        write(root, 'tickets/shop/90-bug.md', ticket({ n: '90', title: 'Rounding bug', type: 'bug', status: 'needs-triage' }).replace('**Type:** bug', '**Type:** bug\n**Severity:** S1\n**Found during:** shop/02'));
        const f = path.join(root, 'tickets/shop/02-checkout.md');
        fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('- [ ] works', '- [x] AC1: works').replace('- Commits:', '- Commits: abc').replace('- Tests:', '- Tests: ok'));
        write(root, 'tests/c.test.js', "test('shop/02#AC1 works')");
      }
      return true;
    };
    const r = runLoop({ root, agent: 'agent', check: 'checks', maxTickets: 3, log: () => {}, runner: run });
    assert.deepEqual(r.newTickets.map(t => [t.id, t.type, t.severity, t.status, t.foundDuring]), [['shop/90', 'bug', 'S1', 'needs-triage', 'shop/02']]);
    assert.match(r.stoppedBecause, /S1 bug shop\/90/);
    assert.equal(r.worked.length, 1, 'stopped before shop/05');
    assert.ok(!frontier(loadTickets(root)).some(t => t.id === 'shop/90'), 'needs-triage bugs are never picked up automatically');

    const root2 = project();
    const handBack = cmd => {
      if (cmd.startsWith('agent')) {
        const f = path.join(root2, 'tickets/shop/02-checkout.md');
        fs.writeFileSync(f, fs.readFileSync(f, 'utf8').replace('**Status:** in-progress', '**Status:** ready-for-human').replace('**Blocked by:** 01', '**Blocked by:** 01, 91'));
        write(root2, 'tickets/shop/91-blocker.md', ticket({ n: '91', type: 'bug', status: 'needs-triage' }));
      }
      return true;
    };
    const r2 = runLoop({ root: root2, agent: 'agent', check: 'checks', log: () => {}, runner: handBack });
    assert.equal(r2.worked[0].outcome, 'ready-for-human');
    assert.deepEqual(r2.newTickets.map(t => t.id), ['shop/91']);
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
