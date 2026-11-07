import fs from 'node:fs';
import path from 'node:path';
import { GENERATOR_SIGNATURE, GENERATOR_NOTE, writeFileSafe, isManagedFile } from './safety.mjs';
import { loadInstall, INSTALL_FILE } from './config.mjs';
import { git } from './git.mjs';

export const PIPELINE_MODES = ['none', 'test', 'release'];
export const PROVIDERS_CI = ['github', 'gitlab', 'other'];
/** release = hosted release on the git host (GitHub or GitLab Release, includes the tag); tag = tag only. */
export const RELEASE_TARGETS = ['release', 'tag', 'npm', 'docker'];
const TARGET_ALIASES = { github: 'release', gitlab: 'release', 'github-release': 'release', 'gitlab-release': 'release', package: 'npm', image: 'docker' };
export const WORKFLOW_FILES = { checks: '.github/workflows/engr-checks.yml', release: '.github/workflows/engr-release.yml' };
export const GITLAB_FILE = '.gitlab-ci.yml';
const ALL_GENERATED = [WORKFLOW_FILES.checks, WORKFLOW_FILES.release, GITLAB_FILE];

/** Guess the CI provider from the git remote. */
export function detectProvider(root) {
  try {
    const cfg = fs.readFileSync(path.join(root, '.git', 'config'), 'utf8');
    if (/gitlab/i.test(cfg)) return 'gitlab';
  } catch { /* not a git repo */ }
  if (fs.existsSync(path.join(root, '.gitlab-ci.yml')) && !fs.existsSync(path.join(root, '.github'))) return 'gitlab';
  return 'github';
}
const CLI = 'node .ai/cli/bin/cli.mjs';

/** Guess the install command from lock files. */
export function detectInstall(root) {
  const has = f => fs.existsSync(path.join(root, f));
  if (has('pnpm-lock.yaml')) return 'corepack enable && pnpm install --frozen-lockfile';
  if (has('yarn.lock')) return 'corepack enable && yarn install --frozen-lockfile';
  if (has('package-lock.json')) return 'npm ci';
  if (has('package.json')) return 'npm install';
  return '';
}

export function defaultPipeline(root) {
  const install = loadInstall(root) || {};
  return {
    mode: 'none',
    provider: detectProvider(root),
    branches: { development: 'develop', main: 'main' },
    node: '22',
    install: detectInstall(root),
    test: install.checks || (fs.existsSync(path.join(root, 'package.json')) ? 'npm test' : ''),
    build: '',
    workflowChecks: true,
    custom: false,
    release: { targets: ['release'], versionFile: fs.existsSync(path.join(root, 'package.json')) ? 'package.json' : 'VERSION' }
  };
}

/** Merge saved settings over defaults and validate. */
export function resolvePipeline(root, overrides = {}) {
  const saved = loadInstall(root)?.pipeline || {};
  const base = defaultPipeline(root);
  const p = {
    ...base,
    ...saved,
    ...stripUndefined(overrides),
    branches: { ...base.branches, ...(saved.branches || {}), ...stripUndefined(overrides.branches || {}) },
    release: { ...base.release, ...(saved.release || {}), ...stripUndefined(overrides.release || {}) }
  };
  if (!PIPELINE_MODES.includes(p.mode)) throw new Error(`Unknown pipeline mode '${p.mode}'. Use: ${PIPELINE_MODES.join(', ')}`);
  if (!PROVIDERS_CI.includes(p.provider)) throw new Error(`Unknown CI provider '${p.provider}'. Use: ${PROVIDERS_CI.join(', ')} (other = /setup-pipeline writes the file by hand)`);
  p.release.targets = [...new Set(p.release.targets.map(t => TARGET_ALIASES[t] || t))];
  for (const t of p.release.targets) {
    if (!RELEASE_TARGETS.includes(t)) throw new Error(`Unknown release target '${t}'. Use: ${RELEASE_TARGETS.join(', ')}`);
  }
  if (!p.branches.main) throw new Error('The main branch name cannot be empty');
  if (['', 'none', null].includes(p.branches.development)) p.branches.development = null;
  if (p.mode === 'release' && !p.release.targets.length) throw new Error('Release mode needs at least one release target');
  return p;
}

function stripUndefined(o) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
}

export function savePipeline(root, pipeline) {
  const p = path.join(root, INSTALL_FILE);
  const record = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
  record.pipeline = pipeline;
  fs.writeFileSync(p, JSON.stringify(record, null, 2) + '\n', 'utf8');
  return p;
}

// ---------- YAML rendering ----------

const q = s => `'${String(s).replace(/'/g, "''")}'`;
const header = () => `# ${GENERATOR_SIGNATURE}. ${GENERATOR_NOTE}\n# Change it with /setup-pipeline or: ${CLI} pipeline --help  (settings in ${INSTALL_FILE})\n`;

function setupSteps(p, { npmRegistry = false } = {}) {
  const steps = [
    '      - uses: actions/checkout@v4',
    '        with:',
    '          fetch-depth: 0',
    '      - uses: actions/setup-node@v4',
    '        with:',
    `          node-version: ${q(p.node)}`
  ];
  if (npmRegistry) steps.push("          registry-url: 'https://registry.npmjs.org'");
  if (p.install) steps.push('      - name: Install', `        run: ${q(p.install)}`);
  return steps;
}

function testSteps(p, { scope }) {
  const steps = [];
  if (p.test) steps.push('      - name: Test', `        run: ${q(p.test)}`);
  if (p.build) steps.push('      - name: Build', `        run: ${q(p.build)}`);
  if (p.workflowChecks) {
    steps.push('      - name: Tickets, ADRs and map paths are valid', `        run: ${CLI} validate`);
    if (scope !== 'global') steps.push('      - name: AI tool files are up to date', `        run: ${CLI} sync --check`);
  }
  return steps;
}

export function renderChecks(p, { scope = 'project' } = {}) {
  const prBranches = [p.branches.development, p.branches.main].filter(Boolean);
  const lines = [
    header(),
    'name: engr checks',
    '',
    'on:',
    '  pull_request:',
    `    branches: [${prBranches.map(q).join(', ')}]`
  ];
  if (p.branches.development) lines.push('  push:', `    branches: [${q(p.branches.development)}]`);
  lines.push(
    '',
    'permissions:',
    '  contents: read',
    '',
    'jobs:',
    '  test:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    ...setupSteps(p),
    ...testSteps(p, { scope })
  );
  if (p.workflowChecks) {
    lines.push(
      '      - name: Every commit references a ticket',
      "        if: github.event_name == 'pull_request'",
      `        run: ${CLI} check-commits --range "origin/\${{ github.base_ref }}..HEAD"`
    );
  }
  return lines.join('\n') + '\n';
}

export function renderRelease(p, { scope = 'project' } = {}) {
  const t = new Set(p.release.targets);
  const exists = "steps.version.outputs.exists == 'false'";
  const lines = [
    header(),
    'name: engr release',
    '',
    'on:',
    '  push:',
    `    branches: [${q(p.branches.main)}]`,
    '  workflow_dispatch:',
    '',
    'permissions:',
    '  contents: write',
    ...(t.has('docker') ? ['  packages: write'] : []),
    '',
    'concurrency:',
    '  group: engr-release',
    '  cancel-in-progress: false',
    '',
    'jobs:',
    '  test:',
    '    runs-on: ubuntu-latest',
    '    steps:',
    ...setupSteps(p),
    ...testSteps(p, { scope }),
    '',
    '  release:',
    '    needs: test',
    '    runs-on: ubuntu-latest',
    '    steps:',
    ...setupSteps(p, { npmRegistry: t.has('npm') }),
    '      - name: Version',
    '        id: version',
    '        run: |',
    `          V=$(${CLI} release-version)`,
    '          echo "version=$V" >> "$GITHUB_OUTPUT"',
    '          if git rev-parse -q --verify "refs/tags/v$V" >/dev/null; then',
    '            echo "exists=true" >> "$GITHUB_OUTPUT"',
    '            echo "v$V is already released. Bump the version to release again."',
    '          else',
    '            echo "exists=false" >> "$GITHUB_OUTPUT"',
    '          fi',
    '      - name: Release notes',
    `        if: ${exists}`,
    `        run: ${CLI} release-notes --version "\${{ steps.version.outputs.version }}" > release-notes.md`
  ];
  if (p.build) lines.push('      - name: Build', `        if: ${exists}`, `        run: ${q(p.build)}`);
  if (t.has('tag') && !t.has('release')) {
    lines.push(
      '      - name: Tag',
      `        if: ${exists}`,
      '        run: |',
      '          git tag "v${{ steps.version.outputs.version }}"',
      '          git push origin "v${{ steps.version.outputs.version }}"'
    );
  }
  if (t.has('release')) {
    lines.push(
      '      - name: GitHub release',
      `        if: ${exists}`,
      '        env:',
      '          GH_TOKEN: ${{ github.token }}',
      '        run: gh release create "v${{ steps.version.outputs.version }}" --title "v${{ steps.version.outputs.version }}" --notes-file release-notes.md --target "${{ github.sha }}"'
    );
  }
  if (t.has('npm')) {
    lines.push(
      '      - name: Publish to npm',
      `        if: ${exists}`,
      '        env:',
      '          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}',
      '        run: npm publish --access public'
    );
  }
  if (t.has('docker')) {
    lines.push(
      '      - name: Log in to GitHub Container Registry',
      `        if: ${exists}`,
      '        uses: docker/login-action@v3',
      '        with:',
      '          registry: ghcr.io',
      '          username: ${{ github.actor }}',
      '          password: ${{ secrets.GITHUB_TOKEN }}',
      '      - name: Image name',
      `        if: ${exists}`,
      '        id: image',
      '        run: echo "name=ghcr.io/${GITHUB_REPOSITORY,,}" >> "$GITHUB_OUTPUT"',
      '      - name: Build and push image',
      `        if: ${exists}`,
      '        uses: docker/build-push-action@v6',
      '        with:',
      '          push: true',
      '          tags: ${{ steps.image.outputs.name }}:${{ steps.version.outputs.version }},${{ steps.image.outputs.name }}:latest'
    );
  }
  return lines.join('\n') + '\n';
}

// ---------- GitLab ----------

const dq = s => JSON.stringify(String(s));

export function renderGitlab(p, { scope = 'project' } = {}) {
  const t = new Set(p.release.targets);
  const dev = p.branches.development;
  const main = p.branches.main;
  const targets = [dev, main].filter(Boolean);
  const mrInto = `$CI_PIPELINE_SOURCE == "merge_request_event" && $CI_MERGE_REQUEST_TARGET_BRANCH_NAME =~ /^(${targets.map(b => b.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|')})$/`;
  const pushTo = b => `$CI_PIPELINE_SOURCE == "push" && $CI_COMMIT_BRANCH == ${dq(b)}`;
  const release = p.mode === 'release';
  const testRules = [`    - if: '${mrInto}'`];
  if (dev) testRules.push(`    - if: '${pushTo(dev)}'`);
  if (release) testRules.push(`    - if: '${pushTo(main)}'`, `    - if: '$CI_PIPELINE_SOURCE == "web"'`);
  const lines = [
    header(),
    `stages: [${release ? 'test, release' : 'test'}]`,
    '',
    'default:',
    `  image: node:${p.node}`,
    '',
    'variables:',
    '  GIT_DEPTH: "0"',
    '',
    'test:',
    '  stage: test',
    '  rules:',
    ...testRules,
    '  script:'
  ];
  if (p.install) lines.push(`    - ${p.install}`);
  if (p.test) lines.push(`    - ${p.test}`);
  if (p.build) lines.push(`    - ${p.build}`);
  if (p.workflowChecks) {
    lines.push(`    - ${CLI} validate`);
    if (scope !== 'global') lines.push(`    - ${CLI} sync --check`);
    lines.push(
      '',
      'commit-tickets:',
      '  stage: test',
      '  rules:',
      `    - if: '${mrInto}'`,
      '  script:',
      '    - git fetch origin "$CI_MERGE_REQUEST_TARGET_BRANCH_NAME"',
      `    - ${CLI} check-commits --range "origin/$CI_MERGE_REQUEST_TARGET_BRANCH_NAME..HEAD"`
    );
  }
  if (!release) return lines.join('\n') + '\n';

  const onMain = [`    - if: '${pushTo(main)}'`, `    - if: '$CI_PIPELINE_SOURCE == "web" && $CI_COMMIT_BRANCH == ${dq(main)}'`];
  lines.push(
    '',
    'release:',
    '  stage: release',
    '  needs: [test]',
    '  rules:',
    ...onMain,
    '  script:'
  );
  if (p.install) lines.push(`    - ${p.install}`);
  lines.push(
    `    - V=$(${CLI} release-version)`,
    '    - echo "RELEASE_VERSION=$V" > release.env',
    '    - |',
    '      if git ls-remote --exit-code --tags origin "refs/tags/v$V" >/dev/null; then',
    '        echo "v$V is already released. Bump the version to release again."',
    '        echo "RELEASE_NEW=false" >> release.env',
    '        exit 0',
    '      fi',
    '    - echo "RELEASE_NEW=true" >> release.env',
    `    - ${CLI} release-notes --version "$V" > release-notes.md`
  );
  if (p.build) lines.push(`    - ${p.build}`);
  if (t.has('release')) {
    lines.push(
      '    - >',
      '      curl --fail --request POST --header "JOB-TOKEN: $CI_JOB_TOKEN"',
      '      --data-urlencode "tag_name=v$V" --data-urlencode "ref=$CI_COMMIT_SHA" --data-urlencode "name=v$V"',
      '      --data-urlencode "description@release-notes.md"',
      '      "$CI_API_V4_URL/projects/$CI_PROJECT_ID/releases"'
    );
  } else if (t.has('tag')) {
    lines.push(
      '    - >',
      '      curl --fail --request POST --header "PRIVATE-TOKEN: $RELEASE_TOKEN"',
      '      --data-urlencode "tag_name=v$V" --data-urlencode "ref=$CI_COMMIT_SHA"',
      '      "$CI_API_V4_URL/projects/$CI_PROJECT_ID/repository/tags"'
    );
  }
  if (t.has('npm')) {
    lines.push(
      '    - echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > ~/.npmrc',
      '    - npm publish --access public'
    );
  }
  lines.push('  artifacts:', '    reports:', '      dotenv: release.env');
  if (t.has('docker')) {
    lines.push(
      '',
      'docker-image:',
      '  stage: release',
      '  needs: [release]',
      '  image: docker:27',
      "  services: ['docker:27-dind']",
      '  rules:',
      ...onMain,
      '  script:',
      '    - if [ "$RELEASE_NEW" != "true" ]; then echo "No new version, skipping image"; exit 0; fi',
      '    - echo "$CI_REGISTRY_PASSWORD" | docker login -u "$CI_REGISTRY_USER" --password-stdin "$CI_REGISTRY"',
      '    - docker build -t "$CI_REGISTRY_IMAGE:$RELEASE_VERSION" -t "$CI_REGISTRY_IMAGE:latest" .',
      '    - docker push "$CI_REGISTRY_IMAGE:$RELEASE_VERSION"',
      '    - docker push "$CI_REGISTRY_IMAGE:latest"'
    );
  }
  return lines.join('\n') + '\n';
}

export function renderPipeline(p, opts = {}) {
  const files = {};
  if (p.mode === 'none' || p.provider === 'other') return files;
  if (p.provider === 'gitlab') {
    files[GITLAB_FILE] = renderGitlab(p, opts);
    return files;
  }
  files[WORKFLOW_FILES.checks] = renderChecks(p, opts);
  if (p.mode === 'release') files[WORKFLOW_FILES.release] = renderRelease(p, opts);
  return files;
}

/** Write (or with dryRun, compare) the generated workflows. Managed files no longer wanted are removed. */
export function writePipeline(root, p, { dryRun = false, force = false, scope = 'project' } = {}) {
  if (p.custom) return [{ status: 'custom', path: root }];
  if (p.provider === 'other') return [{ status: 'custom', path: root, note: 'provider other: /setup-pipeline writes the CI file by hand' }];
  const files = renderPipeline(p, { scope });
  const results = [];
  for (const [rel, content] of Object.entries(files)) results.push(writeFileSafe(path.join(root, rel), content, { dryRun, force }));
  for (const rel of ALL_GENERATED) {
    const abs = path.join(root, rel);
    if (!files[rel] && fs.existsSync(abs) && isManagedFile(abs)) {
      if (!dryRun) fs.rmSync(abs);
      results.push({ status: 'removed_stale', path: abs });
    }
  }
  return results;
}

export function describePipeline(p) {
  const dev = p.branches.development;
  const flow = dev ? `feature → ${dev} → ${p.branches.main}` : `feature → ${p.branches.main}`;
  const host = { github: 'GitHub Actions', gitlab: 'GitLab CI', other: 'other CI (hand-written)' }[p.provider];
  const pr = p.provider === 'gitlab' ? 'MR' : 'PR';
  const lines = [`Pipeline: ${p.mode}${p.custom ? ' (custom)' : ''} on ${host}   branches: ${flow}`];
  if (p.provider === 'other' && p.mode !== 'none') {
    lines.push('  No file is generated for this CI system. Run /setup-pipeline and the agent writes it (Bitbucket, Azure DevOps, Jenkins, CircleCI, ...).');
    return lines.join('\n');
  }
  if (p.custom) {
    lines.push('  Custom pipeline: the workflow files are hand-maintained (written by /setup-pipeline). --write only saves settings.');
    lines.push('  Go back to generated files: pipeline --no-custom --write --force');
    return lines.join('\n');
  }
  if (p.mode === 'none') {
    lines.push('  No CI workflows generated. Turn it on: pipeline --mode test (or release) --write');
    return lines.join('\n');
  }
  lines.push(`  ${pr} into ${[dev, p.branches.main].filter(Boolean).join(' or ')}: install, test${p.build ? ', build' : ''}${p.workflowChecks ? ', validate, sync --check, commit ticket check' : ''}`);
  if (dev) lines.push(`  Merge into ${dev}: the same tests`);
  if (p.mode === 'release') {
    const names = { release: `${p.provider === 'gitlab' ? 'GitLab' : 'GitHub'} Release (with tag)`, tag: 'tag only', npm: 'npm package', docker: `Docker image (${p.provider === 'gitlab' ? 'GitLab registry' : 'ghcr.io'})` };
    lines.push(`  Merge into ${p.branches.main}: tests, then v<version from ${p.release.versionFile}>: ${p.release.targets.map(x => names[x]).join(' + ')} (skipped when that version is already tagged)`);
    const secrets = [];
    if (p.release.targets.includes('npm')) secrets.push('NPM_TOKEN');
    if (p.provider === 'gitlab' && p.release.targets.includes('tag') && !p.release.targets.includes('release')) secrets.push('RELEASE_TOKEN (project access token with api scope)');
    if (secrets.length) lines.push(`  Needs ${p.provider === 'gitlab' ? 'CI/CD variable' : 'secret'}: ${secrets.join(', ')}`);
  }
  lines.push(`  install: ${p.install || '(none)'} · test: ${p.test || '(none)'} · build: ${p.build || '(none)'} · node ${p.node}`);
  return lines.join('\n');
}

// ---------- release helpers used by the generated workflow ----------

export function readVersion(root, versionFile = 'package.json') {
  const p = path.join(root, versionFile);
  if (!fs.existsSync(p)) throw new Error(`Version file '${versionFile}' not found. Set pipeline release.versionFile.`);
  if (versionFile.endsWith('.json')) {
    const v = JSON.parse(fs.readFileSync(p, 'utf8')).version;
    if (!v) throw new Error(`No "version" field in ${versionFile}`);
    return String(v);
  }
  const v = fs.readFileSync(p, 'utf8').trim().replace(/^v/, '');
  if (!v) throw new Error(`${versionFile} is empty`);
  return v;
}

/** The CHANGELOG section for a version (`## [1.2.0]` or `## 1.2.0`), else commit subjects since the last tag. */
export function releaseNotes(root, version) {
  const changelog = path.join(root, 'CHANGELOG.md');
  if (fs.existsSync(changelog)) {
    const lines = fs.readFileSync(changelog, 'utf8').split(/\r?\n/);
    const esc = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const start = lines.findIndex(l => new RegExp(`^##\\s+\\[?v?${esc}\\]?(\\s|$)`).test(l));
    if (start !== -1) {
      const body = [];
      for (let i = start + 1; i < lines.length && !/^##\s/.test(lines[i]); i++) body.push(lines[i]);
      const text = body.join('\n').trim();
      if (text) return text + '\n';
    }
  }
  const lastTag = git(root, ['describe', '--tags', '--abbrev=0'], { allowFail: true });
  const range = lastTag ? [`${lastTag}..HEAD`] : [];
  const log = git(root, ['log', '--no-merges', '--format=- %s', ...range], { allowFail: true }) || '';
  return `Changes${lastTag ? ` since ${lastTag}` : ''}:\n\n${log || '- (no commits found)'}\n`;
}
