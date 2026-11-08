import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadInstall } from './config.mjs';

export const UPSTREAM_CONFIG_URL = 'https://raw.githubusercontent.com/work-w-chrstnrpj/engr-toolbox/main/preset.config.json';
const DAY = 24 * 60 * 60 * 1000;

/** Compare dotted versions numerically: -1, 0 or 1. Missing parts count as 0; a non-numeric tail is ignored. */
export function compareVersions(a, b) {
  const parse = v => String(v || '0').split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function installedVersion(root) {
  return loadInstall(root)?.version || null;
}

/** installed vs latest: current, stale, ahead, or unknown (no install record or no latest). */
export function versionState(installed, latest) {
  if (!installed || !latest) return 'unknown';
  const c = compareVersions(installed, latest);
  return c === 0 ? 'current' : c < 0 ? 'stale' : 'ahead';
}

/** Latest published version. Returns null on any failure (offline, timeout, bad JSON). */
export async function fetchLatestVersion({ fetchImpl = globalThis.fetch, timeoutMs = 2500 } = {}) {
  if (!fetchImpl) return null;
  try {
    const res = await fetchImpl(UPSTREAM_CONFIG_URL, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return (await res.json()).version || null;
  } catch {
    return null;
  }
}

function cacheFile(root) {
  const key = crypto.createHash('sha1').update(path.resolve(root)).digest('hex').slice(0, 10);
  return path.join(os.tmpdir(), `engr-toolbox-latest-${key}.json`);
}

/** Skipped under tests, CI, or ENGR_NO_UPDATE_CHECK=1 so automation never waits on the network. */
export function noticeDisabled(env = process.env) {
  return !!(env.ENGR_NO_UPDATE_CHECK || env.CI || env.NODE_TEST_CONTEXT);
}

/** One-line notice when the project's install is behind. Checks the network at most once a day. */
export async function staleNotice(root, { env = process.env, fetchImpl, now = Date.now() } = {}) {
  if (noticeDisabled(env)) return null;
  const installed = installedVersion(root);
  if (!installed) return null;
  const file = cacheFile(root);
  let latest = null;
  try {
    const cached = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (now - cached.checkedAt < DAY) latest = cached.latest;
  } catch { /* no cache yet */ }
  if (!latest) {
    latest = await fetchLatestVersion({ fetchImpl, timeoutMs: 1500 });
    try { fs.writeFileSync(file, JSON.stringify({ checkedAt: now, latest })); } catch { /* ignore */ }
  }
  if (versionState(installed, latest) !== 'stale') return null;
  return `engr-toolbox ${installed} is installed; ${latest} is available. Run: engr update`;
}
