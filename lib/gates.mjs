import fs from 'node:fs';
import path from 'node:path';
import { loadTickets, indexTickets, openBlockers, findTicket } from './tickets.mjs';
import { hasQa, buildTrace, loadHistory, lastRunFor } from './qa.mjs';

const PLACEHOLDER_GOAL = /\[State the project goal here\.\]/;
const PLACEHOLDER_STACK = /\[Runtime or framework\]/;

function result(phase, reasons, passed) {
  return { phase, ok: reasons.length === 0, reasons, passed };
}

export function gateSpec(root) {
  const reasons = [];
  const passed = [];
  const agents = path.join(root, 'AGENTS.md');
  if (!fs.existsSync(agents)) {
    reasons.push('AGENTS.md is missing');
  } else {
    const c = fs.readFileSync(agents, 'utf8');
    if (PLACEHOLDER_GOAL.test(c)) reasons.push('AGENTS.md: project goal is still a placeholder');
    else passed.push('AGENTS.md goal set');
    if (PLACEHOLDER_STACK.test(c)) reasons.push('AGENTS.md: tech stack is still a placeholder');
    else passed.push('AGENTS.md tech stack set');
  }
  if (!fs.existsSync(path.join(root, 'GLOSSARY.md'))) reasons.push('GLOSSARY.md is missing (run grill-with-docs or adopt-project)');
  else passed.push('GLOSSARY.md exists');
  return result('spec', reasons, passed);
}

export function gateImplement(root, ticketId) {
  if (!ticketId) return result('implement', ['--ticket <feature/NN> is required'], []);
  const tickets = loadTickets(root);
  const t = findTicket(tickets, ticketId);
  if (!t) return result('implement', [`ticket '${ticketId}' not found under tickets/`], []);
  const reasons = [];
  const passed = [];
  if (!['ready-for-agent', 'in-progress'].includes(t.status)) {
    reasons.push(`status is '${t.status}', expected ready-for-agent or in-progress`);
  } else passed.push(`status ${t.status}`);
  if (t.criteriaTotal === 0) reasons.push('no acceptance criteria');
  else passed.push(`${t.criteriaTotal} acceptance criteria`);
  const open = openBlockers(t, indexTickets(tickets));
  if (open.length) reasons.push(`blocked by ${open.join(', ')}`);
  else passed.push('no open blockers');
  return result('implement', reasons, passed);
}

export function gateRelease(root, feature) {
  if (!feature) return result('release', ['--feature <name> is required'], []);
  const tickets = loadTickets(root).filter(t => t.feature === feature);
  if (tickets.length === 0) return result('release', [`no tickets found for feature '${feature}'`], []);
  const reasons = [];
  const passed = [];
  for (const t of tickets) {
    if (t.type === 'bug' && ['S1', 'S2'].includes(t.severity) && !['done', 'wontfix'].includes(t.status)) {
      reasons.push(`${t.id} is an open ${t.severity} bug`);
    } else if (!['done', 'wontfix'].includes(t.status)) reasons.push(`${t.id} is '${t.status}'`);
    else if (t.status === 'done' && !t.hasEvidence) reasons.push(`${t.id} is done but has no evidence`);
    else passed.push(`${t.id} ${t.status}`);
  }
  if (hasQa(root)) {
    const trace = buildTrace(root, { feature });
    if (trace.uncovered.length) reasons.push(`${trace.uncovered.length} acceptance criteria have no test or manual case: ${trace.uncovered.map(r => r.criterion).join(', ')}`);
    else if (trace.total) passed.push(`all ${trace.total} acceptance criteria traced`);
    const failing = trace.rows.filter(r => r.automatedResult === 'failed' || r.manualResult === 'fail');
    if (failing.length) reasons.push(`criteria failing in the latest run: ${failing.map(r => r.criterion).join(', ')}`);
    const last = lastRunFor(loadHistory(root), feature);
    if (last && last.summary.failed > 0) reasons.push(`latest automated run for '${feature}' has ${last.summary.failed} failure(s)`);
    else if (last) passed.push(`latest automated run green (${last.summary.passed} passed)`);
  }
  return result('release', reasons, passed);
}

export function runGate(root, phase, opts = {}) {
  switch (phase) {
    case 'spec': return gateSpec(root);
    case 'implement': return gateImplement(root, opts.ticket);
    case 'release': return gateRelease(root, opts.feature);
    default: throw new Error(`Unknown gate '${phase}'. Use spec, implement, or release.`);
  }
}
