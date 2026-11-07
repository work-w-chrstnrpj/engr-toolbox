import fs from 'node:fs';
import path from 'node:path';
import { GENERATOR_HEADER, GENERATOR_SIGNATURE, GENERATOR_NOTE, writeFileSafe, copyDirectorySafe, safeMergeJson, isManagedFile } from './safety.mjs';
import { listRoles, listSkills, listWorkflows } from './config.mjs';
import { globalDirs, globalRoot, GLOBAL_DISPLAY } from './scope.mjs';

export const PROVIDERS = ['claude', 'cursor', 'codex', 'opencode', 'antigravity', 'copilot', 'windsurf', 'cline', 'kilo', 'aider', 'openhands'];

const CLI = 'node .ai/cli/bin/cli.mjs';
let canon = '.agents';

function yamlString(val) {
  return `'${String(val).replace(/'/g, "''")}'`;
}

function tomlString(val) {
  return JSON.stringify(String(val));
}

const readOnly = role => role.access === 'read-only';

function frontmatter(lines) {
  return ['---', ...lines, '---', '', GENERATOR_HEADER, ''];
}

/** Copy skills into a tool's skills folder, removing stale managed copies when clean is set. */
function syncSkills(skills, destRoot, { dryRun, force, clean }) {
  const results = [];
  const names = new Set(skills.map(s => s.name));
  if (clean && fs.existsSync(destRoot)) {
    for (const entry of fs.readdirSync(destRoot, { withFileTypes: true })) {
      if (!entry.isDirectory() || names.has(entry.name)) continue;
      const stale = path.join(destRoot, entry.name);
      const skillFile = path.join(stale, 'SKILL.md');
      if (fs.existsSync(skillFile) && !isManagedFile(skillFile) && !force) {
        results.push({ status: 'skipped_user_file', path: stale });
        continue;
      }
      if (!dryRun) fs.rmSync(stale, { recursive: true, force: true });
      results.push({ status: 'removed_stale', path: stale });
    }
  }
  for (const skill of skills) {
    // agents/openai.yaml is Codex metadata; Codex reads .agents/skills directly, so other tools skip it.
    results.push(...copyDirectorySafe(skill.directory, path.join(destRoot, skill.name), { dryRun, force, managed: true, exclude: rel => rel.startsWith('agents/') }));
  }
  return results;
}

/** Remove generated role/rule files whose canonical role no longer exists. */
function cleanStaleFiles(dir, keepNames, suffix, { dryRun, clean }) {
  const results = [];
  if (!clean || !fs.existsSync(dir)) return results;
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(suffix) || f === 'README.md') continue;
    const name = f.slice(0, -suffix.length);
    if (keepNames.has(name)) continue;
    const p = path.join(dir, f);
    if (!isManagedFile(p)) continue;
    if (!dryRun) fs.rmSync(p);
    results.push({ status: 'removed_stale', path: p });
  }
  return results;
}

function pointerDoc(title, extraLines = []) {
  return [
    `# ${title}`,
    '',
    GENERATOR_HEADER,
    '',
    'Read `AGENTS.md` first: goal, stack, verification commands, how we work.',
    '',
    '- All work happens on a ticket (`tickets/`, board in `tickets/BOARD.md`); every ticket ends with evidence.',
    `- Skills: \`${canon}/skills/\` (start with \`next\` if unsure; \`discover\` lists everything). Roles: \`${canon}/roles/\` (architect, builder, reviewer, qa, sdet).`,
    '- Context: `GLOSSARY.md`, `docs/adr/`, `.ai/context-routing.md`, `.ai/maps/`. Code is the truth.',
    `- Workflow CLI: \`${CLI} <status|gate|drift|validate|loop|sync>\`.`,
    ...extraLines,
    ''
  ].join('\n');
}

const adapters = {
  claude({ targetDir, roles, skills, opts }) {
    const results = [];
    const agentsDir = path.join(targetDir, '.claude', 'agents');
    for (const role of roles) {
      const tools = readOnly(role) ? ['Read', 'Glob', 'Grep', 'Bash'] : ['Read', 'Glob', 'Grep', 'Edit', 'MultiEdit', 'Write', 'Bash'];
      const content = [
        ...frontmatter([`name: ${role.name}`, `description: ${yamlString(role.description)}`, 'tools:', ...tools.map(t => `  - ${t}`)]),
        role.content
      ].join('\n');
      results.push(writeFileSafe(path.join(agentsDir, `${role.name}.md`), content, opts));
    }
    results.push(...cleanStaleFiles(agentsDir, new Set(roles.map(r => r.name)), '.md', opts));
    results.push(writeFileSafe(path.join(targetDir, 'CLAUDE.md'), pointerDoc('Claude Code Project Instructions', [
      canon === '.agents' ? '- Subagents: `.claude/agents/`. Skills: `.claude/skills/` (generated from `.agents/skills/`).' : '- Subagents and skills are installed globally in `~/.claude/agents/` and `~/.claude/skills/`.'
    ]), opts));
    results.push(...syncSkills(skills, path.join(targetDir, '.claude', 'skills'), opts));
    return results;
  },

  cursor({ targetDir, roles, skills, opts }) {
    const results = [];
    const rulesDir = path.join(targetDir, '.cursor', 'rules');
    for (const role of roles) {
      const content = [...frontmatter([`description: ${yamlString(role.description)}`, 'alwaysApply: false']), role.content].join('\n');
      results.push(writeFileSafe(path.join(rulesDir, `${role.name}.mdc`), content, opts));
    }
    const project = [...frontmatter(['description: Project rules and workflow', 'alwaysApply: true']), pointerDoc('Project').split('\n').slice(4).join('\n')].join('\n');
    results.push(writeFileSafe(path.join(rulesDir, 'project.mdc'), project, opts));
    results.push(...cleanStaleFiles(rulesDir, new Set([...roles.map(r => r.name), 'project']), '.mdc', opts));
    results.push(...syncSkills(skills, path.join(targetDir, '.cursor', 'skills'), opts));
    return results;
  },

  codex({ targetDir, roles, opts }) {
    const results = [];
    const dir = path.join(targetDir, '.codex', 'agents');
    for (const role of roles) {
      const content = [
        `# ${GENERATOR_SIGNATURE}. ${GENERATOR_NOTE}`,
        `name = ${tomlString(role.name)}`,
        `description = ${tomlString(role.description)}`,
        `sandbox_mode = ${tomlString(readOnly(role) ? 'read-only' : 'workspace-write')}`,
        '',
        "developer_instructions = '''",
        role.content,
        "'''",
        ''
      ].join('\n');
      results.push(writeFileSafe(path.join(dir, `${role.name}.toml`), content, opts));
    }
    results.push(...cleanStaleFiles(dir, new Set(roles.map(r => r.name)), '.toml', opts));
    return results;
  },

  opencode({ targetDir, roles, skills, opts }) {
    const results = [];
    const dir = path.join(targetDir, '.opencode', 'agents');
    for (const role of roles) {
      const content = [
        ...frontmatter([
          `name: ${role.name}`,
          `description: ${yamlString(role.description)}`,
          'mode: subagent',
          'permission:',
          `  edit: ${readOnly(role) ? 'deny' : 'allow'}`,
          '  bash: ask'
        ]),
        role.content
      ].join('\n');
      results.push(writeFileSafe(path.join(dir, `${role.name}.md`), content, opts));
    }
    results.push(...cleanStaleFiles(dir, new Set(roles.map(r => r.name)), '.md', opts));
    results.push(safeMergeJson(path.join(targetDir, 'opencode.json'), {
      $schema: 'https://opencode.ai/config.json',
      instructions: canon === '.agents' ? ['AGENTS.md', '.agents/README.md', '.ai/context-routing.md'] : ['AGENTS.md', '.ai/context-routing.md']
    }, opts));
    results.push(...syncSkills(skills, path.join(targetDir, '.opencode', 'skills'), opts));
    return results;
  },

  antigravity({ targetDir, opts }) {
    return [writeFileSafe(path.join(targetDir, 'GEMINI.md'), pointerDoc('Gemini and Antigravity Project Instructions', [
      `- Antigravity reads \`AGENTS.md\` and \`${canon}/skills/\` directly.`
    ]), opts)];
  },

  copilot({ targetDir, roles, skills, opts }) {
    const results = [];
    const dir = path.join(targetDir, '.github', 'agents');
    for (const role of roles) {
      const tools = readOnly(role) ? ['read', 'search', 'terminal'] : ['read', 'edit', 'search', 'terminal'];
      const content = [
        ...frontmatter([`name: ${yamlString(role.title)}`, `description: ${yamlString(role.description)}`, 'tools:', ...tools.map(t => `  - ${t}`)]),
        role.content
      ].join('\n');
      results.push(writeFileSafe(path.join(dir, `${role.name}.agent.md`), content, opts));
    }
    results.push(...cleanStaleFiles(dir, new Set(roles.map(r => r.name)), '.agent.md', opts));
    results.push(writeFileSafe(path.join(targetDir, '.github', 'copilot-instructions.md'), pointerDoc('GitHub Copilot Instructions', [
      '- Agents: `.github/agents/`. Skills: `.github/skills/`.'
    ]), opts));
    results.push(...syncSkills(skills, path.join(targetDir, '.github', 'skills'), opts));
    return results;
  },

  windsurf({ targetDir, roles, skills, workflows, opts }) {
    const results = [];
    const rulesDir = path.join(targetDir, '.windsurf', 'rules');
    for (const role of roles) {
      const content = [
        `# ${role.title}`,
        '',
        GENERATOR_HEADER,
        '',
        role.description,
        '',
        `Full role: \`${canon}/roles/${role.fileName}\`.`,
        ''
      ].join('\n');
      results.push(writeFileSafe(path.join(rulesDir, `${role.name}.md`), content, opts));
    }
    results.push(writeFileSafe(path.join(rulesDir, 'project.md'), pointerDoc('Project Rules'), opts));
    results.push(...cleanStaleFiles(rulesDir, new Set([...roles.map(r => r.name), 'project']), '.md', opts));
    const wfDir = path.join(targetDir, '.windsurf', 'workflows');
    for (const wf of workflows) {
      results.push(writeFileSafe(path.join(wfDir, wf.fileName), `${GENERATOR_HEADER}\n\n${wf.content.trim()}\n`, opts));
    }
    results.push(...cleanStaleFiles(wfDir, new Set(workflows.map(w => w.name)), '.md', opts));
    results.push(...syncSkills(skills, path.join(targetDir, '.windsurf', 'skills'), opts));
    return results;
  },

  cline({ targetDir, opts }) {
    return [writeFileSafe(path.join(targetDir, '.clinerules', 'project.md'), pointerDoc('Cline Rules'), opts)];
  },

  kilo({ targetDir, opts }) {
    const results = [writeFileSafe(path.join(targetDir, '.kilo', 'rules', 'project.md'), pointerDoc('Kilo Code Rules'), opts)];
    const jsonc = [`// ${GENERATOR_SIGNATURE}. ${GENERATOR_NOTE}`, '{', '  "rules": [".kilo/rules/project.md"]', '}', ''].join('\n');
    results.push(writeFileSafe(path.join(targetDir, 'kilo.jsonc'), jsonc, opts));
    return results;
  },

  aider({ targetDir, opts }) {
    const results = [writeFileSafe(path.join(targetDir, 'CONVENTIONS.md'), pointerDoc('Project Conventions'), opts)];
    const yml = [
      `# ${GENERATOR_SIGNATURE}. ${GENERATOR_NOTE}`,
      'map-tokens: 4096',
      'map-refresh: auto',
      'read:',
      '  - AGENTS.md',
      '  - CONVENTIONS.md',
      '  - GLOSSARY.md',
      '  - .ai/context-routing.md',
      'auto-commits: false',
      'dirty-commits: false',
      'show-diffs: true',
      'analytics: false',
      ''
    ].join('\n');
    results.push(writeFileSafe(path.join(targetDir, '.aider.conf.yml'), yml, opts));
    return results;
  },

  openhands({ targetDir, opts }) {
    return [writeFileSafe(path.join(targetDir, '.openhands', 'microagents', 'repo.md'), pointerDoc('OpenHands Repository Instructions'), opts)];
  }
};

/** Global role files per tool: same content as the project adapters, written to the user's tool folder. */
const globalRoleWriters = {
  claude: (role, dir, opts) => {
    const tools = readOnly(role) ? ['Read', 'Glob', 'Grep', 'Bash'] : ['Read', 'Glob', 'Grep', 'Edit', 'MultiEdit', 'Write', 'Bash'];
    return writeFileSafe(path.join(dir, `${role.name}.md`), [...frontmatter([`name: ${role.name}`, `description: ${yamlString(role.description)}`, 'tools:', ...tools.map(t => `  - ${t}`)]), role.content].join('\n'), opts);
  },
  codex: (role, dir, opts) => writeFileSafe(path.join(dir, `${role.name}.toml`), [
    `# ${GENERATOR_SIGNATURE}. ${GENERATOR_NOTE}`,
    `name = ${tomlString(role.name)}`,
    `description = ${tomlString(role.description)}`,
    `sandbox_mode = ${tomlString(readOnly(role) ? 'read-only' : 'workspace-write')}`,
    '',
    "developer_instructions = '''",
    role.content,
    "'''",
    ''
  ].join('\n'), opts),
  opencode: (role, dir, opts) => writeFileSafe(path.join(dir, `${role.name}.md`), [...frontmatter([`name: ${role.name}`, `description: ${yamlString(role.description)}`, 'mode: subagent', 'permission:', `  edit: ${readOnly(role) ? 'deny' : 'allow'}`, '  bash: ask']), role.content].join('\n'), opts),
  copilot: (role, dir, opts) => {
    const tools = readOnly(role) ? ['read', 'search', 'terminal'] : ['read', 'edit', 'search', 'terminal'];
    return writeFileSafe(path.join(dir, `${role.name}.agent.md`), [...frontmatter([`name: ${yamlString(role.title)}`, `description: ${yamlString(role.description)}`, 'tools:', ...tools.map(t => `  - ${t}`)]), role.content].join('\n'), opts);
  }
};
const ROLE_SUFFIX = { claude: '.md', codex: '.toml', opencode: '.md', copilot: '.agent.md' };

/**
 * Generate one tool's adapter files from the canonical .agents/ in sourceRoot.
 * scope 'project': everything goes into targetDir (the project's own .agents/ is canonical).
 * scope 'global': skills and roles go to the tool's user folder; the project gets only pointer files.
 * Tools without a known user folder fall back to project files (status 'project_fallback' is reported).
 */
export function generateAdapters({ sourceRoot, targetDir = sourceRoot, provider, scope = 'project', home, dryRun = false, force = false, clean = false }) {
  const key = String(provider).toLowerCase();
  if (!adapters[key]) {
    throw new Error(`Unsupported tool '${provider}'. Supported: ${PROVIDERS.join(', ')}`);
  }
  if (!fs.existsSync(path.join(sourceRoot, '.agents'))) {
    throw new Error(`No .agents/ folder in ${sourceRoot}. Run init first.`);
  }
  const roles = listRoles(sourceRoot);
  const skills = listSkills(sourceRoot);
  const workflows = listWorkflows(sourceRoot);
  const opts = { dryRun, force, clean };
  canon = scope === 'global' ? GLOBAL_DISPLAY : '.agents';
  try {
    if (scope !== 'global') {
      return { provider: key, targetDir, scope, results: adapters[key]({ targetDir, roles, skills, workflows, opts }) };
    }
    const dirs = globalDirs(key, home);
    if (!dirs) {
      const results = adapters[key]({ targetDir, roles, skills, workflows, opts });
      results.unshift({ status: 'project_fallback', path: targetDir, note: `${key} has no known user-level folder; installed into the project` });
      return { provider: key, targetDir, scope: 'project', results };
    }
    const results = [];
    if (dirs.agents && globalRoleWriters[key]) {
      for (const role of roles) results.push(globalRoleWriters[key](role, dirs.agents, opts));
      results.push(...cleanStaleFiles(dirs.agents, new Set(roles.map(r => r.name)), ROLE_SUFFIX[key], opts));
    }
    results.push(...syncSkills(skills, dirs.skills, opts));
    // Project keeps pointer files only; clean removes project role/skill copies left from a project-scope install.
    results.push(...adapters[key]({ targetDir, roles: [], skills: [], workflows: [], opts }));
    return { provider: key, targetDir, scope, results };
  } finally {
    canon = '.agents';
  }
}

/** Remove only files this tool wrote (managed header) from the global canonical folder and the tools' user folders. */
export function uninstallGlobal({ tools = PROVIDERS, home, dryRun = false } = {}) {
  const results = [];
  const root = globalRoot(home);
  const names = { skills: new Set(), roles: new Set() };
  if (fs.existsSync(path.join(root, '.agents'))) {
    for (const s of listSkills(root)) names.skills.add(s.name);
    for (const r of listRoles(root)) names.roles.add(r.name);
  }
  const removeIfManaged = file => {
    if (fs.existsSync(file) && isManagedFile(file)) {
      if (!dryRun) fs.rmSync(file);
      results.push({ status: 'removed', path: file });
    } else if (fs.existsSync(file)) {
      results.push({ status: 'skipped_user_file', path: file });
    }
  };
  const removeTree = dir => {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) removeTree(p);
      else removeIfManaged(p);
    }
    if (!dryRun && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  };
  for (const tool of tools) {
    const dirs = globalDirs(tool, home);
    if (!dirs) continue;
    for (const skill of names.skills) removeTree(path.join(dirs.skills, skill));
    if (dirs.agents) for (const role of names.roles) removeIfManaged(path.join(dirs.agents, `${role}${ROLE_SUFFIX[tool]}`));
  }
  removeTree(root);
  return results;
}

export const CHANGED_STATUSES = new Set(['created', 'updated', 'removed_stale', 'removed']);
