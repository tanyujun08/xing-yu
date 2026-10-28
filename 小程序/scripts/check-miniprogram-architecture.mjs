import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(SCRIPT_DIRECTORY, '..');
const POLICY_PATH = 'config/miniprogram-architecture-policy.json';
const ARCHITECTURE_PATH = 'docs/architecture/miniprogram-architecture.md';
const DEVELOPMENT_API_CONFIG_PATH = 'miniprogram/shared/config/env.ts';
const EXPECTED_DEVELOPMENT_API_ORIGIN = 'http://127.0.0.1:8081';
const FIXTURE_DIRECTORY = 'tests/fixtures/miniprogram-architecture';
const EXPECTED_VERIFY = 'npm run check:api && npm run check:package && npm run check:architecture && npm run lint && npm run typecheck && npm test';
const EXPECTED_BASELINE = '26062c4fc386493a3001013e5fed061695c680fd';
const EXPECTED_LEGACY_BASELINE_IDENTITY_COUNT = 690;
const EXPECTED_LEGACY_BASELINE_MANIFEST_SHA256 = '705a02d06b9b9465e5f63a32f0fb4b4c6e316edf1728df9af6d1fb845601b33f';
const EXPECTED_LEGACY_BASELINE_SOURCE_IDENTITY_COUNT = 241;
const EXPECTED_LEGACY_BASELINE_SOURCE_MANIFEST_SHA256 = '6c43ccd8e93068dfafdceeb8f9ec54d8ccdfd33f788360a9118cb806befe89fc';
const EXPECTED_LEGACY_BASELINE_DIRECT_RAW_COUNT = 562;
const EXPECTED_LEGACY_BASELINE_DIRECT_WAIVABLE_COUNT = 560;
const EXPECTED_LEGACY_BASELINE_GOVERNED_WXML_PATHS = Object.freeze([
  'miniprogram/pages/addresses/index.wxml',
  'miniprogram/pages/cabinet-pickup/index.wxml',
  'miniprogram/pages/cabinet-return/index.wxml',
  'miniprogram/pages/login/index.wxml',
  'miniprogram/pages/orders/index.wxml',
  'miniprogram/pages/powder-ledger/index.wxml',
  'miniprogram/pages/powder-mall/index.wxml',
  'miniprogram/pages/profile-edit/index.wxml',
  'miniprogram/pages/profile/index.wxml',
  'miniprogram/pages/withdrawal/index.wxml',
]);
const DORMANT_NETWORK_ADAPTER_PATH = 'miniprogram/shared/api/request.ts';
// Existing visual migrations only; new pages never inherit the legacy async exemption.
const LEGACY_VISUAL_PAGE_NAMES = new Set([
  'about', 'account-security', 'cabinet-code', 'cabinet-detail', 'cabinet-open', 'cabinets',
  'chat', 'check-in', 'code', 'confirm', 'contract', 'detail', 'device-orders', 'dispute',
  'growth-tasks', 'home', 'identity', 'info-guide', 'info', 'level-rights', 'listing-price',
  'listings', 'lottery', 'membership', 'no-deposit', 'order-detail', 'order-messages',
  'private-messages', 'publish-eligibility', 'publish-quota', 'publish', 'region',
  'rental-service', 'return-submit', 'service-detail', 'service-notices', 'star-ledger',
  'store-detail', 'stores', 'wallet', 'wechat-waiver',
]);
const RULE_IDS = Object.freeze([
  'MPA-AUTH-001',
  'MPA-DEP-001',
  'MPA-TOKEN-001',
  'MPA-TYPE-001',
  'MPA-COMP-001',
  'MPA-ASYNC-001',
  'MPA-LIST-001',
  'MPA-REFRESH-001',
  'MPA-A11Y-001',
  'MPA-DUP-001',
  'MPA-EXC-001',
]);
const NON_WAIVABLE_RULES = new Set(['MPA-AUTH-001', 'MPA-EXC-001']);

class PolicyDamage extends Error {}

function normalizeText(value) {
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').normalize('NFC');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toPosix(value) {
  return value.split(path.sep).join('/').replace(/^\.\//, '');
}

function lineAt(source, index) {
  return source.slice(0, Math.max(0, index)).split('\n').length;
}

function canonicalSpace(value) {
  return normalizeText(String(value)).trim().replace(/\s+/g, ' ');
}

function canonicalCssValue(value) {
  return canonicalSpace(value)
    .replace(/\s*([,:()/])\s*/g, '$1')
    .replace(/#[0-9A-Fa-f]+/g, (match) => match.toLowerCase());
}

function fingerprint(ruleId, sourcePath, semanticSubject) {
  return sha256(`mpa-finding-v1\0${ruleId}\0${sourcePath}\0${semanticSubject}`);
}

function finding(ruleId, severity, sourcePath, line, semanticSubject, message, remediation) {
  const result = {
    ruleId,
    severity,
    path: sourcePath,
    line: Math.max(1, Number(line) || 1),
    fingerprint: fingerprint(ruleId, sourcePath, semanticSubject),
    message,
    remediation,
  };
  Object.defineProperty(result, 'semanticSubject', { value: semanticSubject, enumerable: false });
  return result;
}

function disambiguateRepeatedSemanticNodes(findings) {
  const groups = new Map();
  for (const item of findings) {
    const key = `${item.ruleId}\0${item.path}\0${item.fingerprint}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    group.sort((left, right) => left.line - right.line
      || compareText(left.message, right.message)
      || compareText(left.remediation, right.remediation));
    group.forEach((item, index) => {
      item.fingerprint = fingerprint(item.ruleId, item.path, `${item.semanticSubject}|occurrence:${index + 1}`);
    });
  }
  return findings;
}

function sortFindings(findings) {
  return findings.sort((left, right) => (
    compareText(left.ruleId, right.ruleId)
    || compareText(left.path, right.path)
    || left.line - right.line
    || compareText(left.fingerprint, right.fingerprint)
  ));
}

function readProjectFile(sourcePath) {
  return normalizeText(fs.readFileSync(path.join(PROJECT_ROOT, ...sourcePath.split('/')), 'utf8'));
}

function collectFiles(directory, predicate) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(absolutePath, predicate);
    return predicate(absolutePath) ? [absolutePath] : [];
  });
}

function collectRepositorySources() {
  const fixedPaths = [
    'AGENTS.md',
    'README.md',
    'package.json',
    POLICY_PATH,
    ARCHITECTURE_PATH,
    'scripts/check-miniprogram-architecture.mjs',
    'tests/change-xy-20260901.test.ts',
    'tests/navigation.test.ts',
  ];
  const sourceExtensions = new Set(['.json', '.ts', '.wxml', '.wxss']);
  const miniprogramFiles = collectFiles(path.join(PROJECT_ROOT, 'miniprogram'), (absolutePath) => (
    sourceExtensions.has(path.extname(absolutePath).toLowerCase())
  )).map((absolutePath) => toPosix(path.relative(PROJECT_ROOT, absolutePath)));
  const fixtureFiles = collectFiles(path.join(PROJECT_ROOT, ...FIXTURE_DIRECTORY.split('/')), (absolutePath) => (
    absolutePath.endsWith('.json')
  )).map((absolutePath) => toPosix(path.relative(PROJECT_ROOT, absolutePath)));
  const sourcePaths = [...new Set([...fixedPaths, ...fixtureFiles, ...miniprogramFiles])].sort(compareText);
  const files = new Map();
  for (const sourcePath of sourcePaths) {
    const absolutePath = path.join(PROJECT_ROOT, ...sourcePath.split('/'));
    if (fs.existsSync(absolutePath) && fs.statSync(absolutePath).isFile()) {
      files.set(sourcePath, readProjectFile(sourcePath));
    }
  }
  return files;
}

function sourceManifestSha256(files) {
  const manifest = [...files.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([sourcePath, source]) => `${sourcePath}\t${sha256(source)}\n`)
    .join('');
  return sha256(manifest);
}

function parseJson(source, sourcePath) {
  try {
    return JSON.parse(source);
  } catch (error) {
    throw new PolicyDamage(`${sourcePath} is not valid JSON: ${error.message}`);
  }
}

function parseVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(String(value));
  return match ? match.slice(1).map(Number) : null;
}

function compareVersion(left, right) {
  for (let index = 0; index < 4; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

function validatePolicy(policy) {
  if (!policy || typeof policy !== 'object' || Array.isArray(policy)) {
    throw new PolicyDamage('Policy root must be an object');
  }
  if (policy.apiConnectedPages !== undefined && (!Array.isArray(policy.apiConnectedPages)
    || new Set(policy.apiConnectedPages).size !== policy.apiConnectedPages.length
    || policy.apiConnectedPages.some((path) => typeof path !== 'string' || !/^miniprogram\/pages\/[a-z0-9-]+\/index\.ts$/.test(path)))) {
    throw new PolicyDamage('API connected pages must be unique exact page source paths');
  }
  const identities = {
    schemaVersion: '1.0',
    policyVersion: '1.0.0',
    basisVersion: '1.0.0.13',
    targetVersion: '1.0.1.7',
    baselineRevision: EXPECTED_BASELINE,
  };
  for (const [key, expected] of Object.entries(identities)) {
    if (policy[key] !== expected) throw new PolicyDamage(`Policy ${key} must equal ${expected}`);
  }
  if (!parseVersion(policy.basisVersion) || !parseVersion(policy.targetVersion)) {
    throw new PolicyDamage('Policy basisVersion and targetVersion must be four-part versions');
  }
  if (!policy.thresholds || typeof policy.thresholds !== 'object' || Array.isArray(policy.thresholds)) {
    throw new PolicyDamage('Policy thresholds must be an object');
  }
  for (const key of ['duplicateMinCharacters', 'nearDuplicateMinTokens', 'silentSliceMaximum']) {
    if (!Number.isSafeInteger(policy.thresholds[key]) || policy.thresholds[key] < 1) {
      throw new PolicyDamage(`Policy threshold ${key} must be a positive integer`);
    }
  }
  if (!Array.isArray(policy.exceptions)) throw new PolicyDamage('Policy exceptions must be an array');
  if (!policy.legacyBaselineDirectDiagnostic
    || policy.legacyBaselineDirectDiagnostic.rawFindingCount !== EXPECTED_LEGACY_BASELINE_DIRECT_RAW_COUNT
    || policy.legacyBaselineDirectDiagnostic.waivableFindingCount !== EXPECTED_LEGACY_BASELINE_DIRECT_WAIVABLE_COUNT) {
    throw new PolicyDamage('Policy legacy baseline direct diagnostic counts are damaged');
  }
  if (!Array.isArray(policy.legacyBaselineGovernedWxmlPaths)
    || policy.legacyBaselineGovernedWxmlPaths.join('\0') !== EXPECTED_LEGACY_BASELINE_GOVERNED_WXML_PATHS.join('\0')) {
    throw new PolicyDamage('Policy legacy baseline governed WXML paths must equal the exact normalized replay path set');
  }
  if (!Array.isArray(policy.retiredMigrationWxmlPaths)
    || policy.retiredMigrationWxmlPaths.join('\0') !== 'miniprogram/pages/cabinet-pickup/index.wxml'
    || policy.retiredMigrationWxmlPaths.some(sourcePath => !policy.legacyBaselineGovernedWxmlPaths.includes(sourcePath))) {
    throw new PolicyDamage('Only the explicitly removed cabinet-pickup route may retire from the current migration partition');
  }
  if (!Array.isArray(policy.visualOnlyMigrationWxmlPaths)
    || policy.visualOnlyMigrationWxmlPaths.some((sourcePath) => typeof sourcePath !== 'string' || !/^miniprogram\/pages\/[^/]+\/index\.wxml$/.test(sourcePath))
    || new Set(policy.visualOnlyMigrationWxmlPaths).size !== policy.visualOnlyMigrationWxmlPaths.length
    || [...policy.visualOnlyMigrationWxmlPaths].sort(compareText).join('\0') !== policy.visualOnlyMigrationWxmlPaths.join('\0')) {
    throw new PolicyDamage('Policy visual-only migration WXML paths must be unique sorted page entry paths');
  }
  if (policy.visualOnlyMigrationWxmlPaths.some((sourcePath) => !LEGACY_VISUAL_PAGE_NAMES.has(sourcePath.split('/')[2]))) {
    throw new PolicyDamage('New pages cannot enter the legacy visual-only migration set');
  }
  const newlyGoverned = policy.newlyGovernedWxmlPaths;
  if (!Array.isArray(newlyGoverned)
    || newlyGoverned.some((sourcePath) => typeof sourcePath !== 'string' || !/^miniprogram\/pages\/[^/]+\/index\.wxml$/.test(sourcePath))
    || new Set(newlyGoverned).size !== newlyGoverned.length
    || [...newlyGoverned].sort(compareText).join('\0') !== newlyGoverned.join('\0')) {
    throw new PolicyDamage('Policy newly governed WXML paths must be unique sorted page entry paths');
  }
  if (policy.legacyBaselineSourceIdentityCount !== EXPECTED_LEGACY_BASELINE_SOURCE_IDENTITY_COUNT
    || typeof policy.legacyBaselineSourceIdentityDigests !== 'string'
    || !/^(?:[0-9a-f]{64})+$/u.test(policy.legacyBaselineSourceIdentityDigests)
    || policy.legacyBaselineSourceIdentityDigests.length % 64 !== 0
    || policy.legacyBaselineSourceIdentityManifestSha256 !== EXPECTED_LEGACY_BASELINE_SOURCE_MANIFEST_SHA256) {
    throw new PolicyDamage('Policy legacy baseline normalized source identity contract is invalid');
  }
  const sourceDigests = policy.legacyBaselineSourceIdentityDigests.match(/.{64}/gu) ?? [];
  if (sourceDigests.length !== EXPECTED_LEGACY_BASELINE_SOURCE_IDENTITY_COUNT
    || new Set(sourceDigests).size !== sourceDigests.length
    || [...sourceDigests].sort(compareText).join('') !== policy.legacyBaselineSourceIdentityDigests
    || sha256(policy.legacyBaselineSourceIdentityDigests) !== EXPECTED_LEGACY_BASELINE_SOURCE_MANIFEST_SHA256) {
    throw new PolicyDamage('Policy legacy baseline normalized source identities are duplicated, reordered, or damaged');
  }
  if (typeof policy.legacyBaselineIdentityDigests !== 'string'
    || !/^(?:[0-9a-f]{64})*$/u.test(policy.legacyBaselineIdentityDigests)
    || policy.legacyBaselineIdentityDigests.length % 64 !== 0) {
    throw new PolicyDamage('Policy legacyBaselineIdentityDigests must be a concatenation of lowercase SHA-256 identities');
  }
  const liveDigests = policy.legacyBaselineIdentityDigests.match(/.{64}/gu) ?? [];
  if (!Array.isArray(policy.retiredLegacyIdentityDigests)
    || policy.retiredLegacyIdentityDigests.some((digest) => typeof digest !== 'string' || !/^[0-9a-f]{64}$/u.test(digest))
    || new Set(policy.retiredLegacyIdentityDigests).size !== policy.retiredLegacyIdentityDigests.length
    || [...policy.retiredLegacyIdentityDigests].sort(compareText).join('\0') !== policy.retiredLegacyIdentityDigests.join('\0')) {
    throw new PolicyDamage('Policy retired legacy identities must be unique sorted SHA-256 identities');
  }
  const retiredDigests = policy.retiredLegacyIdentityDigests;
  const baselineDigests = [...liveDigests, ...retiredDigests].sort(compareText);
  if (new Set(liveDigests).size !== liveDigests.length
    || [...liveDigests].sort(compareText).join('') !== policy.legacyBaselineIdentityDigests
    || retiredDigests.some((digest) => liveDigests.includes(digest))
    || policy.legacyBaselineIdentityCount !== EXPECTED_LEGACY_BASELINE_IDENTITY_COUNT
    || baselineDigests.length !== EXPECTED_LEGACY_BASELINE_IDENTITY_COUNT
    || policy.legacyBaselineIdentityManifestSha256 !== EXPECTED_LEGACY_BASELINE_MANIFEST_SHA256
    || sha256(baselineDigests.join('')) !== EXPECTED_LEGACY_BASELINE_MANIFEST_SHA256) {
    throw new PolicyDamage('Policy legacy baseline live/retired partition does not match the normalized replay authority');
  }
}

function readPolicy(files) {
  const source = files.get(POLICY_PATH);
  if (!source) throw new PolicyDamage(`Missing ${POLICY_PATH}`);
  const policy = parseJson(source, POLICY_PATH);
  validatePolicy(policy);
  return policy;
}

function countOccurrences(source, needle) {
  return source.split(needle).length - 1;
}

function evaluateMigrationRouteCoverage(files, policy) {
  const appSource = files.get('miniprogram/app.json');
  if (appSource === undefined) return [];
  let app;
  try {
    app = JSON.parse(appSource);
  } catch {
    return [finding('MPA-AUTH-001', 'ERROR', 'miniprogram/app.json', 1, 'json:/pages|invalid', 'App route authority cannot be parsed.', 'Use valid app.json and keep every registered route in exactly one migration set.')];
  }
  const routes = Array.isArray(app.pages) ? app.pages : [];
  const expected = routes.map((route) => `miniprogram/${route}.wxml`).sort(compareText);
  const governed = policy.legacyBaselineGovernedWxmlPaths ?? [];
  const visualOnly = policy.visualOnlyMigrationWxmlPaths ?? [];
  const retired = policy.retiredMigrationWxmlPaths ?? [];
  if (retired.some(sourcePath => expected.includes(sourcePath)
    || ['ts', 'wxml', 'wxss', 'json'].some(extension => files.has(sourcePath.replace(/wxml$/u, extension))))) {
    return [finding('MPA-AUTH-001', 'ERROR', POLICY_PATH, 1, 'json:/retiredMigrationWxmlPaths|retired-source', 'Retired cabinet-pickup must have no registration or remaining page source.', 'Remove the exact retired page registration and all four entry files; keep the frozen replay unchanged.')];
  }
  const declared = [...governed.filter(sourcePath => !retired.includes(sourcePath)), ...visualOnly, ...(policy.newlyGovernedWxmlPaths ?? [])].sort(compareText);
  if (routes.length === 0
    || new Set(routes).size !== routes.length
    || new Set(declared).size !== declared.length
    || declared.join('\0') !== expected.join('\0')) {
    return [finding('MPA-AUTH-001', 'ERROR', POLICY_PATH, 1, 'json:/visualOnlyMigrationWxmlPaths|route-coverage', 'Registered pages are not covered by exactly one migration authority set.', 'Partition app.json pages exactly once across legacy governed, legacy visual-only and newly governed sets.')];
  }
  return [];
}

function evaluateAuthority(files, policy, fixtureMode = false) {
  const findings = [];
  if (fixtureMode) {
    const packageSource = files.get('package.json');
    if (!packageSource) {
      findings.push(finding('MPA-AUTH-001', 'ERROR', 'package.json', 1, 'json:/scripts/check:architecture|missing', 'Architecture script is missing.', 'Wire the architecture checker into package.json.'));
      return findings;
    }
    let packageJson;
    try {
      packageJson = JSON.parse(packageSource);
    } catch {
      findings.push(finding('MPA-AUTH-001', 'ERROR', 'package.json', 1, 'json:/|invalid', 'package.json is invalid.', 'Use valid JSON and the exact verify chain.'));
      return findings;
    }
    if (packageJson.scripts?.['check:architecture'] !== 'node scripts/check-miniprogram-architecture.mjs') {
      findings.push(finding('MPA-AUTH-001', 'ERROR', 'package.json', 1, 'json:/scripts/check:architecture|invalid', 'Architecture script wiring is not canonical.', 'Use the canonical read-only checker command.'));
    }
    if (packageJson.scripts?.verify !== EXPECTED_VERIFY) {
      findings.push(finding('MPA-AUTH-001', 'ERROR', 'package.json', 1, 'json:/scripts/verify|invalid', 'Verify chain is incomplete or reordered.', 'Use the exact approved verify chain without bypass arguments.'));
    }
    const environmentSource = files.get(DEVELOPMENT_API_CONFIG_PATH);
    if (environmentSource !== undefined) {
      const originMatch = /\bdevelop\s*:\s*['"]([^'"]+)['"]/.exec(environmentSource);
      if (originMatch?.[1] !== EXPECTED_DEVELOPMENT_API_ORIGIN || /http:\/\/127\.0\.0\.1:8080(?:\/|['"]|\s|$)/.test(environmentSource)) {
        findings.push(finding('MPA-AUTH-001', 'ERROR', DEVELOPMENT_API_CONFIG_PATH, originMatch ? lineAt(environmentSource, originMatch.index) : 1, 'ts-property:apiOrigins.develop|host-authority', 'Development API origin does not match the Xingyu host-port authority.', 'Use http://127.0.0.1:8081; host port 8080 belongs to another project.'));
      }
    }
    return [...findings, ...evaluateMigrationRouteCoverage(files, policy), ...evaluateMockOnly(files, policy)];
  }

  const required = [
    ARCHITECTURE_PATH,
    POLICY_PATH,
    'scripts/check-miniprogram-architecture.mjs',
    'package.json',
    'README.md',
    'AGENTS.md',
    'miniprogram/app.json',
    'miniprogram/app.ts',
    DEVELOPMENT_API_CONFIG_PATH,
    'tests/change-xy-20260901.test.ts',
    'tests/navigation.test.ts',
  ];
  for (const sourcePath of required) {
    if (!files.has(sourcePath)) {
      findings.push(finding('MPA-AUTH-001', 'ERROR', sourcePath, 1, `json:/required/${sourcePath}|missing`, `Required architecture authority file is missing: ${sourcePath}.`, 'Restore the approved M0 authority file.'));
    }
  }

  const architecture = files.get(ARCHITECTURE_PATH) ?? '';
  for (const ruleId of RULE_IDS) {
    if (!architecture.includes(`\`${ruleId}\``)) {
      findings.push(finding('MPA-AUTH-001', 'ERROR', ARCHITECTURE_PATH, 1, `json:/ruleIds/${ruleId}|missing`, `Architecture authority does not declare ${ruleId}.`, 'Declare every stable Rule ID in the unique architecture authority.'));
    }
  }
  if (countOccurrences(architecture, EXPECTED_DEVELOPMENT_API_ORIGIN) !== 1 || architecture.includes('http://127.0.0.1:8080')) {
    findings.push(finding('MPA-AUTH-001', 'ERROR', ARCHITECTURE_PATH, 1, 'markdown:development-api-origin|host-authority', 'Architecture authority must declare the unique host API origin and reject host 8080.', 'Declare exactly one http://127.0.0.1:8081 origin and keep host 8080 outside Xingyu authority.'));
  }

  let packageJson = {};
  try {
    packageJson = JSON.parse(files.get('package.json') ?? '{}');
  } catch {
    findings.push(finding('MPA-AUTH-001', 'ERROR', 'package.json', 1, 'json:/|invalid', 'package.json cannot be parsed.', 'Repair package.json before running the gate.'));
  }
  if (packageJson.scripts?.['check:architecture'] !== 'node scripts/check-miniprogram-architecture.mjs') {
    findings.push(finding('MPA-AUTH-001', 'ERROR', 'package.json', 1, 'json:/scripts/check:architecture|invalid', 'Architecture script wiring is not canonical.', 'Set check:architecture to the approved read-only Node checker.'));
  }
  if (packageJson.scripts?.verify !== EXPECTED_VERIFY) {
    findings.push(finding('MPA-AUTH-001', 'ERROR', 'package.json', 1, 'json:/scripts/verify|invalid', 'Verify chain is incomplete or reordered.', 'Use check:api -> check:package -> check:architecture -> lint -> typecheck -> test without bypass arguments.'));
  }

  const environmentSource = files.get(DEVELOPMENT_API_CONFIG_PATH) ?? '';
  const originMatch = /\bdevelop\s*:\s*['"]([^'"]+)['"]/.exec(environmentSource);
  if (originMatch?.[1] !== EXPECTED_DEVELOPMENT_API_ORIGIN || /http:\/\/127\.0\.0\.1:8080(?:\/|['"]|\s|$)/.test(environmentSource)) {
    findings.push(finding('MPA-AUTH-001', 'ERROR', DEVELOPMENT_API_CONFIG_PATH, originMatch ? lineAt(environmentSource, originMatch.index) : 1, 'ts-property:apiOrigins.develop|host-authority', 'Development API origin does not match the Xingyu host-port authority.', 'Use http://127.0.0.1:8081; host port 8080 belongs to another project.'));
  }

  for (const sourcePath of ['README.md', 'AGENTS.md']) {
    const source = files.get(sourcePath) ?? '';
    if (countOccurrences(source, ARCHITECTURE_PATH) !== 1) {
      findings.push(finding('MPA-AUTH-001', 'ERROR', sourcePath, 1, `json:/architectureRoute|${countOccurrences(source, ARCHITECTURE_PATH)}`, `${sourcePath} must route to the architecture authority exactly once.`, `Keep one link to ${ARCHITECTURE_PATH} and do not duplicate its rules.`));
    }
  }

  const appSource = files.get('miniprogram/app.ts') ?? '';
  const versionMatch = /version\s*:\s*['"]([^'"]+)['"]/.exec(appSource);
  if (versionMatch?.[1] !== policy.targetVersion) {
    findings.push(finding('MPA-AUTH-001', 'ERROR', 'miniprogram/app.ts', versionMatch ? lineAt(appSource, versionMatch.index) : 1, 'ts-property:globalData.version|target-version', 'Product version authority does not match Policy targetVersion.', 'Set globalData.version to the Policy targetVersion.'));
  }
  for (const sourcePath of ['tests/change-xy-20260901.test.ts', 'tests/navigation.test.ts']) {
    const source = files.get(sourcePath) ?? '';
    if (!source.includes(`toBe('${policy.targetVersion}')`)
      && !source.includes(`toEqual('${policy.targetVersion}')`)
      && !source.includes(`toContain("version: '${policy.targetVersion}'")`)
      && !source.includes(`toContain('version: \\'${policy.targetVersion}\\'')`)) {
      findings.push(finding('MPA-AUTH-001', 'ERROR', sourcePath, 1, `ts-callee:version-assertion|${policy.targetVersion}`, `Version assertion does not bind ${policy.targetVersion}.`, 'Update the existing product-version assertion only.'));
    }
  }
  return [...findings, ...evaluateMigrationRouteCoverage(files, policy), ...evaluateMockOnly(files, policy)];
}

function importNodes(source) {
  const nodes = [];
  const importPattern = /\b(?:import|export)\s+(?:(?:type\s+)?[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  for (const match of source.matchAll(importPattern)) {
    if (!match[0].includes('\n\n')) nodes.push({ specifier: match[1], index: match.index ?? 0 });
  }
  const dynamicPattern = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const match of source.matchAll(dynamicPattern)) nodes.push({ specifier: match[1], index: match.index ?? 0 });
  return nodes;
}

function resolveImport(sourcePath, specifier) {
  if (specifier.startsWith('/')) return path.posix.normalize(`miniprogram${specifier}`);
  if (!specifier.startsWith('.')) return null;
  return path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), specifier));
}

function pageDirectory(sourcePath) {
  const match = /^(miniprogram\/(?:pages|custom-tab-bar)\/[^/]+)/.exec(sourcePath);
  return match?.[1] ?? null;
}

function componentDirectory(sourcePath) {
  const match = /^(miniprogram\/components\/[^/]+)/.exec(sourcePath);
  return match?.[1] ?? null;
}

function within(targetPath, rootPath) {
  return targetPath === rootPath || targetPath.startsWith(`${rootPath}/`);
}

function dependencyAllowed(sourcePath, targetPath) {
  const pageRoot = pageDirectory(sourcePath);
  if (pageRoot) {
    return within(targetPath, pageRoot)
      || within(targetPath, 'miniprogram/components')
      || within(targetPath, 'miniprogram/shared/interaction')
      || within(targetPath, 'miniprogram/shared/presentation')
      || within(targetPath, 'miniprogram/shared/model')
      || within(targetPath, 'miniprogram/shared/format')
      || within(targetPath, 'miniprogram/shared/design')
      || /^miniprogram\/shared\/api\/(?:supply-api|rental-api)(?:\.ts)?$/.test(targetPath)
      || targetPath === 'miniprogram/shared/api/account-api'
      || targetPath === 'miniprogram/shared/api/account-api.ts'
      || targetPath === 'miniprogram/shared/api/mock-api'
      || targetPath === 'miniprogram/shared/api/mock-api.ts'
      || targetPath === 'miniprogram/shared/media/local-media'
      || targetPath === 'miniprogram/shared/media/local-media.ts';
  }
  const componentRoot = componentDirectory(sourcePath);
  if (componentRoot) {
    return within(targetPath, componentRoot)
      || (sourcePath === 'miniprogram/components/status-view/index.ts' && (targetPath === 'miniprogram/shared/interaction/busy-visibility' || targetPath === 'miniprogram/shared/interaction/busy-visibility.ts'))
      || within(targetPath, 'miniprogram/shared/presentation')
      || within(targetPath, 'miniprogram/shared/model')
      || within(targetPath, 'miniprogram/shared/design');
  }
  if (sourcePath === 'miniprogram/shared/api/mock-api.ts') {
    return within(targetPath, 'miniprogram/shared/model')
      || within(targetPath, 'miniprogram/shared/api/mock-adapter');
  }
  if (within(sourcePath, 'miniprogram/shared/api/mock-adapter')) {
    return within(targetPath, 'miniprogram/shared/api/mock-adapter')
      || within(targetPath, 'miniprogram/shared/model')
      || within(targetPath, 'miniprogram/shared/fixture')
      || within(targetPath, 'miniprogram/shared/identity')
      || within(targetPath, 'miniprogram/shared/session');
  }
  if (within(sourcePath, 'miniprogram/shared/interaction')) {
    return within(targetPath, 'miniprogram/shared/interaction') || within(targetPath, 'miniprogram/shared/model');
  }
  if (within(sourcePath, 'miniprogram/shared/presentation')) {
    return within(targetPath, 'miniprogram/shared/presentation')
      || within(targetPath, 'miniprogram/shared/model')
      || within(targetPath, 'miniprogram/shared/format')
      || within(targetPath, 'miniprogram/shared/design');
  }
  if (sourcePath === 'miniprogram/shared/media/local-media.ts') {
    return within(targetPath, 'miniprogram/shared/media') || within(targetPath, 'miniprogram/shared/model');
  }
  if (within(sourcePath, 'miniprogram/shared/fixture')) {
    return within(targetPath, 'miniprogram/shared/fixture') || within(targetPath, 'miniprogram/shared/model');
  }
  if (within(sourcePath, 'miniprogram/shared/design')) {
    return within(targetPath, 'miniprogram/shared/design');
  }
  return true;
}

function evaluateDependencies(files) {
  const findings = [];
  for (const [sourcePath, source] of files) {
    if (!sourcePath.endsWith('.ts') || !sourcePath.startsWith('miniprogram/')) continue;
    for (const node of importNodes(source)) {
      const targetPath = resolveImport(sourcePath, node.specifier);
      if (targetPath && !dependencyAllowed(sourcePath, targetPath)) {
        findings.push(finding('MPA-DEP-001', 'ERROR', sourcePath, lineAt(source, node.index), `ts-import:${canonicalSpace(node.specifier)}`, `Disallowed direct dependency: ${node.specifier}.`, 'Move the dependency behind the approved facade/layer or use an allowed direct adjacency.'));
      }
    }
  }
  return findings;
}

function resolveGraphTarget(files, sourcePath, specifier) {
  const resolved = resolveImport(sourcePath, specifier);
  if (!resolved) return null;
  for (const candidate of [resolved, `${resolved}.ts`, `${resolved}/index.ts`]) {
    if (files.has(candidate)) return candidate;
  }
  return null;
}

function isMockProductEntry(sourcePath) {
  return sourcePath === 'miniprogram/app.ts'
    || sourcePath === 'miniprogram/shared/api/mock-api.ts'
    || within(sourcePath, 'miniprogram/shared/api/mock-adapter')
    || /^miniprogram\/(?:pages|components|custom-tab-bar)\/.+\.ts$/u.test(sourcePath);
}

function evaluateMockOnly(files, policy) {
  const findings = [];
  const graph = new Map();
  const networkApiPattern = /\bwx\s*\.\s*(request|uploadFile|downloadFile|connectSocket)\s*\(/gu;
  for (const [sourcePath, source] of files) {
    if (!sourcePath.endsWith('.ts') || !sourcePath.startsWith('miniprogram/')) continue;
    const dependencies = importNodes(source)
      .map((node) => resolveGraphTarget(files, sourcePath, node.specifier))
      .filter((targetPath) => targetPath !== null);
    graph.set(sourcePath, dependencies);
    const masked = maskJavaScriptTrivia(source);
    for (const match of masked.matchAll(networkApiPattern)) {
      if (sourcePath === DORMANT_NETWORK_ADAPTER_PATH) continue;
      findings.push(finding(
        'MPA-AUTH-001',
        'ERROR',
        sourcePath,
        lineAt(masked, match.index ?? 0),
        `ts-call:wx.${match[1]}|mock-only`,
        `Mock-only product code must not call wx.${match[1]}.`,
        `Keep network host APIs dormant in ${DORMANT_NETWORK_ADAPTER_PATH} and unreachable from product entries.`,
      ));
    }
  }

  for (const entryPath of [...graph.keys()].filter(isMockProductEntry).sort(compareText)) {
    const apiConnected = policy?.apiConnectedPages?.includes(entryPath) ?? false;
    const queue = [[entryPath]];
    const visited = new Set([entryPath]);
    let pathToDormant = null;
    while (queue.length > 0 && !pathToDormant) {
      const chain = queue.shift();
      const tail = chain[chain.length - 1];
      for (const dependency of graph.get(tail) ?? []) {
        const next = [...chain, dependency];
        if (apiConnected ? (dependency.includes('/api/mock-') || dependency.includes('/fixture/')) : dependency === DORMANT_NETWORK_ADAPTER_PATH) {
          pathToDormant = next;
          break;
        }
        if (!visited.has(dependency)) {
          visited.add(dependency);
          queue.push(next);
        }
      }
    }
    if (pathToDormant) {
      findings.push(finding(
        'MPA-AUTH-001',
        'ERROR',
        entryPath,
        1,
        `ts-reachability:${pathToDormant.join('->')}`,
        `Runtime boundary violation (${apiConnected ? 'API must not reach Mock' : 'unconnected page must not reach network'}): ${pathToDormant.join(' -> ')}.`,
        'Remove the reachable import edge and route runtime reads and commands only through the repository Mock adapter.',
      ));
    }
  }
  return findings;
}

function withoutCssComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));
}

function maskJavaScriptTrivia(source, { strings = true } = {}) {
  const output = [...source];
  let state = 'code';
  let quote = '';
  for (let index = 0; index < source.length; index += 1) {
    const current = source[index];
    const next = source[index + 1] ?? '';
    if (state === 'line-comment') {
      if (current === '\n') state = 'code';
      else output[index] = ' ';
      continue;
    }
    if (state === 'block-comment') {
      if (current === '*' && next === '/') {
        output[index] = ' ';
        output[index + 1] = ' ';
        index += 1;
        state = 'code';
      } else if (current !== '\n') output[index] = ' ';
      continue;
    }
    if (state === 'string') {
      if (strings && current !== '\n') output[index] = ' ';
      if (current === '\\') {
        if (strings && next !== '\n') output[index + 1] = ' ';
        index += 1;
      } else if (current === quote) {
        state = 'code';
      }
      continue;
    }
    if (current === '/' && next === '/') {
      output[index] = ' ';
      output[index + 1] = ' ';
      index += 1;
      state = 'line-comment';
    } else if (current === '/' && next === '*') {
      output[index] = ' ';
      output[index + 1] = ' ';
      index += 1;
      state = 'block-comment';
    } else if (current === "'" || current === '"' || current === '`') {
      quote = current;
      if (strings) output[index] = ' ';
      state = 'string';
    }
  }
  return output.join('');
}

function maskWxmlComments(source) {
  return source.replace(/<!--[\s\S]*?-->/g, (comment) => comment.replace(/[^\n]/g, ' '));
}

function hasSystemRootMeta(source) {
  const firstNode = /^<page-meta\b([^<>]*)\/?\s*>/.exec(maskWxmlComments(source).trimStart());
  return Boolean(firstNode && /\broot-font-size\s*=\s*(['"])system\1/.test(firstNode[1]));
}

function governedPageRoot(files, sourcePath) {
  const root = pageDirectory(sourcePath);
  if (!root || !/^miniprogram\/pages\/[^/]+$/.test(root)) return null;
  return hasSystemRootMeta(files.get(`${root}/index.wxml`) ?? '') ? root : null;
}

function isGovernedStyle(files, sourcePath) {
  if (!isStyleSource(sourcePath)) return false;
  return Boolean(componentDirectory(sourcePath) || governedPageRoot(files, sourcePath));
}

function maskCssVarCalls(value) {
  const output = [...value];
  const pattern = /\bvar\s*\(/gi;
  for (const match of value.matchAll(pattern)) {
    const start = match.index ?? 0;
    let depth = 0;
    let end = start + match[0].length - 1;
    for (; end < value.length; end += 1) {
      if (value[end] === '(') depth += 1;
      else if (value[end] === ')') {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    for (let index = start; index < end; index += 1) output[index] = ' ';
  }
  return output.join('');
}

const CSS_NAMED_COLORS = new Set(`
  aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown
  burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan
  darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid
  darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet
  deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro
  ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki
  lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray
  lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey
  lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid
  mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue
  mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod
  palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple
  red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue
  slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white
  whitesmoke yellow yellowgreen
`.trim().split(/\s+/));

function hasRawColor(value) {
  const outsideTokens = maskCssVarCalls(value);
  if (/(?:#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|hwb|lab|lch|oklab|oklch|color)\s*\()/i.test(outsideTokens)) return true;
  return [...outsideTokens.matchAll(/\b([a-z]+)\b/gi)].some((match) => CSS_NAMED_COLORS.has(match[1].toLowerCase()));
}

function cssDeclarations(source) {
  const clean = withoutCssComments(source);
  const declarations = [];
  const pattern = /(--?[A-Za-z_][\w-]*|[A-Za-z_][\w-]*)\s*:\s*([^;{}]+)(?:;|(?=\}))/g;
  for (const match of clean.matchAll(pattern)) {
    const index = match.index ?? 0;
    const open = clean.lastIndexOf('{', index);
    const close = clean.lastIndexOf('}', index);
    if (open < close) continue;
    const previousClose = clean.lastIndexOf('}', open - 1);
    const selector = canonicalSpace(clean.slice(previousClose + 1, open)) || ':root';
    declarations.push({
      selector,
      property: match[1].toLowerCase(),
      value: canonicalCssValue(match[2]),
      index,
    });
  }
  return declarations;
}

function isStyleSource(sourcePath) {
  return sourcePath.endsWith('.wxss') && (
    within(sourcePath, 'miniprogram/pages')
    || within(sourcePath, 'miniprogram/components')
    || within(sourcePath, 'miniprogram/custom-tab-bar')
  );
}

function cssSubject(declaration) {
  return `wxss:${declaration.selector}|${declaration.property}|${declaration.value}`;
}

// S2 revision21: one official TDesign Steps adapter, not a second token authority.
const CHECKOUT_STEPS_BRIDGE_PROPERTIES = new Set([
  '--td-step-item-circle-size', '--td-step-item-circle-text-font', '--td-font-body-medium', '--td-spacer',
  '--td-step-item-process-circle-bg', '--td-step-item-process-circle-color', '--td-step-item-process-title-color',
  '--td-step-item-default-circle-bg', '--td-step-item-default-circle-color', '--td-step-item-default-title-color',
  '--td-step-item-line-color', '--td-step-item-finish-circle-bg', '--td-step-item-finish-circle-color',
  '--td-step-item-finish-title-color', '--td-step-item-finish-line-color',
]);
function approvedCheckoutStepsBridge(files, sourcePath, declaration) {
  if (sourcePath !== 'miniprogram/pages/confirm/index.wxss' || declaration.selector !== '.checkout-step'
    || !CHECKOUT_STEPS_BRIDGE_PROPERTIES.has(declaration.property)) return false;
  const authority = new Set(cssDeclarations(files.get('miniprogram/app.wxss') ?? '').map((item) => item.property));
  let references = 0;
  let valid = true;
  const remainder = declaration.value.replace(/var\(\s*(--xy-[\w-]+)\s*\)/g, (_, token) => {
    references++;
    if (!authority.has(token)) valid = false;
    return 'TOKEN';
  });
  // A single token, a sum of tokens, or token-only font shorthand; no literals,
  // fallback values, new semantic tokens, other namespaces or arbitrary CSS.
  return valid && references > 0 && /^(?:TOKEN|calc\(TOKEN\s*\+\s*TOKEN\)|TOKEN\s*\/\s*TOKEN\s*TOKEN)$/.test(remainder);
}

function evaluateTokens(files) {
  const findings = [];
  for (const [sourcePath, source] of files) {
    if (!sourcePath.endsWith('.wxss')) continue;
    const declarations = cssDeclarations(source);
    const governed = isGovernedStyle(files, sourcePath);
    for (const declaration of declarations) {
      if (declaration.property.startsWith('--xy-')
        && sourcePath !== 'miniprogram/app.wxss') {
        findings.push(finding('MPA-TOKEN-001', 'ERROR', sourcePath, lineAt(source, declaration.index), cssSubject(declaration), 'Token declaration exists outside the single runtime authority.', 'Declare the semantic --xy-* token in app.wxss; member-tokens.wxss is a compatibility import only.'));
      }
      if (governed && declaration.property.startsWith('--') && !declaration.property.startsWith('--xy-')
        && !approvedCheckoutStepsBridge(files, sourcePath, declaration)) {
        findings.push(finding('MPA-TOKEN-001', 'ERROR', sourcePath, lineAt(source, declaration.index), cssSubject(declaration), 'A page or component declares a parallel custom-property namespace.', 'Move the semantic value into the approved --xy-* runtime authority and consume that Token.'));
      }
      const customPropertyReferences = [...declaration.value.matchAll(/\bvar\s*\(\s*(--[A-Za-z_][\w-]*)/gi)]
        .map((match) => match[1].toLowerCase());
      if (governed && customPropertyReferences.some((name) => !name.startsWith('--xy-'))) {
        findings.push(finding('MPA-TOKEN-001', 'ERROR', sourcePath, lineAt(source, declaration.index), cssSubject(declaration), 'A page or component consumes a non-Xingyu custom property.', 'Use only the approved --xy-* Token namespace in governed styles.'));
      }
      const legacyRawColor = /(?:#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\()/i.test(declaration.value)
        && !/var\(\s*--xy-/i.test(declaration.value);
      const rawColor = governed ? hasRawColor(declaration.value) : legacyRawColor;
      if (isStyleSource(sourcePath) && !declaration.property.startsWith('--') && rawColor) {
        findings.push(finding('MPA-TOKEN-001', 'ERROR', sourcePath, lineAt(source, declaration.index), cssSubject(declaration), 'Raw color bypasses the existing design Token authority.', 'Replace the raw color with the matching --xy-* semantic token.'));
      }
      if (!isStyleSource(sourcePath)) continue;
      const tokenBacked = customPropertyReferences.some((name) => name.startsWith('--xy-'));
      const dimensionSource = governed ? maskCssVarCalls(declaration.value) : declaration.value;
      const hasFixedDimension = /(?:^|[\s,(])-?\d*\.?\d+(?:rpx|px)\b/i.test(dimensionSource);
      const isGeneralSpacing = /^(?:margin|padding)(?:-(?:top|right|bottom|left|inline|block)(?:-(?:start|end))?)?$/.test(declaration.property)
        || /^(?:gap|row-gap|column-gap)$/.test(declaration.property);
      if (isGeneralSpacing && hasFixedDimension && (!tokenBacked || governed)) {
        findings.push(finding('MPA-TOKEN-001', 'ERROR', sourcePath, lineAt(source, declaration.index), cssSubject(declaration), 'Raw general spacing bypasses the existing spacing scale.', 'Use the matching --xy-space-* or semantic layout Token; register a bounded optical correction as an exact exception.'));
      }
      if (declaration.property === 'border-radius' && hasFixedDimension && (!tokenBacked || governed)) {
        findings.push(finding('MPA-TOKEN-001', 'ERROR', sourcePath, lineAt(source, declaration.index), cssSubject(declaration), 'Raw radius bypasses the existing shape scale.', 'Use a --xy-radius-* semantic Token.'));
      }
      if (declaration.property === 'box-shadow'
        && !tokenBacked
        && !/^(?:none|inherit|initial|unset)$/.test(declaration.value)) {
        findings.push(finding('MPA-TOKEN-001', 'ERROR', sourcePath, lineAt(source, declaration.index), cssSubject(declaration), 'Raw shadow bypasses the existing elevation authority.', 'Use a --xy-shadow-* semantic Token.'));
      }
      if (declaration.property === 'z-index'
        && !tokenBacked
        && !/^(?:0|auto|inherit|initial|unset)$/.test(declaration.value)) {
        findings.push(finding('MPA-TOKEN-001', 'ERROR', sourcePath, lineAt(source, declaration.index), cssSubject(declaration), 'Raw z-index creates an ungoverned stacking layer.', 'Use the matching --xy-z-* semantic Token.'));
      }
    }
  }
  return findings;
}

function staticClassNames(attributes) {
  const match = /\bclass\s*=\s*(['"])(.*?)\1/.exec(attributes);
  if (!match) return [];
  return match[2]
    .replace(/\{\{[\s\S]*?\}\}/g, ' ')
    .split(/\s+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

// A deliberately small numeric subset: positive lengths, resolved variables and
// addition after the existing CSS value canonicalization. Never execute CSS text or infer unknown values.
function touchLengthInPixels(value, variables, seen = new Set()) {
  const source = value.trim();
  const length = /^([0-9]+(?:\.[0-9]+)?)(r?px)$/.exec(source);
  if (length) return Number(length[1]) * (length[2] === 'rpx' ? 320 / 750 : 1);
  const reference = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(source);
  if (reference) {
    if (seen.has(reference[1])) return null;
    const resolved = variables.get(reference[1]) ?? reference[2];
    return resolved === undefined ? null : touchLengthInPixels(resolved, variables, new Set([...seen, reference[1]]));
  }
  if (source.startsWith('calc(') && source.endsWith(')')) {
    const terms = source.slice(5, -1).split('+');
    if (terms.length < 2) return null;
    const numbers = terms.map((term) => touchLengthInPixels(term, variables, seen));
    if (numbers.some((number) => number === null)) return null;
    return numbers.reduce((sum, number) => sum + number, 0);
  }
  return null;
}

function touchValueIsSufficient(value, variables = new Map(), seen = new Set()) {
  if (value.startsWith('calc(')) {
    const pixels = touchLengthInPixels(value, variables, seen);
    return pixels !== null && pixels >= 44;
  }
  const reference = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.+))?\)$/.exec(value);
  if (reference && variables.has(reference[1])) {
    if (seen.has(reference[1])) return false;
    return touchValueIsSufficient(variables.get(reference[1]), variables, new Set([...seen, reference[1]]));
  }
  if (reference && reference[2]) return touchValueIsSufficient(reference[2], variables, seen);
  if (/^var\(\s*--xy-(?:size-touch-min|control-height(?:-large)?)\s*\)$/i.test(value)) return true;
  const pixels = /^([0-9]+(?:\.[0-9]+)?)px$/i.exec(value);
  if (pixels) return Number(pixels[1]) >= 44;
  const responsivePixels = /^([0-9]+(?:\.[0-9]+)?)rpx$/i.exec(value);
  return Boolean(responsivePixels && Number(responsivePixels[1]) * 320 / 750 >= 44);
}

// Resolve only supplied repository sources. No filesystem, network, cross-repository
// or package lookup is permitted when an import is missing or escapes miniprogram.
function resolveTouchStyleSource(files, sourcePath, ancestors = new Set()) {
  if (!within(sourcePath, 'miniprogram') || !sourcePath.endsWith('.wxss') || ancestors.has(sourcePath)) return '';
  const source = files.get(sourcePath);
  if (source === undefined) return '';
  const chain = new Set([...ancestors, sourcePath]);
  return withoutCssComments(source).replace(/@import\s+(?:url\(\s*)?(['"])([^'"]+)\1\s*\)?\s*([^;]*);/gi, (_match, _quote, specifier, condition) => {
    if (/[\\?#%:]/u.test(specifier) || specifier.startsWith('//')) return '';
    const target = path.posix.normalize(specifier.startsWith('/')
      ? `miniprogram${specifier}` : path.posix.join(path.posix.dirname(sourcePath), specifier));
    if (!within(target, 'miniprogram') || !target.endsWith('.wxss')) return '';
    const imported = resolveTouchStyleSource(files, target, chain);
    return condition.trim() ? `@media ${condition.trim()} { ${imported} }` : imported;
  });
}

function touchStyleDeclarations(source, conditional = false) {
  const declarations = [];
  let cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf('{', cursor);
    if (open < 0) break;
    const selector = source.slice(cursor, open).trim();
    let depth = 1;
    let quote = '';
    let end = open + 1;
    for (; end < source.length && depth > 0; end += 1) {
      const char = source[end];
      if (quote) {
        if (char === '\\') end += 1;
        else if (char === quote) quote = '';
      } else if (char === '"' || char === "'") quote = char;
      else if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
    }
    if (depth !== 0) break;
    const body = source.slice(open + 1, end - 1);
    if (/^@(?:media|supports)\b/i.test(selector)) {
      declarations.push(...touchStyleDeclarations(body, true));
    } else if (!selector.startsWith('@')) {
      declarations.push(...cssDeclarations(`${selector}{${body}}`).map((item) => ({ ...item, conditional })));
    }
    cursor = end;
  }
  return declarations;
}

function touchSelectorSpecificity(branch, node, classNames, ancestorClassNames) {
  // A descendant image, pseudo-element or state-only selector cannot prove the
  // dimensions of its parent action. Unsupported selector syntax is not evidence.
  if (/[:[\]+~]/u.test(branch)) return -1;
  const parts = branch.trim().split(/[\s>]+/u).filter(Boolean);
  const terminal = parts.pop() ?? '';
  const ownTag = /^([a-z][\w-]*)/i.exec(terminal)?.[1];
  if (ownTag && ownTag.toLowerCase() !== node.tag.toLowerCase()) return -1;
  if (/[^\w.*#-]/u.test(terminal)) return -1;
  const ownClasses = [...terminal.matchAll(/\.([\w-]+)/gu)].map((match) => match[1]);
  if (ownClasses.some((name) => !classNames.includes(name))) return -1;
  const ownId = /#([\w-]+)/u.exec(terminal)?.[1];
  if (ownId && !new RegExp(`\\bid\\s*=\\s*(['"])${ownId}\\1`).test(node.attributes)) return -1;
  if (!ownTag && !ownClasses.length && !ownId && terminal !== '*') return -1;
  for (const ancestor of parts) {
    // Only an observed ancestor class can prove the ancestor chain here.
    if (!/^(?:[a-z][\w-]*)?(?:\.[\w-]+)+$/iu.test(ancestor)) return -1;
    if ([...ancestor.matchAll(/\.([\w-]+)/gu)].some((match) => !ancestorClassNames.includes(match[1]))) return -1;
  }
  return (branch.match(/#/g)?.length ?? 0) * 100
    + (branch.match(/\./g)?.length ?? 0) * 10
    + parts.filter((part) => /^[a-z]/i.test(part)).length + (ownTag ? 1 : 0);
}

function interactiveNodeHasTouchContract(source, node, ancestorClassNames, variables = new Map()) {
  const classNames = staticClassNames(node.attributes);
  const approvedAction = classNames.some((name) => /^(?:xy-action-(?:primary|secondary|danger)|primary-button|secondary-button)$/.test(name));
  const effective = new Map();
  const declarations = touchStyleDeclarations(source);
  const localVariables = new Map(variables);
  const variablePriority = new Map();
  for (const declaration of declarations) {
    if (!declaration.property.startsWith('--')) continue;
    const specificity = Math.max(...declaration.selector.split(',').map((branch) => touchSelectorSpecificity(branch, node, classNames, ancestorClassNames)));
    if (specificity < 0) continue;
    const priority = specificity + (/!important\s*$/i.test(declaration.value) ? 10_000 : 0);
    if (priority >= (variablePriority.get(declaration.property) ?? -1)) {
      localVariables.set(declaration.property, declaration.conditional ? 'unresolved-conditional' : declaration.value.replace(/\s*!important\s*$/i, ''));
      variablePriority.set(declaration.property, priority);
    }
  }
  for (const declaration of declarations) {
    if (!['height', 'min-height', 'inset'].includes(declaration.property)) continue;
    const branches = declaration.selector.split(',');
    const stateConditional = branches.some((branch) => /:(?:active|hover|focus|focus-visible|focus-within|disabled|enabled|checked)\b/.test(branch));
    const scores = branches.map((branch) => {
      const plain = branch.replace(/:(?:active|hover|focus-visible|focus-within|focus|disabled|enabled|checked)\b/g, '');
      const score = touchSelectorSpecificity(plain, node, classNames, ancestorClassNames);
      return score < 0 ? -1 : score + (branch.match(/:(?:active|hover|focus-visible|focus-within|focus|disabled|enabled|checked)\b/g)?.length ?? 0) * 10;
    });
    const specificity = Math.max(...scores);
    if (specificity < 0) continue;
    const important = /!important\s*$/i.test(declaration.value);
    const value = declaration.value.replace(/\s*!important\s*$/i, '');
    const sufficient = declaration.property === 'inset' ? /^0(?:px|rpx)?$/.test(value) : touchValueIsSufficient(value, localVariables);
    // A media condition may invalidate a default size but cannot prove every viewport.
    if ((declaration.conditional || stateConditional) && sufficient) continue;
    const priority = specificity + (important ? 10_000 : 0);
    const previous = effective.get(declaration.property);
    if (!previous || priority >= previous.priority) effective.set(declaration.property, { priority, sufficient });
  }
  if (effective.size === 0) return approvedAction;
  return [...effective.values()].some((item) => item.sufficient);
}

function selectorMayTargetControl(selector) {
  return selector.split(',').some((branch) => {
    const terminal = branch.trim().split(/[\s>+~]+/u).at(-1) ?? '';
    if (/^image(?:$|[.#[:])/iu.test(terminal)) return false;
    return /(?:^|[.#\s:_-])(?:button|action|control|input|picker|tap|trigger)(?:$|[.#\s:_-])/i.test(branch);
  });
}

function evaluateTypography(files) {
  const findings = [];
  const appStyle = files.get('miniprogram/app.wxss');
  if (appStyle !== undefined) {
    const systemFontDeclarations = cssDeclarations(appStyle).filter((item) => item.property === '--xy-font-family-sans');
    const approvedSystemFont = systemFontDeclarations.length === 1
      && ['-apple-system', 'blinkmacsystemfont', 'pingfang sc', 'microsoft yahei', 'sans-serif']
        .every((name) => systemFontDeclarations[0].value.toLowerCase().includes(name));
    if (!approvedSystemFont || /@font-face\b/i.test(appStyle)) {
      findings.push(finding('MPA-TYPE-001', 'ERROR', 'miniprogram/app.wxss', systemFontDeclarations[0] ? lineAt(appStyle, systemFontDeclarations[0].index) : 1, 'wxss:page|--xy-font-family-sans|system-authority', 'The runtime font authority is not the approved system font stack.', 'Keep one --xy-font-family-sans system stack and do not declare or download a custom runtime font.'));
    }
  }
  for (const [sourcePath, source] of files) {
    if (isStyleSource(sourcePath)) {
      const governed = isGovernedStyle(files, sourcePath);
      for (const declaration of cssDeclarations(source)) {
        const tokenBacked = /var\(\s*--xy-/i.test(declaration.value);
        const systemScaled = /calc\([^)]*1rem[^)]*\)/i.test(declaration.value);
        if (governed
          && declaration.property === 'font'
          && !/^(?:inherit|initial|revert|revert-layer|unset)$/i.test(declaration.value)) {
          findings.push(finding('MPA-TYPE-001', 'ERROR', sourcePath, lineAt(source, declaration.index), cssSubject(declaration), 'Font shorthand bypasses the governed family, size, weight and line-height roles.', 'Set the approved font-* properties with --xy-* typography Tokens instead of font shorthand.'));
        }
        if (['font-size', 'line-height'].includes(declaration.property)
          && (/(?:^|[^\w.-])-?\d*\.?\d+(?:rpx|px|rem|em)\b/i.test(declaration.value)
            || /^-?\d*\.?\d+$/.test(declaration.value))
          && !tokenBacked
          && !systemScaled) {
          findings.push(finding('MPA-TYPE-001', 'ERROR', sourcePath, lineAt(source, declaration.index), cssSubject(declaration), `Raw ${declaration.property} bypasses the typography roles.`, 'Use a --xy-* typography role or the approved system-root calc form.'));
        }
        if (declaration.property === 'font-family'
          && !tokenBacked
          && !/^(?:inherit|initial|unset)$/i.test(declaration.value)) {
          findings.push(finding('MPA-TYPE-001', 'ERROR', sourcePath, lineAt(source, declaration.index), cssSubject(declaration), 'Font family bypasses the system typography authority.', 'Use the approved --xy-font-family-* token; do not load or name a page-local font stack.'));
        }
        if (declaration.property === 'font-weight'
          && !tokenBacked
          && !/^(?:inherit|initial|unset)$/.test(declaration.value)) {
          findings.push(finding('MPA-TYPE-001', 'ERROR', sourcePath, lineAt(source, declaration.index), cssSubject(declaration), 'Raw font weight bypasses the typography roles.', 'Use the matching --xy-text-weight-* Token.'));
        }
        if (['height', 'min-height'].includes(declaration.property)
          && /(?:^|[\s,(])-?\d*\.?\d+(?:rpx|px)\b/i.test(declaration.value)
          && !tokenBacked
          && selectorMayTargetControl(declaration.selector)) {
          findings.push(finding('MPA-TYPE-001', 'ERROR', sourcePath, lineAt(source, declaration.index), cssSubject(declaration), 'Interactive control uses a raw fixed height.', 'Use min-height with the approved --xy-control-* or touch-size Token.'));
        }
      }
    }
    if (/^miniprogram\/pages\/[^/]+\/index\.wxml$/.test(sourcePath)) {
      if (!hasSystemRootMeta(source)) {
        findings.push(finding('MPA-TYPE-001', 'ERROR', sourcePath, 1, 'wxml:page-meta|attribute:root-font-size|missing-or-invalid', 'Page does not opt into the system root font size at its first WXML node.', 'Make <page-meta root-font-size="system" /> the first node for migrated and new pages.'));
      }
    }
    if (sourcePath.endsWith('.wxml') && (componentDirectory(sourcePath) || governedPageRoot(files, sourcePath))) {
      const stylePath = `${path.posix.dirname(sourcePath)}/index.wxss`;
      // Global WXSS applies to pages, but must not cross isolated component styles.
      const globalStyle = pageDirectory(sourcePath) ? resolveTouchStyleSource(files, 'miniprogram/app.wxss') : '';
      const styleSource = `${globalStyle}\n${resolveTouchStyleSource(files, stylePath)}`;
      const variables = new Map();
      for (const declaration of touchStyleDeclarations(styleSource)) {
        if (!declaration.conditional && /^(?:page|:root)$/.test(declaration.selector.trim())
          && declaration.property.startsWith('--')) variables.set(declaration.property, declaration.value);
      }
      const markup = maskWxmlComments(source);
      for (const node of wxmlStartTags(markup).filter((item) => (
        item.tag === 'button'
        || (/\b(?:bind|catch):?tap\s*=/.test(item.attributes)
          && !/\brole\s*=\s*(['"])(?:dialog|none|presentation)\1/i.test(item.attributes))
      ))) {
        if (!interactiveNodeHasTouchContract(styleSource, node, wxmlAncestorClassNames(markup, node.index), variables)) {
          const classes = staticClassNames(node.attributes).join('.') || '<none>';
          findings.push(finding('MPA-TYPE-001', 'ERROR', sourcePath, lineAt(source, node.index), `wxml:${node.tag}|touch-contract:${classes}`, 'Interactive target has no provable 44px minimum touch target.', 'Use an approved xy-action class or declare a min-height backed by --xy-size-touch-min/--xy-control-height.'));
        }
      }
    }
    if (sourcePath.endsWith('.ts') && (pageDirectory(sourcePath) || componentDirectory(sourcePath))) {
      const code = maskJavaScriptTrivia(source);
      for (const match of code.matchAll(/\bwx\.getSystemInfoSync\s*\(/g)) {
        findings.push(finding('MPA-TYPE-001', 'ERROR', sourcePath, lineAt(source, match.index ?? 0), 'ts-callee:wx.getSystemInfoSync', 'Deprecated synchronous system measurement has multiple owners.', 'Use the shared getWindowInfo/getMenuButtonBoundingClientRect measurement module.'));
      }
      for (const match of code.matchAll(/\bwx\.loadFontFace\s*\(/g)) {
        findings.push(finding('MPA-TYPE-001', 'ERROR', sourcePath, lineAt(source, match.index ?? 0), 'ts-callee:wx.loadFontFace', 'Runtime font loading creates a second typography authority.', 'Use the approved system font stack without downloading or loading a page-local font.'));
      }
    }
  }
  return findings;
}

function evaluateComponentIsolation(files, includeUsage = true) {
  const findings = [];
  const componentConfigs = [...files.entries()].filter(([sourcePath]) => /^miniprogram\/components\/[^/]+\/index\.json$/.test(sourcePath));
  const usedComponents = new Set();
  if (includeUsage) {
    for (const [sourcePath, source] of files) {
      if (sourcePath.endsWith('.json')) {
        try {
          const value = JSON.parse(source);
          for (const componentPath of Object.values(value.usingComponents ?? {})) {
            const match = /(?:^|\/)components\/([^/]+)(?:\/index)?$/.exec(String(componentPath));
            if (match) usedComponents.add(match[1]);
          }
        } catch {
          // Product JSON syntax is handled by existing compiler/type gates.
        }
      }
      if (sourcePath.endsWith('.wxml')) {
        for (const match of source.matchAll(/<([a-z][\w-]*-[\w-]+)\b/g)) usedComponents.add(match[1]);
      }
    }
  }
  for (const [sourcePath, source] of componentConfigs) {
    let config;
    try {
      config = JSON.parse(source);
    } catch {
      findings.push(finding('MPA-COMP-001', 'ERROR', sourcePath, 1, 'json:/|invalid', 'Component configuration is invalid JSON.', 'Repair the component configuration.'));
      continue;
    }
    const componentDirectoryPath = path.posix.dirname(sourcePath);
    const componentScriptPath = `${componentDirectoryPath}/index.ts`;
    const componentScript = files.get(componentScriptPath) ?? '';
    const componentCode = maskJavaScriptTrivia(componentScript);
    const scriptIsolation = /\bComponent\s*\(\s*\{[\s\S]*?\boptions\s*:\s*\{[\s\S]*?\bstyleIsolation\s*:\s*(['"])([^'"]+)\1/.exec(componentScript);
    const declaredValues = [
      ...(config.styleIsolation === undefined ? [] : [{ sourcePath, value: config.styleIsolation, kind: 'json' }]),
      ...(scriptIsolation ? [{ sourcePath: componentScriptPath, value: scriptIsolation[2], kind: 'component-call', index: scriptIsolation.index ?? 0 }] : []),
    ];
    if (config.component === true && !declaredValues.some((item) => item.value === 'isolated')) {
      findings.push(finding('MPA-COMP-001', 'ERROR', sourcePath, 1, `json:/styleIsolation|${JSON.stringify(config.styleIsolation ?? null)}`, 'Shared component does not declare isolated style ownership.', 'Set styleIsolation to isolated in component JSON or Component.options, and expose variations through named properties/slots.'));
    }
    for (const declaration of declaredValues.filter((item) => item.value !== 'isolated')) {
      const semanticSubject = declaration.kind === 'json'
        ? `json:/styleIsolation|${JSON.stringify(declaration.value)}`
        : `ts-callee:Component|options.styleIsolation=${canonicalSpace(declaration.value)}`;
      findings.push(finding('MPA-COMP-001', 'ERROR', declaration.sourcePath, declaration.kind === 'json' ? 1 : lineAt(componentScript, declaration.index), semanticSubject, 'Component declares a non-isolated or conflicting style mode.', 'Keep one isolated style ownership declaration and remove shared/apply-shared modes.'));
    }
    for (const match of componentCode.matchAll(/\bwx\.(navigateTo|redirectTo|switchTab|reLaunch|navigateBack)\s*\(/g)) {
      findings.push(finding('MPA-COMP-001', 'ERROR', componentScriptPath, lineAt(componentScript, match.index ?? 0), `ts-callee:wx.${match[1]}`, 'Shared component performs navigation instead of emitting a semantic event.', 'Trigger a bounded component event and let the owning page perform guarded navigation.'));
    }
    for (const match of componentCode.matchAll(/\b(?:mockApi\.)?command\.[A-Za-z_$][\w$]*\s*\(/g)) {
      const callee = canonicalSpace(match[0].replace(/\s*\($/, ''));
      findings.push(finding('MPA-COMP-001', 'ERROR', componentScriptPath, lineAt(componentScript, match.index ?? 0), `ts-callee:${callee}`, 'Shared component performs a business command.', 'Emit a semantic event and keep business commands in the owning page/facade boundary.'));
    }
    const componentName = sourcePath.split('/')[2];
    if (/^(?:loading-view|empty-view|list-footer|common-|base-)/.test(componentName)) {
      findings.push(finding('MPA-COMP-001', 'ERROR', sourcePath, 1, `json:/componentName|${componentName}`, 'Parallel or responsibility-free component name is prohibited.', 'Reuse status-view/page-shell/bottom-actions or choose a bounded semantic owner.'));
    }
    if (includeUsage && !usedComponents.has(componentName)) {
      findings.push(finding('MPA-COMP-001', 'ERROR', sourcePath, 1, `json:/usingComponents|orphan:${componentName}`, `Component ${componentName} has no registered consumer.`, 'Adopt the component in the approved consumers or remove the unused abstraction.'));
    }
  }
  return findings;
}

function matchingParenthesis(code, openIndex) {
  let depth = 0;
  for (let index = openIndex; index < code.length; index += 1) {
    if (code[index] === '(') depth += 1;
    else if (code[index] === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function isInsideApprovedCall(code, targetIndex, pattern) {
  for (const match of code.matchAll(pattern)) {
    const openIndex = (match.index ?? 0) + match[0].lastIndexOf('(');
    const closeIndex = matchingParenthesis(code, openIndex);
    if (openIndex < targetIndex && closeIndex > targetIndex) return true;
  }
  return false;
}

function pageDisposesOwnedControllers(code) {
  return namedFunctionBlocks(code, 'onUnload').some((block) => /\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.dispose\s*\(/.test(block.source));
}

function evaluateAsync(files, policy) {
  const findings = [];
  const globalTimerPattern = /(?<![\w$.])(?:setTimeout|setInterval)\s*\(/g;
  const hostOperationPattern = /\bwx\.(requestPayment|scanCode|chooseMedia)\s*\(/g;
  for (const [sourcePath, source] of files) {
    if (!sourcePath.endsWith('.ts') || !pageDirectory(sourcePath)) continue;
    const code = maskJavaScriptTrivia(source);
    const wxmlPath = `${pageDirectory(sourcePath)}/index.wxml`;
    const visualOnly = policy?.visualOnlyMigrationWxmlPaths?.includes(wxmlPath) ?? false;
    const governed = Boolean(governedPageRoot(files, sourcePath)) && !visualOnly;
    const governedOperations = [];
    for (const match of code.matchAll(globalTimerPattern)) {
      const callee = match[0].slice(0, match[0].indexOf('(')).trim();
      findings.push(finding('MPA-ASYNC-001', 'ERROR', sourcePath, lineAt(source, match.index ?? 0), `ts-callee:${callee}`, 'Page owns a raw timer outside OperationScope.', 'Register the timer with the page OperationScope and clear it during disposal.'));
    }
    for (const match of code.matchAll(hostOperationPattern)) {
      const index = match.index ?? 0;
      const protectedLocally = isInsideApprovedCall(code, index, /\b(?:singleFlight|[A-Za-z_$][\w$]*\.singleFlight)\s*\(/g);
      if (!protectedLocally) {
        findings.push(finding('MPA-ASYNC-001', 'ERROR', sourcePath, lineAt(source, match.index ?? 0), `ts-callee:wx.${match[1]}`, `Host operation wx.${match[1]} is not protected by single-flight.`, 'Dispatch the operation through the page OperationScope singleFlight contract and a stable intent key when valuable.'));
      }
      if (governed) governedOperations.push({ kind: 'operation', index, callee: `wx.${match[1]}`, protectedLocally });
    }
    if (governed) {
      for (const match of code.matchAll(/\b(?:mockApi\.)?command\.([A-Za-z_$][\w$]*)\s*\(/g)) {
        const index = match.index ?? 0;
        const protectedLocally = isInsideApprovedCall(code, index, /\b(?:singleFlight|[A-Za-z_$][\w$]*\.singleFlight)\s*\(/g);
        const callee = `command.${match[1]}`;
        if (!protectedLocally) {
          findings.push(finding('MPA-ASYNC-001', 'ERROR', sourcePath, lineAt(source, index), `ts-callee:${callee}`, `Business operation ${callee} is not protected by local single-flight.`, 'Dispatch the command inside the page OperationScope singleFlight callback with a stable intent key.'));
        }
        governedOperations.push({ kind: 'operation', index, callee, protectedLocally });
      }
      for (const match of code.matchAll(/\bwx\.(navigateTo|redirectTo|switchTab|reLaunch|navigateBack)\s*\(/g)) {
        const index = match.index ?? 0;
        const protectedLocally = isInsideApprovedCall(code, index, /\b(?:navigateOnce|[A-Za-z_$][\w$]*\.navigateOnce)\s*\(/g);
        const callee = `wx.${match[1]}`;
        if (!protectedLocally) {
          findings.push(finding('MPA-ASYNC-001', 'ERROR', sourcePath, lineAt(source, index), `ts-callee:${callee}`, `Navigation ${callee} is not protected by navigateOnce.`, 'Invoke navigation inside the page-owned navigateOnce callback.'));
        }
        governedOperations.push({ kind: 'navigation', index, callee, protectedLocally });
      }
      const protectedOperations = governedOperations.filter((item) => item.protectedLocally);
      if (protectedOperations.length > 0) {
        const needsOperationScope = protectedOperations.some((item) => item.kind === 'operation');
        const hasApprovedOwner = needsOperationScope
          ? /\bcreateOperationScope\s*\(/.test(code)
          : /\bcreateNavigateOnce\s*\(/.test(code);
        if (!hasApprovedOwner || !pageDisposesOwnedControllers(code)) {
          findings.push(finding('MPA-ASYNC-001', 'ERROR', sourcePath, 1, 'ts-callee:page-operation-owner|missing-or-undisposed', 'Guarded operations do not have a page-owned controller disposed from onUnload.', 'Create the approved per-page controller and dispose it from onUnload so late callbacks cannot mutate an unloaded page.'));
        }
      }
    }
  }
  return findings;
}

function wxmlTags(source) {
  const nodes = [];
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    if (source[cursor] !== '<') continue;
    if (source.startsWith('<!--', cursor)) {
      const commentEnd = source.indexOf('-->', cursor + 4);
      cursor = commentEnd < 0 ? source.length : commentEnd + 2;
      continue;
    }
    const closing = source[cursor + 1] === '/';
    const nameStart = cursor + (closing ? 2 : 1);
    if (!/[A-Za-z]/.test(source[nameStart] ?? '')) continue;
    let nameEnd = nameStart + 1;
    while (/[\w-]/.test(source[nameEnd] ?? '')) nameEnd += 1;
    const tag = source.slice(nameStart, nameEnd);
    let quote = '';
    let templateDepth = 0;
    let end = nameEnd;
    for (; end < source.length; end += 1) {
      const current = source[end];
      const next = source[end + 1];
      if (quote) {
        if (current === quote) quote = '';
        continue;
      }
      if (current === '"' || current === "'") {
        quote = current;
        continue;
      }
      if (current === '{' && next === '{') {
        templateDepth += 1;
        end += 1;
        continue;
      }
      if (current === '}' && next === '}' && templateDepth > 0) {
        templateDepth -= 1;
        end += 1;
        continue;
      }
      if (current === '>' && templateDepth === 0) break;
      if (current === '<' && templateDepth === 0) break;
    }
    if (end >= source.length || source[end] !== '>') continue;
    const raw = source.slice(cursor, end + 1);
    const selfClosing = !closing && /\/\s*>$/.test(raw);
    const attributes = closing ? '' : source.slice(nameEnd, end).replace(/\/\s*$/, '');
    nodes.push({ tag, attributes, raw, index: cursor, closing, selfClosing });
    cursor = end;
  }
  return nodes;
}

function wxmlStartTags(source) {
  return wxmlTags(source).filter((node) => !node.closing);
}

function wxmlAncestorClassNames(source, targetIndex) {
  const stack = [];
  for (const node of wxmlTags(source)) {
    if (node.index >= targetIndex) break;
    if (node.closing) {
      const matchingIndex = stack.map((item) => item.tag).lastIndexOf(node.tag);
      if (matchingIndex >= 0) stack.splice(matchingIndex);
    } else if (!node.selfClosing) {
      stack.push(node);
    }
  }
  return [...new Set(stack.flatMap((node) => staticClassNames(node.attributes)))];
}

function evaluateLists(files) {
  const findings = [];
  for (const [sourcePath, source] of files) {
    if (sourcePath.endsWith('.ts') && pageDirectory(sourcePath)) {
      const code = maskJavaScriptTrivia(source);
      for (const match of code.matchAll(/\.slice\(\s*0\s*,\s*(\d+)\s*\)/g)) {
        const limit = Number(match[1]);
        if (limit > 0) {
          findings.push(finding('MPA-LIST-001', 'ERROR', sourcePath, lineAt(source, match.index ?? 0), `ts-callee:Array.prototype.slice(0,${limit})`, `List is silently truncated at ${limit} items.`, 'Use the cursor PageResult contract and explicit hasMore/done state.'));
        }
      }
    }
    if (sourcePath.endsWith('.wxml') && (pageDirectory(sourcePath) || componentDirectory(sourcePath))) {
      const markup = maskWxmlComments(source);
      for (const node of wxmlStartTags(markup)) {
        const forMatch = /\bwx:for\s*=\s*(['"])(.*?)\1/.exec(node.attributes);
        if (!forMatch) continue;
        const keyMatch = /\bwx:key\s*=\s*(['"])(.*?)\1/.exec(node.attributes);
        if (!keyMatch) {
          findings.push(finding('MPA-LIST-001', 'ERROR', sourcePath, lineAt(source, node.index), `wxml:${node.tag}|attribute:wx:for|${canonicalSpace(forMatch[2])}`, 'wx:for is missing a stable wx:key.', 'Bind wx:key to the stable business identifier; do not use array position.'));
        } else if (/^(?:index|\*this|\{\{\s*index\s*\}\})$/i.test(canonicalSpace(keyMatch[2]))) {
          findings.push(finding('MPA-LIST-001', 'ERROR', sourcePath, lineAt(source, node.index), `wxml:${node.tag}|attribute:wx:key|${canonicalSpace(keyMatch[2])}`, 'wx:key uses array position or item identity instead of a stable business identifier.', 'Bind wx:key to an immutable business ID field.'));
        }
      }
    }
  }
  return findings;
}

function namedFunctionBlocks(source, name) {
  const blocks = [];
  const pattern = new RegExp(`\\b${name}\\s*(?:\\([^)]*\\))?\\s*\\{`, 'g');
  for (const match of source.matchAll(pattern)) {
    const start = (match.index ?? 0) + match[0].lastIndexOf('{');
    let depth = 0;
    let end = start;
    for (; end < source.length; end += 1) {
      if (source[end] === '{') depth += 1;
      if (source[end] === '}') {
        depth -= 1;
        if (depth === 0) {
          end += 1;
          break;
        }
      }
    }
    blocks.push({ source: source.slice(start, end), index: match.index ?? 0 });
  }
  return blocks;
}

function evaluateRefresh(files) {
  const findings = [];
  for (const [sourcePath, source] of files) {
    if (!sourcePath.endsWith('.ts') || !pageDirectory(sourcePath)) continue;
    const code = maskJavaScriptTrivia(source);
    for (const match of code.matchAll(/\b(?:mockApi\.)?command\.refreshOrder\s*\(/g)) {
      findings.push(finding('MPA-REFRESH-001', 'ERROR', sourcePath, lineAt(source, match.index ?? 0), 'ts-callee:command.refreshOrder', 'Deprecated refresh command advances Mock runtime state.', 'Use query.orderSnapshot for refresh or explicit command.advanceOrderRuntime for a user-labelled simulation step.'));
    }
    for (const name of ['onPullDownRefresh', 'onReachBottom', 'onScrollLower', 'onLower']) {
      for (const block of namedFunctionBlocks(code, name)) {
        const forbidden = /(?:mockApi\.)?command\.|advanceOrderRuntime\s*\(|refreshMockOrderRuntime\s*\(/.exec(block.source);
        if (forbidden) {
          const callee = canonicalSpace(forbidden[0].replace(/\s*\($/, ''));
          findings.push(finding('MPA-REFRESH-001', 'ERROR', sourcePath, lineAt(source, block.index + (forbidden.index ?? 0)), `ts-callee:${callee}`, `${name} performs a state-advancing command.`, 'Keep refresh/load-more query-only; expose state advancement as an explicit user command.'));
        }
        const cleanupGuaranteed = namedFunctionBlocks(block.source, 'finally')
          .some((finallyBlock) => /\bwx\.stopPullDownRefresh\s*\(/.test(finallyBlock.source));
        if (name === 'onPullDownRefresh' && !cleanupGuaranteed) {
          findings.push(finding('MPA-REFRESH-001', 'ERROR', sourcePath, lineAt(source, block.index), 'ts-callee:onPullDownRefresh.finally', 'Pull-down refresh does not guarantee host refresh cleanup.', 'Call wx.stopPullDownRefresh() from a finally path for success, failure, throw and disposal.'));
        }
      }
    }
  }
  return findings;
}

function visibleTextAfterTag(source, node) {
  const contentStart = node.index + node.raw.length;
  const remainder = source.slice(contentStart);
  const closePattern = new RegExp(`<\\/${node.tag}\\s*>`, 'i');
  const closeMatch = closePattern.exec(remainder);
  const content = closeMatch ? remainder.slice(0, closeMatch.index) : remainder.slice(0, 120);
  const output = [...content];
  for (const child of wxmlStartTags(content)) {
    for (let index = child.index; index < child.index + child.raw.length; index += 1) output[index] = ' ';
  }
  const text = output.join('')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/[A-Za-z][\w-]*\s*>/g, ' ')
    .replace(/\{\{[\s\S]*?\}\}/g, 'value');
  return canonicalSpace(text);
}

function evaluateAccessibility(files) {
  const findings = [];
  for (const [sourcePath, source] of files) {
    if (!sourcePath.endsWith('.wxml') || (!componentDirectory(sourcePath) && !governedPageRoot(files, sourcePath))) continue;
    const markup = maskWxmlComments(source);
    for (const node of wxmlStartTags(markup)) {
      if (!/\b(?:bind|catch):?tap\s*=/.test(node.attributes)) continue;
      const nameProvided = /\baria-label(?:ledby)?\s*=/.test(node.attributes) || visibleTextAfterTag(markup, node).length > 0;
      if (node.tag !== 'button' && !/\brole\s*=/.test(node.attributes)) {
        findings.push(finding('MPA-A11Y-001', 'ERROR', sourcePath, lineAt(source, node.index), `wxml:${node.tag}|attribute:role|missing`, 'Tap target has no semantic role.', 'Use a native button or provide the correct role on the interactive element.'));
      }
      if (!nameProvided) {
        findings.push(finding('MPA-A11Y-001', 'ERROR', sourcePath, lineAt(source, node.index), `wxml:${node.tag}|attribute:aria-label|missing`, 'Tap target has no stable accessible name.', 'Provide aria-label/aria-labelledby or direct meaningful text.'));
      }
      if (/\bdisabled\s*=/.test(node.attributes) && !/\baria-disabled\s*=/.test(node.attributes)) {
        findings.push(finding('MPA-A11Y-001', 'ERROR', sourcePath, lineAt(source, node.index), `wxml:${node.tag}|attribute:aria-disabled|missing`, 'Disabled state is not exposed to accessibility APIs.', 'Bind aria-disabled to the same disabled state.'));
      }
      if (/\bbusy\s*=/.test(node.attributes) && !/\baria-busy\s*=/.test(node.attributes)) {
        findings.push(finding('MPA-A11Y-001', 'ERROR', sourcePath, lineAt(source, node.index), `wxml:${node.tag}|attribute:aria-busy|missing`, 'Busy state is not exposed to accessibility APIs.', 'Bind aria-busy to the same operation state.'));
      }
    }
  }
  return findings;
}

function normalizedDuplicateSource(sourcePath, source) {
  if (sourcePath.endsWith('.ts')) {
    return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  }
  if (sourcePath.endsWith('.wxml')) {
    return source.replace(/<!--[\s\S]*?-->/g, '').replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
  }
  return withoutCssComments(source).replace(/\s+/g, ' ').trim();
}

function duplicateNodeSubject(sourcePath, source, digest, kind) {
  if (sourcePath.endsWith('.wxml')) {
    const tag = wxmlStartTags(source)[0]?.tag ?? 'document';
    return `wxml:${tag}|${kind}:${digest}`;
  }
  if (sourcePath.endsWith('.wxss')) {
    const declaration = cssDeclarations(source)[0];
    return declaration ? `${cssSubject(declaration)}|${kind}:${digest}` : `wxss:document|${kind}:${digest}`;
  }
  const importNode = importNodes(source)[0];
  return importNode ? `ts-import:${importNode.specifier}|${kind}:${digest}` : `ts-callee:module|${kind}:${digest}`;
}

function nearDuplicateSignature(sourcePath, source, minimumTokens) {
  const tokens = sourcePath.endsWith('.wxss')
    ? cssDeclarations(source).map((item) => item.property)
    : sourcePath.endsWith('.wxml')
      ? wxmlStartTags(source).map((item) => item.tag)
      : [...source.matchAll(/\b([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(/g)].map((match) => match[1]);
  if (tokens.length < minimumTokens) return null;
  return sha256(tokens.join('\0'));
}

function evaluateDuplicates(files, policy) {
  const findings = [];
  const candidates = [...files.entries()].filter(([sourcePath]) => (
    /\.(?:ts|wxml|wxss)$/.test(sourcePath)
    && (pageDirectory(sourcePath) || componentDirectory(sourcePath))
  ));
  const exactGroups = new Map();
  const nearGroups = new Map();
  for (const [sourcePath, source] of candidates) {
    const normalized = normalizedDuplicateSource(sourcePath, source);
    if (normalized.length < policy.thresholds.duplicateMinCharacters) continue;
    const exactKey = `${path.posix.extname(sourcePath)}:${sha256(normalized)}`;
    const exactGroup = exactGroups.get(exactKey) ?? [];
    exactGroup.push([sourcePath, source]);
    exactGroups.set(exactKey, exactGroup);
    const signature = nearDuplicateSignature(sourcePath, source, policy.thresholds.nearDuplicateMinTokens);
    if (signature) {
      const nearKey = `${path.posix.extname(sourcePath)}:${signature}`;
      const nearGroup = nearGroups.get(nearKey) ?? [];
      nearGroup.push([sourcePath, source, exactKey]);
      nearGroups.set(nearKey, nearGroup);
    }
  }
  const exactPaths = new Set();
  for (const [key, group] of [...exactGroups.entries()].sort(([left], [right]) => compareText(left, right))) {
    if (group.length < 2) continue;
    const digest = key.slice(key.indexOf(':') + 1);
    const sortedGroup = group.sort(([left], [right]) => compareText(left, right));
    for (const [sourcePath, source] of sortedGroup.slice(1)) {
      exactPaths.add(sourcePath);
      findings.push(finding('MPA-DUP-001', 'ERROR', sourcePath, 1, duplicateNodeSubject(sourcePath, source, digest, 'exact'), `Exact implementation duplicate of ${sortedGroup[0][0]}.`, 'Reuse an approved component/shared owner or keep one bounded implementation.'));
    }
  }
  for (const [key, group] of [...nearGroups.entries()].sort(([left], [right]) => compareText(left, right))) {
    const distinctExact = new Set(group.map((item) => item[2]));
    if (group.length < 2 || distinctExact.size < 2) continue;
    const digest = key.slice(key.indexOf(':') + 1);
    const sortedGroup = group.sort(([left], [right]) => compareText(left, right));
    for (const [sourcePath, source] of sortedGroup.slice(1)) {
      if (exactPaths.has(sourcePath)) continue;
      findings.push(finding('MPA-DUP-001', 'WARN', sourcePath, 1, duplicateNodeSubject(sourcePath, source, digest, 'candidate'), `Near-duplicate candidate shares a structural signature with ${sortedGroup[0][0]}.`, 'Review semantics; extract only after the component promotion contract is satisfied.'));
    }
  }
  return findings;
}

function exceptionTarget(exception) {
  if (!exception || typeof exception !== 'object' || Array.isArray(exception)) return 'target=<invalid>';
  const safe = (value, maximum) => canonicalSpace(String(value ?? '<invalid>')).slice(0, maximum);
  return `target=${safe(exception.ruleId, 32)}:${safe(exception.path, 180)} fingerprint=${safe(exception.fingerprint, 64)}`;
}

function exceptionIdentityDigest(exception) {
  return sha256(['mpa-legacy-exception-v1', exception?.ruleId ?? '', exception?.path ?? '', exception?.fingerprint ?? ''].join('\0'));
}

function legacyIdentityContract(policy) {
  const blob = typeof policy.legacyBaselineIdentityDigests === 'string' ? policy.legacyBaselineIdentityDigests : '';
  const retired = new Set(Array.isArray(policy.retiredLegacyIdentityDigests) ? policy.retiredLegacyIdentityDigests : []);
  const baseline = new Set([...(blob.match(/.{64}/gu) ?? []), ...retired]);
  return { baseline, retired };
}

function exceptionFault(index, code, message, remediation, exception = null) {
  return finding(
    'MPA-EXC-001',
    'ERROR',
    POLICY_PATH,
    1,
    `json:/exceptions/${index}|${code}`,
    `Exception[${index}] ${exceptionTarget(exception)}: ${message}`,
    remediation,
  );
}

function validateException(exception, index, policy) {
  const faults = [];
  const requiredKeys = ['ruleId', 'path', 'fingerprint', 'reason', 'owner', 'removeByVersion'];
  if (!exception || typeof exception !== 'object' || Array.isArray(exception)) {
    return [exceptionFault(index, 'not-object', 'Architecture exception must be an object.', 'Replace it with one exact six-field exception.', exception)];
  }
  const keys = Object.keys(exception).sort(compareText);
  if (keys.join('\0') !== [...requiredKeys].sort(compareText).join('\0')) {
    faults.push(exceptionFault(index, 'field-set', 'Architecture exception must contain exactly the six approved fields.', 'Use ruleId/path/fingerprint/reason/owner/removeByVersion only.', exception));
  }
  if (!RULE_IDS.includes(exception.ruleId) || NON_WAIVABLE_RULES.has(exception.ruleId)) {
    faults.push(exceptionFault(index, 'rule-id', 'Exception targets an unknown or non-waivable Rule ID.', 'Remove the exception or repair the implementation.', exception));
  }
  if (typeof exception.path !== 'string'
    || exception.path.length === 0
    || exception.path.startsWith('./')
    || exception.path.includes('\\')
    || ['*', '?', '[', ']', '{', '}'].some((character) => exception.path.includes(character))
    || exception.path.endsWith('/')) {
    faults.push(exceptionFault(index, 'path', 'Exception path must be one exact repository-relative POSIX file path.', 'Replace globs/directories with the exact finding path.', exception));
  }
  if (typeof exception.fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(exception.fingerprint)) {
    faults.push(exceptionFault(index, 'fingerprint', 'Exception fingerprint must be one lowercase SHA-256.', 'Copy the exact stable finding fingerprint after semantic review.', exception));
  }
  if (typeof exception.reason !== 'string' || !/^LEGACY 1\.0\.0\.13: .{8,180}$/.test(exception.reason)) {
    faults.push(exceptionFault(index, 'reason', 'Exception reason must identify a reviewed 1.0.0.13 legacy fact.', 'Use LEGACY 1.0.0.13: followed by a bounded factual reason.', exception));
  }
  if (typeof exception.owner !== 'string' || !/^[a-z0-9][a-z0-9._-]{1,63}$/.test(exception.owner)) {
    faults.push(exceptionFault(index, 'owner', 'Exception owner must be a controlled non-empty identifier.', 'Set a stable lowercase owner identifier.', exception));
  }
  const basis = parseVersion(policy.basisVersion);
  const target = parseVersion(policy.targetVersion);
  const removal = parseVersion(exception.removeByVersion);
  if (!removal || compareVersion(removal, basis) <= 0) {
    faults.push(exceptionFault(index, 'remove-version', 'Exception removal version must be later than basisVersion.', 'Set a finite four-part removal version after the basis.', exception));
  } else if (compareVersion(target, removal) >= 0) {
    faults.push(exceptionFault(index, 'expired', 'Architecture exception has expired for the target version.', 'Remove the exception and remediate the finding before this target.', exception));
  }
  return faults;
}

function applyExceptions(rawFindings, policy) {
  const faults = [];
  const valid = [];
  const duplicateKeys = new Map();
  const { baseline, retired } = legacyIdentityContract(policy);
  const declaredLiveDigests = new Set();
  let newExceptionCount = 0;
  let pilotExceptionCount = 0;
  policy.exceptions.forEach((exception, index) => {
    const identityDigest = exceptionIdentityDigest(exception);
    declaredLiveDigests.add(identityDigest);
    const validation = validateException(exception, index, policy);
    faults.push(...validation);
    if (validation.length === 0) {
      const key = `${exception.ruleId}\0${exception.path}\0${exception.fingerprint}`;
      const indexes = duplicateKeys.get(key) ?? [];
      indexes.push(index);
      duplicateKeys.set(key, indexes);
      if (!baseline.has(identityDigest)) {
        newExceptionCount += 1;
        faults.push(exceptionFault(index, 'new-exception', 'Exception identity is not in the locked 1.0.0.13 legacy baseline.', 'Repair the new or migrated semantic node; updating the baseline is prohibited.', exception));
      } else if (retired.has(identityDigest)) {
        pilotExceptionCount += 1;
        faults.push(exceptionFault(index, 'retired-exception', 'A retired or migrated legacy identity cannot be enabled again.', 'Keep the retired identity and repair the regressed semantic node.', exception));
      } else {
        valid.push({ ...exception, index, identityDigest });
      }
    }
  });
  const missingPartition = [...baseline].filter((digest) => !declaredLiveDigests.has(digest) && !retired.has(digest));
  if (missingPartition.length > 0) {
    faults.push(exceptionFault(policy.exceptions.length, 'baseline-partition', `${missingPartition.length} locked legacy identities are neither live nor retired.`, 'When deleting a repaired exception, move its identity digest to retiredLegacyIdentityDigests.'));
  }
  for (const indexes of duplicateKeys.values()) {
    if (indexes.length > 1) {
      for (const index of indexes) faults.push(exceptionFault(index, 'collision', 'Multiple exceptions target the same finding identity.', 'Keep exactly one reviewed exception per finding.', policy.exceptions[index]));
    }
  }

  const matchesByFinding = new Map();
  for (const exception of valid) {
    const exact = rawFindings.filter((item) => item.ruleId === exception.ruleId && item.path === exception.path && item.fingerprint === exception.fingerprint);
    if (exact.length === 0) {
      faults.push(exceptionFault(exception.index, 'stale-or-drift', 'Exception no longer matches any current semantic finding; the node is stale or its fingerprint drifted.', 'Revert unapproved drift or remove the stale exception; never refresh automatically.', exception));
      continue;
    }
    if (exact.length > 1) {
      faults.push(exceptionFault(exception.index, 'collision', 'One exception matches multiple findings.', 'Make the parser subject and exception identity one-to-one.', exception));
      continue;
    }
    const key = `${exact[0].ruleId}\0${exact[0].path}\0${exact[0].fingerprint}`;
    const indexes = matchesByFinding.get(key) ?? [];
    indexes.push(exception.index);
    matchesByFinding.set(key, indexes);
  }
  for (const [key, indexes] of matchesByFinding) {
    if (indexes.length > 1) {
      for (const index of indexes) faults.push(exceptionFault(index, 'collision', 'One finding is matched by multiple exceptions.', 'Keep one exact exception.', policy.exceptions[index]));
      matchesByFinding.delete(key);
    }
  }
  const active = rawFindings.filter((item) => !matchesByFinding.has(`${item.ruleId}\0${item.path}\0${item.fingerprint}`));
  const waivedCount = rawFindings.length - active.length;
  return {
    active: [...active, ...faults],
    waivedCount,
    legacyWaivedCount: waivedCount,
    pilotExceptionCount,
    newExceptionCount,
    exceptionFaultCount: faults.length,
  };
}

function evaluateRepository(files, policy) {
  const rawFindings = disambiguateRepeatedSemanticNodes([
    ...evaluateAuthority(files, policy),
    ...evaluateDependencies(files),
    ...evaluateTokens(files),
    ...evaluateTypography(files),
    ...evaluateComponentIsolation(files),
    ...evaluateAsync(files, policy),
    ...evaluateLists(files, policy),
    ...evaluateRefresh(files),
    ...evaluateAccessibility(files),
    ...evaluateDuplicates(files, policy),
  ]);
  const exceptionResult = applyExceptions(rawFindings, policy);
  return { rawFindings, ...exceptionResult };
}

function fixtureFiles(fixture) {
  if (!fixture.files || typeof fixture.files !== 'object' || Array.isArray(fixture.files)) {
    throw new PolicyDamage('Fixture files must be an object');
  }
  return new Map(Object.entries(fixture.files).map(([sourcePath, source]) => [sourcePath, normalizeText(String(source))]));
}

function fixtureCases(fixture, fixturePath) {
  const hasFiles = fixture.files !== undefined;
  const hasCases = fixture.cases !== undefined;
  if (hasFiles === hasCases) {
    throw new PolicyDamage(`Fixture must declare exactly one files object or cases array: ${fixturePath}`);
  }
  if (hasFiles) return [{ name: 'default', files: fixture.files }];
  if (!Array.isArray(fixture.cases) || fixture.cases.length < 2) {
    throw new PolicyDamage(`Fixture cases must contain at least two counterexamples: ${fixturePath}`);
  }
  const names = new Set();
  return fixture.cases.map((fixtureCase, index) => {
    if (!fixtureCase || typeof fixtureCase !== 'object' || Array.isArray(fixtureCase)
      || Object.keys(fixtureCase).sort(compareText).join('\0') !== 'files\0name'
      || typeof fixtureCase.name !== 'string'
      || !/^[a-z0-9][a-z0-9-]{2,63}$/.test(fixtureCase.name)
      || names.has(fixtureCase.name)) {
      throw new PolicyDamage(`Invalid or duplicate fixture case at ${fixturePath}#${index}`);
    }
    names.add(fixtureCase.name);
    fixtureFiles(fixtureCase);
    return fixtureCase;
  });
}

function evaluateExceptionFixture(files, policy) {
  const source = files.get(POLICY_PATH);
  if (!source) return [exceptionFault(0, 'missing-policy', 'Fixture Policy is missing.', 'Provide a Policy fixture.')];
  let fixturePolicy;
  try {
    fixturePolicy = JSON.parse(source);
  } catch {
    return [exceptionFault(0, 'invalid-policy', 'Fixture Policy JSON is invalid.', 'Provide valid JSON.')];
  }
  const syntheticFinding = finding(
    'MPA-DEP-001',
    'ERROR',
    'miniprogram/pages/fixture/index.ts',
    1,
    'ts-import:../../shared/fixture/index',
    'Synthetic exception fixture finding.',
    'Use the approved facade.',
  );
  const exceptions = (fixturePolicy.exceptions ?? []).map((exception) => ({
    ...exception,
    fingerprint: exception.fingerprint === '$FIXTURE_FINDING' ? syntheticFinding.fingerprint : exception.fingerprint,
  }));
  const fixtureBaseline = [...new Set(exceptions.map(exceptionIdentityDigest))].sort(compareText).join('');
  // Synthetic collision fixtures use their original pre-deadline target independently of the product version.
  const merged = { ...policy, targetVersion: '1.0.0.16', legacyBaselineIdentityDigests: fixtureBaseline, retiredLegacyIdentityDigests: [], exceptions };
  return applyExceptions([syntheticFinding], merged).active.filter((item) => item.ruleId === 'MPA-EXC-001');
}

function evaluateOrdinalContract(contract, policy) {
  if (!contract || typeof contract !== 'object'
    || typeof contract.path !== 'string'
    || ['base', 'formatVariant', 'appended', 'removed'].some((key) => typeof contract[key] !== 'string')) {
    throw new PolicyDamage('MPA-EXC-001 accept fixture must declare the semantic ordinal contract');
  }
  const scan = (source) => sortFindings(disambiguateRepeatedSemanticNodes(evaluateTokens(new Map([
    [contract.path, normalizeText(source)],
  ]))));
  const base = scan(contract.base);
  const formatVariant = scan(contract.formatVariant);
  const appended = scan(contract.appended);
  const removed = scan(contract.removed);
  const baseFingerprints = base.map((item) => item.fingerprint);
  const failures = [];
  const reject = (code, message) => failures.push(exceptionFault(0, `ordinal-${code}`, message, 'Keep occurrence ordinals semantic, deterministic and independent from lines/comments/whitespace.'));
  if (base.length !== 2 || formatVariant.length !== 2 || baseFingerprints.join('\0') !== formatVariant.map((item) => item.fingerprint).join('\0')) {
    reject('format-stability', 'CRLF, comments or non-semantic whitespace changed occurrence fingerprints.');
  }
  if (appended.length !== 3 || baseFingerprints.join('\0') !== appended.slice(0, 2).map((item) => item.fingerprint).join('\0')) {
    reject('append', 'Appending one identical semantic node did not preserve prior identities and add exactly one finding.');
  }
  if (removed.length !== 1 || removed[0]?.fingerprint !== base[0]?.fingerprint) {
    reject('remove-identity', 'Removing one repeated node did not retain the first semantic occurrence identity.');
  }
  if (base.length === 2) {
    const exactException = {
      ruleId: base[1].ruleId,
      path: base[1].path,
      fingerprint: base[1].fingerprint,
      reason: 'LEGACY 1.0.0.13: reviewed occurrence ordinal contract fixture for exact matching.',
      owner: 'miniprogram-architecture',
      removeByVersion: '1.0.1.6',
    };
    const exactDigest = exceptionIdentityDigest(exactException);
    const exactPolicy = { ...policy, targetVersion: '1.0.1.5', legacyBaselineIdentityDigests: exactDigest, retiredLegacyIdentityDigests: [], exceptions: [exactException] };
    const exactResult = applyExceptions(base, exactPolicy);
    if (exactResult.waivedCount !== 1 || exactResult.active.some((item) => item.ruleId === 'MPA-EXC-001')) {
      reject('one-to-one', 'One exact occurrence exception did not match exactly one semantic finding.');
    }
    const expiredResult = applyExceptions(base, { ...exactPolicy, targetVersion: exactException.removeByVersion });
    if (expiredResult.waivedCount !== 0 || !expiredResult.active.some((item) => item.ruleId === 'MPA-EXC-001' && item.message.includes('has expired'))) {
      reject('expired', 'An exception was allowed to waive a finding at its removal version.');
    }
    const removedResult = applyExceptions(removed, exactPolicy);
    if (!removedResult.active.some((item) => item.ruleId === 'MPA-EXC-001' && item.message.includes('no longer matches'))) {
      reject('stale', 'Deleting the excepted occurrence did not create a stale exception failure.');
    }
    const nonBaselineResult = applyExceptions(base, { ...exactPolicy, legacyBaselineIdentityDigests: '', retiredLegacyIdentityDigests: [], exceptions: [exactException] });
    if (nonBaselineResult.newExceptionCount !== 1 || !nonBaselineResult.active.some((item) => item.message.includes('not in the locked'))) {
      reject('new-exception', 'A non-baseline exception was not rejected as a new exception.');
    }
    const retiredResult = applyExceptions(base, { ...exactPolicy, retiredLegacyIdentityDigests: [exactDigest] });
    if (retiredResult.pilotExceptionCount !== 1 || !retiredResult.active.some((item) => item.message.includes('cannot be enabled again'))) {
      reject('retired', 'A retired migrated exception was allowed to become live again.');
    }
    const missingPartitionResult = applyExceptions(removed, { ...exactPolicy, exceptions: [] });
    if (!missingPartitionResult.active.some((item) => item.message.includes('neither live nor retired'))) {
      reject('partition', 'Deleting a live exception without retiring its identity did not fail.');
    }
    const repairedResult = applyExceptions(removed, { ...exactPolicy, exceptions: [], retiredLegacyIdentityDigests: [exactDigest] });
    if (repairedResult.active.some((item) => item.ruleId === 'MPA-EXC-001')) {
      reject('retire-after-repair', 'A removed finding with an explicitly retired legacy identity did not pass.');
    }
  }
  return failures;
}

function evaluateFixtureRule(ruleId, files, policy) {
  switch (ruleId) {
    case 'MPA-AUTH-001': return evaluateAuthority(files, policy, true);
    case 'MPA-DEP-001': return evaluateDependencies(files);
    case 'MPA-TOKEN-001': return evaluateTokens(files);
    case 'MPA-TYPE-001': return evaluateTypography(files);
    case 'MPA-COMP-001': return evaluateComponentIsolation(files, false);
    case 'MPA-ASYNC-001': return evaluateAsync(files, policy);
    case 'MPA-LIST-001': return evaluateLists(files, policy);
    case 'MPA-REFRESH-001': return evaluateRefresh(files);
    case 'MPA-A11Y-001': return evaluateAccessibility(files);
    case 'MPA-DUP-001': return evaluateDuplicates(files, policy);
    case 'MPA-EXC-001': return evaluateExceptionFixture(files, policy);
    default: throw new PolicyDamage(`Unknown fixture Rule ID: ${ruleId}`);
  }
}

function runFixtures(policy) {
  const absoluteDirectory = path.join(PROJECT_ROOT, ...FIXTURE_DIRECTORY.split('/'));
  const fixturePaths = collectFiles(absoluteDirectory, (absolutePath) => absolutePath.endsWith('.json'))
    .map((absolutePath) => toPosix(path.relative(PROJECT_ROOT, absolutePath)))
    .sort(compareText);
  const expectedNames = RULE_IDS.flatMap((ruleId) => [`${ruleId}.accept.json`, `${ruleId}.reject.json`]).sort(compareText);
  const actualNames = fixturePaths.map((sourcePath) => path.posix.basename(sourcePath)).sort(compareText);
  if (actualNames.join('\0') !== expectedNames.join('\0')) {
    throw new PolicyDamage('Fixture set must contain exactly one accept and reject case for every stable Rule ID');
  }
  const failures = [];
  for (const fixturePath of fixturePaths) {
    const fixture = parseJson(readProjectFile(fixturePath), fixturePath);
    if (fixture.schemaVersion !== '1.0'
      || !RULE_IDS.includes(fixture.ruleId)
      || !['accept', 'reject'].includes(fixture.case)
      || fixturePath !== `${FIXTURE_DIRECTORY}/${fixture.ruleId}.${fixture.case}.json`) {
      throw new PolicyDamage(`Invalid fixture identity: ${fixturePath}`);
    }
    const cases = fixtureCases(fixture, fixturePath);
    for (const fixtureCase of cases) {
      const findings = evaluateFixtureRule(fixture.ruleId, fixtureFiles(fixtureCase), policy);
      if (fixture.ruleId === 'MPA-EXC-001' && fixture.case === 'accept') {
        findings.push(...evaluateOrdinalContract(fixture.ordinalContract, policy));
      }
      const passed = fixture.case === 'accept' ? findings.length === 0 : findings.some((item) => item.severity === 'ERROR');
      if (!passed) {
        failures.push(finding('MPA-AUTH-001', 'ERROR', fixturePath, 1, `json:/fixtureResult/${fixtureCase.name}|${fixture.case}`, `Architecture ${fixture.case} fixture case ${fixtureCase.name} did not produce the expected result for ${fixture.ruleId}.`, 'Repair the rule parser and keep every acceptance/rejection counterexample.'));
      }
    }
  }
  return { fixtureCount: fixturePaths.length, failures };
}

function outputReport(policy, manifestSha, filesCount, fixtureCount, findings, exceptionCounts = {}) {
  const sorted = sortFindings(findings);
  const errorCount = sorted.filter((item) => item.severity === 'ERROR').length;
  const warningCount = sorted.filter((item) => item.severity === 'WARN').length;
  return {
    schemaVersion: policy?.schemaVersion ?? '1.0',
    policyVersion: policy?.policyVersion ?? 'BROKEN',
    basisVersion: policy?.basisVersion ?? 'UNKNOWN',
    targetVersion: policy?.targetVersion ?? 'UNKNOWN',
    sourceManifestSha256: manifestSha,
    verdict: errorCount > 0 ? 'FAIL' : 'PASS',
    summary: {
      scannedFiles: filesCount,
      fixtureCount,
      errorCount,
      warningCount,
      waivedCount: exceptionCounts.waivedCount ?? 0,
      legacyWaivedCount: exceptionCounts.legacyWaivedCount ?? 0,
      pilotExceptionCount: exceptionCounts.pilotExceptionCount ?? 0,
      newExceptionCount: exceptionCounts.newExceptionCount ?? 0,
    },
    findings: sorted,
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.some((value) => value !== '--fixtures-only') || args.filter((value) => value === '--fixtures-only').length > 1) {
    throw new PolicyDamage('Only the diagnostic --fixtures-only option is supported; update/baseline/bypass options do not exist');
  }
  const repositoryFiles = collectRepositorySources();
  const manifestSha = sourceManifestSha256(repositoryFiles);
  const policy = readPolicy(repositoryFiles);
  const fixtureResult = runFixtures(policy);
  if (args.includes('--fixtures-only')) {
    const report = outputReport(policy, manifestSha, 0, fixtureResult.fixtureCount, fixtureResult.failures);
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = report.verdict === 'PASS' ? 0 : 1;
    return;
  }
  const result = evaluateRepository(repositoryFiles, policy);
  const report = outputReport(
    policy,
    manifestSha,
    repositoryFiles.size,
    fixtureResult.fixtureCount,
    [...fixtureResult.failures, ...result.active],
    result,
  );
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.verdict === 'PASS' ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    const report = {
      schemaVersion: '1.0',
      policyVersion: 'BROKEN',
      basisVersion: 'UNKNOWN',
      targetVersion: 'UNKNOWN',
      sourceManifestSha256: '0'.repeat(64),
      verdict: 'BROKEN',
      summary: { scannedFiles: 0, fixtureCount: 0, errorCount: 1, warningCount: 0, waivedCount: 0, legacyWaivedCount: 0, pilotExceptionCount: 0, newExceptionCount: 0 },
      findings: [finding('MPA-EXC-001', 'ERROR', POLICY_PATH, 1, 'json:/parser|damage', error instanceof Error ? error.message : String(error), 'Repair the Policy/parser contract; bypass and automatic baseline updates are prohibited.')],
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.exitCode = 2;
  }
}

export {
  RULE_IDS,
  collectRepositorySources,
  evaluateOrdinalContract,
  evaluateFixtureRule,
  evaluateRepository,
  fingerprint,
  normalizeText,
  readPolicy,
  sourceManifestSha256,
};
