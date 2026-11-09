import fs from 'node:fs';
import path from 'node:path';
import { git } from './git.mjs';
import { INSTALL_FILE, loadInstall } from './config.mjs';

/** The personal working branch saved at install time, or null (tickets then work on the current branch). */
export function workingBranch(root) {
  return loadInstall(root)?.workingBranch || null;
}

export function currentBranch(root) {
  return git(root, ['rev-parse', '--abbrev-ref', 'HEAD'], { allowFail: true });
}

export function branchExists(root, name) {
  return git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${name}`], { allowFail: true }) !== null;
}

export function validBranchName(name) {
  if (!name || /^-/.test(name)) return false;
  try {
    git(process.cwd(), ['check-ref-format', '--branch', name]);
    return true;
  } catch {
    return false;
  }
}

/** Save (or clear, with null) the working branch in engr-toolbox.json. Optionally create it from the current branch. */
export function setWorkingBranch(root, name, { create = false } = {}) {
  const file = path.join(root, INSTALL_FILE);
  if (!fs.existsSync(file)) throw new Error(`No ${INSTALL_FILE} here. Install first with: init`);
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (name === null) {
    delete record.workingBranch;
  } else {
    if (!validBranchName(name)) throw new Error(`'${name}' is not a valid branch name`);
    record.workingBranch = name;
  }
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n', 'utf8');
  let created = false;
  if (name && create && !branchExists(root, name)) {
    git(root, ['branch', name]);
    created = true;
  }
  return { name, created, exists: name ? branchExists(root, name) : false };
}

/** Branch name for one ticket: ticket/<feature>-<NN>-<slug>, or ticket/<number>-<slug> for #123. */
export function ticketBranchName(id, title = '') {
  const idPart = String(id).replace(/^#/, '').replace(/\//g, '-').toLowerCase();
  const slug = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return `ticket/${idPart}${slug ? `-${slug}` : ''}`;
}

/** The branch to compare against by default: origin's default branch, else main/master. */
export function defaultBase(root) {
  const head = git(root, ['symbolic-ref', '--short', 'refs/remotes/origin/HEAD'], { allowFail: true });
  if (head) return head;
  for (const c of ['origin/main', 'main', 'origin/master', 'master']) {
    if (git(root, ['rev-parse', '--verify', '--quiet', c], { allowFail: true }) !== null) return c;
  }
  return null;
}

/** How far `branch` (default: the working branch, else the current one) is behind or ahead of `base`. */
export function branchStatus(root, { base = null, branch = null } = {}) {
  const target = branch || workingBranch(root) || currentBranch(root);
  const against = base || defaultBase(root);
  if (!against) throw new Error('No base branch found. Pass --base <branch>.');
  if (git(root, ['rev-parse', '--verify', '--quiet', against], { allowFail: true }) === null) throw new Error(`Base '${against}' does not exist. Run: git fetch`);
  if (git(root, ['rev-parse', '--verify', '--quiet', target], { allowFail: true }) === null) throw new Error(`Branch '${target}' does not exist.`);
  const [behind, ahead] = git(root, ['rev-list', '--left-right', '--count', `${against}...${target}`]).split(/\s+/).map(Number);
  const incoming = behind
    ? git(root, ['log', '--format=%h%x1f%s', '-n', '50', `${target}..${against}`]).split('\n').filter(Boolean).map(l => {
        const [sha, subject] = l.split('\x1f');
        return { sha, subject };
      })
    : [];
  return { branch: target, base: against, ahead, behind, diverged: ahead > 0 && behind > 0, incoming };
}

export function formatBranchStatus(s) {
  const lines = [`${s.branch} vs ${s.base}: ${s.behind} behind, ${s.ahead} ahead${s.diverged ? ' (diverged)' : ''}`];
  if (!s.behind) lines.push('Up to date: nothing to catch up.');
  else {
    lines.push(`Incoming from ${s.base}:`);
    for (const c of s.incoming) lines.push(`  ${c.sha} ${c.subject}`);
    if (s.behind > s.incoming.length) lines.push(`  ... and ${s.behind - s.incoming.length} more`);
    lines.push('Catch up with /catch-up, or: git merge ' + s.base);
  }
  return lines.join('\n');
}
