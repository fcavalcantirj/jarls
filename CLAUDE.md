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
- ✅ "Extract move-execution.test.ts from index.test.ts" - DONE (split into move-execution.test.ts, apply-move.test.ts)
- ✅ "Extract victory.test.ts from index.test.ts" - DONE (split into victory-throne.test.ts, victory-elimination.test.ts, victory-laststanding.test.ts)
- ✅ "Extract utils.test.ts from index.test.ts" - DONE (split into utils.test.ts, utils-path.test.ts)
- ✅ "Finalize index.test.ts" - DONE (deleted, all tests extracted)

**All file-splitting tasks are COMPLETE.** No more blocking infrastructure tasks.

---

## Golden Rules

### TDD First — Write Tests Before Code

**ALWAYS follow Test-Driven Development when fixing bugs or adding features.**

1. **RED**: Write a failing test that demonstrates the bug or describes the expected behavior
2. **GREEN**: Write the minimum code needed to make the test pass
3. **REFACTOR**: Clean up the code while keeping tests green

**Why this matters:**

- Tests prove the fix actually works before deployment
- Tests document the expected behavior
- Tests prevent regressions
- Without a failing test, you can't prove you fixed anything

**Never skip this process:**

- Do NOT write code first, then tests
- Do NOT "test manually in production"
- Do NOT assume code works without a failing test proving the problem

### Server Is the Authority — Client Must Be Dumb

**100% of game logic lives on the API. The client is a dumb terminal that only renders and relays user input.**

- The client must NEVER decide whose turn it is, validate moves, calculate combat, check win conditions, or advance game state.
- ALL game rules, turn logic, and state transitions happen server-side only.
- After sending a move (`playTurn`), the client must **immediately block all interaction** (`movePending = true`) until the server responds with the authoritative state via `turnPlayed`.
- The client must not allow piece selection, move sending, or any game action while `movePending` or `isAnimating` is true.
- `selectIsMyTurn` must return `false` when `movePending` is true, regardless of what `gameState.currentPlayerId` says (it may be stale).
- Two gaps must always be closed:
  1. **Emit-to-broadcast gap**: Between sending `playTurn` and receiving `turnPlayed` — closed by `movePending`.
  2. **Broadcast-to-animation gap**: Between receiving `turnPlayed` and the React effect starting animation — closed by `setPendingTurnUpdate` immediately setting `isAnimating = true`.

### React Stale Closure Trap — Always Read Fresh from Store

**In `useCallback` handlers that need the LATEST state for blocking decisions, read directly from `useGameStore.getState()`, NOT from captured React state.**

React's `useCallback` captures variable values at render time. When a user clicks rapidly:

1. First click triggers callback → state updated via Zustand
2. React hasn't re-rendered yet
3. Second click triggers callback → **still has OLD captured values!**

```typescript
// BAD — stale closure, captures values at render time
const movePending = useGameStore((s) => s.movePending);
const handleClick = useCallback(() => {
  if (movePending) return; // ← STALE! Can be false even after setMovePending(true)
}, [movePending]);

// GOOD — reads fresh value every time
const handleClick = useCallback(() => {
  const { movePending } = useGameStore.getState(); // ← FRESH every call
  if (movePending) return;
}, []);
```

This applies to ALL blocking guards (`isAnimating`, `movePending`, `isMyTurn`) in click handlers.

### File Size Limit

**No single code file should exceed ~800 lines.**

- This applies to all source code files (`.ts`, `.tsx`, `.js`, etc.)
- Documentation files (`.md`) are exempt
- If a file grows beyond 800 lines, split it into modules
- Test files should mirror source structure (e.g., `combat.ts` → `combat.test.ts`)

### Why This Matters

Large files cause context explosion when using AI assistants. A 3,000+ line file loads ~12k+ tokens just for the source, making even small tasks consume excessive context.

### Current Module Structure for shared/src/

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
    ├── combat-attack.test.ts
    ├── combat-defense.test.ts
    ├── combat-resolution.test.ts
    ├── push-simple.test.ts
    ├── push-chain.test.ts
    ├── push-edge.test.ts
    ├── push-compression.test.ts
    ├── push-compression-edge.test.ts
    ├── push-resolution.test.ts
    ├── move-validation.test.ts
    ├── move-execution.test.ts
    ├── move-validmoves.test.ts
    ├── apply-move.test.ts
    ├── victory-throne.test.ts
    ├── victory-elimination.test.ts
    ├── victory-laststanding.test.ts
    ├── utils.test.ts
    └── utils-path.test.ts
```
