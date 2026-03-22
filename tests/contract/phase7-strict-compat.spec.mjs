import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..', '..')

test('D7-09/D7-11: compatibility failures use COMPAT-xxx and include current vs required', async () => {
  const { evaluateLibraryCompatibility } = await importTs('src/main/contract/compatibility-gate.ts')
  const diagnostics = evaluateLibraryCompatibility(
    [
      {
        libraryGuid: 'guid-third',
        libraryName: 'ThirdPartyGrid',
        filePath: 'D:/libs/third-grid.fne',
        sourceType: 'third-party',
        metadataMajorVersion: 1,
        requiredCompilerVersion: '2.0.0',
      },
    ],
    {
      compilerVersion: '1.0.0',
      supportedMetadataMajorVersion: 1,
      supportedFeatures: ['event-protocol'],
    }
  )

  assert.ok(diagnostics.length > 0)
  assert.ok(diagnostics.every(item => item.code.startsWith('COMPAT-')))
  assert.ok(diagnostics.some(item => /current/i.test(item.message)))
  assert.ok(diagnostics.some(item => /required/i.test(item.message)))
})

test('D7-10/D7-01: one library with multiple misses returns all items under strict all-loaded rule', async () => {
  const { evaluateLibraryCompatibility } = await importTs('src/main/contract/compatibility-gate.ts')
  const diagnostics = evaluateLibraryCompatibility(
    [
      {
        libraryGuid: 'guid-core',
        libraryName: 'BuiltinCore',
        filePath: 'D:/libs/krnln.fne',
        sourceType: 'builtin',
        metadataMajorVersion: 3,
        requiredCompilerVersion: '2.5.0',
        requiredFeatures: ['event-protocol', 'window-unit-protocol'],
      },
      {
        libraryGuid: 'guid-migrated',
        libraryName: 'MigratedPaint',
        filePath: 'D:/libs/migrated-paint.fne',
        sourceType: 'migrated',
        metadataMajorVersion: 1,
        requiredCompilerVersion: '2.0.0',
      },
      {
        libraryGuid: 'guid-third',
        libraryName: 'ThirdPartyGrid',
        filePath: 'D:/libs/third-grid.fne',
        sourceType: 'third-party',
        metadataMajorVersion: 1,
        requiredFeatures: ['window-unit-protocol'],
      },
    ],
    {
      compilerVersion: '1.8.0',
      supportedMetadataMajorVersion: 1,
      supportedFeatures: ['event-protocol'],
    }
  )

  const builtinErrors = diagnostics.filter(item => item.libraryName === 'BuiltinCore')
  assert.ok(builtinErrors.length >= 3, 'version + feature + metadata misses should be aggregated')
  assert.ok(diagnostics.some(item => item.libraryName === 'MigratedPaint'))
  assert.ok(diagnostics.some(item => item.libraryName === 'ThirdPartyGrid'))
})

test('D7-12: diagnostics are stably sorted by libraryName first', async () => {
  const { evaluateLibraryCompatibility, sortDiagnosticsStableByLibrary } = await importTs('src/main/contract/compatibility-gate.ts')
  const diagnostics = evaluateLibraryCompatibility(
    [
      {
        libraryGuid: 'guid-z',
        libraryName: 'Zeta',
        filePath: 'D:/libs/zeta.fne',
        metadataMajorVersion: 2,
      },
      {
        libraryGuid: 'guid-a',
        libraryName: 'Alpha',
        filePath: 'D:/libs/alpha.fne',
        metadataMajorVersion: 3,
      },
    ],
    {
      compilerVersion: '1.0.0',
      supportedMetadataMajorVersion: 1,
      supportedFeatures: [],
    }
  )

  const names = diagnostics.map(item => item.libraryName)
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)))

  const reSorted = sortDiagnosticsStableByLibrary(diagnostics)
  assert.deepEqual(reSorted.map(item => item.libraryName), names)
})

async function importTs(relativePath) {
  const target = path.join(repoRoot, relativePath)
  return import(pathToFileURL(target).href)
}

