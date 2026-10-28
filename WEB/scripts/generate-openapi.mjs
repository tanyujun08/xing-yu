import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const contractRoot = join(root, 'openapi');
const output = join(root, 'src', 'shared', 'api', 'generated', 'schema.d.ts');
const lockOutput = join(root, 'openapi.lock.json');
const arguments_ = process.argv.slice(2);
if (
  arguments_.length > 1 ||
  (arguments_.length === 1 && arguments_[0] !== '--check')
) {
  throw new Error('Usage: node scripts/generate-openapi.mjs [--check]');
}
const checkOnly = arguments_[0] === '--check';
// Contract text follows the tracked LF convention on every platform.
const normalizeText = (text) => text.replaceAll('\r\n', '\n');
const rootDocument = normalizeText(
  await readFile(join(contractRoot, 'openapi.yaml'), 'utf8'),
);
const revisionMatches = [
  ...rootDocument.matchAll(
    /^x-contract-revision:\s*(XY-[0-9]{8}-(?:[0-9]{3}|[a-f0-9]{32}))\s*$/gm,
  ),
];
if (revisionMatches.length !== 1) {
  throw new Error('openapi.yaml must define one Change-backed x-contract-revision');
}
const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(
  await readFile(join(root, 'package-lock.json'), 'utf8'),
);
const installedGenerator = JSON.parse(
  await readFile(
    join(root, 'node_modules', 'openapi-typescript', 'package.json'),
    'utf8',
  ),
);
const generatorVersion = packageJson.devDependencies?.['openapi-typescript'];
if (!/^\d+\.\d+\.\d+$/.test(generatorVersion ?? '')) {
  throw new Error('package.json must pin an exact openapi-typescript version');
}
const lockedGenerator = packageLock.packages?.['node_modules/openapi-typescript'];
if (
  packageLock.packages?.['']?.devDependencies?.['openapi-typescript'] !==
    generatorVersion ||
  lockedGenerator?.version !== generatorVersion ||
  installedGenerator.version !== generatorVersion ||
  !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(lockedGenerator?.integrity ?? '')
) {
  throw new Error('openapi-typescript package, lock, and installed versions drifted');
}
const schema = await openapiTS(pathToFileURL(join(contractRoot, 'openapi.yaml')));
const generatedSchema = normalizeText(astToString(schema));

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }),
  );
  return files.flat().sort();
}

const hash = createHash('sha256');
for (const path of await listFiles(contractRoot)) {
  hash.update(relative(contractRoot, path).replaceAll('\\', '/'));
  hash.update('\0');
  hash.update(normalizeText(await readFile(path, 'utf8')));
  hash.update('\0');
}

const generatedLock = `${JSON.stringify(
  {
    contract_revision: revisionMatches[0][1],
    sha256: hash.digest('hex'),
    generator: `openapi-typescript@${generatorVersion}`,
    generator_integrity: lockedGenerator.integrity,
  },
  null,
  2,
)}\n`;

if (checkOnly) {
  const currentSchema = await readFile(output, 'utf8');
  const currentLock = await readFile(lockOutput, 'utf8');
  if (
    normalizeText(currentSchema) !== generatedSchema ||
    normalizeText(currentLock) !== generatedLock
  ) {
    throw new Error('Generated OpenAPI types or lock drifted; run npm run generate:api');
  }
} else {
  await Promise.all([
    writeFile(output, generatedSchema, 'utf8'),
    writeFile(lockOutput, generatedLock, 'utf8'),
  ]);
}
