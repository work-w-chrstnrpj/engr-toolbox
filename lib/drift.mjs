import fs from 'node:fs';
import path from 'node:path';
import { git } from './git.mjs';

export const SYNC_FILE = path.join('.ai', 'last-sync');
const MAP_ENTRY = /^\s*-\s+(.+?)\s+(?:→|->)\s+`([^`]+)`/;
const IGNORED_PREFIXES = ['docs/', 'tickets/', '.agents/', '.ai/', '.claude/', '.cursor/', '.codex/', '.opencode/', '.github/agents/', '.github/skills/', '.windsurf/', '.clinerules/', '.kilo/', '.openhands/'];
const IGNORED_FILES = ['AGENTS.md', 'CLAUDE.md', 'GEMINI.md', 'CONVENTIONS.md', 'GLOSSARY.md', 'CHANGELOG.md', 'README.md', 'engr-toolbox.json'];
const HINTS = [
  { re: /(migrat|schema|models?\/|entity|entities|\.sql$|prisma)/i, doc: 'docs/database/data-model.md' },
  { re: /(routes?|controllers?|handlers?|endpoints?|openapi|swagger|graphql|api\/)/i, doc: 'docs/api/api-specification.md' },
  { re: /(\.github\/workflows|dockerfile|docker-compose|helm|terraform|k8s|deploy|\.env\.example)/i, doc: 'docs/deployment/deployment.md' },
  { re: /(\.test\.|\.spec\.|__tests__|tests?\/|e2e|playwright|cypress|jest|vitest)/i, doc: 'docs/testing/test-specification.md' }
];

export function readMapEntries(root) {
  const dir = path.join(root, '.ai', 'maps');
  const entries = [];
  if (!fs.existsSync(dir)) return entries;
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.md')).sort()) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').split(/\r?\n/);
    lines.forEach((line, i) => {
      const m = line.match(MAP_ENTRY);
      if (m && !/[<>[\]]/.test(m[2])) {
        entries.push({ map: `.ai/maps/${f}`, line: i + 1, name: m[1].trim(), path: m[2].replace(/\/$/, '') });
      }
    });
  }
  return entries;
}

export function missingMapPaths(root) {
  return readMapEntries(root).filter(e => !fs.existsSync(path.join(root, e.path)));
}

export function readSyncPoint(root) {
  const p = path.join(root, SYNC_FILE);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8').trim() || null : null;
}

export function markSyncPoint(root) {
  const sha = git(root, ['rev-parse', 'HEAD']);
  fs.mkdirSync(path.join(root, '.ai'), { recursive: true });
  fs.writeFileSync(path.join(root, SYNC_FILE), sha + '\n', 'utf8');
  return sha;
}

function covers(entryPath, file) {
  return file === entryPath || file.startsWith(entryPath + '/');
}

function ignored(file) {
  return IGNORED_FILES.includes(file) || IGNORED_PREFIXES.some(p => file.startsWith(p));
}

export function parseNameStatus(output) {
  const changes = [];
  for (const line of output.split('\n').filter(Boolean)) {
    const parts = line.split('\t');
    const code = parts[0][0];
    if (code === 'R' || code === 'C') changes.push({ status: code, from: parts[1], path: parts[2] });
    else changes.push({ status: code, path: parts[1] });
  }
  return changes;
}

export function detectDrift(root, { since = null } = {}) {
  const base = since || readSyncPoint(root);
  if (!base) {
    throw new Error(`No sync point. Run 'drift --mark' once (writes ${SYNC_FILE}), or pass --since <ref>.`);
  }
  const head = git(root, ['rev-parse', 'HEAD']);
  const changes = parseNameStatus(git(root, ['diff', '--name-status', '-M', `${base}..HEAD`]));
  const commits = git(root, ['log', '--format=%h %an: %s', `${base}..HEAD`]).split('\n').filter(Boolean);
  const entries = readMapEntries(root);
  const affectedMaps = new Map();
  const unmapped = [];
  const docHints = new Map();

  for (const c of changes) {
    const touched = [c.path, c.from].filter(Boolean);
    const hits = entries.filter(e => touched.some(f => covers(e.path, f)));
    for (const h of hits) {
      const key = h.map;
      if (!affectedMaps.has(key)) affectedMaps.set(key, []);
      affectedMaps.get(key).push({ entry: h.name, mapPath: h.path, change: c });
    }
    if (hits.length === 0 && !ignored(c.path)) unmapped.push(c);
    if (!ignored(c.path)) {
      for (const hint of HINTS) {
        if (hint.re.test(c.path)) {
          if (!docHints.has(hint.doc)) docHints.set(hint.doc, []);
          docHints.get(hint.doc).push(c.path);
        }
      }
    }
  }

  return {
    base,
    head,
    commits,
    changes,
    affectedMaps: Object.fromEntries(affectedMaps),
    unmapped,
    docHints: Object.fromEntries(docHints),
    brokenMapPaths: missingMapPaths(root)
  };
}

export function formatDrift(report) {
  const out = [];
  out.push(`Drift ${report.base.slice(0, 7)}..${report.head.slice(0, 7)}: ${report.commits.length} commit(s), ${report.changes.length} file(s) changed`);
  if (report.changes.length === 0) {
    out.push('Nothing changed since the sync point.');
    return out.join('\n');
  }
  const maps = Object.entries(report.affectedMaps);
  out.push('', `Maps to check (${maps.length}):`);
  for (const [map, hits] of maps) {
    out.push(`  ${map}`);
    for (const h of hits) out.push(`    ${h.change.status} ${h.change.from ? h.change.from + ' → ' : ''}${h.change.path}  (entry: ${h.entry})`);
  }
  out.push('', `Changed files no map covers (${report.unmapped.length}):`);
  for (const c of report.unmapped.slice(0, 40)) out.push(`  ${c.status} ${c.path}`);
  if (report.unmapped.length > 40) out.push(`  ... and ${report.unmapped.length - 40} more`);
  const hints = Object.entries(report.docHints);
  if (hints.length) {
    out.push('', 'Reference docs that may need updating:');
    for (const [doc, files] of hints) out.push(`  ${doc}  (${files.length} file(s), e.g. ${files[0]})`);
  }
  if (report.brokenMapPaths.length) {
    out.push('', 'Map entries pointing at missing paths:');
    for (const e of report.brokenMapPaths) out.push(`  ${e.map}:${e.line}  ${e.name} → ${e.path}`);
  }
  out.push('', 'Next: run update-docs, then drift --mark.');
  return out.join('\n');
}
