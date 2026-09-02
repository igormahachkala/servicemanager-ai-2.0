import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const moduleCache = new Map()

function loadTypeScript() {
  const candidates = [
    'typescript',
    resolve('/Users/igor/projects/sma-service/web/node_modules/typescript'),
  ]
  for (const candidate of candidates) {
    try {
      return require(candidate)
    } catch {
      // Try the next local dependency location.
    }
  }
  throw new Error('Cannot load TypeScript. Run npm install in web/ before this focused check.')
}

const ts = loadTypeScript()

function resolveLocalTsModule(id, fromFilename) {
  const targetBase = resolve(dirname(fromFilename), id)
  const candidates = [
    targetBase,
    `${targetBase}.ts`,
    `${targetBase}.tsx`,
    resolve(targetBase, 'index.ts'),
    resolve(targetBase, 'index.tsx'),
  ]
  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    if (statSync(candidate).isDirectory()) continue
    return candidate
  }
  throw new Error(`Cannot resolve runtime require(${id}) from ${relative(root, fromFilename)}`)
}

function loadTsModule(relativePath) {
  const filename = resolve(root, relativePath)
  const cached = moduleCache.get(filename)
  if (cached) return cached.module.exports

  const source = readFileSync(filename, 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
    fileName: filename,
  }).outputText
  const module = { exports: {} }
  const loaded = {
    module,
    context: vm.createContext({
      module,
      exports: module.exports,
      require: (id) => {
        if (id.startsWith('.')) return loadTsModule(relative(root, resolveLocalTsModule(id, filename)))
        throw new Error(`Unexpected runtime require(${id}) from ${relative(root, filename)}`)
      },
      console,
      Date,
    }),
  }
  moduleCache.set(filename, loaded)
  vm.runInContext(output, loaded.context, { filename })
  return module.exports
}

const gate = loadTsModule('src/mobile/mobileShiftGate.ts')

function plain(value) {
  return JSON.parse(JSON.stringify(value))
}

function user(role) {
  return { id: `${role.toLowerCase()}-1`, role, companyId: 'provider-1' }
}

function state({
  companyType = 'PROVIDER',
  policy = true,
  shiftStatus = null,
} = {}) {
  return {
    company: {
      id: companyType === 'PROVIDER' ? 'provider-1' : 'client-1',
      type: companyType,
      requireActiveShiftForWork: policy,
    },
    shift: shiftStatus ? { status: shiftStatus } : null,
  }
}

assert.equal(gate.shouldFetchShiftGateState(user('TECHNICIAN')), true)
assert.equal(gate.shouldFetchShiftGateState(user('MASTER')), true)
assert.equal(gate.shouldFetchShiftGateState(user('ADMIN')), false)
assert.equal(gate.shouldFetchShiftGateState(user('DISPATCHER')), false)
assert.equal(gate.shouldFetchShiftGateState(user('CLIENT')), false)

assert.equal(gate.shouldShowShiftGatePrompt(user('TECHNICIAN'), state({ policy: false })), false)
assert.equal(gate.shouldShowShiftGatePrompt(user('TECHNICIAN'), state({ policy: true })), true)
assert.equal(gate.shouldShowShiftGatePrompt(user('TECHNICIAN'), state({ policy: true, shiftStatus: 'OPEN' })), false)
assert.equal(gate.shouldShowShiftGatePrompt(user('MASTER'), state({ policy: true })), true)
assert.equal(gate.shouldShowShiftGatePrompt(user('ADMIN'), state({ policy: true })), false)
assert.equal(gate.shouldShowShiftGatePrompt(user('DISPATCHER'), state({ policy: true })), false)
assert.equal(gate.shouldShowShiftGatePrompt(user('TECHNICIAN'), state({ companyType: 'CLIENT', policy: true })), false)

assert.deepEqual(plain(gate.reduceShiftGatePrompt('closed', 'show')), {
  stage: 'initial',
  dismiss: false,
  openShift: false,
})
assert.deepEqual(plain(gate.reduceShiftGatePrompt('initial', 'not_now')), {
  stage: 'closed',
  dismiss: true,
  openShift: false,
})
assert.deepEqual(plain(gate.reduceShiftGatePrompt('initial', 'yes')), {
  stage: 'confirm',
  dismiss: false,
  openShift: false,
})
assert.deepEqual(plain(gate.reduceShiftGatePrompt('confirm', 'cancel')), {
  stage: 'closed',
  dismiss: true,
  openShift: false,
})
assert.deepEqual(plain(gate.reduceShiftGatePrompt('confirm', 'confirm_open')), {
  stage: 'closed',
  dismiss: false,
  openShift: true,
})

assert.equal(
  gate.shiftGateDismissalKey({ userId: 'u1', companyId: 'c1', dayKey: '2026-09-02' }),
  'sma.mobileShiftGate.dismissed:u1:c1:2026-09-02',
)
assert.notEqual(
  gate.shiftGateDismissalKey({ userId: 'u1', companyId: 'c1', dayKey: '2026-09-02' }),
  gate.shiftGateDismissalKey({ userId: 'u1', companyId: 'c1', dayKey: '2026-09-03' }),
)

assert.equal(gate.isActiveShiftRequiredError({ status: 409, message: gate.ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE }), true)
assert.equal(gate.isActiveShiftRequiredError({ status: 409, message: 'ACTIVE_SHIFT_REQUIRED' }), true)
assert.equal(gate.isActiveShiftRequiredError({ status: 409, message: 'Another conflict' }), false)
assert.equal(gate.isActiveShiftRequiredError({ status: 403, message: gate.ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE }), false)

const shellSource = readFileSync(resolve(root, 'src/mobile/MobileShell.tsx'), 'utf8')
const promptSource = readFileSync(resolve(root, 'src/mobile/MobileShiftGatePrompt.tsx'), 'utf8')
const routerSource = readFileSync(resolve(root, 'src/router.tsx'), 'utf8')
const apiSource = readFileSync(resolve(root, 'src/lib/api.ts'), 'utf8')
const errorsSource = readFileSync(resolve(root, 'src/mobile/mobileActionErrors.ts'), 'utf8')
const workforceServiceSource = readFileSync(resolve(root, '../backend/src/workforce/workforce.service.ts'), 'utf8')

assert.match(shellSource, /import \{ MobileShiftGatePrompt \} from ['"]\.\/MobileShiftGatePrompt['"]/)
assert.match(shellSource, /<MobileShiftGatePrompt user=\{meQ\.data\} \/>/)
assert.match(routerSource, /path="\/max"[\s\S]*<MobileShell \/>/)

assert.match(promptSource, /queryKey:\s*\[\s*['"]workforce-me['"]\s*\]/)
assert.match(promptSource, /queryFn:\s*api\.workforceMyState/)
assert.match(promptSource, /api\.openWorkShift/)
assert.match(promptSource, /SHIFT_GATE_DISMISSAL_STORAGE_AREA/)
assert.doesNotMatch(promptSource, /localStorage/)
assert.doesNotMatch(promptSource, /api\.company\(/)
assert.doesNotMatch(promptSource, /workforce\/shifts\/open/)

assert.match(apiSource, /type:\s*CompanyType/)
assert.match(apiSource, /requireActiveShiftForWork:\s*boolean/)
assert.match(workforceServiceSource, /type:\s*true/)
assert.match(workforceServiceSource, /requireActiveShiftForWork:\s*true/)

assert.match(errorsSource, /isActiveShiftRequiredError/)
assert.match(errorsSource, /ACTIVE_SHIFT_REQUIRED_FRIENDLY_MESSAGE/)

console.log('verify-mobile-shift-gate: PASS')
