import fs from 'node:fs';
import path from 'node:path';
import { TICKET_STATES } from './config.mjs';

export const TICKET_ID_PATTERN = /\b([a-z0-9][a-z0-9-]*)\/(\d{2,3})\b/g;
const TICKET_FILE = /^(\d{2,3})-[^/]+\.md$/;
const CLOSED = new Set(['done', 'wontfix']);

function headerField(content, label) {
  const m = content.match(new RegExp(`^\\*{0,2}${label}:\\*{0,2}\\s*(.*?)\\s*$`, 'mi'));
  return m ? m[1].trim() : null;
}

function section(content, heading) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex(l => new RegExp(`^##\\s+${heading}\\s*$`, 'i').test(l));
  if (start === -1) return null;
  const out = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) break;
    out.push(lines[i]);
  }
  return out;
}

export function parseBlockers(raw, feature) {
  if (!raw || /^none\b/i.test(raw)) return [];
  return raw
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      const full = s.match(/^([a-z0-9][a-z0-9-]*)\/(\d{2,3})/);
      if (full) return `${full[1]}/${full[2]}`;
      const num = s.match(/^#?(\d{1,3})\b/);
      return num ? `${feature}/${num[1].padStart(2, '0')}` : null;
    })
    .filter(Boolean);
}

export function parseTicket(filePath, feature) {
  const content = fs.readFileSync(filePath, 'utf8');
  const fileName = path.basename(filePath);
  const number = fileName.match(TICKET_FILE)[1];
  const titleMatch = content.match(/^#\s+(?:\d{2,3}:\s*)?(.+)$/m);
  const criteriaLines = (section(content, 'Acceptance criteria') || []).filter(l => /^\s*- \[[ xX]\]/.test(l));
  const criteria = criteriaLines.map((l, i) => {
    const explicit = l.match(/^\s*- \[[ xX]\]\s*(AC\d+)\s*[:.)-]\s*(.*)$/i);
    const text = explicit ? explicit[2] : l.replace(/^\s*- \[[ xX]\]\s*/, '');
    const ac = explicit ? explicit[1].toUpperCase() : `AC${i + 1}`;
    return { id: `${feature}/${number}#${ac}`, ac, text: text.trim(), done: /- \[[xX]\]/.test(l), explicit: !!explicit };
  });
  const evidenceLines = (section(content, 'Evidence') || []).filter(l => /^\s*-\s+/.test(l));
  const evidence = evidenceLines
    .map(l => {
      const m = l.match(/^\s*-\s+([^:]+):\s*(.*)$/);
      return m ? { label: m[1].trim(), value: m[2].trim() } : { label: '', value: l.replace(/^\s*-\s+/, '').trim() };
    });
  const log = section(content, 'Progress log') || [];
  return {
    id: `${feature}/${number}`,
    feature,
    number,
    file: filePath,
    title: titleMatch ? titleMatch[1].trim() : fileName,
    type: (headerField(content, 'Type') || 'dev').toLowerCase(),
    status: (headerField(content, 'Status') || 'needs-triage').toLowerCase(),
    owner: headerField(content, 'Owner') || '',
    blockedBy: parseBlockers(headerField(content, 'Blocked by'), feature),
    severity: (headerField(content, 'Severity') || '').toUpperCase().match(/S[1-4]/)?.[0] || null,
    criteria,
    criteriaTotal: criteria.length,
    criteriaDone: criteria.filter(c => c.done).length,
    evidence,
    hasEvidence: evidence.some(e => e.value && !/^<.*>$/.test(e.value)),
    logEntries: log.filter(l => /^###\s+/.test(l)).length
  };
}

export function ticketsDir(root) {
  return path.join(root, 'tickets');
}

export function loadTickets(root) {
  const dir = ticketsDir(root);
  const tickets = [];
  if (!fs.existsSync(dir)) return tickets;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const featureDir = path.join(dir, entry.name);
    for (const f of fs.readdirSync(featureDir).sort()) {
      if (TICKET_FILE.test(f)) tickets.push(parseTicket(path.join(featureDir, f), entry.name));
    }
  }
  return tickets.sort((a, b) => a.id.localeCompare(b.id));
}

export function indexTickets(tickets) {
  return new Map(tickets.map(t => [t.id, t]));
}

export function openBlockers(ticket, byId) {
  return ticket.blockedBy.filter(id => byId.get(id)?.status !== 'done');
}

export function isBlocked(ticket, byId) {
  return openBlockers(ticket, byId).length > 0;
}

export function frontier(tickets, { feature = null, types = null } = {}) {
  const byId = indexTickets(tickets);
  return tickets.filter(t =>
    t.status === 'ready-for-agent' &&
    !isBlocked(t, byId) &&
    (!feature || t.feature === feature) &&
    (!types || types.includes(t.type))
  );
}

export function groupForBoard(tickets) {
  const byId = indexTickets(tickets);
  const groups = { ready: [], inProgress: [], inReview: [], blocked: [], needsHuman: [], done: [] };
  for (const t of tickets) {
    if (CLOSED.has(t.status)) groups.done.push(t);
    else if (t.status === 'in-progress') groups.inProgress.push(t);
    else if (t.status === 'in-review') groups.inReview.push(t);
    else if (isBlocked(t, byId)) groups.blocked.push(t);
    else if (t.status === 'ready-for-agent') groups.ready.push(t);
    else groups.needsHuman.push(t);
  }
  return groups;
}

const GROUP_TITLES = [
  ['ready', 'Ready (frontier)'],
  ['inProgress', 'In progress'],
  ['inReview', 'In review'],
  ['blocked', 'Blocked'],
  ['needsHuman', 'Needs a human (triage, info, human work)'],
  ['done', 'Done']
];

export function renderBoard(tickets) {
  const byId = indexTickets(tickets);
  const groups = groupForBoard(tickets);
  const out = ['# Board', '', '_Generated by `status --write`. Do not edit. Read this before opening ticket files._', ''];
  if (tickets.length === 0) {
    out.push('No tickets yet. Start with `/grill-with-docs` (new project) or `/adopt-project` (existing repo).', '');
    return out.join('\n');
  }
  const counts = GROUP_TITLES.map(([k, title]) => `${title.split(' (')[0]}: ${groups[k].length}`).join(' · ');
  out.push(counts, '');
  for (const [key, title] of GROUP_TITLES) {
    if (groups[key].length === 0) continue;
    out.push(`## ${title}`, '', '| ID | Title | Type | Status | Criteria | Blocked by | Evidence |', '|---|---|---|---|---|---|---|');
    for (const t of groups[key]) {
      const open = openBlockers(t, byId);
      const rel = path.relative(path.dirname(path.dirname(t.file)), t.file).split(path.sep).join('/');
      out.push(`| [${t.id}](${rel}) | ${t.title} | ${t.type} | ${t.status} | ${t.criteriaDone}/${t.criteriaTotal} | ${open.join(', ') || '-'} | ${t.hasEvidence ? 'yes' : '-'} |`);
    }
    out.push('');
  }
  return out.join('\n');
}

export function formatStatus(tickets) {
  const byId = indexTickets(tickets);
  const groups = groupForBoard(tickets);
  if (tickets.length === 0) return 'No tickets yet.';
  const lines = [];
  for (const [key, title] of GROUP_TITLES) {
    if (groups[key].length === 0) continue;
    lines.push(`\n${title} (${groups[key].length})`);
    for (const t of groups[key]) {
      const open = openBlockers(t, byId);
      const extra = open.length ? `  ⛔ ${open.join(', ')}` : '';
      lines.push(`  ${t.id.padEnd(28)} ${t.status.padEnd(16)} ${t.title}${extra}`);
    }
  }
  return lines.join('\n');
}

export function writeBoard(root, tickets = loadTickets(root)) {
  const dir = ticketsDir(root);
  fs.mkdirSync(dir, { recursive: true });
  const boardPath = path.join(dir, 'BOARD.md');
  fs.writeFileSync(boardPath, renderBoard(tickets) + '\n', 'utf8');
  return boardPath;
}

export function setTicketStatus(filePath, status) {
  if (!TICKET_STATES.includes(status)) throw new Error(`Unknown ticket status '${status}'`);
  const content = fs.readFileSync(filePath, 'utf8');
  const re = /^(\*{0,2}Status:\*{0,2}\s*).*$/mi;
  const next = re.test(content)
    ? content.replace(re, `$1${status}`)
    : content.replace(/^(#.*\n)/, `$1\n**Status:** ${status}\n`);
  fs.writeFileSync(filePath, next, 'utf8');
}

export function appendProgressLog(filePath, who, lines, date = new Date()) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!/^##\s+Progress log\s*$/mi.test(content)) {
    content = content.replace(/\s*$/, '\n\n## Progress log\n');
  }
  const stamp = date.toISOString().slice(0, 10);
  const entry = [`### ${stamp} ${who}`, ...lines.map(l => `- ${l}`)].join('\n');
  content = content.replace(/\s*$/, `\n\n${entry}\n`);
  fs.writeFileSync(filePath, content, 'utf8');
}

/** Set or extend an Evidence line (`- Tests: ...`). Creates the section and line if missing. */
export function setEvidence(filePath, label, value) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (!/^##\s+Evidence\s*$/mi.test(content)) {
    content = content.replace(/(\n##\s+Progress log)/i, `\n## Evidence\n\n- ${label}: ${value}\n$1`);
    if (!content.includes(`- ${label}: ${value}`)) content = content.replace(/\s*$/, `\n\n## Evidence\n\n- ${label}: ${value}\n`);
  } else {
    const re = new RegExp(`^(\\s*-\\s+${label}:)[ \\t]*(.*)$`, 'mi');
    if (re.test(content)) {
      content = content.replace(re, (_, head, existing) => `${head} ${existing.trim() ? existing.trim() + '; ' : ''}${value}`);
    } else {
      content = content.replace(/^(##\s+Evidence\s*\n\n?)/mi, `$1- ${label}: ${value}\n`);
    }
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

export function findTicket(tickets, id) {
  return tickets.find(t => t.id === id) || null;
}

/** Structural ticket checks used by `validate`. */
export function validateTickets(tickets) {
  const errors = [];
  const warnings = [];
  const byId = indexTickets(tickets);
  for (const t of tickets) {
    const rel = `tickets/${t.feature}/${path.basename(t.file)}`;
    if (!TICKET_STATES.includes(t.status)) {
      errors.push(`${rel}: unknown status '${t.status}' (expected one of ${TICKET_STATES.join(', ')})`);
    }
    for (const b of t.blockedBy) {
      if (!byId.has(b)) errors.push(`${rel}: blocked by unknown ticket '${b}'`);
    }
    if (t.status === 'done' && !t.hasEvidence) {
      errors.push(`${rel}: status is done but Evidence is empty`);
    }
    if (t.criteriaTotal === 0 && !CLOSED.has(t.status)) {
      warnings.push(`${rel}: no acceptance criteria`);
    }
    const acs = t.criteria.filter(c => c.explicit).map(c => c.ac);
    const dup = acs.find((a, i) => acs.indexOf(a) !== i);
    if (dup) errors.push(`${rel}: duplicate criterion ID ${dup}`);
    if (t.type === 'bug' && !t.severity && !CLOSED.has(t.status)) {
      warnings.push(`${rel}: bug without Severity (S1 to S4)`);
    }
  }
  return { errors, warnings };
}
