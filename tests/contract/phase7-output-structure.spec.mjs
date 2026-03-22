import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')

test('D7-07: repair checklist groups by library -> category -> fieldPath', async () => {
  const { makeDiagnostic } = await importTs('src/main/contract/contract-diagnostics.ts')
  const { groupRepairChecklistByLibraryCategoryField } = await importTs('src/main/contract/compatibility-gate.ts')

  const grouped = groupRepairChecklistByLibraryCategoryField([
    makeDiagnostic({
      level: 'ERROR',
      code: 'COMPAT-101',
      category: 'version',
      libraryGuid: 'guid-a',
      libraryName: 'Alpha',
      filePath: 'D:/libs/a.fne',
      fieldPath: 'compatibility.requiredCompilerVersion',
      message: 'current=1.0.0 required=2.0.0',
      suggestion: '升级编译器',
    }),
    makeDiagnostic({
      level: 'ERROR',
      code: 'COMPAT-151',
      category: 'feature',
      libraryGuid: 'guid-a',
      libraryName: 'Alpha',
      filePath: 'D:/libs/a.fne',
      fieldPath: 'compatibility.requiredFeatures.event-protocol',
      message: 'feature missing',
      suggestion: '启用特性',
    }),
  ])

  assert.ok(grouped.Alpha)
  assert.ok(grouped.Alpha.version)
  assert.ok(grouped.Alpha.feature)
  assert.ok(grouped.Alpha.version['compatibility.requiredCompilerVersion'])
  assert.ok(grouped.Alpha.feature['compatibility.requiredFeatures.event-protocol'])
})

test('D7-08: grouped checklist entries preserve compiler/library-manager isomorphic fields', async () => {
  const { makeDiagnostic } = await importTs('src/main/contract/contract-diagnostics.ts')
  const { groupRepairChecklistByLibraryCategoryField } = await importTs('src/main/contract/compatibility-gate.ts')

  const diagnostic = makeDiagnostic({
    level: 'ERROR',
    code: 'COMPAT-201',
    category: 'metadata',
    libraryGuid: 'guid-b',
    libraryName: 'Beta',
    filePath: 'D:/libs/b.fne',
    fieldPath: 'compatibility.metadataMajorVersion',
    message: 'current=1 required=2',
    suggestion: '升级支持库或编译器',
  })

  const grouped = groupRepairChecklistByLibraryCategoryField([diagnostic])
  const item = grouped.Beta.metadata['compatibility.metadataMajorVersion'][0]

  assert.deepEqual(Object.keys(item).sort(), [
    'category',
    'code',
    'fieldPath',
    'filePath',
    'level',
    'libraryGuid',
    'libraryName',
    'message',
    'suggestion',
  ])
  assert.equal(item.code.startsWith('COMPAT-'), true)

  const managerSource = fs.readFileSync(path.join(repoRoot, 'src/main/library-manager.ts'), 'utf-8')
  assert.ok(managerSource.includes('library'))
  assert.ok(managerSource.includes('category'))
  assert.ok(managerSource.includes('fieldPath'))
})

async function importTs(relativePath) {
  const target = path.join(repoRoot, relativePath)
  return import(pathToFileURL(target).href)
}

