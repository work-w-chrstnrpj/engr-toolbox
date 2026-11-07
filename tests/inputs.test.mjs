import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { templateRoot, tempDir, write } from './helpers.mjs';
import { scanInputs, addInputs, loadManifest, kindOf, displaySource } from '../lib/inputs.mjs';

const cli = path.join(templateRoot, 'bin', 'cli.mjs');

function team() {
  const dir = tempDir('team-');
  write(dir, 'tdd.md', '# TDD v1');
  write(dir, 'specs/api.yaml', 'openapi: 3.0.0');
  write(dir, 'erd.png', 'png-bytes');
  write(dir, '.DS_Store', 'junk');
  write(dir, 'node_modules/x.js', 'junk');
  return dir;
}

describe('inputs', () => {
  test('a whole folder is scanned recursively, hidden files and dependencies skipped', () => {
    const root = tempDir();
    const scan = scanInputs(root, [team()], { to: 'payments' });
    assert.deepEqual(scan.map(f => [f.dest, f.status, f.kind]), [
      ['payments/erd.png', 'new', 'diagram'],
      ['payments/specs/api.yaml', 'new', 'text'],
      ['payments/tdd.md', 'new', 'text']
    ]);
    assert.ok(!fs.existsSync(path.join(root, 'docs/inputs')), 'scan writes nothing');
  });

  test('add copies new files, then only changed ones, keeping the previous version and updating INDEX.md', () => {
    const root = tempDir();
    const dir = team();
    addInputs(root, [dir], { to: 'payments', owner: 'Payments team', date: '2026-11-01' });
    assert.ok(fs.existsSync(path.join(root, 'docs/inputs/payments/specs/api.yaml')));
    let index = fs.readFileSync(path.join(root, 'docs/inputs/INDEX.md'), 'utf8');
    assert.match(index, /\| `payments\/tdd\.md` \| tdd \| Payments team \| 2026-11-01 \|/);

    fs.writeFileSync(path.join(dir, 'tdd.md'), '# TDD v2');
    const second = addInputs(root, [dir], { to: 'payments', version: 'v2', date: '2026-11-07' });
    assert.deepEqual(second.map(f => f.status).sort(), ['changed', 'unchanged', 'unchanged']);
    assert.equal(fs.readFileSync(path.join(root, 'docs/inputs/payments/tdd.md'), 'utf8'), '# TDD v2');
    assert.equal(fs.readFileSync(path.join(root, 'docs/inputs/payments/tdd.2026-11-07.md'), 'utf8'), '# TDD v1');
    index = fs.readFileSync(path.join(root, 'docs/inputs/INDEX.md'), 'utf8');
    assert.match(index, /\| `payments\/tdd\.md` \| tdd \| Payments team \| v2 \|.*previous version: `payments\/tdd\.2026-11-07\.md`/);
    assert.equal(index.match(/payments\/tdd\.md` \|/g).length, 1, 'row updated, not duplicated');
    assert.deepEqual(loadManifest(root).files['payments/tdd.md'].versions, ['payments/tdd.2026-11-07.md']);
  });

  test('several single files, dry run, kinds, and sources without the home folder', () => {
    const root = tempDir();
    const a = write(tempDir(), 'prd.pdf', '%PDF');
    const b = write(tempDir(), 'notes.txt', 'hello');
    const scan = addInputs(root, [a, b], { dryRun: true });
    assert.deepEqual(scan.map(f => f.dest), ['prd.pdf', 'notes.txt']);
    assert.ok(!fs.existsSync(path.join(root, 'docs/inputs')));
    assert.equal(kindOf('x.docx'), 'document');
    assert.equal(kindOf('x.bin'), 'other');
    assert.equal(displaySource(root, path.join(os.homedir(), 'Downloads', 'x.pdf')), '~/Downloads/x.pdf');
    assert.equal(displaySource(root, path.join(root, 'in', 'x.pdf')), 'in/x.pdf');
  });

  test('cli: inputs add a folder, then list', () => {
    const root = tempDir();
    const out = execFileSync('node', [cli, 'inputs', 'add', team(), '--to', 'payments'], { cwd: root, encoding: 'utf8', env: { ...process.env, ENGR_NO_DELEGATE: '1' } });
    assert.match(out, /New \(3\)/);
    assert.match(out, /Next: \/ingest/);
    assert.match(execFileSync('node', [cli, 'inputs'], { cwd: root, encoding: 'utf8', env: { ...process.env, ENGR_NO_DELEGATE: '1' } }), /3 input\(s\)/);
    assert.throws(() => execFileSync('node', [cli, 'inputs', 'add'], { cwd: root, stdio: 'pipe', env: { ...process.env, ENGR_NO_DELEGATE: '1' } }));
  });
});
