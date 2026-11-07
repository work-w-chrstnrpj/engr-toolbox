import fs from 'node:fs';
import path from 'node:path';
import { writeFileSafe, writeManagedFileSafe, copyDirectorySafe } from './safety.mjs';
import { loadConfig, resolveTier, INSTALL_FILE } from './config.mjs';
import { generateAdapters, PROVIDERS } from './generator.mjs';
import { SCOPES, globalRoot, toGlobalPaths, supportsGlobal } from './scope.mjs';

export const TRACKERS = ['local', 'github', 'other'];
export const MODES = ['new', 'existing'];
export const UPSTREAM_INSTALL = 'npx github:work-w-chrstnrpj/engr-toolbox';

function copyTree(src, dest, opts) {
  if (!fs.existsSync(src)) return [];
  if (fs.statSync(src).isDirectory()) return copyDirectorySafe(src, dest, opts);
  let content = fs.readFileSync(src, 'utf8');
  if (opts.transform) content = opts.transform(content, dest);
  return [(opts.managed ? writeManagedFileSafe : writeFileSafe)(dest, content, opts)];
}

/** Copy the workflow CLI into the project so status, gate, drift, loop and sync run offline at a pinned version. */
function installCli(templateRoot, targetDir, opts) {
  const results = [];
  for (const dir of ['bin', 'lib']) {
    results.push(...copyDirectorySafe(path.join(templateRoot, dir), path.join(targetDir, '.ai', 'cli', dir), { ...opts, managed: true }));
  }
  results.push(writeFileSafe(path.join(targetDir, '.ai', 'cli', 'package.json'), JSON.stringify({ type: 'module', private: true }, null, 2) + '\n', { ...opts, force: true }));
  results.push(...copyTree(path.join(templateRoot, 'preset.config.json'), path.join(targetDir, '.ai', 'cli', 'preset.config.json'), { ...opts, force: true }));
  return results;
}

function trackerDoc(content, tracker) {
  return content.replace(/^\*\*Tracker:\*\*.*$/m, `**Tracker:** ${tracker}`);
}

/**
 * Install canonical .agents/ assets and the project scaffold for a size tier.
 * - .agents/ files are managed: re-running updates them unless you delete their header.
 * - Scaffold files (AGENTS.md, GLOSSARY.md, docs, tickets) are project-owned: created once, never overwritten without --force.
 */
export function installAssets(options) {
  const {
    templateRoot,
    targetDir,
    size,
    mode = 'existing',
    tracker = 'local',
    tools = ['claude'],
    scope = 'project',
    home,
    dryRun = false,
    force = false
  } = options;
  if (!SCOPES.includes(scope)) throw new Error(`Unknown scope '${scope}'. Use: ${SCOPES.join(', ')}`);

  if (!MODES.includes(mode)) throw new Error(`Unknown mode '${mode}'. Use: ${MODES.join(', ')}`);
  if (!TRACKERS.includes(tracker)) throw new Error(`Unknown tracker '${tracker}'. Use: ${TRACKERS.join(', ')}`);
  for (const t of tools) {
    if (!PROVIDERS.includes(t)) throw new Error(`Unknown tool '${t}'. Supported: ${PROVIDERS.join(', ')}`);
  }

  const config = loadConfig(templateRoot);
  const tier = resolveTier(config, size || config.defaultTier);
  const sameRoot = path.resolve(templateRoot) === path.resolve(targetDir);
  const global = scope === 'global';
  const managed = { dryRun, force, managed: true, ...(global ? { transform: toGlobalPaths } : {}) };
  const owned = { dryRun, force };
  const results = [];
  const agentsSrc = path.join(templateRoot, '.agents');
  const canonicalRoot = global ? globalRoot(home) : targetDir;
  const agentsDest = path.join(canonicalRoot, '.agents');

  if (!sameRoot || global) {
    for (const readme of ['README.md', 'skills/README.md', 'roles/README.md', 'workflows/README.md']) {
      results.push(...copyTree(path.join(agentsSrc, readme), path.join(agentsDest, readme), managed));
    }
    for (const role of tier.roles) {
      results.push(...copyTree(path.join(agentsSrc, 'roles', `${role}.md`), path.join(agentsDest, 'roles', `${role}.md`), managed));
    }
    for (const pb of tier.playbooks) {
      results.push(...copyTree(path.join(agentsSrc, 'roles', 'playbooks', pb), path.join(agentsDest, 'roles', 'playbooks', pb), managed));
    }
    for (const skill of tier.skills) {
      const src = path.join(agentsSrc, 'skills', skill);
      if (!fs.existsSync(src)) throw new Error(`Tier '${tier.name}' lists missing skill '${skill}'`);
      results.push(...copyTree(src, path.join(agentsDest, 'skills', skill), managed));
    }
    for (const wf of tier.workflows) {
      results.push(...copyTree(path.join(agentsSrc, 'workflows', `${wf}.md`), path.join(agentsDest, 'workflows', `${wf}.md`), managed));
    }
    for (const tool of tier.tools) {
      results.push(...copyTree(path.join(agentsSrc, 'tools', `${tool}.md`), path.join(agentsDest, 'tools', `${tool}.md`), managed));
    }

  }

  if (!sameRoot) {
    const scaffoldRoot = path.join(templateRoot, 'template');
    const scaffold = [...tier.scaffold, ...(mode === 'new' ? config.newProjectScaffold || [] : [])];
    for (const entry of scaffold) {
      results.push(...copyTree(path.join(scaffoldRoot, entry), path.join(targetDir, entry), owned));
    }

    const trackerPath = path.join(targetDir, 'docs', 'agents', 'issue-tracker.md');
    const trackerSrc = path.join(scaffoldRoot, 'docs', 'agents', 'issue-tracker.md');
    if (fs.existsSync(trackerSrc)) {
      const exists = fs.existsSync(trackerPath);
      const current = exists ? fs.readFileSync(trackerPath, 'utf8') : fs.readFileSync(trackerSrc, 'utf8');
      const desired = trackerDoc(current, tracker);
      if (!exists || desired !== current) {
        if (!dryRun) {
          fs.mkdirSync(path.dirname(trackerPath), { recursive: true });
          fs.writeFileSync(trackerPath, desired, 'utf8');
        }
        results.push({ status: exists ? 'updated' : 'created', path: trackerPath });
      }
    }

    results.push(...installCli(templateRoot, targetDir, { dryRun, force }));
  }

  const installPath = path.join(targetDir, INSTALL_FILE);
  const previous = fs.existsSync(installPath) ? JSON.parse(fs.readFileSync(installPath, 'utf8')) : {};
  const record = {
    ...previous,
    version: config.version,
    size: tier.name,
    mode,
    tracker,
    tools,
    scope,
    ...(global ? { globalRoot: '~/.engr-toolbox' } : {}),
    checks: previous.checks ?? null,
    contextRules: previous.contextRules ?? config.contextRules
  };
  results.push(writeFileSafe(installPath, JSON.stringify(record, null, 2) + '\n', { dryRun, force: true }));

  if (!dryRun) {
    for (const tool of tools) {
      results.push(...generateAdapters({ sourceRoot: canonicalRoot, targetDir, provider: tool, scope, home, force, clean: false }).results);
    }
  }

  return { tier, mode, tracker, tools, scope, canonicalRoot, results };
}

export function detectMode(targetDir) {
  if (!fs.existsSync(targetDir)) return 'new';
  const entries = fs.readdirSync(targetDir).filter(e => !['.git', '.DS_Store'].includes(e));
  return entries.length === 0 ? 'new' : 'existing';
}

export function detectTools(targetDir) {
  const signals = [
    ['claude', ['.claude', 'CLAUDE.md']],
    ['cursor', ['.cursor']],
    ['codex', ['.codex']],
    ['opencode', ['.opencode', 'opencode.json']],
    ['copilot', ['.github/copilot-instructions.md', '.github/agents']],
    ['windsurf', ['.windsurf']],
    ['cline', ['.clinerules']],
    ['kilo', ['.kilo', 'kilo.jsonc']],
    ['aider', ['.aider.conf.yml']],
    ['antigravity', ['GEMINI.md']],
    ['openhands', ['.openhands']]
  ];
  const found = signals.filter(([, paths]) => paths.some(p => fs.existsSync(path.join(targetDir, p)))).map(([t]) => t);
  return found.length ? found : ['claude'];
}

export function detectTracker(targetDir) {
  try {
    const cfg = fs.readFileSync(path.join(targetDir, '.git', 'config'), 'utf8');
    if (/github\.com/.test(cfg)) return 'github';
  } catch { /* not a git repo */ }
  return 'local';
}

async function ask(rl, question, choices, fallback) {
  const hint = choices ? ` [${choices.join('/')}]` : '';
  const answer = (await rl.question(`${question}${hint} (${fallback}): `)).trim();
  return answer || fallback;
}

/** Interactive questions. Returns { mode, size, tools, tracker } or null when cancelled. */
export async function promptChoices({ targetDir, config, input = process.stdin, output = process.stdout }) {
  const readline = await import('node:readline/promises');
  const rl = readline.createInterface({ input, output });
  try {
    output.write(`\nengr-toolbox: install into ${targetDir}\n\n`);
    const mode = await ask(rl, '1. New or existing project?', MODES, detectMode(targetDir));
    output.write('\n   small  : solo or small project, core workflow only\n   medium : team project, inputs, design, QA, release\n   large  : big codebase or many teams, parallel builds, wayfinding, heavy context tools\n');
    const size = await ask(rl, '2. Project size?', Object.keys(config.tiers), config.defaultTier);
    const toolsRaw = await ask(rl, `3. AI tools (comma separated: ${PROVIDERS.join(', ')})?`, null, detectTools(targetDir).join(','));
    const tracker = await ask(rl, '4. Where do tickets live?', TRACKERS, detectTracker(targetDir));
    output.write('\n   project : skills and roles live in this repo, the whole team gets them (recommended for teams)\n   global  : skills and roles installed once on this machine, shared by all your projects\n');
    const scope = await ask(rl, '5. Install skills and roles where?', SCOPES, 'project');
    const tools = toolsRaw.split(',').map(s => s.trim()).filter(Boolean);
    output.write(`\n   mode=${mode} size=${size} tools=${tools.join(',')} tracker=${tracker} scope=${scope}\n`);
    const ok = (await rl.question('Install? [Y/n]: ')).trim().toLowerCase();
    if (ok && ok !== 'y' && ok !== 'yes') return null;
    return { mode, size, tools, tracker, scope };
  } finally {
    rl.close();
  }
}

export function nextSteps({ mode, tracker, scope = 'project', tools = [] }) {
  const lines = ['', 'Next steps:'];
  if (scope === 'global') {
    lines.push('  Skills and roles are installed for your user, not committed to this repo. Teammates run the same init with --scope global, or use --scope project.');
    const fallback = tools.filter(t => !supportsGlobal(t));
    if (fallback.length) lines.push(`  No user-level folder known for: ${fallback.join(', ')}. Their files were written into the project instead.`);
  }
  if (mode === 'existing') {
    lines.push('  1. In your AI tool, run /adopt-project to build the glossary, ADRs, architecture page and maps from your code.');
    lines.push('  2. Have team documents (TDD, API spec)? Run /ingest on each.');
  } else {
    lines.push('  1. Fill the goal, stack and verification commands in AGENTS.md.');
    lines.push('  2. In your AI tool, run /grill-with-docs to start.');
  }
  lines.push('  3. Unsure what is next at any point: /next');
  lines.push('  4. See the board: node .ai/cli/bin/cli.mjs status   (or install the short command once: npm install -g github:work-w-chrstnrpj/engr-toolbox, then: engr status)');
  lines.push('     In Claude Code or Codex: /cli status, or just ask.');
  if (tracker === 'github') lines.push('  Tickets use GitHub Issues through the gh CLI (gh auth login).');
  lines.push(`  Upgrade later: ${UPSTREAM_INSTALL} init --yes (re-uses your saved choices)`);
  return lines.join('\n');
}
