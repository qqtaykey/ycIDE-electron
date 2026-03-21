# Project Research Summary

**Project:** ycIDE Support Library Migration  
**Domain:** Brownfield migration of 易语言 third-party support libraries (GBK/x86 → UTF-8/x64)  
**Researched:** 2026-03-21  
**Confidence:** MEDIUM-HIGH

## Executive Summary

This is a migration-focused infrastructure project, not a net-new product build. The goal is to move all remaining third-party 易语言 libraries from `第三方相关文件` into the maintained `支持库源码` tree, while converting text assets from GBK to UTF-8 and making binaries/runtime contracts x64-safe. The research converges on a disciplined, transaction-style migration pipeline: inventory first, transform in isolated workspace, verify against current ycIDE consumer contracts, then atomically promote.

The recommended approach is to keep the existing Electron/Node runtime unchanged and build a dedicated migration workflow around manifest-driven orchestration, deterministic encoding conversion, x64 ABI auditing, and verification gates that mirror real ycIDE behavior (`library-manager` scan/load/conflict rules and compiler/toolchain assumptions). Success criteria should be “compiles + loads + key events run,” not “files converted” or “build passes once.”

The largest risks are silent encoding corruption, x64 pointer/ABI defects, and hidden x86-only dependencies that fail late in integration. Mitigation is clear: strict round-trip encoding checks, truncation/ABI warning gates, per-library transactional promotion with rollback, and mandatory end-to-end validation before merge.

## Key Findings

### Recommended Stack

For this repo, the stack decision is intentionally hybrid: preserve current ycIDE app stack (Electron + TypeScript + existing compiler integration), and add a dedicated migration toolchain for repeatable bulk conversion/adaptation. Research strongly favors a Python-based orchestration layer with explicit reporting and deterministic conversion policy, plus dual compiler validation for x64 hardening.

**Core technologies:**
- **Python 3.12 + Typer/Rich**: migration CLI orchestration/reporting — enables repeatable dry-run, status, and rollback-friendly operations.
- **Deterministic GBK/CP936-first conversion + UTF-8 validation**: encoding safety chain — minimizes silent mojibake and mixed-encoding drift.
- **MSVC v143 (VS2022) + clang-cl checks**: x64 adaptation validation — balances ecosystem compatibility with stronger diagnostics.
- **CMake/Ninja + scripted PE/export checks**: build/ABI verification — confirms artifacts are truly x64 and contract-compatible.
- **Pytest + CI quality gates**: regression safety — enforces conversion reports, compile checks, and loadability before promotion.

**Critical version requirements:**
- Python **3.12.x** baseline.
- MSVC **v143 / VS2022** class toolchain for primary compatibility.
- LLVM/clang tooling aligned (18.x-class baseline suggested in research).

### Expected Features

The feature research is clear: table stakes are migration correctness and auditability, not user-facing IDE enhancements.

**Must have (table stakes):**
- Library inventory baseline and migration coverage tracking.
- Safe encoding pipeline (detect → convert → validate) with mixed-encoding alerts.
- x64 ABI audit (pointer width, struct alignment, callback signatures, cross-DLL boundaries).
- Dual-arch strategy during migration (x64 required, x86 retained for regression comparison).
- ycIDE loadability verification (scan/load/conflict checks) and event protocol completeness.
- Minimal regression loop (load + compile + runtime key event checks).
- Per-library migration report (traceable, auditable delivery).

**Should have (differentiators):**
- Automated migration scorecard (red/yellow/green by library).
- Dry-run migration risk estimator.
- Golden multi-library sample projects for system-level regression.

**Defer (v2+):**
- Event protocol semi-auto generator.
- Broader compatibility doc automation/dashboarding beyond essential reporting.

### Architecture Approach

Adopt a **pipeline + manifest + staged promotion** architecture. Major components are: Inventory Scanner (discover unmigrated libs), Manifest Store (state machine + hashes), Conversion Engine, x64 Adaptation Engine, Verification Engine (encoding/build/load/protocol gates), Promotion Orchestrator (atomic per-library writes), and Rollback Controller (snapshot restore). Key pattern: each library is a transaction (`PLANNED → TRANSFORMED → VERIFIED → PROMOTED`), executed in workspace first, never via in-place bulk rewrite.

**Major components:**
1. **Planning Layer (Scanner + Manifest):** determines scope, state, and resumability.
2. **Transformation Layer (Encoding + x64 Adaptation):** applies deterministic, auditable changes in isolated workspace.
3. **Verification/Release Layer (Validation + Promotion + Rollback):** gates delivery against real ycIDE contracts and supports safe revert.

### Critical Pitfalls

1. **Silent encoding corruption despite successful compile** — prevent with sentinel corpus, strict decode policy, round-trip checks, UTF-8 legality scanning.
2. **Pointer truncation / type-width bugs on x64** — enforce pointer-safe types and treat truncation warnings as release blockers.
3. **ABI/calling-convention/struct packing drift at FFI boundaries** — require binary contract tests and strict parser invariants.
4. **x86-only transitive dependencies discovered late** — maintain SBOM + architecture audit and block packaging on PE machine mismatch.
5. **Silent catch leading to “false success”** — use fail-fast in migration path and require completeness metrics/reporting.

## Implications for Roadmap

Based on combined research, recommended phase structure is dependency-driven and transaction-safe.

### Phase 1: Inventory & Baseline Lock
**Rationale:** Everything depends on knowing exact migration scope and dependency architecture.  
**Delivers:** Full unmigrated library list, coverage metric, SBOM/arch inventory, per-library manifest skeleton.  
**Addresses:** “迁移清单与覆盖率基线”, initial dependency risk control.  
**Avoids:** Late x86-only dependency surprises; hidden scope creep.

### Phase 2: Encoding Pipeline Foundation
**Rationale:** Encoding integrity is the highest-frequency failure mode and must be standardized early.  
**Delivers:** Deterministic conversion workflow, dry-run, round-trip validation, BOM policy checks, conversion reports.  
**Uses:** Python orchestration + charset detection/validation stack.  
**Implements:** Manifest-driven transform + verification gate (encoding branch).  
**Avoids:** Mojibake, mixed-encoding drift, non-reproducible manual conversions.

### Phase 3: x64 ABI Adaptation & Dual-Arch Build Gates
**Rationale:** x64 correctness is core business objective and has deep technical risk.  
**Delivers:** Type/ABI fixes, arch-correct linking, x64 build pass across target libraries, x86 regression lane retained.  
**Addresses:** x64 ABI audit + dual-arch strategy table stakes.  
**Avoids:** Pointer truncation, calling-convention breaks, “compile-only” false confidence.

### Phase 4: ycIDE Integration Verification (Load/Protocol/Runtime)
**Rationale:** True acceptance is consumer compatibility inside existing ycIDE flows.  
**Delivers:** Automated scan/load/conflict verification, protocol/event validation, minimal runtime regression suite.  
**Implements:** Verification Engine against `library-manager.ts` and `compiler.ts` contracts.  
**Avoids:** “Converted but unusable in IDE” outcomes.

### Phase 5: Atomic Promotion, Rollback, and Batch Throughput
**Rationale:** Safe scale-up requires controlled promotion and recoverability.  
**Delivers:** Per-library atomic promotion, snapshot rollback, batch scheduling, migration score visibility/reporting.  
**Addresses:** Traceable delivery and production-ready migration operations.  
**Avoids:** Big-bang failure and un-revertable repository state.

### Phase Ordering Rationale

- Inventory/manifest first because all downstream conversion, ABI work, and reporting depend on explicit scope and state tracking.
- Encoding before ABI because corrupted source text invalidates later compile/runtime diagnostics.
- ABI before full integration because load/protocol checks only matter after architecture correctness is established.
- Promotion/parallelization last because scaling a non-transactional pipeline multiplies defects.

### Research Flags

Phases likely needing deeper `/gsd-research-phase`:
- **Phase 3 (x64 ABI Adaptation):** per-library ABI quirks and third-party binary contract variance are high-risk and library-specific.
- **Phase 4 (Integration Verification):** event protocol coverage for UI libraries may require targeted rule discovery/test fixture expansion.

Phases with standard patterns (can likely skip extra research):
- **Phase 1 (Inventory/Baseline):** straightforward diffing, manifesting, and architecture cataloging patterns.
- **Phase 2 (Encoding Pipeline):** established deterministic conversion/validation pattern already clear from research.
- **Phase 5 (Promotion/Rollback mechanics):** standard transactional release approach once prior phases are stable.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Internal repo fit is strong; external 2025 tooling verification was limited in environment. |
| Features | HIGH | Table stakes and anti-features are directly aligned with project scope and repository constraints. |
| Architecture | HIGH | Component boundaries and validation contracts are strongly grounded in existing ycIDE code paths. |
| Pitfalls | MEDIUM-HIGH | Risks are well-known for encoding/ABI migrations; some specifics remain library-dependent. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Per-library transformation templates:** third-party libraries will vary in source layout/protocol completeness; define adaptation archetypes during Phase 3.
- **Mixed-encoding heuristics tuning:** detector thresholds and fallback policy should be validated on real corpus before full batch.
- **Golden runtime fixtures:** current testing baseline is lightweight; expand targeted fixtures before large-scale promotion.
- **BOM/file-type policy finalization:** decide and codify file-extension-level BOM requirements to eliminate toolchain edge cases.

## Sources

### Primary (HIGH confidence)
- `.planning/research/PROJECT.md` — scope, constraints, success criteria.
- `.planning/research/STACK.md` — proposed migration toolchain and version baselines.
- `.planning/research/FEATURES.md` — table stakes, dependencies, anti-features.
- `.planning/research/ARCHITECTURE.md` — pipeline design, component boundaries, build order.
- `.planning/research/PITFALLS.md` — critical/moderate/minor migration failure modes.
- `src/main/library-manager.ts`, `src/main/compiler.ts`, `src/main/fne-parser.ts` (as cited in research docs) — consumer/runtime validation anchors.

### Secondary (MEDIUM confidence)
- `convert_commobj.py`, `do_convert.ps1` — existing conversion practice baseline.
- `支持库编译消息接口规范-v1.md` — protocol integration expectations.

### Tertiary (LOW confidence)
- External 2025 ecosystem assumptions referenced in stack research (not live-verified in this environment).

---
*Research completed: 2026-03-21*  
*Ready for roadmap: yes*
