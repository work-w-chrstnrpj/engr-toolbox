import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { templateRoot, tempDir } from './helpers.mjs';
import { loadConfig, resolveTier, listSkills, listRoles } from '../lib/config.mjs';
import { installAssets } from '../lib/install.mjs';
import { generateAdapters, PROVIDERS } from '../lib/generator.mjs';
import { validateTemplate } from '../lib/validator.mjs';

const cli = path.join(templateRoot, 'bin', 'cli.mjs');

describe('tiers', () => {
  const config = loadConfig(templateRoot);

  test('every tier only lists skills, roles, workflows, tools, playbooks and scaffold that exist', () => {
    for (const name of Object.keys(config.tiers)) {
      const tier = resolveTier(config, name);
      for (const s of tier.skills) assert.ok(fs.existsSync(path.join(templateRoot, '.agents/skills', s, 'SKILL.md')), `${name}: skill ${s}`);
      for (const r of tier.roles) assert.ok(fs.existsSync(path.join(templateRoot, '.agents/roles', `${r}.md`)), `${name}: role ${r}`);
      for (const w of tier.workflows) assert.ok(fs.existsSync(path.join(templateRoot, '.agents/workflows', `${w}.md`)), `${name}: workflow ${w}`);
      for (const t of tier.tools) assert.ok(fs.existsSync(path.join(templateRoot, '.agents/tools', `${t}.md`)), `${name}: tool ${t}`);
      for (const p of tier.playbooks) assert.ok(fs.existsSync(path.join(templateRoot, '.agents/roles/playbooks', p)), `${name}: playbook ${p}`);
      for (const f of tier.scaffold) assert.ok(fs.existsSync(path.join(templateRoot, 'template', f)), `${name}: scaffold ${f}`);
    }
  });

  test('tiers grow: small ⊂ medium ⊂ large', () => {
    const [s, m, l] = ['small', 'medium', 'large'].map(t => resolveTier(config, t));
    for (const x of s.skills) assert.ok(m.skills.includes(x));
    for (const x of m.skills) assert.ok(l.skills.includes(x));
    assert.ok(s.skills.length < m.skills.length && m.skills.length < l.skills.length);
  });

  test('the large tier ships every canonical skill', () => {
    const large = resolveTier(config, 'large');
    for (const s of listSkills(templateRoot)) assert.ok(large.skills.includes(s.name), `large tier missing ${s.name}`);
  });

  test('unknown tier is rejected', () => {
    assert.throws(() => resolveTier(config, 'huge'), /Unknown size/);
  });
});

describe('install', () => {
  test('small existing install copies only the small tier and stays valid', () => {
    const target = tempDir();
    fs.writeFileSync(path.join(target, 'README.md'), 'existing project');
    installAssets({ templateRoot, targetDir: target, size: 'small', mode: 'existing', tools: ['claude'], tracker: 'local' });

    assert.ok(fs.existsSync(path.join(target, '.agents/skills/implement/SKILL.md')));
    assert.ok(!fs.existsSync(path.join(target, '.agents/skills/ingest')), 'ingest is medium+');
    assert.ok(!fs.existsSync(path.join(target, 'docs/inputs')), 'inputs are medium+');
    assert.ok(!fs.existsSync(path.join(target, 'qa')), 'qa layer is medium+');
    assert.ok(!fs.existsSync(path.join(target, '.agents/roles/sdet.md')), 'sdet is medium+');
    assert.ok(!fs.existsSync(path.join(target, 'application')), 'no new-project folders in existing mode');
    assert.ok(fs.existsSync(path.join(target, 'GLOSSARY.md')));
    assert.ok(fs.existsSync(path.join(target, '.ai/cli/bin/cli.mjs')), 'CLI copied into project');
    assert.ok(fs.existsSync(path.join(target, '.claude/agents/builder.md')));
    assert.ok(fs.existsSync(path.join(target, '.claude/skills/tdd/SKILL.md')));
    assert.equal(fs.readFileSync(path.join(target, 'README.md'), 'utf8'), 'existing project');

    const record = JSON.parse(fs.readFileSync(path.join(target, 'engr-toolbox.json'), 'utf8'));
    assert.equal(record.size, 'small');
    assert.deepEqual(record.tools, ['claude']);

    const v = validateTemplate(target);
    assert.equal(v.errors.length, 0, v.errors.join('; '));
  });

  test('medium new install adds team layer and new-project folders; tracker is recorded', () => {
    const target = tempDir();
    installAssets({ templateRoot, targetDir: target, size: 'medium', mode: 'new', tools: ['cursor', 'copilot'], tracker: 'github' });
    for (const p of ['qa/README.md', 'qa/_templates/test-plan.md', '.agents/roles/sdet.md', '.agents/skills/automate-tests/SKILL.md', '.cursor/rules/sdet.mdc', 'docs/inputs/INDEX.md', 'docs/design/_templates/erd.md', '.ai/maps/api-map.md', '.agents/roles/architect.md', 'application/README.md', '.cursor/rules/project.mdc', '.github/agents/reviewer.agent.md']) {
      assert.ok(fs.existsSync(path.join(target, p)), p);
    }
    assert.match(fs.readFileSync(path.join(target, 'docs/agents/issue-tracker.md'), 'utf8'), /\*\*Tracker:\*\* github/);
  });

  test('re-running install keeps project-owned files and updates managed ones', () => {
    const target = tempDir();
    installAssets({ templateRoot, targetDir: target, size: 'small', tools: ['claude'] });
    fs.writeFileSync(path.join(target, 'GLOSSARY.md'), 'my glossary');
    const skill = path.join(target, '.agents/skills/tdd/SKILL.md');
    fs.writeFileSync(skill, fs.readFileSync(skill, 'utf8') + '\nstale edit\n');
    const owned = path.join(target, '.agents/skills/next/SKILL.md');
    fs.writeFileSync(owned, fs.readFileSync(owned, 'utf8').split('\n').filter(l => !l.includes('Generated by engr-toolbox')).join('\n') + '\nmine\n');

    installAssets({ templateRoot, targetDir: target, size: 'small', tools: ['claude'] });
    assert.equal(fs.readFileSync(path.join(target, 'GLOSSARY.md'), 'utf8'), 'my glossary');
    assert.ok(!fs.readFileSync(skill, 'utf8').includes('stale edit'), 'managed skill updated');
    assert.ok(fs.readFileSync(owned, 'utf8').includes('mine'), 'header removed = owned, kept');
  });

  test('dry run writes nothing', () => {
    const target = path.join(tempDir(), 'nothing');
    installAssets({ templateRoot, targetDir: target, size: 'large', tools: ['claude'], dryRun: true });
    assert.ok(!fs.existsSync(target));
  });

  test('rejects unknown tools and trackers', () => {
    const target = tempDir();
    assert.throws(() => installAssets({ templateRoot, targetDir: target, tools: ['notepad'] }), /Unknown tool/);
    assert.throws(() => installAssets({ templateRoot, targetDir: target, tracker: 'jira-sync' }), /Unknown tracker/);
  });
});

describe('adapters', () => {
  test('every provider generates from the project .agents/ without errors', () => {
    const target = tempDir();
    installAssets({ templateRoot, targetDir: target, size: 'medium', tools: [] });
    for (const provider of PROVIDERS) {
      const { results } = generateAdapters({ sourceRoot: target, provider });
      assert.ok(results.length > 0, provider);
    }
    assert.ok(fs.existsSync(path.join(target, '.windsurf/workflows/main-flow.md')));
    assert.ok(fs.existsSync(path.join(target, 'kilo.jsonc')));
    assert.ok(fs.existsSync(path.join(target, '.openhands/microagents/repo.md')));
  });

  test('read-only roles get no edit tools', () => {
    const target = tempDir();
    installAssets({ templateRoot, targetDir: target, size: 'small', tools: ['claude', 'opencode', 'codex'] });
    const claude = fs.readFileSync(path.join(target, '.claude/agents/reviewer.md'), 'utf8');
    assert.ok(!/- Edit/.test(claude));
    assert.match(fs.readFileSync(path.join(target, '.claude/agents/builder.md'), 'utf8'), /- Edit/);
    assert.match(fs.readFileSync(path.join(target, '.opencode/agents/reviewer.md'), 'utf8'), /edit: deny/);
    assert.match(fs.readFileSync(path.join(target, '.codex/agents/reviewer.toml'), 'utf8'), /sandbox_mode = "read-only"/);
  });

  test('cursor rules never use wildcard globs', () => {
    const target = tempDir();
    installAssets({ templateRoot, targetDir: target, size: 'large', tools: ['cursor'] });
    for (const f of fs.readdirSync(path.join(target, '.cursor/rules'))) {
      assert.ok(!fs.readFileSync(path.join(target, '.cursor/rules', f), 'utf8').includes('globs:'), f);
    }
  });

  test('clean removes stale managed skills; Codex metadata is not copied to other tools', () => {
    const target = tempDir();
    installAssets({ templateRoot, targetDir: target, size: 'medium', tools: ['claude'] });
    assert.ok(!fs.existsSync(path.join(target, '.claude/skills/generate-rca/agents')));
    fs.rmSync(path.join(target, '.agents/skills/prototype'), { recursive: true });
    const { results } = generateAdapters({ sourceRoot: target, provider: 'claude', clean: true });
    assert.ok(results.some(r => r.status === 'removed_stale' && r.path.endsWith('prototype')));
  });

  test('this repository has no adapter drift (sync --check)', () => {
    execFileSync('node', [cli, 'sync', '--check'], { cwd: templateRoot, stdio: 'pipe' });
  });
});

describe('cli', () => {
  test('init --yes installs into --into and the copied CLI runs status there', () => {
    const target = tempDir();
    execFileSync('node', [cli, 'init', '--yes', '--into', target, '--size', 'small', '--tools', 'claude', '--mode', 'new'], { stdio: 'pipe' });
    const out = execFileSync('node', [path.join(target, '.ai/cli/bin/cli.mjs'), 'status'], { cwd: target, encoding: 'utf8' });
    assert.match(out, /No tickets yet/);
  });

  test('provider shorthand still works', () => {
    const target = tempDir();
    execFileSync('node', [cli, 'codex', '--into', target, '--size', 'small'], { stdio: 'pipe' });
    assert.ok(fs.existsSync(path.join(target, '.codex/agents/builder.toml')));
  });

  test('the copied CLI refuses init without the template payload', () => {
    const target = tempDir();
    execFileSync('node', [cli, 'init', '--yes', '--into', target, '--size', 'small', '--tools', 'claude'], { stdio: 'pipe' });
    assert.throws(
      () => execFileSync('node', [path.join(target, '.ai/cli/bin/cli.mjs'), 'init', '--yes'], { cwd: target, stdio: 'pipe' }),
      /no template payload|Command failed/
    );
  });

  test('package exposes a bin matching its name, so npx github: runs it', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(templateRoot, 'package.json'), 'utf8'));
    assert.equal(pkg.bin[pkg.name], './bin/cli.mjs');
    for (const f of pkg.files) assert.ok(fs.existsSync(path.join(templateRoot, f)), `files entry ${f} exists`);
  });

  test('roles are the five ticket owners', () => {
    assert.deepEqual(listRoles(templateRoot).map(r => r.name), ['architect', 'builder', 'qa', 'reviewer', 'sdet']);
  });
});
