import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { templateRoot, tempDir } from './helpers.mjs';
import { renderDiscover, renderItem, topicFromHelpFlag, collect } from '../lib/discover.mjs';
import { installAssets } from '../lib/install.mjs';

const cli = path.join(templateRoot, 'bin', 'cli.mjs');
const run = (args, cwd = templateRoot) => execFileSync('node', [cli, ...args], { cwd, encoding: 'utf8' });

describe('discover', () => {
  test('help flags map to topics, including skillset and singular forms', () => {
    assert.equal(topicFromHelpFlag('help-discover'), 'all');
    assert.equal(topicFromHelpFlag('help-discover-skillset'), 'skills');
    assert.equal(topicFromHelpFlag('help-discover-workflow'), 'workflows');
    assert.equal(topicFromHelpFlag('help-discover-role'), 'roles');
    assert.equal(topicFromHelpFlag('help-discover-docs'), 'docs');
    assert.equal(topicFromHelpFlag('help'), null);
  });

  test('lists only what the project has installed', () => {
    const small = tempDir();
    installAssets({ templateRoot, targetDir: small, size: 'small', tools: [] });
    const data = collect(small);
    assert.ok(data.skills.some(s => s.name === 'implement'));
    assert.ok(!data.skills.some(s => s.name === 'automate-tests'), 'sdet skills are medium+');
    assert.deepEqual(data.roles.map(r => r.name), ['builder', 'reviewer']);
    assert.ok(!data.structure.some(s => s.path === 'qa/'));
    assert.ok(data.docs.some(d => d.path === 'docs/architecture.md' && d.status === 'NOT_STARTED'));
  });

  test('skills split into ones you run (/name) and ones the agent can pick up', () => {
    const out = renderDiscover(templateRoot, 'skills');
    assert.match(out, /Skills you run \(\d+\)/);
    assert.match(out, /\/grill-with-docs/);
    assert.match(out, /Skills the agent also picks up on its own/);
  });

  test('search filters and detail views show one item', () => {
    const out = renderDiscover(templateRoot, 'skills', { search: 'flaky' });
    assert.match(out, /fix-flaky-tests/);
    assert.doesNotMatch(out, /grill-with-docs/);
    assert.match(renderItem(templateRoot, 'role', 'sdet'), /^sdet {2}\(read-write\)/);
    assert.match(renderItem(templateRoot, 'workflow', 'quality'), /File: \.agents\/workflows\/quality\.md/);
    assert.throws(() => renderItem(templateRoot, 'skill', 'flaky'), /Did you mean: fix-flaky-tests/);
  });

  test('cli: --help-discover-* flags, discover <name>, and unknown names', () => {
    assert.match(run(['--help-discover-skillset']), /Skills you run/);
    assert.match(run(['--help-discover-workflow']), /Workflows \(\d+\)/);
    assert.match(run(['--help-discover-role']), /Roles \(5\)/);
    assert.match(run(['--help-discover-skill', 'tdd']), /^tdd {2}\(you or the agent\)/);
    assert.match(run(['discover', 'report-bug']), /File: \.agents\/skills\/report-bug\/SKILL\.md/);
    assert.match(run(['--help-discover']), /Main flow/);
    assert.throws(() => run(['discover', 'nope']), /Command failed/);
  });
});

describe('short command', () => {
  test('package exposes engr', async () => {
    const pkg = JSON.parse((await import('node:fs')).readFileSync(path.join(templateRoot, 'package.json'), 'utf8'));
    assert.equal(pkg.bin.engr, './bin/cli.mjs');
  });

  test('a global copy delegates to the project .ai/cli copy, except init', async () => {
    const fs = await import('node:fs');
    const project = tempDir();
    fs.mkdirSync(path.join(project, '.ai/cli/bin'), { recursive: true });
    fs.writeFileSync(path.join(project, '.ai/cli/bin/cli.mjs'), 'console.log("PINNED", process.argv.slice(2).join(" "))\n');
    assert.match(run(['status'], project), /^PINNED status/);
    assert.match(run(['discover', 'skills'], project), /^PINNED discover skills/);
    const out = run(['init', '--yes', '--size', 'small', '--tools', 'claude'], project);
    assert.match(out, /file\(s\) written/, 'init runs from the global copy');
  });

  test('the template repository itself is never delegated', () => {
    assert.match(run(['status']), /No tickets yet/);
  });
});
