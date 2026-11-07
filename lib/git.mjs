import { execFileSync } from 'node:child_process';

export function git(root, args, { allowFail = false } = {}) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (error) {
    if (allowFail) return null;
    const msg = (error.stderr || error.message || '').toString().trim();
    throw new Error(`git ${args.join(' ')} failed: ${msg}`);
  }
}

export function isGitRepo(root) {
  return git(root, ['rev-parse', '--is-inside-work-tree'], { allowFail: true }) === 'true';
}
