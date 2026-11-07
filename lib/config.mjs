import fs from 'node:fs';
import path from 'node:path';

export const INSTALL_FILE = 'engr-toolbox.json';
export const TICKET_STATES = [
  'needs-triage',
  'needs-info',
  'ready-for-agent',
  'ready-for-human',
  'in-progress',
  'in-review',
  'done',
  'wontfix'
];
export const TICKET_TYPES = ['design', 'dev', 'automation', 'review', 'qa', 'doc-drift', 'bug', 'research', 'prototype', 'grilling', 'task'];

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

/** Template config (preset.config.json) shipped with the package. */
export function loadConfig(rootDir) {
  const configPath = path.join(rootDir, 'preset.config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error(`preset.config.json not found in ${rootDir}`);
  }
  return readJson(configPath);
}

/** Per-project install record (engr-toolbox.json), or null. */
export const LEGACY_INSTALL_FILES = ['ai-structure.json'];

export function loadInstall(rootDir) {
  for (const name of [INSTALL_FILE, ...LEGACY_INSTALL_FILES]) {
    const p = path.join(rootDir, name);
    if (fs.existsSync(p)) return readJson(p);
  }
  return null;
}

/** Context rules come from the project's install record, falling back to the template config. */
export function loadContextRules(rootDir) {
  const install = loadInstall(rootDir);
  if (install?.contextRules) return install.contextRules;
  const configPath = path.join(rootDir, 'preset.config.json');
  if (fs.existsSync(configPath)) return readJson(configPath).contextRules || null;
  return null;
}

/** Resolve a tier with its `extends` chain into flat, de-duplicated lists. */
export function resolveTier(config, tierName = config.defaultTier || 'medium') {
  const tiers = config.tiers || {};
  if (!tiers[tierName]) {
    throw new Error(`Unknown size '${tierName}'. Available: ${Object.keys(tiers).join(', ')}`);
  }
  const chain = [];
  let current = tierName;
  const seen = new Set();
  while (current) {
    if (seen.has(current)) throw new Error(`Tier cycle at '${current}'`);
    seen.add(current);
    chain.unshift(tiers[current]);
    current = tiers[current].extends;
  }
  const keys = ['roles', 'skills', 'workflows', 'tools', 'playbooks', 'scaffold'];
  const resolved = { name: tierName, description: tiers[tierName].description };
  for (const key of keys) {
    resolved[key] = [...new Set(chain.flatMap(t => t[key] || []))];
  }
  return resolved;
}

function field(content, label) {
  const m = content.match(new RegExp(`^- \\*\\*${label}:\\*\\*\\s*(.+?)\\s*$`, 'm'));
  return m ? m[1].trim() : null;
}

export function parseRoleMetadata(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const name = field(content, 'Name');
  const description = field(content, 'Description');
  if (!name || !description) {
    throw new Error(`Missing metadata in role file: ${filePath}`);
  }
  return {
    name,
    title: field(content, 'Role') || name,
    description,
    access: field(content, 'Access') || 'read-write',
    fileName: path.basename(filePath),
    content: content.trim()
  };
}

export function parseFrontmatter(content) {
  const fm = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return null;
  const data = {};
  for (const line of fm[1].split(/\r?\n/)) {
    const m = line.match(/^\s*([^:#]+):\s*(.*?)\s*$/);
    if (m) data[m[1].trim()] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return data;
}

export function parseSkillMetadata(skillDir) {
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillFile)) throw new Error(`SKILL.md missing in ${skillDir}`);
  const content = fs.readFileSync(skillFile, 'utf8');
  const meta = parseFrontmatter(content);
  if (!meta) throw new Error(`Frontmatter missing in ${skillFile}`);
  if (!meta.description) throw new Error(`Description missing in ${skillFile}`);
  return {
    name: meta.name || path.basename(skillDir),
    description: meta.description,
    userInvoked: meta['disable-model-invocation'] === 'true',
    directory: skillDir,
    content: content.trim()
  };
}

export function listRoles(sourceRoot) {
  const dir = path.join(sourceRoot, '.agents', 'roles');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map(f => parseRoleMetadata(path.join(dir, f)));
}

export function listSkills(sourceRoot) {
  const dir = path.join(sourceRoot, '.agents', 'skills');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory() && fs.existsSync(path.join(dir, d.name, 'SKILL.md')))
    .map(d => parseSkillMetadata(path.join(dir, d.name)))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function listWorkflows(sourceRoot) {
  const dir = path.join(sourceRoot, '.agents', 'workflows');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && f !== 'README.md')
    .sort()
    .map(f => ({ name: path.basename(f, '.md'), fileName: f, content: fs.readFileSync(path.join(dir, f), 'utf8') }));
}
