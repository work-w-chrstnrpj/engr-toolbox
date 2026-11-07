import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const templateRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function tempDir(prefix = 'engr-') {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

export function write(root, rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, 'utf8');
  return p;
}

export function ticket({ n, title = `Ticket ${n}`, type = 'dev', status = 'ready-for-agent', blockedBy = 'None', criteria = ['- [ ] works'], evidence = '- Commits:\n- Tests:' }) {
  return [
    `# ${n}: ${title}`,
    '',
    `**Type:** ${type}`,
    `**Status:** ${status}`,
    `**Blocked by:** ${blockedBy}`,
    '',
    '## What to build',
    '',
    'Something.',
    '',
    '## Acceptance criteria',
    '',
    ...criteria,
    '',
    '## Evidence',
    '',
    evidence,
    '',
    '## Progress log',
    ''
  ].join('\n');
}

export function gitInit(root) {
  const run = args => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
  run(['init', '-q']);
  run(['config', 'user.email', 'test@example.com']);
  run(['config', 'user.name', 'Test']);
  run(['config', 'commit.gpgsign', 'false']);
  return {
    commit(message) {
      run(['add', '-A']);
      run(['commit', '-q', '--allow-empty', '-m', message]);
      return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
    },
    run
  };
}
