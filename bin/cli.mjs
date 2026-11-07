#!/usr/bin/env node
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig, loadInstall } from '../lib/config.mjs';
import { generateAdapters, uninstallGlobal, PROVIDERS, CHANGED_STATUSES } from '../lib/generator.mjs';
import { SCOPES, canonicalRoot, projectScope, globalRoot } from '../lib/scope.mjs';
import { installAssets, promptChoices, detectMode, detectTools, detectTracker, nextSteps, UPSTREAM_INSTALL } from '../lib/install.mjs';
import { validateTemplate } from '../lib/validator.mjs';
import { measureTokens, formatMeasureReport } from '../lib/measure.mjs';
import { loadTickets, formatStatus, writeBoard, findTicket, setEvidence, appendProgressLog } from '../lib/tickets.mjs';
import { runGate } from '../lib/gates.mjs';
import { detectDrift, formatDrift, markSyncPoint } from '../lib/drift.mjs';
import { checkCommits } from '../lib/commits.mjs';
import { runLoop } from '../lib/loop.mjs';
import { readJUnit, recordRun, loadHistory, findFlaky, writeFlaky, writeRunSummary, summarise, buildTrace, formatTrace, writeTrace } from '../lib/qa.mjs';
import { git } from '../lib/git.mjs';
import { resolvePipeline, savePipeline, writePipeline, describePipeline, readVersion, releaseNotes, PIPELINE_MODES, RELEASE_TARGETS } from '../lib/pipeline.mjs';
import { renderDiscover, renderItem, normaliseTopic, topicFromHelpFlag, TOPICS, collect } from '../lib/discover.mjs';

const templateRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const HELP = `
engr-toolbox: ticket-driven engineering workflow for AI coding agents.

Install or upgrade (from GitHub, no npm publish needed):
  ${UPSTREAM_INSTALL} [init] [options]

Short command (one-time global install, then works in any project folder):
  npm install -g --allow-git=all github:work-w-chrstnrpj/engr-toolbox
  engr <command> [options]          (uses the project's own .ai/cli/ copy when there is one)

Without the global install:
  node .ai/cli/bin/cli.mjs <command> [options]

Discover what this project has (terminal or coding agent):
  discover [skills|roles|workflows|docs|structure|commands|all]   --search <text>
  discover <skill|role|workflow> <name>      or just: discover <name>
  --help-discover, --help-discover-skillset, --help-discover-workflow, --help-discover-role, --help-discover-docs, --help-discover-structure

Commands:
  init                 Install or upgrade (interactive; --yes for defaults or saved choices)
  status               Show the ticket board          --write  rewrite tickets/BOARD.md   --feature <f>
  gate <phase>         Check a phase gate: spec | implement --ticket <f/NN> | deliver --ticket <f/NN> | release --feature <f>
  drift                Changes since the last sync    --since <ref>   --mark (save HEAD as sync point)
  validate             Structure, tickets, ADRs, map paths, context   --task <api|database|deployment|testing>
  check-commits        Every commit references a ticket   --range <base>..<head>
  trace                Acceptance criteria → manual cases → automated tests   --feature <f> --write --strict
  test-report          Read JUnit XML results   --junit <file|dir> --feature <f> --ticket <f/NN> --label <name> --write
  loop                 Work ready tickets unattended   --agent "<cmd>" --verify "<cmd>" --max-tickets N --max-attempts N --dry-run
  pipeline             CI/CD settings and GitHub Actions workflows (optional)
                       --provider github|gitlab|other --mode none|test|release --dev-branch <name|none> --main-branch <name>
                       --release-targets release,tag,npm,docker --test "<cmd>" --build "<cmd>" --install "<cmd>"
                       --write (save and generate) · --check (CI: workflows match settings)
                       --custom (files are hand-made by /setup-pipeline; never overwritten) · --no-custom
  release-version      Print the version a release would use     release-notes  CHANGELOG section for a version
  sync                 Regenerate tool adapters from .agents/   --target <tool|all> --check --clean --dry-run --scope project|global
  uninstall            Remove globally installed skills and roles (only files this tool wrote)   --scope global --tools <list> --dry-run
  measure              Token budget per tier
  <tool>               Shorthand for: init --yes --tools <tool>

Init options:
  --mode new|existing   --size small|medium|large   --tools claude,cursor,...   --tracker local|github|other
  --scope project|global   (where skills, roles, workflows and policies go; project-specific files always stay in the project)
  --pipeline none|test|release  --provider github|gitlab|other  --dev-branch develop  --main-branch main  --release-targets release,tag,npm,docker
  --into <dir>   --yes   --dry-run   --force

Tools: ${PROVIDERS.join(', ')}
`;

const VALUE_FLAGS = new Set(['into', 'mode', 'size', 'profile', 'tools', 'tool', 'tracker', 'target', 'task', 'feature', 'ticket', 'since', 'range', 'agent', 'verify', 'max-tickets', 'max-attempts', 'types', 'junit', 'label', 'search', 'scope', 'pipeline', 'dev-branch', 'main-branch', 'release-targets', 'test', 'build', 'install', 'node', 'version', 'version-file', 'provider']);

export function parseArgs(argv) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h') flags.help = true;
    else if (a === '-y') flags.yes = true;
    else if (a.startsWith('--')) {
      const [key, inline] = a.slice(2).split('=', 2);
      if (VALUE_FLAGS.has(key)) {
        const value = inline ?? argv[++i];
        if (value === undefined) throw new Error(`--${key} needs a value`);
        flags[key] = value;
      } else flags[key] = true;
    } else positional.push(a);
  }
  return { command: positional[0] || 'init', args: positional.slice(1), flags, positional };
}

const list = v => (v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : null);

function printResults(results, base) {
  for (const r of results) console.log(`  [${r.status}] ${path.relative(base, r.path) || '.'}`);
}

async function cmdInit(flags, targetDir, forcedTool = null) {
  if (!fs.existsSync(path.join(templateRoot, 'template'))) {
    throw new Error(`This copy of the CLI has no template payload. Install or upgrade with:\n  ${UPSTREAM_INSTALL} init`);
  }
  const config = loadConfig(templateRoot);
  const previous = loadInstall(targetDir) || {};
  let choices = {
    mode: flags.mode || previous.mode || detectMode(targetDir),
    size: flags.size || flags.profile || previous.size || config.defaultTier,
    tools: forcedTool ? [forcedTool] : list(flags.tools || flags.tool) || previous.tools || detectTools(targetDir),
    tracker: flags.tracker || previous.tracker || detectTracker(targetDir),
    scope: flags.scope || previous.scope || 'project',
    pipeline: pipelineFlags(flags)
  };
  const interactive = !flags.yes && !forcedTool && process.stdin.isTTY && !flags['dry-run'];
  if (interactive) {
    choices = await promptChoices({ targetDir, config, previous });
    if (!choices) {
      console.log('Cancelled. Nothing was installed.');
      return;
    }
  }
  console.log(`\nInstalling size=${choices.size} mode=${choices.mode} tools=${choices.tools.join(',')} tracker=${choices.tracker} scope=${choices.scope} into ${targetDir}${flags['dry-run'] ? ' (dry run)' : ''}`);
  const out = installAssets({ templateRoot, targetDir, ...choices, dryRun: !!flags['dry-run'], force: !!flags.force });
  const changed = out.results.filter(r => CHANGED_STATUSES.has(r.status));
  const skipped = out.results.filter(r => r.status === 'skipped_user_file');
  console.log(`\n${changed.length} file(s) written, ${skipped.length} existing file(s) kept as they are (not written by this tool).`);
  if (choices.scope === 'global') console.log(`Shared assets: ${out.canonicalRoot}/.agents (skills and roles also copied into each tool's user folder).`);
  for (const f of out.results.filter(r => r.status === 'project_fallback')) console.log(`  note: ${f.note}`);
  if (flags.verbose) printResults(out.results, targetDir);
  console.log(nextSteps({ ...choices, pipeline: out.pipeline }));
}

function pipelineFlags(flags, modeFlag = 'pipeline') {
  const mode = flags[modeFlag];
  const any = mode || flags.provider || flags.custom || flags['no-custom'] || flags['dev-branch'] || flags['main-branch'] || flags['release-targets'] || flags.test || flags.build || flags.install || flags.node || flags['version-file'];
  if (!any) return null;
  const branches = {};
  if (flags['dev-branch'] !== undefined) branches.development = flags['dev-branch'];
  if (flags['main-branch'] !== undefined) branches.main = flags['main-branch'];
  const release = {};
  if (flags['release-targets']) release.targets = list(flags['release-targets']);
  if (flags['version-file']) release.versionFile = flags['version-file'];
  return { mode, provider: flags.provider, branches, release, test: flags.test, build: flags.build, install: flags.install, node: flags.node, custom: flags.custom ? true : flags['no-custom'] ? false : undefined };
}

function cmdPipeline(flags, targetDir) {
  if (flags.mode && !PIPELINE_MODES.includes(flags.mode)) throw new Error(`--mode must be one of ${PIPELINE_MODES.join(', ')}`);
  const overrides = pipelineFlags(flags, 'mode') || {};
  const p = resolvePipeline(targetDir, overrides);
  const scope = projectScope(targetDir);
  if (flags.check && p.custom) {
    console.log('✔ Custom pipeline: hand-maintained workflow files are not compared');
    return;
  }
  if (flags.check) {
    const changed = writePipeline(targetDir, p, { dryRun: true, scope }).filter(r => CHANGED_STATUSES.has(r.status));
    if (changed.length) {
      printResults(changed, targetDir);
      console.error('\nCI workflows are out of date with the saved pipeline settings. Run: pipeline --write');
      process.exit(1);
    }
    console.log('✔ CI workflows match the pipeline settings');
    return;
  }
  console.log(describePipeline(p));
  if (flags.write) {
    savePipeline(targetDir, p);
    const results = writePipeline(targetDir, p, { scope, force: !!flags.force });
    console.log('');
    printResults(results, targetDir);
    const kept = results.filter(r => r.status === 'skipped_user_file');
    if (kept.length) console.log('  (kept: a workflow file without the generated header is yours; delete it or use --force)');
  } else if (Object.keys(overrides).length) {
    console.log('\n(preview only: add --write to save these settings and generate the workflows)');
  }
}

function cmdSync(flags, targetDir) {
  const install = loadInstall(targetDir);
  const scope = flags.scope || projectScope(targetDir);
  const sourceRoot = scope === 'global' ? globalRoot() : targetDir;
  const targets = !flags.target || flags.target === 'all'
    ? (flags.target === 'all' ? PROVIDERS : install?.tools || PROVIDERS)
    : list(flags.target);
  const check = !!flags.check;
  let drifted = 0;
  for (const t of targets) {
    const { results } = generateAdapters({ sourceRoot, targetDir, provider: t, scope, dryRun: check || !!flags['dry-run'], force: !!flags.force, clean: !!flags.clean || check });
    const changed = results.filter(r => CHANGED_STATUSES.has(r.status));
    const owned = results.filter(r => r.status === 'skipped_user_file');
    drifted += changed.length;
    if (owned.length) console.log(`  ${t}: kept ${owned.length} file(s) without the generated header (yours); delete them or use --force to regenerate`);
    if (check) {
      if (changed.length) {
        console.log(`✖ ${t}: ${changed.length} adapter file(s) out of date`);
        printResults(changed, targetDir);
      } else console.log(`✔ ${t}: up to date`);
    } else {
      console.log(`--- ${t}: ${changed.length} change(s)`);
      printResults(changed, targetDir);
    }
  }
  if (check && drifted) {
    console.error('\nAdapters are out of date. Run: sync --clean');
    process.exit(1);
  }
}

function cmdUninstall(flags, targetDir) {
  if ((flags.scope || 'global') !== 'global') {
    throw new Error('Only --scope global can be uninstalled. Project files are yours: remove them with git.');
  }
  const results = uninstallGlobal({ tools: list(flags.tools) || PROVIDERS, dryRun: !!flags['dry-run'] });
  const removed = results.filter(r => r.status === 'removed');
  const kept = results.filter(r => r.status === 'skipped_user_file');
  console.log(`${flags['dry-run'] ? 'Would remove' : 'Removed'} ${removed.length} file(s) written by this tool. Kept ${kept.length} file(s) it did not write.`);
  if (flags.verbose) printResults(results, process.env.HOME || '/');
}

function cmdValidate(flags, targetDir) {
  const v = validateTemplate(targetDir, { task: flags.task });
  console.log(`\n✔ ${v.passed.length} check(s) passed`);
  if (v.warnings.length) {
    console.log(`\n⚠ ${v.warnings.length} warning(s):`);
    for (const w of v.warnings) console.log(`  ${w}`);
  }
  if (v.errors.length) {
    console.error(`\n✖ ${v.errors.length} error(s):`);
    for (const e of v.errors) console.error(`  ${e}`);
    process.exit(1);
  }
  console.log('\nValidation passed.');
}

function cmdStatus(flags, targetDir) {
  let tickets = loadTickets(targetDir);
  if (flags.feature) tickets = tickets.filter(t => t.feature === flags.feature);
  if (flags.json) {
    console.log(JSON.stringify(tickets, null, 2));
    return;
  }
  console.log(formatStatus(tickets));
  if (flags.write) console.log(`\nWrote ${path.relative(targetDir, writeBoard(targetDir))}`);
}

function cmdGate(args, flags, targetDir) {
  const r = runGate(targetDir, args[0], { ticket: flags.ticket, feature: flags.feature });
  for (const p of r.passed) console.log(`  ✔ ${p}`);
  for (const x of r.reasons) console.error(`  ✖ ${x}`);
  console.log(r.ok ? `\nGate '${r.phase}' passed.` : `\nGate '${r.phase}' blocked.`);
  if (!r.ok) process.exit(1);
}

function cmdDrift(flags, targetDir) {
  if (flags.mark) {
    console.log(`Sync point saved: ${markSyncPoint(targetDir).slice(0, 12)}`);
    return;
  }
  const report = detectDrift(targetDir, { since: flags.since });
  console.log(flags.json ? JSON.stringify(report, null, 2) : formatDrift(report));
}

function cmdCheckCommits(flags, targetDir) {
  const r = checkCommits(targetDir, flags.range);
  for (const c of r.results) console.log(`  ${c.ok ? '✔' : '✖'} ${c.sha} ${c.subject}${c.ok ? '' : `  (${c.reason})`}`);
  if (!r.results.length) console.log('  No commits in range.');
  if (!r.ok) {
    console.error('\nSome commits have no ticket reference. Add feature/NN or #123 to the message, or [no-ticket] for trivial housekeeping.');
    process.exit(1);
  }
}

function cmdTrace(flags, targetDir) {
  const trace = buildTrace(targetDir, { feature: flags.feature });
  console.log(formatTrace(trace));
  if (flags.write) console.log(`\nWrote ${path.relative(targetDir, writeTrace(targetDir, trace))}`);
  if (flags.strict && trace.uncovered.length) {
    console.error(`\n${trace.uncovered.length} criteria not covered.`);
    process.exit(1);
  }
}

function cmdTestReport(flags, targetDir) {
  if (!flags.junit) throw new Error('--junit <file or folder> is required');
  const cases = readJUnit(path.resolve(targetDir, flags.junit));
  const s = summarise(cases);
  const line = `${s.passed} passed, ${s.failed} failed, ${s.skipped} skipped (${s.total})`;
  console.log(`JUnit: ${line}`);
  for (const c of cases.filter(x => x.outcome === 'failed')) console.log(`  ✖ ${c.id}${c.message ? `: ${c.message.slice(0, 120)}` : ''}`);
  if (!flags.write) {
    console.log('\n(dry view: add --write to record history, flaky list, run summary and ticket evidence)');
    return;
  }
  const commit = git(targetDir, ['rev-parse', '--short', 'HEAD'], { allowFail: true });
  const run = recordRun(targetDir, { cases, feature: flags.feature || null, ticket: flags.ticket || null, label: flags.label || null, commit });
  const flaky = findFlaky(loadHistory(targetDir));
  const summaryPath = writeRunSummary(targetDir, run, cases);
  writeFlaky(targetDir, flaky);
  console.log(`Recorded run. Flaky tests: ${flaky.length}. Summary: ${path.relative(targetDir, summaryPath)}`);
  if (flags.ticket) {
    const t = findTicket(loadTickets(targetDir), flags.ticket);
    if (!t) throw new Error(`ticket '${flags.ticket}' not found`);
    const rel = path.relative(targetDir, summaryPath).split(path.sep).join('/');
    setEvidence(t.file, 'Tests', `${line}${commit ? ` at ${commit}` : ''} (${rel})`);
    appendProgressLog(t.file, 'test-report', [`Automated run: ${line}.`]);
    console.log(`Updated evidence on ${t.id}`);
  }
  if (s.failed) process.exitCode = 1;
}

function cmdDiscover(args, flags, targetDir) {
  const [first, second] = args;
  const singular = { skill: 'skills', role: 'roles', workflow: 'workflows' };
  if (first && second && singular[first]) return process.stdout.write(renderItem(targetDir, first, second));
  if (first && !TOPICS.includes(normaliseTopic(first))) {
    const data = collect(targetDir);
    for (const [kind, list] of [['skill', data.skills], ['role', data.roles], ['workflow', data.workflows]]) {
      if (list.some(x => x.name === first)) return process.stdout.write(renderItem(targetDir, kind, first));
    }
    throw new Error(`Nothing called '${first}'. Topics: ${TOPICS.join(', ')}. Or search: discover all --search ${first}`);
  }
  process.stdout.write(renderDiscover(targetDir, first || 'all', { search: flags.search || null }));
}

function cmdLoop(flags, targetDir) {
  const report = runLoop({
    root: targetDir,
    agent: flags.agent,
    check: flags.verify,
    feature: flags.feature,
    types: list(flags.types) || undefined,
    maxTickets: Number(flags['max-tickets'] || 1),
    maxAttempts: Number(flags['max-attempts'] || 3),
    dryRun: !!flags['dry-run']
  });
  if (report.newTickets.length) {
    console.log(`\nTickets raised during this run (${report.newTickets.length}), triage them with /triage:`);
    for (const t of report.newTickets) console.log(`  ${t.id}  ${t.type}${t.severity ? ` ${t.severity}` : ''}  ${t.status}  ${t.title}  (found during ${t.foundDuring})`);
  }
  console.log(`\nLoop stopped: ${report.stoppedBecause}`);
}

/**
 * A global `engr` hands off to the project's own pinned copy in .ai/cli/ so every teammate
 * runs the version the project installed. `init` always runs from the global copy (it needs the template payload).
 */
function delegateToProjectCli(argv) {
  if (process.env.ENGR_NO_DELEGATE) return false;
  const parsed = parseArgs(argv);
  if (parsed.command === 'init' && !Object.keys(parsed.flags).some(f => f.startsWith('help'))) return false;
  const projectRoot = path.resolve(parsed.flags.into || process.cwd());
  const projectCli = path.join(projectRoot, '.ai', 'cli', 'bin', 'cli.mjs');
  if (!fs.existsSync(projectCli)) return false;
  const projectCliRoot = path.resolve(path.dirname(projectCli), '..');
  if (projectCliRoot === templateRoot || fs.realpathSync(projectCliRoot) === fs.realpathSync(templateRoot)) return false;
  if (fs.existsSync(path.join(projectRoot, 'bin', 'cli.mjs')) && fs.realpathSync(path.join(projectRoot, 'bin', 'cli.mjs')) === fs.realpathSync(fileURLToPath(import.meta.url))) return false;
  const r = spawnSync(process.execPath, [projectCli, ...argv], { stdio: 'inherit', env: { ...process.env, ENGR_NO_DELEGATE: '1' } });
  process.exit(r.status ?? 1);
}

async function main() {
  delegateToProjectCli(process.argv.slice(2));
  const parsed = parseArgs(process.argv.slice(2));
  let { command, args } = parsed;
  const { flags } = parsed;
  const helpTopic = Object.keys(flags).map(topicFromHelpFlag).find(Boolean);
  if (helpTopic) {
    command = 'discover';
    const named = parsed.positional.filter(p => p !== 'discover');
    args = named.length && ['skills', 'roles', 'workflows'].includes(helpTopic) ? [helpTopic.slice(0, -1), ...named] : [helpTopic];
  }
  if (flags.help || command === 'help') {
    console.log(HELP);
    return;
  }
  const targetDir = path.resolve(flags.into || process.cwd());
  switch (command) {
    case 'init': return cmdInit(flags, targetDir);
    case 'sync': return cmdSync(flags, targetDir);
    case 'uninstall': return cmdUninstall(flags, targetDir);
    case 'validate': return cmdValidate(flags, targetDir);
    case 'status': return cmdStatus(flags, targetDir);
    case 'gate': return cmdGate(args, flags, targetDir);
    case 'drift': return cmdDrift(flags, targetDir);
    case 'check-commits': return cmdCheckCommits(flags, targetDir);
    case 'loop': return cmdLoop(flags, targetDir);
    case 'trace': return cmdTrace(flags, targetDir);
    case 'discover': return cmdDiscover(args, flags, targetDir);
    case 'pipeline': return cmdPipeline(flags, targetDir);
    case 'release-version': {
      const p = resolvePipeline(targetDir);
      return console.log(readVersion(targetDir, flags['version-file'] || p.release.versionFile));
    }
    case 'release-notes': {
      const p = resolvePipeline(targetDir);
      return process.stdout.write(releaseNotes(targetDir, flags.version || readVersion(targetDir, p.release.versionFile)));
    }
    case 'test-report': return cmdTestReport(flags, targetDir);
    case 'measure': return console.log(formatMeasureReport(measureTokens(templateRoot)));
    default:
      if (PROVIDERS.includes(command)) return cmdInit({ ...flags, yes: true }, targetDir, command);
      throw new Error(`Unknown command '${command}'. Run with --help.`);
  }
}

main().catch(err => {
  console.error(`\n✖ ${err.message}\n`);
  process.exit(1);
});
