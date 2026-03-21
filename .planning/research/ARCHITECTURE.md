# Architecture Patterns — 易语言支持库迁移与 x64 改造

**Domain:** Bulk support-library migration (GBK→UTF-8 + x64 adaptation) inside existing ycIDE ecosystem  
**Researched:** 2026-03-21  
**Confidence:** HIGH (repository-verified for current ycIDE architecture and integration points)

## Recommended Architecture

Use a **pipeline + manifest + staged promotion** architecture, not ad-hoc conversion scripts directly mutating `支持库源码`.

### High-Level Structure

```text
第三方相关文件 (source of truth, read-only)
        │
        ▼
[1] Inventory & Classification
        │  emits migration manifest + fingerprints
        ▼
[2] Encoding Conversion Stage (workspace only)
        │  GBK/other -> UTF-8, deterministic transforms
        ▼
[3] x64 Adaptation Stage (workspace only)
        │  include/lib/protocol fixes, arch-specific build prep
        ▼
[4] Verification Stage
        │  static checks + compile/link checks + IDE load checks
        ▼
[5] Promotion Stage (atomic commit unit)
        │  write to 支持库源码 + static_lib/lib outputs
        ▼
[6] Rollback Controller
           revert by manifest snapshot + file hash map
```

Core rule: **all transforms happen in an isolated migration workspace first**, and only verified artifacts are promoted.

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Inventory Scanner** | Enumerate unmigrated libraries from `第三方相关文件`, map source layout, detect candidate encoding/architecture assumptions | Manifest Store, Conversion Engine |
| **Manifest Store** | Persist per-library migration plan: source files, target paths, checksums, status, rollback pointers | All pipeline components |
| **Encoding Conversion Engine** | Convert text artifacts to UTF-8 (prefer UTF-8 with BOM where current toolchain expects it), produce conversion report and changed-file list | Manifest Store, Verification Engine |
| **x64 Adaptation Engine** | Apply architecture-specific transformations (headers/lib references, protocol JSON alignment, folder normalization for x64 assets) | Manifest Store, Verification Engine |
| **Verification Engine** | Gate promotion by checks: parseability, compiler/toolchain compatibility, static_lib x64 presence, `.fne` loadability via existing manager assumptions | Compiler Adapter, Library Compatibility Adapter, Manifest Store |
| **Compiler Adapter** | Reuse existing compile behavior in `src/main/compiler.ts` (Clang + MSVC SDK path conventions, arch switching) for migration validation | Verification Engine |
| **Library Compatibility Adapter** | Reuse existing support-library assumptions from `src/main/library-manager.ts` (`lib/x64` precedence, `.fne` scanning, conflict constraints) | Verification Engine |
| **Promotion Orchestrator** | Move validated artifacts to `支持库源码`, `lib/x64`, `static_lib/x64` as needed; enforce atomic per-library promotion | Rollback Controller, Manifest Store |
| **Rollback Controller** | Restore previous state using pre-promotion snapshot map (hash + backup path) and status ledger | Promotion Orchestrator, Manifest Store |

### Why this boundary split

- Current repo already has runtime consumers (`library-manager.ts`, `compiler.ts`), so migration should be **producer-side disciplined** instead of changing runtime behavior first.
- Existing scripts (`convert_commobj.py`, `do_convert.ps1`) are useful prototypes but lack transaction safety and verification gates.

---

## Data Flow (Explicit)

### 1) Discover & Plan
1. Scanner walks `第三方相关文件/**` and identifies libraries not yet present in `支持库源码/*`.
2. For each library, create manifest entry:
   - `libraryId`, source root, target root
   - file inventory and SHA256
   - detected encoding confidence
   - required x64 actions (unknown/pending/known)
3. Mark status as `PLANNED`.

### 2) Workspace Transform
1. Copy source files into `.migration/workspace/{libraryId}`.
2. Run encoding conversion only inside workspace.
3. Run x64 adaptation only inside workspace.
4. Write step logs and updated hashes to manifest.
5. Mark status as `TRANSFORMED`.

### 3) Verification Gate
Verification must pass all:
1. **Encoding verification:** no undecodable remnants; expected UTF-8 format consistency.
2. **Structure verification:** required files present for ycIDE packaging conventions.
3. **Compile/link verification:** x64 compile path using current compiler assumptions (`compiler/llvm`, `MSVCSDK`, `static_lib/x64` lookup behavior).
4. **Library load verification:** `.fne` and metadata remain consumable by current `library-manager` scan/load model.
5. **Protocol verification:** if custom UI events exist, protocol file (`*.events.json`/`*.protocol.json`/`*.compile-protocol.json`) validates against current compile protocol behavior.

If all pass → `VERIFIED`. Any failure → `FAILED` with reason code.

### 4) Atomic Promotion
1. Before overwrite, snapshot current targets to `.migration/backups/{runId}/{libraryId}`.
2. Apply copy/move into final targets:
   - source under `支持库源码/{library}`
   - runtime library artifacts under `lib/x64` if needed
   - static link artifacts under `static_lib/x64` if needed
3. Recompute hashes, update manifest `PROMOTED`.

### 5) Rollback (Safety Net)
Rollback trigger: failed post-check or manual abort.
1. Read manifest last-known-good pointers.
2. Restore target files from backup snapshot.
3. Verify restored hashes match pre-promotion values.
4. Mark status `ROLLED_BACK`.

---

## Patterns to Follow

### Pattern 1: Per-Library Transaction
**What:** Treat each library migration as an independent transaction with clear states (`PLANNED → TRANSFORMED → VERIFIED → PROMOTED`).  
**When:** Always, especially in bulk jobs.  
**Why:** Prevents one bad library from contaminating the full migration batch.

### Pattern 2: Manifest-Driven Idempotency
**What:** Pipeline reads/writes a manifest file and can resume without redoing already-verified steps.  
**When:** Long-running batch migration and reruns after interruption.  
**Why:** Required for safe incremental progress.

### Pattern 3: Consumer-Compatibility Validation
**What:** Validate against current consumer contracts (`library-manager` scanning priority, static lib lookup, compile protocol behavior).  
**When:** Before every promotion.  
**Why:** Migration success means “works in current ycIDE”, not just “files converted”.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: In-Place Bulk Rewrite in `支持库源码`
**Why bad:** No rollback boundary, hard to isolate regressions, high risk of mixed-encoding partial state.  
**Instead:** Always transform in workspace then atomically promote.

### Anti-Pattern 2: Encoding-Only “Done” Criteria
**Why bad:** UTF-8 conversion can still break build/link/runtime metadata contracts for x64.  
**Instead:** Require compile/load verification gates before promotion.

### Anti-Pattern 3: Global Batch Commit Without Per-Library Status
**Why bad:** Debugging failures becomes opaque; rollback too coarse.  
**Instead:** Persist per-library manifest states and logs.

---

## Scalability Considerations

| Concern | At 10 libraries | At 50 libraries | At 200+ libraries |
|---------|-----------------|-----------------|-------------------|
| Execution Model | Sequential acceptable | Parallel by library group | Controlled worker pool + checkpoint resume |
| Verification Cost | Manual review possible | Automated checks mandatory | Full automation + failure triage queue |
| Rollback | Simple folder backup | Per-library snapshot required | Content-addressed backup store recommended |
| Reporting | Console logs | Structured per-library report | Dashboard/summary generation from manifest |

---

## Suggested Build Order (Roadmap Implications)

1. **Foundation: Manifest + Workspace + Status Machine**
   - Build first; everything depends on reproducible state and resumability.
2. **Encoding Conversion Module**
   - Add deterministic conversion with audit output.
3. **x64 Adaptation Module**
   - Implement arch-specific transformations and path normalization.
4. **Verification Module**
   - Integrate compile/load/protocol checks against existing ycIDE behavior.
5. **Promotion + Rollback Module**
   - Add atomic promotion and tested restore path.
6. **Batch Orchestration + Reporting**
   - Parallelization, retry policy, and migration progress visibility.

### Build-order rationale
- Verification and rollback cannot be trusted without manifest/state machine first.
- x64 adaptation must be validated by real consumer constraints before mass promotion.
- Batch orchestration should come last, after single-library transaction correctness is proven.

---

## Integration Notes with Existing ycIDE

- **Do not change main runtime contracts first.**  
  Migrate libraries to satisfy existing contracts in:
  - `src/main/library-manager.ts` (`lib/x64` priority, `.fne` discovery, conflict behavior)
  - `src/main/compiler.ts` (arch handling, static lib lookup, Clang/MSVCSDK assumptions)
- **Keep packaging compatibility.**  
  Existing `package.json` includes `lib` and `static_lib` as `extraFiles`; migration output locations should align with this.
- **Leverage compile protocol standard.**  
  `支持库编译消息接口规范-v1.md` should be part of verification for event-enabled UI libraries.

---

## Confidence & Gaps

- **High confidence:** recommended component boundaries, data flow, and build-order implications (directly derived from repo architecture and current scripts).
- **Medium confidence:** exact per-library transformation rules for every third-party library, because each library’s source structure and x64 delta may differ.
- **Gap to resolve in implementation phase:** automated detection heuristics for mixed encodings and per-library x64 adaptation templates.

## Sources

- Repository architecture and integrations:
  - `.planning/PROJECT.md`
  - `.planning/codebase/ARCHITECTURE.md`
  - `.planning/codebase/INTEGRATIONS.md`
- Current migration scripts:
  - `convert_commobj.py`
  - `do_convert.ps1`
- Current runtime consumer contracts:
  - `src/main/library-manager.ts`
  - `src/main/compiler.ts`
- Compile protocol contract:
  - `支持库编译消息接口规范-v1.md`
- Packaging/build flow:
  - `package.json`
