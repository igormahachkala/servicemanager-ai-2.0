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

function parseTsx(relativePath, source) {
  return ts.createSourceFile(resolve(root, relativePath), source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
}

function nodeContains(node, predicate) {
  let found = false
  const visit = (current) => {
    if (found) return
    if (predicate(current)) {
      found = true
      return
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
  return found
}

function tagNameText(tagName) {
  return ts.isIdentifier(tagName) ? tagName.text : tagName.getText()
}

function collectJsxElements(sourceFile, tagName) {
  const elements = []
  const visit = (node) => {
    if (ts.isJsxElement(node) && tagNameText(node.openingElement.tagName) === tagName) {
      elements.push({ node, opening: node.openingElement })
    } else if (ts.isJsxSelfClosingElement(node) && tagNameText(node.tagName) === tagName) {
      elements.push({ node, opening: node })
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return elements
}

function jsxAttribute(opening, name) {
  return opening.attributes.properties.find((property) => (
    ts.isJsxAttribute(property) && property.name.text === name
  ))
}

function jsxAttributeString(opening, name) {
  const initializer = jsxAttribute(opening, name)?.initializer
  return initializer && ts.isStringLiteral(initializer) ? initializer.text : undefined
}

function jsxAttributeExpression(opening, name) {
  const initializer = jsxAttribute(opening, name)?.initializer
  if (!initializer || !ts.isJsxExpression(initializer)) return undefined
  return initializer.expression
}

function nodeRendersComponent(node, componentName) {
  if (!node) return false
  return nodeContains(node, (current) => {
    if (!ts.isJsxOpeningElement(current) && !ts.isJsxSelfClosingElement(current)) return false
    const tagName = tagNameText(current.tagName)
    if (tagName === componentName) return true
    if (tagName !== 'LazyRoute') return false
    const component = jsxAttributeExpression(current, 'component')
    return Boolean(component && ts.isIdentifier(component) && component.text === componentName)
  })
}

function hasNamedImport(sourceFile, moduleSpecifier, importedName) {
  return sourceFile.statements.some((statement) => {
    if (!ts.isImportDeclaration(statement)) return false
    if (!ts.isStringLiteral(statement.moduleSpecifier)) return false
    if (statement.moduleSpecifier.text !== moduleSpecifier) return false
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) return false
    return bindings.elements.some((element) => element.name.text === importedName)
  })
}

function hasLazyExportComponent(sourceFile, constName, importPath, exportName) {
  return sourceFile.statements.some((statement) => {
    if (!ts.isVariableStatement(statement)) return false
    return statement.declarationList.declarations.some((declaration) => {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== constName) return false
      const initializer = declaration.initializer
      if (!initializer || !ts.isCallExpression(initializer)) return false
      if (!ts.isIdentifier(initializer.expression) || initializer.expression.text !== 'lazyExport') return false
      const [, exported] = initializer.arguments
      if (!exported || !ts.isStringLiteral(exported) || exported.text !== exportName) return false
      return nodeContains(initializer.arguments[0], (node) => (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === importPath
      ))
    })
  })
}

function findSingleRoute(sourceFile, path) {
  const routes = collectJsxElements(sourceFile, 'Route').filter((route) => jsxAttributeString(route.opening, 'path') === path)
  assert.equal(routes.length, 1, `Expected one Route with path="${path}"`)
  return routes[0]
}

function routeElementRenders(sourceFile, path, componentName) {
  const route = findSingleRoute(sourceFile, path)
  const element = jsxAttributeExpression(route.opening, 'element')
  assert.equal(nodeRendersComponent(element, componentName), true, `Route path="${path}" must render ${componentName}`)
  return route
}

function nestedRouteRenders(parentRoute, componentName) {
  return nodeContains(parentRoute.node, (current) => {
    if (!ts.isJsxOpeningElement(current) && !ts.isJsxSelfClosingElement(current)) return false
    if (tagNameText(current.tagName) !== 'Route') return false
    return nodeRendersComponent(jsxAttributeExpression(current, 'element'), componentName)
  })
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
const shellAst = parseTsx('src/mobile/MobileShell.tsx', shellSource)
const routerAst = parseTsx('src/router.tsx', routerSource)

assert.equal(hasNamedImport(shellAst, './MobileShiftGatePrompt', 'MobileShiftGatePrompt'), true)
const shiftGatePromptMounts = collectJsxElements(shellAst, 'MobileShiftGatePrompt')
assert.equal(shiftGatePromptMounts.length, 1, 'MobileShell must mount MobileShiftGatePrompt once')
assert.equal(
  shiftGatePromptMounts.some((mount) => jsxAttributeExpression(mount.opening, 'user')?.getText(shellAst) === 'meQ.data'),
  true,
  'MobileShiftGatePrompt must receive current MobileShell user data',
)
assert.equal(
  hasLazyExportComponent(routerAst, 'MobileShell', './mobile/MobileShell', 'MobileShell'),
  true,
  'MobileShell must stay lazy-loaded through router component binding',
)
routeElementRenders(routerAst, '/m', 'MobileShell')
const maxRoute = routeElementRenders(routerAst, '/max', 'MaxApp')
assert.equal(nestedRouteRenders(maxRoute, 'MobileShell'), true, 'MAX routes must reuse shared MobileShell')

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
