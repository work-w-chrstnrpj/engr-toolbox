import fs from 'node:fs';
import path from 'node:path';
import { loadTickets } from './tickets.mjs';
import { loadInstall } from './config.mjs';
import { checkMessage } from './commits.mjs';

export const GUARD_MODES = ['block', 'warn', 'off'];
export const GUARD_MARKER = 'engr-toolbox guard';
const CLI = 'node .ai/cli/bin/cli.mjs';

// Paths that may change without a ticket: the ticket system itself, docs, and tool config.
const EXEMPT = [
  /^tickets\//, /^docs\//, /^qa\//, /^\.ai\//, /^\.agents\//, /^\.claude\//, /^\.git\//,
  /^[^/]+\.md$/i, /^engr-toolbox\.json$/, /^preset\.config\.json$/
];

export function guardMode(root) {
  if (process.env.ENGR_GUARD && GUARD_MODES.includes(process.env.ENGR_GUARD)) return process.env.ENGR_GUARD;
  const m = loadInstall(root)?.guard;
  return GUARD_MODES.includes(m) ? m : 'block';
}

export function activeTickets(root) {
  return loadTickets(root).filter(t => t.status === 'in-progress');
}

export function isExempt(root, filePath) {
  if (!filePath) return true;
  const rel = path.relative(root, path.resolve(root, filePath)).split(path.sep).join('/');
  if (rel.startsWith('..')) return true; // outside the project
  return EXEMPT.some(re => re.test(rel));
}

const NO_TICKET = [
  'No ticket is in progress, so this change is not tracked.',
  `Tell the user: "This needs a ticket first so the change is recorded." Draft one from their request (title, numbered criteria), get a go-ahead,`,
  `write tickets/<feature>/NN-slug.md as "**Status:** in-progress" (see the tickets skill, "Request with no ticket"), then retry. /grill-with-docs → /to-spec → /to-tickets is optional.`,
  `Trivial housekeeping: set ENGR_GUARD=warn, or "guard": "warn" in engr-toolbox.json.`
].join('\n');

/** PreToolUse: decide whether an edit may proceed. exit 2 blocks and feeds stderr to the agent. */
export function guardEdit(root, input) {
  const mode = guardMode(root);
  if (mode === 'off') return { exit: 0 };
  const file = input?.tool_input?.file_path || input?.tool_input?.notebook_path;
  if (isExempt(root, file)) return { exit: 0 };
  if (activeTickets(root).length) return { exit: 0 };
  if (mode === 'warn') return { exit: 0, stderr: `warning: ${NO_TICKET}` };
  return { exit: 2, stderr: `Blocked editing ${path.relative(root, path.resolve(root, file))}.\n${NO_TICKET}` };
}

/** UserPromptSubmit: remind the agent to ticket the work before touching code. stdout is added as context. */
export function guardPrompt(root, input) {
  if (guardMode(root) === 'off') return { exit: 0 };
  const prompt = String(input?.prompt || '').trim();
  if (!prompt || prompt.startsWith('/')) return { exit: 0 };
  const active = activeTickets(root);
  if (active.length) return { exit: 0, stdout: `Active ticket: ${active.map(t => t.id).join(', ')}. Keep changes within it. If the user changes the requirements, update the ticket's criteria and log a "Requirement change" entry before changing code.` };
  return {
    exit: 0,
    stdout: [
      'engr-toolbox: no ticket is in progress.',
      'If this request changes files, say a ticket is needed first, draft it from the request, get a go-ahead, write it as in-progress, then implement (tickets skill, "Request with no ticket").',
      'Pure questions and read-only work need no ticket.'
    ].join(' ')
  };
}

/** commit-msg git hook: the message must reference a ticket or carry [no-ticket]. */
export function guardCommitMsg(root, file) {
  if (guardMode(root) === 'off') return { exit: 0 };
  const message = fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => !l.startsWith('#')).join('\n');
  if (/^(Merge|Revert) /.test(message)) return { exit: 0 };
  const known = new Set(loadTickets(root).map(t => t.id));
  const r = checkMessage(message, known);
  if (r.ok) return { exit: 0 };
  const text = `Commit has no ticket: ${r.reason}.\nAdd feature/NN or #123, or [no-ticket] for trivial housekeeping.`;
  return guardMode(root) === 'warn' ? { exit: 0, stderr: `warning: ${text}` } : { exit: 1, stderr: text };
}

/** Hook entries for .claude/settings.json. */
export function claudeHooks() {
  return {
    UserPromptSubmit: [{ hooks: [{ type: 'command', command: `${CLI} guard prompt` }] }],
    PreToolUse: [{ matcher: 'Edit|Write|MultiEdit|NotebookEdit', hooks: [{ type: 'command', command: `${CLI} guard edit` }] }]
  };
}

/** Merge our hooks into settings.json without touching anything else. */
export function installClaudeHooks(root, { dryRun = false } = {}) {
  const target = path.join(root, '.claude', 'settings.json');
  let settings = {};
  if (fs.existsSync(target)) {
    try { settings = JSON.parse(fs.readFileSync(target, 'utf8')); } catch { return { status: 'skipped_user_file', path: target }; }
  }
  settings.hooks = settings.hooks || {};
  let changed = false;
  for (const [event, entries] of Object.entries(claudeHooks())) {
    const list = settings.hooks[event] = settings.hooks[event] || [];
    for (const entry of entries) {
      const cmd = entry.hooks[0].command;
      if (!list.some(e => e.hooks?.some(h => h.command === cmd))) { list.push(entry); changed = true; }
    }
  }
  if (!changed) return { status: 'unchanged', path: target };
  const existed = fs.existsSync(target);
  if (!dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  }
  return { status: existed ? 'updated' : 'created', path: target };
}

/** Install a commit-msg hook unless the user already has one. */
export function installCommitHook(root, { dryRun = false } = {}) {
  const hooksDir = path.join(root, '.git', 'hooks');
  const target = path.join(hooksDir, 'commit-msg');
  if (!fs.existsSync(path.join(root, '.git'))) return { status: 'skipped_no_git', path: target };
  if (fs.existsSync(target) && !fs.readFileSync(target, 'utf8').includes(GUARD_MARKER)) return { status: 'skipped_user_file', path: target };
  const body = `#!/bin/sh\n# ${GUARD_MARKER}: commits must reference a ticket\n${CLI} guard commit-msg "$1"\n`;
  if (fs.existsSync(target) && fs.readFileSync(target, 'utf8') === body) return { status: 'unchanged', path: target };
  if (!dryRun) {
    fs.mkdirSync(hooksDir, { recursive: true });
    fs.writeFileSync(target, body, { mode: 0o755 });
  }
  return { status: 'created', path: target };
}
