import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { tempDir, write, ticket } from './helpers.mjs';
import { guardEdit, guardPrompt, guardCommitMsg, installClaudeHooks, installCommitHook } from '../lib/guard.mjs';

const edit = f => ({ tool_input: { file_path: f } });

describe('guard', () => {
  test('blocks source edits with no in-progress ticket, allows exempt paths', () => {
    const root = tempDir();
    write(root, 'tickets/a/01-x.md', ticket({ n: '01', status: 'ready-for-agent' }));
    assert.equal(guardEdit(root, edit(path.join(root, 'src/app.js'))).exit, 2);
    assert.equal(guardEdit(root, edit(path.join(root, 'tickets/a/01-x.md'))).exit, 0);
    assert.equal(guardEdit(root, edit(path.join(root, 'docs/x.md'))).exit, 0);
  });

  test('allows edits once a ticket is in progress', () => {
    const root = tempDir();
    write(root, 'tickets/a/01-x.md', ticket({ n: '01', status: 'in-progress' }));
    assert.equal(guardEdit(root, edit(path.join(root, 'src/app.js'))).exit, 0);
  });

  test('warn mode lets the edit through with a warning', () => {
    const root = tempDir();
    write(root, 'engr-toolbox.json', JSON.stringify({ guard: 'warn' }));
    const r = guardEdit(root, edit(path.join(root, 'src/a.js')));
    assert.equal(r.exit, 0);
    assert.match(r.stderr, /needs a ticket|No ticket/);
  });

  test('prompt hook nudges only when no ticket is active and not for slash commands', () => {
    const root = tempDir();
    assert.match(guardPrompt(root, { prompt: 'add export' }).stdout, /no ticket/);
    assert.equal(guardPrompt(root, { prompt: '/triage' }).stdout, undefined);
  });

  test('commit-msg requires a ticket or [no-ticket]', () => {
    const root = tempDir();
    write(root, 'tickets/a/01-x.md', ticket({ n: '01' }));
    const f = write(root, 'MSG', 'feat: thing\n');
    assert.equal(guardCommitMsg(root, f).exit, 1);
    fs.writeFileSync(f, 'feat: thing [a/01]\n');
    assert.equal(guardCommitMsg(root, f).exit, 0);
  });

  test('installs hooks idempotently and preserves existing settings', () => {
    const root = tempDir();
    write(root, '.claude/settings.json', JSON.stringify({ permissions: { allow: ['Bash(ls)'] } }));
    fs.mkdirSync(path.join(root, '.git'));
    assert.equal(installClaudeHooks(root).status, 'updated');
    assert.equal(installClaudeHooks(root).status, 'unchanged');
    const s = JSON.parse(fs.readFileSync(path.join(root, '.claude/settings.json'), 'utf8'));
    assert.deepEqual(s.permissions.allow, ['Bash(ls)']);
    assert.equal(installCommitHook(root).status, 'created');
    assert.equal(installCommitHook(root).status, 'unchanged');
  });
});
