import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { templateRoot, tempDir, write, ticket } from './helpers.mjs';
import { loadTickets } from '../lib/tickets.mjs';
import { parseJUnit, recordRun, loadHistory, findFlaky, buildTrace, renderTrace, loadManualResults } from '../lib/qa.mjs';
import { runGate } from '../lib/gates.mjs';
import { validateTemplate } from '../lib/validator.mjs';

const cli = path.join(templateRoot, 'bin', 'cli.mjs');

const JUNIT = `<?xml version="1.0"?>
<testsuites>
  <testsuite name="cart">
    <testcase classname="cart" name="cart/01#AC1 user can add an item" time="0.2"/>
    <testcase classname="cart" name="cart/01#AC2 total updates">
      <failure message="expected 10 &amp; got 9">stack</failure>
    </testcase>
    <testcase classname="cart" name="unrelated helper"><skipped/></testcase>
  </testsuite>
</testsuites>`;

function shop() {
  const root = tempDir();
  fs.mkdirSync(path.join(root, 'qa', 'runs'), { recursive: true });
  write(root, 'tickets/cart/01-add.md', ticket({ n: '01', status: 'done', evidence: '- Commits: abc', criteria: ['- [x] AC1: item appears in cart', '- [x] AC2: total updates', '- [x] AC3: empty cart message'] }));
  return root;
}

describe('acceptance criteria IDs', () => {
  test('explicit IDs are kept; unprefixed criteria are numbered by position', () => {
    const root = tempDir();
    write(root, 'tickets/f/01-a.md', ticket({ n: '01', criteria: ['- [ ] AC3: third', '- [x] AC7: seventh'] }));
    write(root, 'tickets/f/02-b.md', ticket({ n: '02', criteria: ['- [ ] one', '- [ ] two'] }));
    const [a, b] = loadTickets(root);
    assert.deepEqual(a.criteria.map(c => c.id), ['f/01#AC3', 'f/01#AC7']);
    assert.equal(a.criteriaDone, 1);
    assert.deepEqual(b.criteria.map(c => c.id), ['f/02#AC1', 'f/02#AC2']);
  });

  test('duplicate IDs fail validate; bugs without severity warn', () => {
    const root = tempDir();
    write(root, 'tickets/f/01-a.md', ticket({ n: '01', criteria: ['- [ ] AC1: a', '- [ ] AC1: b'] }));
    write(root, 'tickets/f/02-bug.md', ticket({ n: '02', type: 'bug' }));
    const v = validateTemplate(root);
    assert.ok(v.errors.some(e => e.includes('duplicate criterion ID AC1')));
    assert.ok(v.warnings.some(w => w.includes('bug without Severity')));
  });
});

describe('junit and history', () => {
  test('parses outcomes, messages and criterion references', () => {
    const cases = parseJUnit(JUNIT);
    assert.deepEqual(cases.map(c => c.outcome), ['passed', 'failed', 'skipped']);
    assert.equal(cases[1].message, 'expected 10 & got 9');
    assert.deepEqual(cases[0].criteria, ['cart/01#AC1']);
    assert.deepEqual(cases[2].criteria, []);
  });

  test('flaky = passed and failed within recent runs', () => {
    const root = tempDir();
    const mk = outcome => [{ id: 'a', outcome, criteria: [] }, { id: 'b', outcome: 'passed', criteria: [] }];
    recordRun(root, { cases: mk('passed') });
    recordRun(root, { cases: mk('failed') });
    recordRun(root, { cases: mk('passed') });
    const flaky = findFlaky(loadHistory(root));
    assert.deepEqual(flaky.map(f => f.id), ['a']);
    assert.equal(flaky[0].failed, 1);
  });
});

describe('traceability', () => {
  test('finds automated tests in code and manual cases with their latest results', () => {
    const root = shop();
    write(root, 'tests/cart.spec.ts', "test('cart/01#AC1 user can add an item', () => {})");
    write(root, 'qa/cases/cart/TC-01-total.md', '# TC-01: Total\n\n**Covers:** cart/01#AC2\n**Priority:** P1\n');
    write(root, 'qa/runs/2026-11-01-cart-r1.md', '| Case | Covers | Result | Evidence |\n|---|---|---|---|\n| TC-01 | cart/01#AC2 | fail | bug |\n');
    write(root, 'qa/runs/2026-11-02-cart-r2.md', '| Case | Covers | Result | Evidence |\n|---|---|---|---|\n| TC-01 | cart/01#AC2 | pass | ok |\n');
    assert.equal(loadManualResults(root).get('TC-01').result, 'pass', 'later run wins');

    const trace = buildTrace(root, { feature: 'cart' });
    assert.equal(trace.total, 3);
    assert.equal(trace.covered, 2);
    assert.deepEqual(trace.uncovered.map(r => r.criterion), ['cart/01#AC3']);
    const ac1 = trace.rows.find(r => r.criterion === 'cart/01#AC1');
    assert.deepEqual(ac1.automated, ['tests/cart.spec.ts']);
    assert.equal(trace.rows.find(r => r.criterion === 'cart/01#AC2').manualResult, 'pass');
    assert.match(renderTrace(trace), /\| cart\/01#AC3 \| empty cart message \| - \|/);
  });
});

describe('release gate with qa', () => {
  test('blocks on uncovered criteria, failing runs and open S1/S2 bugs; bug fixes need a regression test; passes when all clear', () => {
    const root = shop();
    write(root, 'tests/cart.spec.ts', "it('cart/01#AC1 add'); it('cart/01#AC2 total'); it('cart/01#AC3 empty'); it('cart/02#AC1 regression for the bug');");
    write(root, 'tickets/cart/02-bug.md', ticket({ n: '02', type: 'bug', status: 'needs-triage' }).replace('**Type:** bug', '**Type:** bug\n**Severity:** S2'));

    recordRun(root, { feature: 'cart', cases: parseJUnit(JUNIT) });
    let r = runGate(root, 'release', { feature: 'cart' });
    assert.ok(r.reasons.some(x => x.includes('open S2 bug')));
    assert.ok(r.reasons.some(x => x.includes('failing in the latest run: cart/01#AC2')));
    assert.ok(r.reasons.some(x => x.includes('latest automated run')));

    fs.writeFileSync(path.join(root, 'tickets/cart/02-bug.md'), fs.readFileSync(path.join(root, 'tickets/cart/02-bug.md'), 'utf8').replace('needs-triage', 'done').replace('- Commits:', '- Commits: fix123'));
    recordRun(root, { feature: 'cart', cases: parseJUnit(JUNIT.replace(/<failure[\s\S]*?<\/failure>/, '')) });
    r = runGate(root, 'release', { feature: 'cart' });
    assert.equal(r.ok, true, r.reasons.join('; '));
  });

  test('without a qa/ folder the gate does not require traceability', () => {
    const root = tempDir();
    write(root, 'tickets/x/01-a.md', ticket({ n: '01', status: 'done', evidence: '- Commits: abc' }));
    assert.equal(runGate(root, 'release', { feature: 'x' }).ok, true);
  });
});

describe('cli', () => {
  test('test-report --write records history, flaky list, run summary and ticket evidence', () => {
    const root = shop();
    write(root, 'tickets/cart/03-auto.md', ticket({ n: '03', type: 'automation', status: 'in-progress' }));
    write(root, 'results/junit.xml', JUNIT);
    let failed = false;
    try {
      execFileSync('node', [cli, 'test-report', '--junit', 'results', '--feature', 'cart', '--ticket', 'cart/03', '--label', 'ci', '--write'], { cwd: root, stdio: 'pipe' });
    } catch (e) {
      failed = e.status === 1;
    }
    assert.ok(failed, 'exit code 1 when tests failed');
    assert.equal(loadHistory(root).runs.length, 1);
    assert.ok(fs.existsSync(path.join(root, 'qa/flaky.md')));
    assert.ok(fs.readdirSync(path.join(root, 'qa/runs')).some(f => f.endsWith('-cart-ci.md')));
    const t = fs.readFileSync(path.join(root, 'tickets/cart/03-auto.md'), 'utf8');
    assert.match(t, /- Tests: 1 passed, 1 failed, 1 skipped \(3\)/);
    assert.match(t, /### \d{4}-\d{2}-\d{2} test-report/);
  });

  test('trace --strict fails when criteria are uncovered and --write writes the matrix', () => {
    const root = shop();
    assert.throws(() => execFileSync('node', [cli, 'trace', '--strict'], { cwd: root, stdio: 'pipe' }));
    execFileSync('node', [cli, 'trace', '--write'], { cwd: root, stdio: 'pipe' });
    assert.match(fs.readFileSync(path.join(root, 'qa/traceability.md'), 'utf8'), /Covered: 0\/3/);
  });
});
