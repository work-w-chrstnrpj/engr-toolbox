import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadTickets, frontier, findTicket, setTicketStatus, appendProgressLog, writeBoard } from './tickets.mjs';
import { loadInstall } from './config.mjs';
import { gateDeliver } from './gates.mjs';

const DEFAULT_TYPES = ['dev', 'bug', 'automation'];

function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

export function buildPrompt(ticket, root, feedback = []) {
  const rel = path.relative(root, ticket.file).split(path.sep).join('/');
  const lines = [
    `Use the implement skill on ticket ${ticket.id} (${rel}) and deliver it completely.`,
    `Every acceptance criterion needs a passing automated test whose name starts with its ID (${ticket.id}#AC1 ...); tick a criterion only when its test passes.`,
    `Keep the progress log, put ${ticket.id} in every commit message, fill the Evidence section,`,
    `and run "node .ai/cli/bin/cli.mjs gate deliver --ticket ${ticket.id}" until it passes before setting in-review.`,
    'Bugs found along the way: fix bugs in your own new code; fix small existing bugs in code you touch with their own regression test and note them in Evidence;',
    'file any other bug with the report-bug skill (Found during this ticket, status needs-triage) and carry on;',
    'if a bug blocks this ticket or is a security or data-loss risk, file it, add it to Blocked by, set this ticket to ready-for-human and stop.',
    'If you need a human decision, set the status to ready-for-human, explain why in the log, and stop.'
  ];
  if (feedback.length) {
    lines.push(`The previous attempt was not delivered. Fix these first: ${feedback.join('; ')}.`);
  }
  return lines.join(' ');
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
  const report = { worked: [], newTickets: [], stoppedBecause: null, dryRun };
  const knownAtStart = new Set(loadTickets(root).map(t => t.id));

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
    let feedback = [];
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      log(`\n▶ ${ticket.id} attempt ${attempt}/${maxAttempts}`);
      const agentOk = runner(`${agent} ${shellQuote(buildPrompt(ticket, root, feedback))}`, root, { ENGR_TICKET: ticket.id });
      const after = findTicket(loadTickets(root), ticket.id);
      if (after && ['ready-for-human', 'needs-info', 'wontfix'].includes(after.status)) {
        outcome = after.status;
        appendProgressLog(ticket.file, 'loop', [`Agent handed back with status ${after.status}.`]);
        break;
      }
      const checksOk = runner(checkCommand, root, {});
      const delivery = gateDeliver(root, ticket.id);
      if (agentOk && checksOk && delivery.ok) {
        outcome = 'in-review';
        setTicketStatus(ticket.file, 'in-review');
        appendProgressLog(ticket.file, 'loop', [`Attempt ${attempt}: delivered. Checks passed (\`${checkCommand}\`) and gate deliver passed. Waiting for review.`]);
        break;
      }
      feedback = [
        ...(agentOk ? [] : ['the agent command exited with an error']),
        ...(checksOk ? [] : [`the verify command \`${checkCommand}\` failed`]),
        ...delivery.reasons
      ];
      appendProgressLog(ticket.file, 'loop', [`Attempt ${attempt}: not delivered. ${feedback.join('; ')}.`]);
      if (attempt === maxAttempts) {
        setTicketStatus(ticket.file, 'ready-for-human');
        appendProgressLog(ticket.file, 'loop', [`Gave up after ${maxAttempts} attempts. Still failing: ${feedback.join('; ')}. Needs a human.`]);
      }
    }
    const appeared = loadTickets(root).filter(t => !knownAtStart.has(t.id) && !report.newTickets.some(n => n.id === t.id));
    for (const t of appeared) {
      report.newTickets.push({ id: t.id, title: t.title, type: t.type, severity: t.severity, status: t.status, foundDuring: t.foundDuring || ticket.id });
      log(`  + new ${t.type} ticket ${t.id}${t.severity ? ` (${t.severity})` : ''}: ${t.title} [${t.status}]`);
    }
    writeBoard(root);
    report.worked.push({ id: ticket.id, outcome });
    log(`■ ${ticket.id} → ${outcome}`);
    if (outcome !== 'in-review') {
      report.stoppedBecause = `${ticket.id} needs a human`;
      break;
    }
    const urgent = report.newTickets.find(t => t.type === 'bug' && t.severity === 'S1');
    if (urgent) {
      report.stoppedBecause = `S1 bug ${urgent.id} raised; a human must look before more tickets run`;
      break;
    }
  }
  if (!report.stoppedBecause) report.stoppedBecause = `max tickets (${maxTickets}) reached`;
  return report;
}
