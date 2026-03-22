# Phase 3 Runbook: x64 Adaptation & Dual-Arch Gates

## Phase 3 boundary

- No Phase 4 integration verification
- No Phase 5 promotion actions

## Execution model

- Process libraries in baseline order (`.planning/baselines/inventory-baseline.json`).
- For every library, run both lanes:
  - x64 primary lane
  - x86 comparison lane
- Keep blocked libraries in retry queue; continue remaining libraries.
- Phase remains incomplete until blocked queue is cleared.

## Commands

```bash
npm run test:migration:x64
node scripts/migration/x64-adaptation.mjs --write --apply-remediation-batch=1
node scripts/migration/x64-adaptation.mjs --check
```

## Blocked-library retry procedure

1. Run `npm run test:migration:x64`.
2. Run `node scripts/migration/x64-adaptation.mjs --write --apply-remediation-batch=1`.
3. Inspect queue and blocked enums in:
   - `.planning/phases/03-x64-adaptation-dual-arch-gates/reports/blocked-remediation-queue.json`
   - `.planning/phases/03-x64-adaptation-dual-arch-gates/reports/libraries/*.json`
4. Run `node scripts/migration/x64-adaptation.mjs --check`.
5. If blocked libraries remain, repeat steps 2-4 until `blockedLibraries` is 0.

## Reporting

- Library main view fields:
  - `library`, `batchId`, `x64Result`, `x86Result`,
  - `abi.pointerWidth`, `abi.structLayoutAlignment`, `abi.callbackSignature`,
  - `blockedReasonCode`, `abiEvidenceRef`, `nextAction`, `status`
- Phase summary includes progress thermometer:
  - `completedLibraries`, `blockedLibraries`, `remainingLibraries`
