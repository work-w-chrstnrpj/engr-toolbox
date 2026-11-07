import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadTickets, frontier, findTicket, setTicketStatus, appendProgressLog, writeBoard } from './tickets.mjs';
import { loadInstall } from './config.mjs';

const DEFAULT_TYPES = ['dev', 'bug', 'automation'];

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

export function buildPrompt(ticket, root) {
  const rel = path.relative(root, ticket.file).split(path.sep).join('/');
  return [
    `Use the implement skill on ticket ${ticket.id} (${rel}).`,
    'Follow the tickets skill: keep the progress log, reference the ticket ID in every commit,',
    'fill the Evidence section, and set the status to in-review when checks pass.',
    'If you need a human decision, set the status to ready-for-human, explain why in the log, and stop.'
  ].join(' ');
}

/** Find the deterministic check command: --check, then engr-toolbox.json "checks", then package.json "test". */
export function resolveCheckCommand(root, explicit) {
  if (explicit) return explicit;
  const install = loadInstall(root);
  if (install?.checks) return install.checks;
  const pkg = path.join(root, 'package.json');
  if (fs.existsSync(pkg)) {
    try {
      const scripts = JSON.parse(fs.readFileSync(pkg, 'utf8')).scripts || {};
      if (scripts.test && !/no test specified/.test(scripts.test)) return 'npm test';
    } catch { /* ignore invalid package.json */ }
  }
  return null;
}

function run(command, root, env) {
  const r = spawnSync(command, { cwd: root, shell: true, stdio: 'inherit', env: { ...process.env, ...env } });
  return r.status === 0;
}

/**
 * Work the ticket frontier one ticket at a time with brakes:
 * deterministic checks after every agent run, a retry cap, and hand-off to a human.
 * The loop never commits, pushes, or merges; the agent's implement skill commits locally.
 */
export function runLoop(options) {
  const {
    root,
    agent,
    check = null,
    feature = null,
    types = DEFAULT_TYPES,
    maxTickets = 1,
    maxAttempts = 3,
    dryRun = false,
    log = console.log,
    runner = run
  } = options;

  const checkCommand = resolveCheckCommand(root, check);
  const report = { worked: [], stoppedBecause: null, dryRun };

  if (!dryRun && !agent) throw new Error('--agent "<command>" is required (for example: --agent "claude -p")');
  if (!dryRun && !checkCommand) {
    throw new Error('No check command found. Pass --check "<command>" or set "checks" in engr-toolbox.json. The loop never runs without a brake.');
  }

  for (let n = 0; n < maxTickets; n++) {
    const ready = frontier(loadTickets(root), { feature, types });
    if (ready.length === 0) {
      report.stoppedBecause = 'frontier empty';
      break;
    }
    const ticket = ready[0];
    const prompt = buildPrompt(ticket, root);

    if (dryRun) {
      log(`[dry-run] next ticket: ${ticket.id}  ${ticket.title}`);
      log(`[dry-run] agent: ${agent || '<--agent required>'} ${shellQuote(prompt)}`);
      log(`[dry-run] check: ${checkCommand || '<--check required>'}`);
      log(`[dry-run] frontier: ${ready.map(t => t.id).join(', ')}`);
      report.worked.push({ id: ticket.id, outcome: 'dry-run' });
      report.stoppedBecause = 'dry-run';
      break;
    }

    setTicketStatus(ticket.file, 'in-progress');
    appendProgressLog(ticket.file, 'loop', [`Claimed by loop (max ${maxAttempts} attempts).`]);
    writeBoard(root);

    let outcome = 'ready-for-human';
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      log(`\n▶ ${ticket.id} attempt ${attempt}/${maxAttempts}`);
      const agentOk = runner(`${agent} ${shellQuote(prompt)}`, root, { ENGR_TICKET: ticket.id });
      const after = findTicket(loadTickets(root), ticket.id);
      if (after && ['ready-for-human', 'needs-info', 'wontfix'].includes(after.status)) {
        outcome = after.status;
        appendProgressLog(ticket.file, 'loop', [`Agent handed back with status ${after.status}.`]);
        break;
      }
      const checksOk = runner(checkCommand, root, {});
      if (agentOk && checksOk) {
        outcome = 'in-review';
        setTicketStatus(ticket.file, 'in-review');
        appendProgressLog(ticket.file, 'loop', [`Attempt ${attempt}: agent finished, checks passed (\`${checkCommand}\`). Waiting for review.`]);
        break;
      }
      appendProgressLog(ticket.file, 'loop', [`Attempt ${attempt}: ${agentOk ? 'agent finished' : 'agent failed'}, checks ${checksOk ? 'passed' : 'failed'}.`]);
      if (attempt === maxAttempts) {
        setTicketStatus(ticket.file, 'ready-for-human');
        appendProgressLog(ticket.file, 'loop', [`Gave up after ${maxAttempts} attempts. Needs a human.`]);
      }
    }
    writeBoard(root);
    report.worked.push({ id: ticket.id, outcome });
    log(`■ ${ticket.id} → ${outcome}`);
    if (outcome !== 'in-review') {
      report.stoppedBecause = `${ticket.id} needs a human`;
      break;
    }
  }
  if (!report.stoppedBecause) report.stoppedBecause = `max tickets (${maxTickets}) reached`;
  return report;
}
