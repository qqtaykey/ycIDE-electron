# Project Research Summary

**Project:** ycIDE v1.1 Compiler Standardization & Third-Party Support Library Self-Serve Compilation  
**Domain:** Compiler contract governance + support-library build/stage workflow in Electron desktop IDE  
**Researched:** 2026-03-22  
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone is a platform-governance upgrade: move ycIDE from “compiler hardcoded per library” to a versioned, validated contract model that third-party authors can use without core compiler edits. The research is consistent across all four tracks: keep current Electron/TypeScript runtime and existing compile pipeline, but add a strict contract layer (`*.compile-protocol.json` + canonical contract manifest), validation tooling, and deterministic build/stage flow for third-party artifacts.

The recommended implementation path is opinionated: define schema first, validate at load and pre-publish, then enforce a dual-mode policy (legacy-compatible fallback for existing libs, strict contract requirement for new third-party libs). Architecturally, contract logic and build/staging logic should be isolated into dedicated modules, exposed via new IPC channels, and integrated into `compiler.ts` and `library-manager.ts` with structured diagnostics.

Key risks are not theoretical—they already appear in current behavior patterns: fallback masking broken contracts, TODO placeholders producing “compile success but no behavior,” version drift across compiler releases, and deployment/security issues from unmanaged native artifacts. Mitigation is clear: strict mode gates, compatibility version negotiation (`minCompilerVersion` + features), clean-machine validation, and explicit trust/validation gates in the third-party pipeline.

## Key Findings

### Recommended Stack

The stack should remain Node/TypeScript-first and incremental to current repo conventions. Introduce schema-driven contract validation and semver compatibility as core technical controls, then provide a minimal self-serve CLI for third-party authors.

**Core technologies:**
- **JSON Schema Draft 2020-12 + AJV 8.18.0**: canonical contract validation — prevents malformed protocol files from silently entering compile/runtime flow.
- **TypeScript 5.7.x + generated types (`json-schema-to-typescript`)**: keep schema and in-repo types synchronized — reduces contract drift.
- **Node.js 22.x LTS baseline + commander 14**: third-party self-serve CLI (`init/validate/pack/doctor`) — lowers adoption friction in existing ecosystem.
- **semver 7.7.4**: protocol version negotiation and compatibility gates — required for safe contract evolution.
- **fast-glob 3.3.3**: deterministic artifact discovery for packaging/staging — ensures repeatable output layout.

**Critical version requirements:**
- Node.js **22.x+** baseline for CLI/runtime consistency.
- JSON Schema **2020-12** as the contract standard.
- AJV **8.18.0** paired with `ajv-formats` **3.0.1**.

### Expected Features

The MVP is governance-heavy and should prioritize reliability over bells-and-whistles.

**Must have (table stakes):**
- Stable versioned contract schema with compatibility policy.
- Contract validator with error/warn/info grading before compile/publish.
- Standard artifact package contract (`.fne` + protocol JSON + arch outputs).
- One-command third-party build flow (at minimum: init/build/validate/pack).
- Compatibility gate: legacy fallback retained for old libs, strict mode for new third-party libs.
- Compliance acceptance checks: load/conflict, compile/link, event-dispatch coverage.

**Should have (competitive):**
- Protocol scaffold generation from FNE metadata.
- Compatibility badge/report output (`Contract Pass`, `x64 Pass`, `Legacy Safe`).
- Guided remediation hints in diagnostics.

**Defer (v2+):**
- Auto-patch generation for failed contracts.
- Cross-platform third-party build support beyond Windows-focused v1.1 target.

### Architecture Approach

Use a **sidecar-contract + build-stage-activate** architecture. Keep runtime discovery in current main-process flow, but introduce two explicit modules: `library-contract` (schema, resolver, validator, normalized DTOs) and `library-build` (orchestrator, staging, manifest ledger). `compiler.ts` consumes validated DTOs (not raw JSON), `library-manager.ts` surfaces contract health/version, and IPC adds namespaced endpoints for validate/build/stage operations.

**Major components:**
1. **Contract Schema/Validator Module (new):** defines and enforces v1 contract rules, version compatibility, and diagnostics.
2. **Build Orchestrator + Artifact Staging (new):** turns `支持库源码` outputs into deterministic `lib/static_lib` ingest artifacts.
3. **Compiler + Library Manager Integration (modified):** uses validated contracts while preserving controlled legacy fallback during migration window.

### Critical Pitfalls

1. **Fallback path becomes permanent bypass** — enforce strict mode for new third-party libraries and show fallback hits as explicit risk.
2. **Unknown command TODO placeholders ship silently** — treat unsupported command generation as hard error in strict mode; require coverage report.
3. **Protocol version drift breaks ecosystem** — add `minCompilerVersion` + feature flags and hard compatibility checks.
4. **Runtime dependency path tied to developer machine** — standardize deployable packaging and clean-machine validation gate.
5. **Security boundary too weak for native third-party libs** — introduce trust tiers, source validation, and phased isolation strategy.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Contract Foundation & Version Policy
**Rationale:** Every downstream feature depends on a stable contract definition and compatibility rules.  
**Delivers:** Canonical schema, version policy (SemVer + breaking rules), compatibility fields (`minCompilerVersion`, `features`), type generation pipeline.  
**Addresses:** Stable contract schema + governance table stakes.  
**Avoids:** Protocol drift and silent cross-version breakage.

### Phase 2: Compiler Strictness Integration
**Rationale:** Contract must affect real compile behavior early; otherwise governance is documentation-only.  
**Delivers:** `compiler.ts` contract resolver/validator integration, dual-mode behavior (legacy fallback vs third-party strict), unsupported-command hard-fail in strict mode, structured diagnostics.  
**Uses:** AJV + semver + normalized contract DTOs.  
**Implements:** Backward-compatible strictness pattern from architecture research.  
**Avoids:** “Compiles but no effect” and fallback-masked defects.

### Phase 3: Library Manager Contract Visibility & Conflict Governance
**Rationale:** Authors and users need visibility before compile; load-time health should be first-class state.  
**Delivers:** `library-manager.ts` contract status/version fields, conflict policy upgrades (naming/override rules), load-time diagnostics surfaced to UI/API.  
**Addresses:** Compatibility gating + ecosystem collision controls.  
**Avoids:** Non-deterministic behavior from load order and hidden invalid contracts.

### Phase 4: Third-Party Build/Stage Self-Serve Pipeline
**Rationale:** Self-serve promise is only real when external authors can produce valid artifacts deterministically.  
**Delivers:** Extended `build-all-support-libs.ps1` orchestration, staging manifests, deterministic package layout, CLI commands (`init/validate/pack/doctor`).  
**Addresses:** One-command build + standardized artifact contract.  
**Avoids:** Arbitrary-path loading, packaging mismatch, and deployment breakage.

### Phase 5: UX, Compliance Reports & Security Baseline
**Rationale:** Scale requires actionable diagnostics and trust controls, not just pass/fail internals.  
**Delivers:** Contract/build health in UI, compatibility badges/reports, clean-machine gate, initial trust model for third-party native libraries.  
**Addresses:** Compliance acceptance and safer ecosystem onboarding.  
**Avoids:** High support burden and unsafe default loading behavior.

### Phase Ordering Rationale

- Schema/versioning must precede strict compiler enforcement; strictness without canonical contract is unstable.
- Compiler and library-manager integration must land before third-party pipeline so tool outputs map to real runtime behavior.
- Build/stage comes after contract enforcement to avoid mass-producing artifacts that fail runtime governance.
- Security/UX hardening follows core mechanics but should begin with minimum guardrails (not deferred to “later someday”).

### Research Flags

Phases likely needing deeper `/gsd-research-phase`:
- **Phase 2:** command-generation coverage policy and strict-mode rollout thresholds per library category.
- **Phase 4:** third-party packaging edge cases (arch matrices, staging semantics) and CI-like reproducibility strategy.
- **Phase 5:** trust/signed-source model and native parsing/process-isolation design.

Phases with standard patterns (skip research-phase):
- **Phase 1:** JSON Schema + AJV + semver governance is well-established.
- **Phase 3:** metadata surfacing and conflict diagnostics in manager/UI follows existing internal patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Strong internal fit and concrete package choices; external ecosystem comparisons partially inferred offline. |
| Features | MEDIUM | Repository-backed table stakes are clear; differentiator prioritization has some market-assumption uncertainty. |
| Architecture | HIGH | Directly grounded in existing module boundaries (`compiler`, `library-manager`, IPC, build script). |
| Pitfalls | MEDIUM-HIGH | Risks are evidenced in current behavior patterns; some mitigation depth (especially security) needs implementation validation. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Strict-mode scope policy:** define exactly which libraries are “legacy-allowed” vs “strict-required” at launch.
- **Command support matrix:** codify unsupported commands and roadmap for generator coverage to avoid TODO placeholders.
- **Protocol evolution process:** specify RFC/change-control for new fields to prevent schema fragmentation.
- **Security operational model:** decide minimum v1.1 trust gate (signing/allowlist/explicit consent) and enforcement point.
- **Third-party template assets:** provide sample library + CI recipe to reduce first-integration failure rate.

## Sources

### Primary (HIGH confidence)
- `.planning/research/STACK.md` — stack and package/version recommendations for contract + CLI flow.
- `.planning/research/FEATURES.md` — MVP table stakes, differentiators, anti-features, dependency map.
- `.planning/research/ARCHITECTURE.md` — component boundaries, data flow, build-order plan, integration deltas.
- `.planning/research/PITFALLS.md` — critical failure patterns, warning signs, prevention mapping by phase.
- Repository code/files referenced throughout research: `src/main/compiler.ts`, `src/main/library-manager.ts`, `src/main/index.ts`, `src/preload/index.ts`, `支持库编译消息接口规范-v1.md`, `支持库源码/build-all-support-libs.ps1`, `package.json`.

### Secondary (MEDIUM confidence)
- npm package metadata/version snapshots for AJV, semver, commander, fast-glob, json-schema-to-typescript.
- Existing internal build-summary artifacts under `支持库源码/build-logs/`.

### Tertiary (LOW confidence)
- Cross-ecosystem “typical competitor patterns” described in FEATURES research (explicitly marked as offline inference).

---
*Research completed: 2026-03-22*  
*Ready for roadmap: yes*
