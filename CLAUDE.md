# Jarls Project Guidelines

## CRITICAL PRIORITY - DO THIS FIRST

**BEFORE doing ANY other task, check if file-splitting tasks are done.**

The following infrastructure tasks in `specs/prd-v1.json` are **BLOCKING** and must be completed first:

- ✅ "Split shared/src/index.ts - extract types.ts" - DONE
- ✅ "Split shared/src/index.ts - extract hex.ts" - DONE
- ✅ "Split shared/src/index.ts - extract board.ts" - DONE
- ✅ "Split shared/src/index.ts - extract combat.ts" - DONE
- ✅ "Split shared/src/index.ts - extract move.ts" - DONE
- ✅ "Split shared/src/index.ts - finalize and verify" - DONE
- ✅ "Split combat.ts - extract combat-core.ts" - DONE
- ✅ "Split move.ts - extract move-validation.ts" - DONE
- ✅ "Split shared/src/index.test.ts - create test directory" - DONE
- ✅ "Re-split hex.test.ts" - DONE
- ✅ "Re-split board.test.ts" - DONE
- ✅ "Extract combat-strength.test.ts from index.test.ts" - DONE
- ✅ "Extract combat-calculation.test.ts from index.test.ts" - DONE (split into combat-attack.test.ts, combat-defense.test.ts, combat-resolution.test.ts)
- ✅ "Extract push-simple.test.ts from index.test.ts" - DONE
- ✅ "Extract push-complex.test.ts from index.test.ts" - DONE (split into push-chain.test.ts, push-edge.test.ts, push-compression.test.ts, push-resolution.test.ts)
- ✅ "Extract move-validation.test.ts from index.test.ts" - DONE
- ❌ "Extract move-execution.test.ts from index.test.ts" - **BLOCKING**
- ✅ "Extract victory.test.ts from index.test.ts" - DONE (split into victory-throne.test.ts, victory-elimination.test.ts, victory-laststanding.test.ts)
- ❌ "Extract utils.test.ts from index.test.ts" - **BLOCKING**
- ❌ "Finalize index.test.ts" - **BLOCKING**

**WHY**: Files over 800 lines cause context explosion. Every task that touches these files consumes 2M+ tokens instead of ~100k target.

---

## Golden Rules

### File Size Limit

**No single code file should exceed ~800 lines.**

- This applies to all source code files (`.ts`, `.tsx`, `.js`, etc.)
- Documentation files (`.md`) are exempt
- If a file grows beyond 800 lines, split it into modules
- Test files should mirror source structure (e.g., `combat.ts` → `combat.test.ts`)

### Why This Matters

Large files cause context explosion when using AI assistants. A 3,000+ line file loads ~12k+ tokens just for the source, making even small tasks consume excessive context.

### Current Violations (HIGHEST PRIORITY - FIX FIRST)

- `packages/shared/src/index.test.ts` (~12,000 lines) → split into **tests**/\*.test.ts files (remaining tests)

### Recommended Module Structure for shared/src/

```
shared/src/
├── types.ts           # All type definitions
├── hex.ts             # Hex coordinate functions
├── board.ts           # Board generation functions
├── combat.ts          # Combat calculation functions (re-exports combat-core.ts)
├── combat-core.ts     # Core combat calculations
├── move.ts            # Move execution (re-exports move-validation.ts)
├── move-validation.ts # Move validation functions
├── starvation.ts      # Starvation mechanics
├── index.ts           # Re-exports everything
└── __tests__/
    ├── types.test.ts
    ├── hex-coordinates.test.ts
    ├── hex-directions.test.ts
    ├── board-generation.test.ts
    ├── board-validation.test.ts
    ├── combat-strength.test.ts
    ├── combat-calculation.test.ts
    ├── push-simple.test.ts
    ├── push-complex.test.ts
    ├── move-validation.test.ts
    ├── move-execution.test.ts
    ├── victory.test.ts
    └── utils.test.ts
```
