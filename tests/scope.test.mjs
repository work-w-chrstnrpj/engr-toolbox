import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { templateRoot, tempDir, write } from './helpers.mjs';
import { installAssets } from '../lib/install.mjs';
import { generateAdapters, uninstallGlobal } from '../lib/generator.mjs';
import { validateTemplate } from '../lib/validator.mjs';
import { collect } from '../lib/discover.mjs';
import { toGlobalPaths } from '../lib/scope.mjs';

const cli = path.join(templateRoot, 'bin', 'cli.mjs');

describe('global scope', () => {
  let home;
  let saved;
  before(() => {
    saved = process.env.ENGR_HOME;
    home = tempDir('engr-home-');
    process.env.ENGR_HOME = home;
  });
  after(() => {
    if (saved === undefined) delete process.env.ENGR_HOME;
    else process.env.ENGR_HOME = saved;
  });

  test('shared assets go to the home folder; project-specific files stay in the project', () => {
    const project = tempDir();
    const out = installAssets({ templateRoot, targetDir: project, size: 'medium', tools: ['claude', 'codex', 'cline'], scope: 'global' });

    for (const p of ['.engr-toolbox/.agents/skills/tdd/SKILL.md', '.engr-toolbox/.agents/roles/sdet.md', '.claude/skills/tdd/SKILL.md', '.claude/agents/sdet.md', '.agents/skills/test-plan/SKILL.md', '.codex/agents/reviewer.toml']) {
      assert.ok(fs.existsSync(path.join(home, p)), `global ${p}`);
    }
    assert.ok(!fs.existsSync(path.join(project, '.agents')), 'no .agents/ in the project');
    assert.ok(!fs.existsSync(path.join(project, '.claude/skills')), 'no project skill copies');
    for (const p of ['AGENTS.md', 'GLOSSARY.md', 'qa/README.md', 'tickets/README.md', 'docs/adr/README.md', '.ai/cli/bin/cli.mjs', 'CLAUDE.md']) {
      assert.ok(fs.existsSync(path.join(project, p)), `project ${p}`);
    }
    assert.match(fs.readFileSync(path.join(project, 'CLAUDE.md'), 'utf8'), /installed globally/);
    assert.ok(out.results.some(r => r.status === 'project_fallback'), 'cline has no user folder: falls back');
    assert.ok(fs.existsSync(path.join(project, '.clinerules/project.md')));
    assert.equal(JSON.parse(fs.readFileSync(path.join(project, 'engr-toolbox.json'), 'utf8')).scope, 'global');
  });

  test('global copies point at the global canonical folder', () => {
    const role = fs.readFileSync(path.join(home, '.engr-toolbox/.agents/roles/sdet.md'), 'utf8');
    assert.match(role, /~\/\.engr-toolbox\/\.agents\/roles\/playbooks\/sdet\/sdet\.md/);
    assert.doesNotMatch(role, /[\s`]\.agents\/roles\/playbooks/);
    assert.equal(toGlobalPaths('see `.agents/skills/x` and docs/.agents-not'), 'see `~/.engr-toolbox/.agents/skills/x` and docs/.agents-not');
  });

  test('never overwrites a skill another pack installed with the same name', () => {
    const theirs = path.join(home, '.claude/skills/grilling/SKILL.md');
    fs.mkdirSync(path.dirname(theirs), { recursive: true });
    fs.rmSync(path.dirname(theirs), { recursive: true, force: true });
    write(home, '.claude/skills/grilling/SKILL.md', '---\nname: grilling\ndescription: someone else\n---\nTheirs');
    const project = tempDir();
    const out = installAssets({ templateRoot, targetDir: project, size: 'small', tools: ['claude'], scope: 'global' });
    assert.equal(fs.readFileSync(theirs, 'utf8').endsWith('Theirs'), true);
    assert.ok(out.results.some(r => r.status === 'skipped_user_file' && r.path === theirs));
  });

  test('validate, discover and sync follow the recorded scope', () => {
    const project = tempDir();
    installAssets({ templateRoot, targetDir: project, size: 'medium', tools: ['claude'], scope: 'global' });
    assert.equal(validateTemplate(project).errors.length, 0, validateTemplate(project).errors.join('; '));
    const data = collect(project);
    assert.ok(data.skills.some(s => s.name === 'automate-tests'));
    assert.ok(data.structure[0].path.startsWith('~/.engr-toolbox'));
    const env = { ...process.env, ENGR_HOME: home, ENGR_NO_DELEGATE: '1' };
    execFileSync('node', [cli, 'sync', '--check'], { cwd: project, env, stdio: 'pipe' });
  });

  test('uninstall removes only files this tool wrote', () => {
    const results = uninstallGlobal({ tools: ['claude', 'codex'] });
    assert.ok(results.some(r => r.status === 'removed'));
    assert.ok(!fs.existsSync(path.join(home, '.claude/skills/tdd')));
    assert.ok(!fs.existsSync(path.join(home, '.engr-toolbox')));
    assert.ok(fs.existsSync(path.join(home, '.claude/skills/grilling/SKILL.md')), 'the other pack stays');
  });

  test('project scope stays the default', () => {
    const project = tempDir();
    installAssets({ templateRoot, targetDir: project, size: 'small', tools: ['claude'] });
    assert.ok(fs.existsSync(path.join(project, '.agents/skills/tdd/SKILL.md')));
    assert.ok(fs.existsSync(path.join(project, '.claude/skills/tdd/SKILL.md')));
    assert.ok(!fs.existsSync(path.join(home, '.engr-toolbox')));
  });

  test('cli: init --scope global then uninstall', () => {
    const project = tempDir();
    const env = { ...process.env, ENGR_HOME: home };
    const out = execFileSync('node', [cli, 'init', '--yes', '--into', project, '--size', 'small', '--tools', 'claude', '--scope', 'global'], { env, encoding: 'utf8' });
    assert.match(out, /scope=global/);
    assert.match(out, /installed for your user/);
    assert.ok(fs.existsSync(path.join(home, '.claude/agents/builder.md')));
    execFileSync('node', [cli, 'uninstall', '--scope', 'global'], { env, cwd: project, stdio: 'pipe' });
    assert.ok(!fs.existsSync(path.join(home, '.claude/agents/builder.md')));
  });
});
