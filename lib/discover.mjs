import fs from 'node:fs';
import path from 'node:path';
import { listRoles, listSkills, listWorkflows } from './config.mjs';
import { canonicalRoot } from './scope.mjs';

export const TOPICS = ['skills', 'roles', 'workflows', 'docs', 'structure', 'commands', 'all'];

const ALIASES = {
  skill: 'skills', skillset: 'skills', skillsets: 'skills',
  role: 'roles', agents: 'roles', agent: 'roles',
  workflow: 'workflows', flow: 'workflows', flows: 'workflows',
  doc: 'docs', context: 'docs',
  folders: 'structure', tree: 'structure',
  command: 'commands', cli: 'commands'
};

export function normaliseTopic(topic) {
  const t = String(topic || 'all').toLowerCase();
  return ALIASES[t] || t;
}

/** Folders and files the workflow uses, with what each is for. Only those that exist are shown. */
const STRUCTURE = [
  ['AGENTS.md', 'Goal, stack, verification commands, how we work (read first)'],
  ['GLOSSARY.md', 'Project terms'],
  ['.agents/skills/', 'Skills: one reusable step each'],
  ['.agents/roles/', 'Roles: who owns each ticket type'],
  ['.agents/workflows/', 'How the skills chain from idea to release'],
  ['.agents/tools/', 'Context, verification and adapter policies'],
  ['.ai/context-routing.md', 'What to read first, by task'],
  ['.ai/maps/', 'Where things are in the code'],
  ['.ai/cli/', 'The workflow CLI (status, gate, trace, ...)'],
  ['docs/architecture.md', 'One-page architecture'],
  ['docs/adr/', 'Decisions and why'],
  ['docs/inputs/', 'Team documents, read-only'],
  ['docs/design/', 'ERD, flows, API changes'],
  ['docs/api/', 'API reference (as it is now)'],
  ['docs/database/', 'Data model reference'],
  ['docs/testing/', 'Testing reference'],
  ['docs/deployment/', 'Deployment reference'],
  ['docs/agents/', 'Ticket tracker setup'],
  ['qa/', 'Test strategy, plans, cases, runs, traceability'],
  ['tickets/', 'All work, one file per ticket'],
  ['tickets/BOARD.md', 'Generated board (read before tickets)'],
  ['engr-toolbox.json', 'Installed size, tools, tracker, scope (project or global)'],
  ['template/', 'Scaffold shipped by init (template repository only)'],
  ['bin/', 'CLI source (template repository only)'],
  ['lib/', 'CLI library (template repository only)']
];

const COMMANDS = [
  ['discover <topic> [name]', 'This help: skills, roles, workflows, docs, structure, commands, all'],
  ['status [--write]', 'Ticket board; --write rewrites tickets/BOARD.md'],
  ['gate spec | implement --ticket f/NN | release --feature f', 'Phase gates'],
  ['trace [--feature f] [--write] [--strict]', 'Acceptance criteria → cases → tests → results'],
  ['test-report --junit <path> [--write]', 'Record automated results, flaky list, ticket evidence'],
  ['drift [--mark]', 'What changed since the last sync point'],
  ['validate [--task t]', 'Structure, tickets, ADRs, map paths, context'],
  ['check-commits --range a..b', 'Every commit references a ticket'],
  ['loop --agent "<cmd>" --verify "<cmd>"', 'Work ready tickets unattended, with brakes'],
  ['pipeline [--mode none|test|release] [--write]', 'Optional CI/CD: test on PRs, release on merge to main'],
  ['release-version · release-notes', 'Version and notes a release would use'],
  ['sync [--check] [--clean]', 'Regenerate tool adapters from .agents/'],
  ['init', 'Install or upgrade (via npx github:...)'],
  ['measure', 'Token budget per tier']
];

const firstLine = text => (text.split(/\r?\n/).find(l => l.trim() && !l.startsWith('#') && !l.startsWith('<!--')) || '').trim();
const short = (s, n = 96) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const matches = (q, ...fields) => !q || fields.some(f => String(f || '').toLowerCase().includes(q.toLowerCase()));
const rel = (root, p) => path.relative(root, p).split(path.sep).join('/');

function docStatus(file) {
  const m = fs.readFileSync(file, 'utf8').match(/^>?\s*\*{0,2}Status:\*{0,2}\s*([A-Za-z_ -]+)/m);
  return m ? m[1].trim() : '';
}

export function collect(root) {
  const canon = canonicalRoot(root);
  const skills = listSkills(canon).map(s => ({
    name: s.name,
    invoke: s.userInvoked ? `/${s.name}` : s.name,
    by: s.userInvoked ? 'you' : 'auto',
    description: s.description,
    path: canon === root ? rel(root, path.join(s.directory, 'SKILL.md')) : path.join(s.directory, 'SKILL.md')
  }));
  const roles = listRoles(canon).map(r => ({
    name: r.name,
    access: r.access,
    description: r.description,
    path: canon === root ? `.agents/roles/${r.fileName}` : path.join(canon, '.agents', 'roles', r.fileName)
  }));
  const workflows = listWorkflows(canon).map(w => ({
    name: w.name,
    description: firstLine(w.content),
    path: canon === root ? `.agents/workflows/${w.fileName}` : path.join(canon, '.agents', 'workflows', w.fileName),
    content: w.content
  }));
  const docs = [];
  const addDoc = p => {
    if (fs.existsSync(p) && fs.statSync(p).isFile() && p.endsWith('.md')) {
      const content = fs.readFileSync(p, 'utf8');
      const title = (content.match(/^#\s+(.+)$/m) || [])[1] || path.basename(p);
      docs.push({ path: rel(root, p), title: title.trim(), status: docStatus(p) });
    }
  };
  for (const f of ['AGENTS.md', 'GLOSSARY.md', '.ai/context-routing.md', 'tickets/BOARD.md']) addDoc(path.join(root, f));
  const walk = dir => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (!['_templates', 'cases', 'runs'].includes(e.name)) walk(p);
      } else if (e.name !== 'README.md' && !/^0000-/.test(e.name)) addDoc(p);
    }
  };
  walk(path.join(root, 'docs'));
  walk(path.join(root, 'qa'));
  walk(path.join(root, '.ai', 'maps'));
  const structure = STRUCTURE.filter(([p]) => fs.existsSync(path.join(root, p))).map(([p, what]) => ({ path: p, what }));
  if (canon !== root) structure.unshift({ path: '~/.engr-toolbox/.agents/', what: 'Shared skills, roles, workflows, policies (installed globally)' });
  return { skills, roles, workflows, docs, structure, commands: COMMANDS.map(([cmd, what]) => ({ cmd, what })) };
}

function table(rows, cols) {
  const widths = cols.map(c => Math.max(c.label.length, ...rows.map(r => String(r[c.key] ?? '').length)));
  const line = vals => vals.map((v, i) => (i === vals.length - 1 ? v : String(v).padEnd(widths[i]))).join('  ');
  return [line(cols.map(c => c.label)), line(widths.map((w, i) => (i === widths.length - 1 ? '-'.repeat(Math.min(w, 20)) : '-'.repeat(w)))), ...rows.map(r => line(cols.map(c => r[c.key] ?? '')))].join('\n');
}

function section(title, body, hint) {
  return [`\n${title}`, '', body, hint ? `\n${hint}` : ''].join('\n');
}

function renderSkills(items, q) {
  const rows = items.filter(s => matches(q, s.name, s.description)).map(s => ({ ...s, description: short(s.description) }));
  if (!rows.length) return section('Skills', '(none match)');
  const you = rows.filter(r => r.by === 'you');
  const auto = rows.filter(r => r.by === 'auto');
  const cols = [{ key: 'invoke', label: 'Skill' }, { key: 'description', label: 'What it does' }];
  const out = [];
  if (you.length || !q) out.push(section(`Skills you run (${you.length}) — type /name in Claude Code, or ask for it by name in Codex`, you.length ? table(you, cols) : '(none)'));
  if (auto.length || !q) out.push(section(`Skills the agent also picks up on its own (${auto.length})`, auto.length ? table(auto, cols) : '(none)'));
  out.push('\nDetails: discover skill <name>   ·   Not sure where to start: /next');
  return out.join('\n');
}

function renderRoles(items, q) {
  const rows = items.filter(r => matches(q, r.name, r.description)).map(r => ({ ...r, description: short(r.description, 90) }));
  return section(`Roles (${rows.length})`, rows.length ? table(rows, [{ key: 'name', label: 'Role' }, { key: 'access', label: 'Access' }, { key: 'description', label: 'Owns' }]) : '(none match)', 'Details: discover role <name>   ·   Use one: "use the sdet agent to ..."');
}

function renderWorkflows(items, q) {
  const rows = items.filter(w => matches(q, w.name, w.description)).map(w => ({ ...w, description: short(w.description, 90) }));
  return section(`Workflows (${rows.length})`, rows.length ? table(rows, [{ key: 'name', label: 'Workflow' }, { key: 'description', label: 'What it covers' }]) : '(none match)', 'Details: discover workflow <name>');
}

function renderDocs(items, q) {
  const rows = items.filter(d => matches(q, d.path, d.title, d.status));
  return section(`Docs and context (${rows.length})`, rows.length ? table(rows, [{ key: 'path', label: 'File' }, { key: 'status', label: 'Status' }, { key: 'title', label: 'Title' }]) : '(none match)', 'NOT_STARTED means a placeholder still waiting to be filled.');
}

function renderStructure(items, q) {
  const rows = items.filter(s => matches(q, s.path, s.what));
  return section('Structure', rows.length ? table(rows, [{ key: 'path', label: 'Path' }, { key: 'what', label: 'What it is for' }]) : '(none match)');
}

function renderCommands(items, q) {
  const rows = items.filter(c => matches(q, c.cmd, c.what));
  return section('Commands (engr <command>, or node .ai/cli/bin/cli.mjs <command>; in coding agents use /cli or just ask)', table(rows, [{ key: 'cmd', label: 'Command' }, { key: 'what', label: 'What it does' }]));
}

function renderMainFlow() {
  return section('Main flow', [
    'adopt-project / ingest → grill-with-docs → design → to-spec → test-plan → to-tickets',
    '→ implement (dev) · automate-tests (sdet) · manual cases and runs (qa) → report-bug',
    '→ test-report → release-check → pr → retro          Lost? /next'
  ].join('\n'));
}

export function renderDiscover(root, topic = 'all', { search = null } = {}) {
  const t = normaliseTopic(topic);
  if (!TOPICS.includes(t)) throw new Error(`Unknown topic '${topic}'. Use: ${TOPICS.join(', ')}`);
  const data = collect(root);
  const parts = [];
  if (t === 'all') {
    parts.push(renderMainFlow(), renderSkills(data.skills, search), renderRoles(data.roles, search), renderWorkflows(data.workflows, search), renderStructure(data.structure, search), renderCommands(data.commands, search));
    parts.push('\nMore: discover docs (every doc with its status) · discover <skill|role|workflow> <name>');
  } else if (t === 'skills') parts.push(renderSkills(data.skills, search));
  else if (t === 'roles') parts.push(renderRoles(data.roles, search));
  else if (t === 'workflows') parts.push(renderMainFlow(), renderWorkflows(data.workflows, search));
  else if (t === 'docs') parts.push(renderDocs(data.docs, search));
  else if (t === 'structure') parts.push(renderStructure(data.structure, search));
  else if (t === 'commands') parts.push(renderCommands(data.commands, search));
  return parts.join('\n').replace(/^\n/, '') + '\n';
}

/** One skill, role or workflow in detail. */
export function renderItem(root, kind, name) {
  const k = normaliseTopic(kind);
  const data = collect(root);
  const pick = (list, label) => {
    const item = list.find(x => x.name === name);
    if (item) return item;
    const close = list.filter(x => x.name.includes(name)).map(x => x.name);
    throw new Error(`No ${label} '${name}'.${close.length ? ` Did you mean: ${close.join(', ')}?` : ''} List them with: discover ${label}s`);
  };
  if (k === 'skills') {
    const s = pick(data.skills, 'skill');
    const body = fs.readFileSync(path.isAbsolute(s.path) ? s.path : path.join(root, s.path), 'utf8').replace(/^---[\s\S]*?---\s*/, '').replace(/<!--[\s\S]*?-->\s*/g, '');
    return [`${s.invoke}  (${s.by === 'you' ? 'you run it' : 'you or the agent'})`, s.description, `File: ${s.path}`, '', body.trim(), ''].join('\n');
  }
  if (k === 'roles') {
    const r = pick(data.roles, 'role');
    const body = fs.readFileSync(path.isAbsolute(r.path) ? r.path : path.join(root, r.path), 'utf8').replace(/<!--[\s\S]*?-->\s*/g, '');
    return [`${r.name}  (${r.access})`, `File: ${r.path}`, '', body.trim(), ''].join('\n');
  }
  if (k === 'workflows') {
    const w = pick(data.workflows, 'workflow');
    return [`${w.name}`, `File: ${w.path}`, '', w.content.replace(/<!--[\s\S]*?-->\s*/g, '').trim(), ''].join('\n');
  }
  throw new Error(`Details are available for skill, role and workflow. Use: discover ${k}`);
}

/** Map `--help-discover`, `--help-discover-skillset`, `--help-discover-workflow`, ... to a topic, or null. */
export function topicFromHelpFlag(flag) {
  const m = String(flag).match(/^help-discover(?:-(.+))?$/);
  return m ? normaliseTopic(m[1] || 'all') : null;
}
