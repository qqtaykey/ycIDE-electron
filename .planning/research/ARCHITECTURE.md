# Architecture Research

**Domain:** Compiler contract standardization + third-party support-library self-serve compilation (ycIDE Electron desktop)
**Researched:** 2026-03-22
**Confidence:** HIGH

## Standard Architecture

### System Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Third-Party Author Workspace                          │
├──────────────────────────────────────────────────────────────────────────────┤
│  支持库源码/<lib>/ *.sln/*.vcxproj + source + contract files                │
│  Required outputs: <lib>.fne, <lib>.lib (x64/x86), <lib>.compile-protocol  │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ (build artifacts + contract validation report)
┌───────────────────────────────▼──────────────────────────────────────────────┐
│                     ycIDE Packaging & Runtime Asset Layer                    │
├──────────────────────────────────────────────────────────────────────────────┤
│  lib/ (runtime .fne, lib/x64 precedence)                                    │
│  static_lib/ (link-time .lib by arch)                                       │
│  compiler/ (clang + MSVCSDK)                                                │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │
┌───────────────────────────────▼──────────────────────────────────────────────┐
│                      Electron Main Process Integration                       │
├──────────────────────────────────────────────────────────────────────────────┤
│  library-manager.ts  → scan/load/conflict/static-lib resolve                │
│  fne-parser.ts       → extract LibInfo/commands/windowUnits/constants       │
│  compiler.ts         → generate C++ + link + protocol-driven event mapping  │
│  index.ts            → IPC orchestration                                    │
└───────────────────────────────┬──────────────────────────────────────────────┘
                                │ IPC (typed bridge)
┌───────────────────────────────▼──────────────────────────────────────────────┐
│                    Preload + Renderer (Author/Integrator UI)                │
├──────────────────────────────────────────────────────────────────────────────┤
│  preload/index.ts   → window.api.library / window.api.compiler              │
│  App.tsx            → compile mode/arch + output + library change reactions │
│  LibraryDialog      → library selection + metadata inspection               │
│  Sidebar library    → loaded lib commands/types tree                         │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| **Compiler Contract Descriptor (NEW)** | Canonical schema for what a support library must expose for ycIDE compile/runtime integration | JSON schema + version field (v1) for metadata packaging and optional event bindings |
| **Contract Validator (NEW)** | Validate third-party output before ingest into `lib/` and `static_lib/` | Node/TS validator run in build script and optional IPC endpoint |
| **Third-party Build Orchestrator (NEW)** | Build all support libraries from `支持库源码`, normalize artifacts into ingestable layout | PowerShell + MSBuild wrapper (extend `支持库源码/build-all-support-libs.ps1`) |
| **Artifact Staging/Ingest (NEW)** | Deterministic copy from build output to `lib[/x64]` + `static_lib[/x64]` and sidecar contract files | Scripted staging step with manifest and overwrite policy |
| **library-manager.ts (MODIFIED)** | Runtime discovery and metadata indexing; contract-awareness during scan/load | Keep existing scan/load semantics, add contract-aware metadata fields and diagnostics |
| **compiler.ts (MODIFIED)** | Consume contract files for event dispatch + link behavior; preserve fallback compatibility | Existing protocol lookup path remains; add strict validation + error taxonomy |
| **IPC in index.ts / preload API (MODIFIED)** | Expose self-serve compile/validate/stage capabilities to renderer tools | Add dedicated `library:contract:*` and `library:build:*` channels |

## Recommended Project Structure

```text
src/
├── main/
│   ├── compiler.ts                    # [MOD] consume validated contract + richer diagnostics
│   ├── library-manager.ts             # [MOD] scan/load + contract manifest indexing
│   ├── index.ts                       # [MOD] new IPC entrypoints for contract/build/stage
│   ├── fne-parser.ts                  # [MOD?] optional extended fields extraction
│   ├── library-contract/
│   │   ├── schema-v1.ts               # [NEW] TS zod/json-schema source of truth
│   │   ├── validator.ts               # [NEW] validate contract + emit structured errors
│   │   ├── resolver.ts                # [NEW] locate .events/.protocol/.compile-protocol
│   │   └── types.ts                   # [NEW] normalized DTOs
│   └── library-build/
│       ├── orchestrator.ts            # [NEW] call build scripts, capture logs/status
│       ├── staging.ts                 # [NEW] copy artifacts to lib/static_lib layout
│       └── manifest.ts                # [NEW] per-lib build/ingest ledger
├── preload/
│   └── index.ts                       # [MOD] expose library.contract/build APIs
└── renderer/src/
    ├── App.tsx                        # [MOD] integrate contract validation + build output views
    └── components/
        ├── LibraryDialog/             # [MOD] show contract health/version
        └── (optional) LibraryBuildPanel/ # [NEW] self-serve build & stage UI

支持库源码/
├── build-all-support-libs.ps1         # [MOD] produce standardized outputs + summary json
└── <lib>/
    ├── <lib>.fne                      # build output
    ├── x64/<lib>.lib                  # build output (arch)
    ├── <lib>.compile-protocol.json    # contract sidecar (optional but recommended for UI libs)
    └── ycide.contract.json            # [NEW] canonical contract declaration (v1)
```

### Structure Rationale

- **`src/main/library-contract/`**: keep all contract semantics in one place; avoid spreading schema logic across `compiler.ts` and UI.
- **`src/main/library-build/`**: isolate long-running build/stage side effects from runtime compile path.
- **`支持库源码/<lib>/ycide.contract.json`**: puts responsibility on library author package, not compiler hardcode.

## Architectural Patterns

### Pattern 1: Sidecar Contract + Runtime Discovery

**What:** Keep `.fne` as binary metadata authority and add sidecar contract files (`ycide.contract.json`, `*.compile-protocol.json`) for compile/runtime behavior that binary metadata cannot encode robustly.
**When to use:** Always for third-party libs; mandatory for non-trivial UI/event libraries.
**Trade-offs:** Slight packaging complexity, but eliminates compiler hardcoding churn.

**Example:**
```typescript
const candidates = [
  `${libName}.events.json`,
  `${libName}.protocol.json`,
  `${libName}.compile-protocol.json`
]
const protocol = resolver.loadFirstValid(candidates)
validator.assertProtocolV1(protocol)
```

### Pattern 2: Backward-Compatible Strictness

**What:** Validate new contract strictly, but keep fallback behavior for existing built-in libraries (current behavior in `compiler.ts` is hardcode fallback when protocol missing).
**When to use:** During migration window (v1.1 milestone).
**Trade-offs:** More branching in compiler path short-term, but zero regression for installed libraries.

**Example:**
```typescript
const protocolHit = resolveEventByProtocol(...)
if (protocolHit) return protocolHit
// fallback for legacy libraries
return resolveEventByLegacyRules(...)
```

### Pattern 3: Build-Stage-Activate Pipeline

**What:** Separate library compilation from IDE runtime activation.
**When to use:** Third-party self-serve workflow and CI-like deterministic ingestion.
**Trade-offs:** One extra step, but avoids loading half-built artifacts.

**Example:**
```typescript
await buildOrchestrator.buildLibrary(libRoot, { arch: 'x64' })
await staging.stageArtifacts(libRoot, repoLibDir, repoStaticLibDir)
await libraryManager.scan()
await libraryManager.load(libName)
```

## Data Flow

### Request Flow

```text
[Third-party author triggers build]
    ↓
[renderer build panel / CLI script]
    ↓
[IPC: library:build:run]
    ↓
[main library-build orchestrator]
    ↓
[MSBuild via build-all-support-libs.ps1]
    ↓
[artifact staging + contract validation]
    ↓
[library-manager rescan/load]
    ↓
[compiler path consumes contract at compile time]
```

### State Management

```text
[Contract/Build Manifest Store (userData or repo .planning artifact)]
    ↓ (read)
[Main process: validator/orchestrator/library-manager]
    ↓ (events)
[Renderer panels + output]
    ↓ (actions)
[IPC build/validate/stage commands]
```

### Key Data Flows

1. **Library ingestion flow:** `支持库源码` build output → validator → stage to `lib` / `static_lib` → `libraryManager.scan()` → UI/compile availability.
2. **Compile-time event binding flow:** loaded library list → protocol resolver (`*.events|*.protocol|*.compile-protocol`) → event dispatch generation in `generateMainC`.
3. **Arch-specific link flow:** toolbar/project arch (`x86|x64`) → `compiler.ts` target + `libraryManager.findStaticLib()` resolution → static link or `.fne` dynamic fallback.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-20 third-party libs | single-script build + local staging is fine |
| 20-100 libs | add incremental build manifest, only rebuild changed libs, parallel MSBuild jobs |
| 100+ libs | split catalog/index from build runtime, add deterministic artifact cache and strict CI gate |

### Scaling Priorities

1. **First bottleneck:** Manual artifact staging mistakes → fix with staged manifest + checksum verification.
2. **Second bottleneck:** Compiler fallback ambiguity for event mapping → fix by requiring validated protocol for new UI libraries.

## Anti-Patterns

### Anti-Pattern 1: Compiler Hardcoding Per New Library

**What people do:** Add ad-hoc `if (libName === X)` branches in `compiler.ts` for events/link dependencies.
**Why it's wrong:** Reintroduces the exact bottleneck this milestone is trying to remove.
**Do this instead:** Encode mapping in contract sidecar and validate before staging.

### Anti-Pattern 2: Loading Build Outputs Directly from Arbitrary Paths

**What people do:** Point `library:scan(folder)` to random build output and compile against it.
**Why it's wrong:** Non-deterministic dependencies and packaging mismatch (`package.json` ships `lib/static_lib`).
**Do this instead:** Always stage into canonical repo runtime paths, then scan/load from canonical locations.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| MSBuild / Visual Studio Build Tools | Shell invocation via PowerShell orchestrator | already used by `支持库源码/build-all-support-libs.ps1`; extend, don’t replace |
| Clang + MSVCSDK (bundled) | Existing compile pipeline in `src/main/compiler.ts` | contract work must not break current toolchain discovery paths |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Renderer ↔ Main (new contract/build ops) | IPC (`ipcRenderer.invoke` / `ipcMain.handle`) | add namespaced channels: `library:contract:validate`, `library:build:run`, `library:stage` |
| Main compiler ↔ library contract module | in-process service call | compiler should consume normalized contract DTO, not raw JSON |
| library-manager ↔ contract validator | in-process service call | on scan/load, surface contract health and version in list/info DTO |
| Build orchestrator ↔ artifact staging | explicit manifest handoff | include arch, output paths, hash, timestamp, validator result |

## Delta Plan (New vs Modified Components)

### New Components

1. **Contract schema + validator module** (`src/main/library-contract/*`)
2. **Build orchestrator/staging module** (`src/main/library-build/*`)
3. **Optional renderer build panel** (or extend existing LibraryDialog)
4. **Per-library build/contract manifest** (json artifact)

### Modified Components

1. **`src/main/compiler.ts`**
   - Keep existing protocol lookup order.
   - Route parsing through validator/resolver.
   - Replace generic warnings with structured contract diagnostics.
2. **`src/main/library-manager.ts`**
   - Extend `LibraryItem`/`getList()` to include `contractVersion`, `contractStatus`.
   - Optional load gating (warn-only first, strict later).
3. **`src/main/index.ts` + `src/preload/index.ts`**
   - Add IPC for validate/build/stage/get-build-status.
4. **`支持库源码/build-all-support-libs.ps1`**
   - Emit machine-readable result summary per library and arch.
   - Standardize artifact output folder contract.

## Suggested Build Order (Dependency-Aware)

1. **Contract schema + validator (foundation)**
   - Dependency for compiler and library-manager deltas.
2. **Compiler integration to validated contract**
   - Enables stable compile behavior with current fallback preserved.
3. **library-manager metadata surface changes**
   - Exposes contract health to UI and diagnostics.
4. **Build orchestrator + staging**
   - Produces deterministic self-serve workflow.
5. **IPC/preload + renderer integration**
   - Makes capability user-accessible inside ycIDE.
6. **Packaging/docs/tests updates**
   - Ensure `lib/static_lib` flow and migration compatibility are proven.

## Sources

- `.planning/PROJECT.md` (milestone intent and constraints)
- `src/main/index.ts` (current IPC boundaries)
- `src/preload/index.ts` (renderer API contract)
- `src/main/compiler.ts` (protocol loading, compile/link flow)
- `src/main/library-manager.ts` (scan/load/state/static-lib resolution)
- `src/main/fne-parser.ts` (LibInfo model from `.fne`)
- `支持库编译消息接口规范-v1.md` (existing contract precedent)
- `支持库源码/build-all-support-libs.ps1` (existing third-party build foundation)
- `package.json` (`extraFiles` runtime packaging paths)

---
*Architecture research for: compiler standardization + third-party support-library self-serve compilation*
*Researched: 2026-03-22*
