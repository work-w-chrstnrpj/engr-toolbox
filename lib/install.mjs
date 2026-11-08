import fs from 'node:fs';
import path from 'node:path';
import { writeFileSafe, writeManagedFileSafe, copyDirectorySafe } from './safety.mjs';
import { loadConfig, resolveTier, INSTALL_FILE } from './config.mjs';
import { generateAdapters, PROVIDERS } from './generator.mjs';
import { SCOPES, globalRoot, toGlobalPaths, supportsGlobal } from './scope.mjs';
import { resolvePipeline, savePipeline, writePipeline, detectProvider } from './pipeline.mjs';
import { installClaudeHooks, installCommitHook } from './guard.mjs';

export const TRACKERS = ['local', 'github', 'other'];
export const MODES = ['new', 'existing'];
export const UPSTREAM_INSTALL = 'npx --allow-git=all github:work-w-chrstnrpj/engr-toolbox';

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
    pipeline = null,
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
    if (tools.includes('claude') && !global) results.push(installClaudeHooks(targetDir, { dryRun }));
    if (!global) results.push(installCommitHook(targetDir, { dryRun }));
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

  let pipelineResolved = null;
  if (pipeline && !sameRoot) {
    pipelineResolved = resolvePipeline(targetDir, { ...pipeline, branches: pipeline.branches, release: pipeline.release });
    if (!dryRun) {
      savePipeline(targetDir, pipelineResolved);
      results.push(...writePipeline(targetDir, pipelineResolved, { scope }));
    }
  }

  if (!dryRun) {
    for (const tool of tools) {
      results.push(...generateAdapters({ sourceRoot: canonicalRoot, targetDir, provider: tool, scope, home, force, clean: false }).results);
    }
  }

  return { tier, mode, tracker, tools, scope, canonicalRoot, pipeline: pipelineResolved, results };
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

const TOOL_LABELS = {
  claude: 'Claude Code', codex: 'Codex', cursor: 'Cursor', copilot: 'GitHub Copilot', opencode: 'OpenCode',
  windsurf: 'Windsurf', cline: 'Cline', kilo: 'Kilo Code', aider: 'Aider', antigravity: 'Antigravity / Gemini', openhands: 'OpenHands'
};

/** Interactive questions with arrow-key pickers. Returns the choices, or null when cancelled. */
export async function promptChoices({ targetDir, config, input = process.stdin, output = process.stdout, previous = {} }) {
  const { select, multiSelect, textInput } = await import('./prompt.mjs');
  const io = { input, output };
  output.write(`\nengr-toolbox: install into ${targetDir}\n\n`);

  const mode = await select('1. New or existing project?', [
    { value: 'existing', hint: 'add the workflow to code you already have' },
    { value: 'new', hint: 'also create application/, service/, shared/, tests/' }
  ], { initial: previous.mode || detectMode(targetDir), ...io });
  if (mode === null) return null;

  const size = await select('2. Project size?', Object.keys(config.tiers).map(t => ({ value: t, hint: config.tiers[t].description })), { initial: previous.size || config.defaultTier, ...io });
  if (size === null) return null;

  const tools = await multiSelect('3. Which AI tools do you use? (pick all that apply)', PROVIDERS.map(t => ({ value: t, label: TOOL_LABELS[t] || t })), { initial: previous.tools || detectTools(targetDir), ...io });
  if (tools === null) return null;

  const tracker = await select('4. Where do tickets live?', [
    { value: 'local', hint: 'markdown files in tickets/' },
    { value: 'github', hint: 'GitHub Issues through the gh CLI' },
    { value: 'other', hint: 'describe your tracker in docs/agents/issue-tracker.md' }
  ], { initial: previous.tracker || detectTracker(targetDir), ...io });
  if (tracker === null) return null;

  const scope = await select('5. Install skills and roles where?', [
    { value: 'project', hint: 'in this repo, the whole team gets them (recommended for teams)' },
    { value: 'global', hint: 'once on this machine, shared by all your projects' }
  ], { initial: previous.scope || 'project', ...io });
  if (scope === null) return null;

  const pipelineMode = await select('6. Set up CI/CD? (optional)', [
    { value: 'none', hint: 'no workflows; you can add them later with: pipeline' },
    { value: 'test', hint: 'test every PR and every push to the development branch' },
    { value: 'release', hint: 'test, plus release when merged to main' }
  ], { initial: previous.pipeline?.mode || 'none', ...io });
  if (pipelineMode === null) return null;

  let pipeline = { mode: pipelineMode };
  if (pipelineMode !== 'none') {
    const provider = await select('   CI system', [
      { value: 'github', label: 'GitHub Actions' },
      { value: 'gitlab', label: 'GitLab CI' },
      { value: 'other', label: 'Other', hint: 'Bitbucket, Azure DevOps, Jenkins, ... /setup-pipeline writes it for you' }
    ], { initial: previous.pipeline?.provider || detectProvider(targetDir), ...io });
    if (provider === null) return null;
    pipeline.provider = provider;
    const development = await textInput('   Development branch (type none for feature → main)', previous.pipeline?.branches?.development || 'develop', io);
    const main = await textInput('   Main branch', previous.pipeline?.branches?.main || 'main', io);
    pipeline.branches = { development, main };
    if (pipelineMode === 'release') {
      const host = provider === 'gitlab' ? 'GitLab' : 'GitHub';
      const targets = await multiSelect('   On merge to main', [
        { value: 'release', label: `${host} Release`, hint: 'tag + release notes from CHANGELOG.md' },
        { value: 'tag', label: 'Tag only', hint: 'just the version tag, no release page' },
        { value: 'npm', label: 'npm package', hint: 'npm publish, needs NPM_TOKEN' },
        { value: 'docker', label: 'Docker image', hint: provider === 'gitlab' ? 'push to the GitLab registry' : 'push to ghcr.io' }
      ], { initial: previous.pipeline?.release?.targets || ['release'], ...io });
      if (targets === null) return null;
      pipeline.release = { targets };
    }
  }

  output.write(`\n   mode=${mode} size=${size} tools=${tools.join(',')} tracker=${tracker} scope=${scope} pipeline=${pipelineMode}\n`);
  const ok = await select('Install now?', [{ value: 'yes' }, { value: 'no' }], { initial: 'yes', ...io });
  if (ok !== 'yes') return null;
  return { mode, size, tools, tracker, scope, pipeline };
}

export function nextSteps({ mode, tracker, scope = 'project', tools = [], pipeline = null }) {
  const lines = ['', 'Next steps:'];
  if (pipeline && pipeline.mode !== 'none') {
    const files = pipeline.provider === 'gitlab' ? '.gitlab-ci.yml' : pipeline.provider === 'other' ? 'none yet: run /setup-pipeline and the agent writes it' : `.github/workflows/engr-checks.yml${pipeline.mode === 'release' ? ' and engr-release.yml' : ''}`;
    lines.push(`  CI/CD: ${files}. Tailor each branch's steps with /setup-pipeline.`);
    if (pipeline.release?.targets?.includes('npm')) lines.push(`  Add NPM_TOKEN in ${pipeline.provider === 'gitlab' ? 'GitLab (Settings → CI/CD → Variables)' : 'GitHub (Settings → Secrets → Actions)'} before the first release.`);
  }
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
  lines.push('  4. See the board: node .ai/cli/bin/cli.mjs status   (or install the short command once: npm install -g --allow-git=all github:work-w-chrstnrpj/engr-toolbox, then: engr status)');
  lines.push('     In Claude Code or Codex: /cli status, or just ask.');
  if (tracker === 'github') lines.push('  Tickets use GitHub Issues through the gh CLI (gh auth login).');
  lines.push(`  Upgrade later: ${UPSTREAM_INSTALL} init --yes (re-uses your saved choices)`);
  return lines.join('\n');
}
