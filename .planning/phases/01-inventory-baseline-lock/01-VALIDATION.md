---
phase: 1
slug: inventory-baseline-lock
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-21
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Playwright (`@playwright/test`), plus Node script self-check commands for migration baseline |
| **Config file** | `playwright.config.js` |
| **Quick run command** | `node scripts/migration/inventory-baseline.mjs --check-manifest` |
| **Full suite command** | `node scripts/migration/inventory-baseline.mjs --regenerate && node tests/migration/inventory-baseline.spec.mjs && npm run test:ui:smoke` |
| **Estimated runtime** | ~60 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/migration/inventory-baseline.mjs --check-manifest`
- **After every plan wave:** Run `node scripts/migration/inventory-baseline.mjs --regenerate && node tests/migration/inventory-baseline.spec.mjs && npm run test:ui:smoke`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 90 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | INVT-01 | integration | `node scripts/migration/inventory-baseline.mjs --check-list` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | INVT-02 | unit/integration | `node scripts/migration/inventory-baseline.mjs --check-classification` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | INVT-03 | integration | `node scripts/migration/inventory-baseline.mjs --check-manifest` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `scripts/migration/inventory-baseline.mjs` — deterministic baseline generator CLI
- [ ] `scripts/migration/classify-arch.mjs` — architecture status classifier
- [ ] `scripts/migration/classify-encoding.mjs` — encoding status classifier
- [ ] `tests/migration/inventory-baseline.spec.mjs` — baseline determinism and metrics assertions
- [ ] `tests/migration/fixtures/README.md` — fixture contract and maintenance rules

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Spot-check classification on ambiguous library samples | INVT-02 | Mixed encoding/arch evidence may require human confirmation on edge cases | Select 3 “mixed” libraries from manifest, inspect source folders and key files, confirm classification rationale is recorded |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
