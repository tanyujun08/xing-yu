import { existsSync, statSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const repositoryRoot = path.resolve(import.meta.dirname, '..')
const args = process.argv.slice(2)
const validateOnly = args.includes('--validate-only')
const cliFiles = []

for (let index = 0; index < args.length; index += 1) {
  const value = args[index]
  if (value === '--validate-only') continue
  if (value !== '--test-file' || index + 1 >= args.length) {
    throw new Error(`Unsupported argument: ${value}`)
  }
  cliFiles.push(args[index + 1])
  index += 1
}

function readSelectedFiles() {
  if (cliFiles.length > 0) return cliFiles
  const encoded = process.env.XINGYU_ADMIN_TEST_FILES_JSON
  if (encoded === undefined || encoded === '') return []
  let parsed
  try {
    parsed = JSON.parse(encoded)
  } catch {
    throw new Error('XINGYU_ADMIN_TEST_FILES_JSON must be valid JSON.')
  }
  if (!Array.isArray(parsed)) {
    throw new Error('XINGYU_ADMIN_TEST_FILES_JSON must be a JSON array.')
  }
  return parsed
}

function validateSelectedFiles(values) {
  if (values.some((value) => typeof value !== 'string')) {
    throw new Error('Every selected Admin test path must be a string.')
  }
  if (new Set(values).size !== values.length) {
    throw new Error('Selected Admin test paths must be unique.')
  }
  for (const value of values) {
    if (!/^src\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.test\.(?:ts|tsx)$/.test(value)) {
      throw new Error(`Selected Admin test path is outside the allowed unit-test scope: ${value}`)
    }
    const fullPath = path.resolve(repositoryRoot, ...value.split('/'))
    const relative = path.relative(repositoryRoot, fullPath)
    if (relative.startsWith('..') || path.isAbsolute(relative) || !existsSync(fullPath) || !statSync(fullPath).isFile()) {
      throw new Error(`Selected Admin test file does not exist inside the repository: ${value}`)
    }
  }
}

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: repositoryRoot,
    env: process.env,
    shell: false,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(' ')} exited ${result.status}`)
  }
}

const selectedTestFiles = readSelectedFiles()
validateSelectedFiles(selectedTestFiles)
const mode = selectedTestFiles.length > 0 ? 'TARGETED' : 'FULL'
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const testArgv = ['vitest', 'run', ...selectedTestFiles]
const plan = [
  ['run', 'check:api'],
  ['run', 'lint'],
  ...(mode === 'TARGETED'
    ? [['exec', '--', 'vitest', 'run', ...selectedTestFiles]]
    : [['test']]),
  ['run', 'build'],
]

if (!validateOnly) {
  for (const commandArgs of plan) run(npm, commandArgs)
}

console.log(
  `XINGYU_ADMIN_TEST_RESULT_JSON=${JSON.stringify({
    mode,
    selectedTestFiles,
    executedTestFiles: selectedTestFiles,
    testArgv,
    fullSuite: mode === 'FULL',
    technicalChecks: ['check:api', 'lint', 'build:typecheck'],
    validatedOnly: validateOnly,
  })}`,
)
