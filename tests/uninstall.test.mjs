import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { installAssets } from '../lib/install.mjs';
import { uninstallProject } from '../lib/uninstall.mjs';
import { templateRoot, tempDir, write, gitInit } from './helpers.mjs';

const cli = path.join(templateRoot, 'bin', 'cli.mjs');
const exists = (root, rel) => fs.existsSync(path.join(root, rel));

function installed() {
  const project = tempDir();
  gitInit(project);
  write(project, 'src/app.js', 'console.log(1);\n');
  installAssets({ templateRoot, targetDir: project, size: 'small', tools: ['claude', 'cursor'] });
  return project;
}

describe('uninstall --scope project', () => {
  test('removes what the tool wrote and keeps project-owned files', () => {
    const project = installed();
    assert.ok(exists(project, '.agents'));
    assert.ok(exists(project, 'engr-toolbox.json'));
    assert.ok(exists(project, 'AGENTS.md'));

    const results = uninstallProject(project);
    assert.ok(results.some(r => r.status === 'removed'));
    for (const gone of ['.agents', '.ai/cli', '.claude/skills', '.cursor', 'engr-toolbox.json', 'CLAUDE.md', '.git/hooks/commit-msg']) {
      assert.ok(!exists(project, gone), `${gone} should be removed`);
    }
    for (const kept of ['AGENTS.md', 'GLOSSARY.md', 'src/app.js']) {
      assert.ok(exists(project, kept), `${kept} should stay`);
    }
  });

  test('dry run changes nothing', () => {
    const project = installed();
    const results = uninstallProject(project, { dryRun: true });
    assert.ok(results.some(r => r.status === 'removed'));
    assert.ok(exists(project, '.agents'));
    assert.ok(exists(project, 'engr-toolbox.json'));
  });

  test('keeps a file the user took ownership of and our neighbours in settings.json', () => {
    const project = installed();
    const owned = path.join(project, '.claude/skills/tdd/SKILL.md');
    fs.writeFileSync(owned, '# my own tdd\n');
    const settingsPath = path.join(project, '.claude/settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    settings.permissions = { allow: ['Bash(ls)'] };
    fs.writeFileSync(settingsPath, JSON.stringify(settings));

    uninstallProject(project);
    assert.equal(fs.readFileSync(owned, 'utf8'), '# my own tdd\n');
    const after = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    assert.deepEqual(after.permissions, { allow: ['Bash(ls)'] });
    assert.equal(after.hooks, undefined);
  });

  test('leaves a commit-msg hook it did not write', () => {
    const project = installed();
    const hook = path.join(project, '.git/hooks/commit-msg');
    fs.writeFileSync(hook, '#!/bin/sh\necho mine\n');
    uninstallProject(project);
    assert.ok(fs.existsSync(hook));
  });

  test('cli: refuses the toolbox source repository', () => {
    assert.throws(
      () => execFileSync('node', [cli, 'uninstall', '--scope', 'project', '--into', templateRoot], { stdio: 'pipe' }),
      /source repository/
    );
    assert.ok(fs.existsSync(path.join(templateRoot, '.agents')));
  });

  test('cli: init then uninstall --scope project', () => {
    const project = tempDir();
    gitInit(project);
    execFileSync('node', [cli, 'init', '--yes', '--into', project, '--size', 'small', '--tools', 'claude'], { stdio: 'pipe', env: { ...process.env, ENGR_NO_DELEGATE: '1' } });
    assert.ok(exists(project, 'engr-toolbox.json'));
    const out = execFileSync('node', [cli, 'uninstall', '--scope', 'project', '--into', project], { encoding: 'utf8' });
    assert.match(out, /Removed \d+ file/);
    assert.ok(!exists(project, 'engr-toolbox.json'));
    assert.ok(exists(project, 'AGENTS.md'));
  });
});
