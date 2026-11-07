import fs from 'node:fs';
import path from 'node:path';
import { loadContextRules, listSkills, parseFrontmatter } from './config.mjs';
import { loadTickets, validateTickets } from './tickets.mjs';
import { missingMapPaths } from './drift.mjs';
import { canonicalRoot } from './scope.mjs';

const SKILL_CALL = /[Cc]all the Skill tool (?:twice, )?(?:with|for) ((?:[`"][a-z0-9-]+[`"])(?:\s*(?:,|and)\s*[`"][a-z0-9-]+[`"])*)/g;

function checkRoles(root, report) {
  const dir = path.join(root, '.agents', 'roles');
  if (!fs.existsSync(dir)) {
    report.errors.push('Missing .agents/roles directory');
    return;
  }
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.md') && x !== 'README.md')) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const rel = `.agents/roles/${f}`;
    const before = report.errors.length;
    if (!/^- \*\*Name:\*\*\s*\S/m.test(content)) report.errors.push(`${rel}: missing '- **Name:**'`);
    if (!/^- \*\*Description:\*\*\s*\S/m.test(content)) report.errors.push(`${rel}: missing '- **Description:**'`);
    const access = content.match(/^- \*\*Access:\*\*\s*(\S+)/m);
    if (access && !['read-only', 'read-write'].includes(access[1])) report.errors.push(`${rel}: Access must be read-only or read-write`);
    if (!/^## Skills/m.test(content)) report.errors.push(`${rel}: missing '## Skills' section`);
    if (report.errors.length === before) report.passed.push(`${rel}: valid`);
  }
}

function checkSkills(root, report) {
  const dir = path.join(root, '.agents', 'skills');
  if (!fs.existsSync(dir)) {
    report.errors.push('Missing .agents/skills directory');
    return;
  }
  for (const d of fs.readdirSync(dir, { withFileTypes: true }).filter(x => x.isDirectory())) {
    const file = path.join(dir, d.name, 'SKILL.md');
    const rel = `.agents/skills/${d.name}/SKILL.md`;
    if (!fs.existsSync(file)) {
      report.errors.push(`.agents/skills/${d.name}: missing SKILL.md`);
      continue;
    }
    const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    if (!fm) report.errors.push(`${rel}: missing frontmatter`);
    else if (!fm.name) report.errors.push(`${rel}: frontmatter missing name`);
    else if (!fm.description) report.errors.push(`${rel}: frontmatter missing description`);
    else if (fm.name !== d.name) report.errors.push(`${rel}: name '${fm.name}' does not match folder '${d.name}'`);
    else report.passed.push(`${rel}: valid frontmatter`);
  }

  // Skills may only call model-invoked skills that exist.
  let skills = [];
  try {
    skills = listSkills(root);
  } catch {
    return;
  }
  const byName = new Map(skills.map(s => [s.name, s]));
  for (const s of skills) {
    for (const m of s.content.matchAll(SKILL_CALL)) {
      for (const name of [...m[1].matchAll(/`([a-z0-9-]+)`|"([a-z0-9-]+)"/g)].map(x => x[1] || x[2])) {
        const target = byName.get(name);
        if (!target) report.errors.push(`.agents/skills/${s.name}: calls unknown skill '${name}'`);
        else if (target.userInvoked) report.errors.push(`.agents/skills/${s.name}: calls user-invoked skill '${name}' (only model-invoked skills can be called)`);
      }
    }
  }
}

function checkAdrs(root, report) {
  const dir = path.join(root, 'docs', 'adr');
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => /^\d{4}-.+\.md$/.test(f) && !f.startsWith('0000-'));
  const numbers = new Set(files.map(f => f.slice(0, 4)));
  for (const f of files) {
    const content = fs.readFileSync(path.join(dir, f), 'utf8');
    const rel = `docs/adr/${f}`;
    const status = content.match(/^\*{0,2}Status:\*{0,2}\s*(.+)$/mi);
    if (!status) {
      report.errors.push(`${rel}: missing Status line`);
      continue;
    }
    const refs = [...content.matchAll(/(?:Superseded by|Supersedes:?)\s*\**\s*ADR-(\d{4})/gi)].map(m => m[1]);
    for (const n of refs) {
      if (!numbers.has(n)) report.errors.push(`${rel}: references ADR-${n}, which does not exist`);
    }
    report.passed.push(`${rel}: valid`);
  }
}

function checkMaps(root, report) {
  for (const e of missingMapPaths(root)) {
    report.errors.push(`${e.map}:${e.line}: '${e.name}' points at missing path '${e.path}'`);
  }
}

function checkTicketsDir(root, report) {
  let tickets;
  try {
    tickets = loadTickets(root);
  } catch (error) {
    report.errors.push(`tickets: ${error.message}`);
    return;
  }
  const { errors, warnings } = validateTickets(tickets);
  report.errors.push(...errors);
  report.warnings.push(...warnings);
  if (tickets.length) report.passed.push(`tickets: ${tickets.length} parsed`);
}

function checkContext(root, task, report) {
  const rules = loadContextRules(root);
  if (!rules) return;
  for (const rule of rules.requiredCore || []) {
    const p = path.join(root, rule.file);
    if (!fs.existsSync(p)) {
      report.warnings.push(`Core doc missing: ${rule.file}`);
      continue;
    }
    const content = fs.readFileSync(p, 'utf8');
    for (const check of rule.checks || []) {
      const matches = new RegExp(check.pattern).test(content);
      if (check.invert ? matches : !matches) report.warnings.push(`[Context] ${rule.file}: ${check.message}`);
    }
  }
  if (!task) return;
  const cond = (rules.conditionalTasks || {})[task];
  if (!cond) {
    report.errors.push(`Unknown task '${task}'. Available: ${Object.keys(rules.conditionalTasks || {}).join(', ')}`);
    return;
  }
  const p = path.join(root, cond.file);
  if (!fs.existsSync(p)) {
    report.errors.push(`[Task Blocked] '${task}' needs ${cond.name} at ${cond.file}, which is missing.`);
    return;
  }
  const content = fs.readFileSync(p, 'utf8');
  if (/Status: NOT_STARTED|\[State the|\[Project Name\]/.test(content)) {
    report.errors.push(`[Task Blocked] '${task}' needs ${cond.name} at ${cond.file}, which is NOT_STARTED or has placeholders.`);
  } else {
    report.passed.push(`Task context ready for '${task}': ${cond.file}`);
  }
}

export function validateTemplate(rootDir, options = {}) {
  const report = { errors: [], warnings: [], passed: [] };
  const canon = canonicalRoot(rootDir);
  checkRoles(canon, report);
  checkSkills(canon, report);
  checkAdrs(rootDir, report);
  checkMaps(rootDir, report);
  checkTicketsDir(rootDir, report);
  checkContext(rootDir, options.task || null, report);
  return { valid: report.errors.length === 0, ...report };
}
