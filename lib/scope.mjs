import os from 'node:os';
import path from 'node:path';
import { loadInstall } from './config.mjs';

export const SCOPES = ['project', 'global'];
export const GLOBAL_DIR = '.engr-toolbox';
export const GLOBAL_DISPLAY = `~/${GLOBAL_DIR}/.agents`;

/** Home used for global installs. ENGR_HOME overrides it (tests, custom setups). */
export function globalHome() {
  return path.resolve(process.env.ENGR_HOME || os.homedir());
}

/** Folder whose .agents/ holds the global canonical assets. */
export function globalRoot(home = globalHome()) {
  return path.join(home, GLOBAL_DIR);
}

/**
 * Per-tool user-level folders for skills and agents. Only tools with a documented user-level location are listed;
 * the rest fall back to project files. Check your tool's docs if a location moves.
 */
export function globalDirs(tool, home = globalHome()) {
  const map = {
    claude: { agents: path.join(home, '.claude', 'agents'), skills: path.join(home, '.claude', 'skills') },
    codex: { agents: path.join(home, '.codex', 'agents'), skills: path.join(home, '.agents', 'skills') },
    opencode: { agents: path.join(home, '.config', 'opencode', 'agents'), skills: path.join(home, '.config', 'opencode', 'skills') },
    cursor: { agents: null, skills: path.join(home, '.cursor', 'skills') },
    copilot: { agents: path.join(home, '.copilot', 'agents'), skills: path.join(home, '.copilot', 'skills') }
  };
  return map[tool] || null;
}

export function supportsGlobal(tool) {
  return globalDirs(tool, '/') !== null;
}

/** Rewrite project-relative `.agents/` references so globally installed files point at the global copy. */
export function toGlobalPaths(content) {
  return content.replace(/(^|[\s`'"(])\.agents\//gm, `$1${GLOBAL_DISPLAY}/`);
}

/** Where a project's canonical .agents/ lives: the project itself, or the global root. */
export function canonicalRoot(projectRoot) {
  const install = loadInstall(projectRoot);
  return install?.scope === 'global' ? globalRoot() : projectRoot;
}

export function projectScope(projectRoot) {
  return loadInstall(projectRoot)?.scope === 'global' ? 'global' : 'project';
}
