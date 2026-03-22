# Stack Research

**Domain:** Compiler standardization for third-party support-library self-serve compilation  
**Researched:** 2026-03-22  
**Confidence:** MEDIUM

## Recommended Stack

> Scope note: this is **only** for new v1.1 capability (stable compiler contract + third-party self-serve workflow).  
> Existing validated stack (Electron shell, FNE scanning/loading, compiler pipeline) remains unchanged.

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| JSON Schema (Draft 2020-12) | 2020-12 | Define the stable support-library compiler contract (`*.compile-protocol.json` + package manifest) | Language-agnostic contract that third parties can validate locally before shipping; avoids compiler hardcoding per library |
| TypeScript | 5.7.x (existing) | Internal contract types + compiler-side integration | Already in repo; use it to keep parser/validator/types synchronized and reduce contract drift |
| Node.js (LTS baseline) | 22.x+ | Third-party CLI runtime (`validate`, `pack`, `check-compat`) | Same ecosystem as current project; lowers adoption friction and keeps tooling cross-machine consistent |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ajv` | 8.18.0 | Runtime JSON Schema validation for protocol/manifest files | Mandatory for compiler-side load and CLI preflight checks |
| `ajv-formats` | 3.0.1 | Standard format validators (`uri`, `email`, etc.) | Use if manifest includes contact/homepage/version metadata fields |
| `semver` | 7.7.4 | Contract version negotiation (`compiler supports protocol x.y`) | Mandatory when introducing `protocolVersion` and compatibility gates |
| `commander` | 14.0.3 | Build a reusable third-party CLI (`ycide-supportlib`) | Use for self-serve workflow commands: `init`, `validate`, `pack`, `doctor` |
| `json-schema-to-typescript` | 15.0.4 | Generate TS types from canonical schema | Use in CI/build scripts to prevent schema/type divergence |
| `fast-glob` | 3.3.3 | Deterministic file discovery for packaging (`.fne`, protocol, metadata, static libs) | Use in CLI packaging step to enforce required artifact layout |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| npm workspaces/scripts (existing npm 11 lockfile flow) | Host contract CLI + schema checks inside repo | Add scripts like `contract:validate`, `contract:typegen`, `supportlib:pack` |
| Node built-in test runner (`node --test`) | Contract parser/validator regression tests | Matches current repo testing style used by migration scripts |
| Playwright smoke lane (existing) | Ensure new validator/contract logic does not break IDE startup/load flow | Keep this as integration guard, not as protocol correctness test |

## Integration Points (Explicit)

1. **`src/main/compiler.ts`**  
   - Replace ad-hoc `JSON.parse` protocol acceptance with `ajv` validated loading.  
   - Keep existing fallback behavior (hardcoded rules) for backward compatibility, but log standardized warnings/errors.

2. **`src/main/library-manager.ts`**  
   - Add sidecar contract discovery result (valid/invalid + error list) per loaded library.  
   - Expose validation state so UI and compile pipeline can show actionable diagnostics.

3. **`src/main/index.ts` + `src/preload/index.ts` IPC**  
   - Add dedicated contract IPC methods (example):  
     - `library:validateContract(name)`  
     - `library:getContractDiagnostics(name)`  
   - Keep existing `library:*` APIs intact to avoid breaking current UI.

4. **New CLI package (recommended path: `tools/supportlib-cli/`)**  
   - Third-party workflow: `init` (scaffold) → `validate` (schema + compatibility) → `pack` (deterministic artifact bundle).  
   - Output format should match compiler lookup rules already present (`<name>.events.json` / `.protocol.json` / `.compile-protocol.json`).

## Installation

```bash
# Core additions for contract validation + versioning + CLI
npm install ajv@8.18.0 ajv-formats@3.0.1 semver@7.7.4 fast-glob@3.3.3

# Supporting (CLI + schema type generation)
npm install commander@14.0.3
npm install -D json-schema-to-typescript@15.0.4
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| JSON Schema + AJV | Zod-only runtime schema | Use Zod only if contract is exclusively internal TS and never consumed by non-TS third parties |
| Node CLI (`commander`) | Python CLI | Use Python only if third-party ecosystem is already Python-heavy; current repo and contributors are Node-first |
| Semver compatibility gates | Manual string compare | Only acceptable for one-off prototypes; not stable enough for long-lived contract evolution |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Raw `JSON.parse`-only protocol loading | Accepts malformed contracts silently and shifts failure to compile/runtime | `ajv` schema validation + normalized diagnostics |
| YAML as primary contract format | Extra parser surface + inconsistent formatting across contributors | JSON schema + JSON protocol files (already compiler-adjacent) |
| Introducing remote build service for v1.1 | Over-engineering; adds infra/auth/ops burden unrelated to current milestone | Local self-serve CLI + deterministic package format |
| Breaking existing fallback mapping immediately | Risks built-in/migrated library regressions | Keep fallback path; deprecate gradually with warning telemetry |

## Stack Patterns by Variant

**If library only needs event-binding standardization (minimum v1.1):**
- Use `*.compile-protocol.json` + AJV validation only.
- Because this solves “no compiler update needed” with minimal surface-area change.

**If library wants full third-party distribution workflow:**
- Use CLI scaffold + validate + pack pipeline with semver compatibility checks.
- Because authors can self-serve releases and verify compatibility before publishing.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| `ajv@8.18.0` | `ajv-formats@3.0.1` | Officially paired in AJV v8 ecosystem |
| `commander@14.0.3` | `node@22+` | Set Node LTS baseline to avoid CLI runtime mismatch |
| `json-schema-to-typescript@15.0.4` | `typescript@5.7.x` | Fits current TS stack for generated types |
| `semver@7.7.4` | Node LTS | Stable utility dependency, no special integration risk |

## Sources

- Internal codebase evidence (HIGH):  
  - `.planning/PROJECT.md` (v1.1 scope)  
  - `支持库编译消息接口规范-v1.md` (current protocol contract intent)  
  - `src/main/compiler.ts` (existing protocol discovery + fallback behavior)  
  - `src/main/library-manager.ts` (library scan/load state integration points)  
  - `src/main/index.ts` + `src/preload/index.ts` (IPC integration surface)  
  - `package.json` (current stack baseline)
- npm registry version checks (MEDIUM):  
  - https://www.npmjs.com/package/ajv  
  - https://www.npmjs.com/package/ajv-formats  
  - https://www.npmjs.com/package/semver  
  - https://www.npmjs.com/package/commander  
  - https://www.npmjs.com/package/json-schema-to-typescript  
  - https://www.npmjs.com/package/fast-glob

---
*Stack research for: compiler contract standardization + third-party self-serve compilation*
*Researched: 2026-03-22*

