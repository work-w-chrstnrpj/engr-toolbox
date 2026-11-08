import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { tempDir, write, templateRoot } from './helpers.mjs';
import { compareVersions, versionState, staleNotice } from '../lib/update.mjs';
import { installAssets, loadConfig } from '../lib/index.mjs';

const cli = (args, cwd) => spawnSync(process.execPath, [path.join(templateRoot, 'bin', 'cli.mjs'), ...args], { cwd, encoding: 'utf8', env: { ...process.env, ENGR_NO_DELEGATE: '1' } });

describe('update', () => {
  test('compares versions numerically', () => {
    assert.equal(compareVersions('3.4.0', '3.10.0'), -1);
    assert.equal(compareVersions('3.4.0', '3.4'), 0);
    assert.equal(compareVersions('4.0.0', '3.99.9'), 1);
    assert.equal(versionState('3.0.0', '3.4.0'), 'stale');
    assert.equal(versionState(null, '3.4.0'), 'unknown');
  });

  test('stale notice appears only when behind, and never offline or in tests', async () => {
    const root = tempDir();
    write(root, 'engr-toolbox.json', JSON.stringify({ version: '1.0.0' }));
    const env = {};
    const fetchImpl = async () => ({ ok: true, json: async () => ({ version: '2.0.0' }) });
    assert.match(await staleNotice(root, { env, fetchImpl, now: 1 }), /1\.0\.0.*2\.0\.0.*engr update/);
    assert.equal(await staleNotice(root, { env: { CI: '1' }, fetchImpl }), null);
    const offline = tempDir();
    write(offline, 'engr-toolbox.json', JSON.stringify({ version: '1.0.0' }));
    assert.equal(await staleNotice(offline, { env, fetchImpl: async () => { throw new Error('offline'); }, now: 2 }), null);
  });

  test('update --check fails on a stale install; update upgrades it and keeps choices', () => {
    const root = tempDir();
    installAssets({ templateRoot, targetDir: root, size: 'small', tools: ['claude'] });
    const rec = path.join(root, 'engr-toolbox.json');
    const old = { ...JSON.parse(fs.readFileSync(rec, 'utf8')), version: '0.0.1' };
    fs.writeFileSync(rec, JSON.stringify(old));
    assert.equal(cli(['update', '--check'], root).status, 1);
    const r = cli(['update'], root);
    assert.equal(r.status, 0, r.stderr);
    const after = JSON.parse(fs.readFileSync(rec, 'utf8'));
    assert.equal(after.version, loadConfig(templateRoot).version);
    assert.equal(after.size, 'small');
    assert.equal(cli(['update', '--check'], root).status, 0);
  });
});
