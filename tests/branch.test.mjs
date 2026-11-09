import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { tempDir, write, gitInit, templateRoot } from './helpers.mjs';
import { workingBranch, setWorkingBranch, ticketBranchName, branchStatus, branchExists, validBranchName } from '../lib/branch.mjs';
import { installAssets } from '../lib/install.mjs';

const git = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();

describe('branch', () => {
  test('ticket branch names are stable and safe', () => {
    assert.equal(ticketBranchName('orders/03', 'Export CSV!'), 'ticket/orders-03-export-csv');
    assert.equal(ticketBranchName('#123', 'Fix: the thing'), 'ticket/123-fix-the-thing');
    assert.equal(ticketBranchName('a/01'), 'ticket/a-01');
  });

  test('branch names are validated', () => {
    assert.equal(validBranchName('my-personal-branch'), true);
    assert.equal(validBranchName('bad name'), false);
    assert.equal(validBranchName('-x'), false);
  });

  test('init saves the working branch, keeps it on re-run, and set/unset change it', () => {
    const root = tempDir();
    gitInit(root);
    installAssets({ templateRoot, targetDir: root, size: 'small', tools: ['claude'], workingBranch: 'my-personal-branch' });
    assert.equal(workingBranch(root), 'my-personal-branch');
    installAssets({ templateRoot, targetDir: root, size: 'small', tools: ['claude'] });
    assert.equal(workingBranch(root), 'my-personal-branch');
    const r = setWorkingBranch(root, 'dev-mine');
    assert.equal(r.exists, false);
    assert.equal(workingBranch(root), 'dev-mine');
    setWorkingBranch(root, null);
    assert.equal(workingBranch(root), null);
    assert.throws(() => setWorkingBranch(root, 'bad name'), /not a valid branch name/);
  });

  test('set --create makes the branch from the current one', () => {
    const root = tempDir();
    const g = gitInit(root);
    write(root, 'a.txt', 'a');
    g.commit('init');
    installAssets({ templateRoot, targetDir: root, size: 'small', tools: ['claude'] });
    const r = setWorkingBranch(root, 'mine', { create: true });
    assert.equal(r.created, true);
    assert.equal(branchExists(root, 'mine'), true);
  });

  test('status reports behind and ahead against the base', () => {
    const root = tempDir();
    const g = gitInit(root);
    git(root, 'checkout', '-q', '-b', 'main');
    write(root, 'a.txt', '1');
    g.commit('base');
    git(root, 'branch', 'mine');
    write(root, 'b.txt', '2');
    g.commit('feat: on main');
    write(root, 'c.txt', '3');
    g.commit('feat: more on main');
    git(root, 'checkout', '-q', 'mine');
    write(root, 'd.txt', '4');
    g.commit('mine only');
    const s = branchStatus(root, { base: 'main', branch: 'mine' });
    assert.equal(s.behind, 2);
    assert.equal(s.ahead, 1);
    assert.equal(s.diverged, true);
    assert.deepEqual(s.incoming.map(c => c.subject), ['feat: more on main', 'feat: on main']);
    assert.equal(branchStatus(root, { base: 'mine', branch: 'mine' }).behind, 0);
    git(root, 'branch', 'feature', 'main~2');
    const f = branchStatus(root, { base: 'main', branch: 'feature' });
    assert.equal(f.branch, 'feature');
    assert.equal(f.behind, 2);
    assert.equal(f.ahead, 0);
    assert.throws(() => branchStatus(root, { base: 'main', branch: 'nope' }), /does not exist/);
  });
});
