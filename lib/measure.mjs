import fs from 'node:fs';
import path from 'node:path';
import { loadConfig, resolveTier, parseSkillMetadata, parseRoleMetadata } from './config.mjs';

/** About four characters per token for Markdown and source. */
export function estimateTokens(text) {
  return text ? Math.ceil(text.length / 4) : 0;
}

function sizeOf(file) {
  const content = fs.readFileSync(file, 'utf8');
  return { lines: content.split('\n').length, tokens: estimateTokens(content) };
}

/**
 * Startup cost = what an agent sees before choosing work: AGENTS.md plus every skill and role description.
 * On-demand cost = full skill and role bodies, loaded only when used.
 */
export function measureTokens(rootDir) {
  const config = loadConfig(rootDir);
  const report = { roles: {}, skills: {}, playbooks: {}, tiers: {} };

  const rolesDir = path.join(rootDir, '.agents', 'roles');
  for (const f of fs.readdirSync(rolesDir).filter(x => x.endsWith('.md') && x !== 'README.md')) {
    const meta = parseRoleMetadata(path.join(rolesDir, f));
    report.roles[meta.name] = { ...sizeOf(path.join(rolesDir, f)), descriptionTokens: estimateTokens(meta.description) };
  }

  const skillsDir = path.join(rootDir, '.agents', 'skills');
  for (const d of fs.readdirSync(skillsDir, { withFileTypes: true }).filter(x => x.isDirectory())) {
    const meta = parseSkillMetadata(path.join(skillsDir, d.name));
    report.skills[meta.name] = { ...sizeOf(path.join(skillsDir, d.name, 'SKILL.md')), descriptionTokens: estimateTokens(meta.description) };
  }

  const pbDir = path.join(rolesDir, 'playbooks');
  if (fs.existsSync(pbDir)) {
    for (const cat of fs.readdirSync(pbDir, { withFileTypes: true }).filter(x => x.isDirectory())) {
      report.playbooks[cat.name] = {};
      for (const f of fs.readdirSync(path.join(pbDir, cat.name)).filter(x => x.endsWith('.md'))) {
        report.playbooks[cat.name][f] = sizeOf(path.join(pbDir, cat.name, f));
      }
    }
  }

  const agentsTemplate = path.join(rootDir, 'template', 'AGENTS.md');
  const agentsTokens = fs.existsSync(agentsTemplate) ? sizeOf(agentsTemplate).tokens : 0;
  for (const name of Object.keys(config.tiers)) {
    const tier = resolveTier(config, name);
    const skills = tier.skills.map(s => report.skills[s]).filter(Boolean);
    const roles = tier.roles.map(r => report.roles[r]).filter(Boolean);
    report.tiers[name] = {
      roles: roles.length,
      skills: skills.length,
      startupTokens: agentsTokens + [...skills, ...roles].reduce((n, x) => n + x.descriptionTokens, 0),
      onDemandTokens: [...skills, ...roles].reduce((n, x) => n + x.tokens, 0)
    };
  }
  return report;
}

export function formatMeasureReport(report) {
  const row = (a, b, c, d = '') => `${String(a).padEnd(32)}${String(b).padStart(8)}${String(c).padStart(12)}${String(d).padStart(14)}`;
  const lines = ['', '=== Token budget ===', ''];
  lines.push('Tiers (startup = AGENTS.md + skill/role descriptions; on-demand = full bodies)');
  lines.push(row('Tier', 'Skills', 'Startup', 'On-demand'));
  for (const [name, t] of Object.entries(report.tiers)) lines.push(row(`${name} (${t.roles} roles)`, t.skills, t.startupTokens, t.onDemandTokens));
  lines.push('', 'Roles');
  lines.push(row('Role', 'Lines', 'Tokens'));
  for (const [name, r] of Object.entries(report.roles)) lines.push(row(name, r.lines, r.tokens));
  lines.push('', 'Largest skills');
  lines.push(row('Skill', 'Lines', 'Tokens'));
  for (const [name, s] of Object.entries(report.skills).sort((a, b) => b[1].tokens - a[1].tokens).slice(0, 8)) lines.push(row(name, s.lines, s.tokens));
  lines.push('', 'Playbooks (loaded only when a ticket needs them)');
  for (const [cat, files] of Object.entries(report.playbooks)) {
    const total = Object.values(files).reduce((n, f) => n + f.tokens, 0);
    lines.push(row(cat, Object.keys(files).length + ' file(s)', total));
  }
  lines.push('');
  return lines.join('\n');
}
