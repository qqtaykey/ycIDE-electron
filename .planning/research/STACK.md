# Technology Stack (Research: Stack Dimension)

**Project:** 易语言支持库迁移与 x64 改造（GBK/x32 → UTF-8/x64）  
**Researched:** 2026-03-21  
**Scope:** Bulk encoding conversion + x64 migration workflow for legacy Chinese Windows support libraries

> Note: This recommendation is based on repository context plus established Windows migration practice. I could not verify live 2025 web docs in this environment, so confidence is explicitly marked.

## Recommended 2025-Style Stack (Prescriptive)

### 1) Migration Orchestration Layer

| Technology | Version Baseline | Purpose | Why | Confidence |
|---|---:|---|---|---|
| Python | 3.12.x | Main migration CLI/pipeline | Best balance of text/binary processing, Windows automation, and testability for bulk conversion | MEDIUM |
| `typer` + `rich` | typer 0.12+, rich 13+ | CLI UX + progress/reporting | Makes batch migration auditable and repeatable (dry-run/report/rollback modes) | MEDIUM |
| `pathspec` | 0.12+ | Include/exclude rules | Prevents accidental conversion of binaries/resources | MEDIUM |

### 2) Encoding Detection & Conversion

| Technology | Version Baseline | Purpose | Why | Confidence |
|---|---:|---|---|---|
| `charset-normalizer` | 3.3+ | Heuristic encoding detection | Better fallback detection for mixed legacy text than fixed single-pass decode | MEDIUM |
| Deterministic codec pass (`cp936`/GBK first, then validate UTF-8) | N/A | Controlled transcode strategy | Chinese legacy codebases are mostly GBK/CP936; deterministic-first avoids over-guessing | HIGH |
| Round-trip validation + diff checks | N/A | Data integrity gate | Prevent silent mojibake/regression in comments/identifiers/protocol files | HIGH |

**Policy:**  
1. Detect candidate text files only (never binary).  
2. Try deterministic GBK/CP936 decode first.  
3. If ambiguous, use detector + confidence threshold.  
4. Re-encode UTF-8 (no BOM unless toolchain requires BOM per file type).  
5. Verify round-trip and generate conversion report.

### 3) Native Build & x64 Toolchain

| Technology | Version Baseline | Purpose | Why | Confidence |
|---|---:|---|---|---|
| MSVC (VS 2022, v143 toolset) | 17.10+ baseline | Primary Windows ABI/compiler compatibility | Most compatible for Win32/COM-style legacy support libs and ecosystem tooling | MEDIUM |
| LLVM/Clang (`clang-cl`) | 18.x baseline | Secondary compiler + stricter diagnostics | Finds UB/pointer-size bugs missed by single-compiler flows | MEDIUM |
| CMake + Ninja | CMake 3.29+, Ninja 1.12+ | Unified multi-lib build graph | Standardized x86/x64 target switching and reproducible builds | MEDIUM |
| `vcpkg` (manifest mode) | current 2025 pin | Dependency locking | Reproducible Windows-native dependency resolution | MEDIUM |

### 4) x64 Migration Analysis & Verification

| Technology | Version Baseline | Purpose | Why | Confidence |
|---|---:|---|---|---|
| `clang-tidy` + warning gates | LLVM-matched | Static checks for 32→64 hazards | Catches truncation/sign/pointer-cast issues early | MEDIUM |
| PE/ABI inspection (`dumpbin`, `llvm-readobj`) | Toolchain bundled | Validate output architecture/export signatures | Ensures `.dll/.fne` artifacts are truly x64 and symbol-compatible | HIGH |
| Scripted symbol diff | custom | Compare x86 vs x64 exports/contracts | Prevents accidental API surface drift during migration | HIGH |

### 5) Quality Gates / CI

| Technology | Version Baseline | Purpose | Why | Confidence |
|---|---:|---|---|---|
| GitHub Actions (Windows runners) | windows-2022 image | Automated migration + build + validation | Standard hosted CI for Windows-native pipelines | LOW |
| `pytest` | 8.x | Conversion/unit regression tests | Fast validation for encoding edge cases and parser behavior | MEDIUM |
| Artifact manifests + checksums | N/A | Provenance & rollback | Needed for bulk migration safety and phased rollout | HIGH |

## Stack Decision for This Repo (Immediate)

Given current repo state (`convert_commobj.py`, `do_convert.ps1`, Electron + Node + packaged compiler assets):

1. **Keep Node/Electron app stack as-is for IDE runtime.**  
2. **Introduce a dedicated Python 3.12 migration CLI** under `tools/migration/` (do not rely on ad-hoc one-off scripts).  
3. **Standardize native builds on MSVC v143 + clang-cl dual-check** for every migrated support library.  
4. **Add architecture-aware output contract:** `lib/x64/*.fne` mandatory, x86 optional compatibility lane.  
5. **Gate merge on conversion report + x64 export validation + smoke compile in ycIDE pipeline.**

## What NOT to Use (and Why)

| Avoid | Why Not |
|---|---|
| One-pass “decode GBK then save UTF-8” over wildcard paths | Corrupts non-text/binary payloads and silently damages mixed-encoding files |
| Manual per-library hand conversion in editor | Not reproducible, no audit trail, impossible to scale for bulk migration |
| x86-only compile verification | Misses pointer-size/ABI issues that only fail on x64 |
| ANSI `A`-API centric Windows interop (`char*` boundary) | Increases encoding defects; prefer Unicode/Wide API boundaries |
| Unpinned toolchains/dependencies | Results drift across machines; hard to reproduce failures |

## Minimal Implementation Blueprint

```bash
# Python migration toolchain
py -3.12 -m venv .venv
.venv\Scripts\activate
pip install typer rich charset-normalizer pathspec pytest

# Native checks (example)
cmake -S . -B build-x64 -G Ninja -A x64
cmake --build build-x64 --config Release
```

## Sources

- Internal project context (HIGH):  
  - `D:\chungbin\ycIDE-html\.planning\PROJECT.md`  
  - `D:\chungbin\ycIDE-html\.planning\codebase\STACK.md`  
  - `D:\chungbin\ycIDE-html\.planning\codebase\ARCHITECTURE.md`  
  - `D:\chungbin\ycIDE-html\README.md`  
  - `D:\chungbin\ycIDE-html\convert_commobj.py`  
  - `D:\chungbin\ycIDE-html\do_convert.ps1`  
  - `D:\chungbin\ycIDE-html\src\main\compiler.ts`  
  - `D:\chungbin\ycIDE-html\src\main\library-manager.ts`  
  - `D:\chungbin\ycIDE-html\src\main\fne-parser.ts`  
- External 2025 ecosystem verification: **Not directly fetchable in current environment** (confidence reduced where applicable).

