import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';

export const INPUTS_DIR = path.join('docs', 'inputs');
const MANIFEST = path.join(INPUTS_DIR, '.manifest.json');
const INDEX = path.join(INPUTS_DIR, 'INDEX.md');
const MAX_BYTES = 50 * 1024 * 1024;
const RESERVED = new Set(['INDEX.md', 'README.md', '.manifest.json']);

const KINDS = [
  ['text', /\.(md|markdown|txt|rst|adoc|csv|tsv|json|ya?ml|xml|html?|sql|graphql|proto)$/i],
  ['document', /\.(pdf|docx?|odt|rtf|pptx?|odp|xlsx?|ods|pages|key|numbers)$/i],
  ['diagram', /\.(png|jpe?g|gif|webp|svg|drawio|vsdx?|puml|mmd|excalidraw)$/i]
];

export function kindOf(file) {
  return (KINDS.find(([, re]) => re.test(file)) || ['other'])[0];
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

const posix = p => p.split(path.sep).join('/');

/** Where a file came from, without leaking the home folder: project-relative, ~-relative, or the path as given. */
export function displaySource(root, abs) {
  const rel = path.relative(root, abs);
  if (!rel.startsWith('..') && !path.isAbsolute(rel)) return posix(rel);
  const home = os.homedir();
  return abs.startsWith(home + path.sep) ? '~/' + posix(path.relative(home, abs)) : posix(abs);
}
const today = (d = new Date()) => d.toISOString().slice(0, 10);

export function loadManifest(root) {
  const p = path.join(root, MANIFEST);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { files: {} };
}

function saveManifest(root, manifest) {
  const p = path.join(root, MANIFEST);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
}

/** Expand files and folders (recursively, skipping hidden files and dependency folders) into source → destination pairs. */
export function expandSources(sources, { to = null } = {}) {
  const out = [];
  for (const src of sources) {
    const abs = path.resolve(src);
    if (!fs.existsSync(abs)) throw new Error(`Not found: ${src}`);
    if (fs.statSync(abs).isDirectory()) {
      const base = to ?? path.basename(abs);
      const walk = dir => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
          if (e.name.startsWith('.') || e.name === 'node_modules') continue;
          const p = path.join(dir, e.name);
          if (e.isDirectory()) walk(p);
          else if (e.isFile()) out.push({ source: p, dest: posix(path.join(base, path.relative(abs, p))) });
        }
      };
      walk(abs);
    } else {
      out.push({ source: abs, dest: posix(path.join(to ?? '', path.basename(abs))) });
    }
  }
  return out;
}

/**
 * Compare files against what was ingested before.
 * status: new | changed | unchanged | too-large
 */
export function scanInputs(root, sources, opts = {}) {
  const manifest = loadManifest(root);
  return expandSources(sources, opts).map(({ source, dest }) => {
    const size = fs.statSync(source).size;
    const entry = { source, dest, size, kind: kindOf(source) };
    if (RESERVED.has(dest)) return { ...entry, status: 'reserved' };
    if (size > MAX_BYTES) return { ...entry, status: 'too-large' };
    const hash = sha256(source);
    const known = manifest.files[dest];
    const existing = path.join(root, INPUTS_DIR, dest);
    let status = 'new';
    if (known) status = known.sha256 === hash ? 'unchanged' : 'changed';
    else if (fs.existsSync(existing)) status = sha256(existing) === hash ? 'unchanged' : 'changed';
    return { ...entry, sha256: hash, status };
  });
}

function archiveName(dest, date) {
  const ext = path.extname(dest);
  const stem = dest.slice(0, dest.length - ext.length);
  return `${stem}.${date}${ext}`;
}

function titleFromFile(dest) {
  return path.basename(dest, path.extname(dest)).replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function updateIndex(root, rows) {
  const p = path.join(root, INDEX);
  let text = fs.existsSync(p)
    ? fs.readFileSync(p, 'utf8')
    : '# Inputs Index\n\n| File or link | Title | Owner | Version / date | Source | Ingested | Notes |\n|---|---|---|---|---|---|---|\n';
  const lines = text.replace(/\s*$/, '').split('\n');
  for (const r of rows) {
    const cell = `\`${r.dest}\``;
    const i = lines.findIndex(l => l.startsWith('|') && l.split('|')[1]?.trim().replace(/`/g, '') === r.dest);
    if (i === -1) {
      lines.push(`| ${cell} | ${r.title} | ${r.owner || ''} | ${r.version} | ${r.source} | ${r.date} | ${r.notes || ''} |`);
    } else {
      const cells = lines[i].split('|').slice(1, -1).map(c => c.trim());
      while (cells.length < 7) cells.push('');
      cells[3] = r.version;
      cells[4] = r.source;
      cells[5] = r.date;
      if (r.owner) cells[2] = r.owner;
      cells[6] = r.notes || cells[6];
      lines[i] = `| ${cells.join(' | ')} |`;
    }
  }
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, lines.join('\n') + '\n', 'utf8');
}

/**
 * Copy new and changed files into docs/inputs/, keep the previous version of changed ones
 * (renamed with the date), and record every file in INDEX.md and the manifest.
 * Inputs are read-only afterwards: nothing in docs/inputs/ is ever edited, only versioned.
 */
export function addInputs(root, sources, { to = null, owner = '', version = null, dryRun = false, date = today() } = {}) {
  const scan = scanInputs(root, sources, { to });
  const manifest = loadManifest(root);
  const rows = [];
  for (const f of scan) {
    if (!['new', 'changed'].includes(f.status)) continue;
    const dest = path.join(root, INPUTS_DIR, f.dest);
    let archived = null;
    if (f.status === 'changed' && fs.existsSync(dest)) {
      archived = archiveName(f.dest, date);
      let n = 2;
      while (fs.existsSync(path.join(root, INPUTS_DIR, archived))) archived = archiveName(f.dest, `${date}-${n++}`);
      if (!dryRun) fs.renameSync(dest, path.join(root, INPUTS_DIR, archived));
    }
    f.archived = archived;
    if (dryRun) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f.source, dest);
    const prev = manifest.files[f.dest];
    manifest.files[f.dest] = {
      sha256: f.sha256,
      size: f.size,
      kind: f.kind,
      source: displaySource(root, f.source),
      ingested: date,
      versions: [...(prev?.versions || []), ...(archived ? [archived] : [])]
    };
    rows.push({
      dest: f.dest,
      title: titleFromFile(f.dest),
      owner,
      version: version || date,
      source: displaySource(root, f.source),
      date,
      notes: archived ? `previous version: \`${archived}\`` : ''
    });
  }
  if (!dryRun && rows.length) {
    saveManifest(root, manifest);
    updateIndex(root, rows);
  }
  return scan;
}

export function formatInputs(scan, { dryRun = false, write = false } = {}) {
  const groups = ['new', 'changed', 'unchanged', 'too-large', 'reserved'];
  const label = { new: 'New', changed: 'Changed (previous version kept)', unchanged: 'Unchanged (skipped)', 'too-large': 'Too large (over 50 MB, skipped)', reserved: 'Reserved name (skipped)' };
  const out = [`${scan.length} file(s) found`];
  for (const g of groups) {
    const items = scan.filter(f => f.status === g);
    if (!items.length) continue;
    out.push('', `${label[g]} (${items.length}):`);
    for (const f of items) out.push(`  ${f.dest.padEnd(48)} ${f.kind.padEnd(8)} ${f.archived ? `→ old kept as ${f.archived}` : ''}`.trimEnd());
  }
  const todo = scan.filter(f => ['new', 'changed'].includes(f.status));
  if (write && todo.length) out.push('', `Copied into docs/inputs/ and recorded in INDEX.md. Next: /ingest to extract terms, decisions and open questions from the ${todo.length} file(s).`);
  else if (todo.length) out.push('', dryRun ? '(dry run: nothing copied)' : 'Add them with: inputs add <same paths>');
  else out.push('', 'Nothing new to ingest.');
  return out.join('\n');
}

export function listInputs(root) {
  const m = loadManifest(root);
  const entries = Object.entries(m.files).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return 'No inputs ingested yet. Add a file or a whole folder: inputs add <path>';
  return [`${entries.length} input(s) in docs/inputs/:`, ...entries.map(([dest, e]) => `  ${dest.padEnd(48)} ${e.kind.padEnd(8)} ${e.ingested}${e.versions.length ? `  (${e.versions.length} older version(s))` : ''}`)].join('\n');
}
