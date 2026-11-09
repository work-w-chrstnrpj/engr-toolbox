import fs from 'node:fs';
import path from 'node:path';
import { isManagedFile } from './safety.mjs';
import { INSTALL_FILE } from './config.mjs';
import { GUARD_MARKER, claudeHooks } from './guard.mjs';

// Folders the installer and the adapters write into. Only files carrying the generator header are removed.
const MANAGED_ROOTS = [
  '.agents', '.ai/cli',
  '.claude', '.cursor', '.codex', '.opencode', '.windsurf', '.clinerules', '.kilo', '.openhands',
  '.github/agents', '.github/skills', '.github/workflows'
];
// Single files the adapters write at the project root or next to it.
const MANAGED_FILES = ['CLAUDE.md', 'GEMINI.md', 'CONVENTIONS.md', 'kilo.jsonc', '.aider.conf.yml', '.github/copilot-instructions.md'];
// Written without a header, so removed only inside .ai/cli, which this tool owns.
const CLI_EXTRAS = ['package.json', 'preset.config.json'];

/**
 * Remove an installed project setup. Only files this tool wrote are removed:
 * generated files with the header, the project's .ai/cli copy, engr-toolbox.json, our hook entries and our commit-msg hook.
 * Scaffold files (AGENTS.md, GLOSSARY.md, docs/, tickets/, .ai/maps, ...) are project-owned and always kept.
 */
export function uninstallProject(targetDir, { dryRun = false } = {}) {
  const results = [];
  const root = path.resolve(targetDir);

  const removeFile = (file, force = false) => {
    if (!fs.existsSync(file)) return;
    if (force || isManagedFile(file)) {
      if (!dryRun) fs.rmSync(file);
      results.push({ status: 'removed', path: file });
    } else {
      results.push({ status: 'skipped_user_file', path: file });
    }
  };
  const removeTree = dir => {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) removeTree(p);
      else removeFile(p);
    }
    pruneIfEmpty(dir);
  };
  const pruneIfEmpty = dir => {
    if (!dryRun && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
  };

  results.push(...removeClaudeHooks(root, dryRun));
  results.push(...removeCommitHook(root, dryRun));

  // .ai/cli: managed copies plus the two files written without a header.
  const cliDir = path.join(root, '.ai', 'cli');
  for (const extra of CLI_EXTRAS) removeFile(path.join(cliDir, extra), true);

  for (const rel of MANAGED_ROOTS) removeTree(path.join(root, rel));
  for (const rel of MANAGED_FILES) removeFile(path.join(root, rel));

  removeFile(path.join(root, INSTALL_FILE), true);

  // Tidy folders this left empty (not the ones that still hold user files).
  if (!dryRun) {
    for (const rel of ['.ai/cli', '.ai', '.github/workflows', '.github']) pruneIfEmpty(path.join(root, rel));
  }
  return results;
}

/** Take our two hook entries out of .claude/settings.json and leave everything else in it. */
function removeClaudeHooks(root, dryRun) {
  const target = path.join(root, '.claude', 'settings.json');
  if (!fs.existsSync(target)) return [];
  let settings;
  try { settings = JSON.parse(fs.readFileSync(target, 'utf8')); } catch { return [{ status: 'skipped_user_file', path: target }]; }
  if (!settings.hooks) return [];
  const ours = new Set(Object.values(claudeHooks()).flat().map(e => e.hooks[0].command));
  let changed = false;
  for (const event of Object.keys(settings.hooks)) {
    const kept = settings.hooks[event].filter(e => !e.hooks?.some(h => ours.has(h.command)));
    if (kept.length !== settings.hooks[event].length) changed = true;
    if (kept.length) settings.hooks[event] = kept;
    else delete settings.hooks[event];
  }
  if (!changed) return [];
  if (!Object.keys(settings.hooks).length) delete settings.hooks;
  if (!dryRun) {
    if (Object.keys(settings).length) fs.writeFileSync(target, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    else fs.rmSync(target);
  }
  return [{ status: 'removed', path: `${target} (engr-toolbox hooks)` }];
}

function removeCommitHook(root, dryRun) {
  const target = path.join(root, '.git', 'hooks', 'commit-msg');
  if (!fs.existsSync(target)) return [];
  if (!fs.readFileSync(target, 'utf8').includes(GUARD_MARKER)) return [{ status: 'skipped_user_file', path: target }];
  if (!dryRun) fs.rmSync(target);
  return [{ status: 'removed', path: target }];
}
