# Jarls - Game Rules Specification v1.0

## Document Purpose

This document captures all rule clarifications and design decisions made during the game design interview. It serves as the authoritative reference for implementation.

**Base Ruleset:** jarls-ruleset-v04.md (Version 0.4.1)

---

## Core Decisions

### Scope

| Item             | Decision                                                  |
| ---------------- | --------------------------------------------------------- |
| Platform         | Web (browser-based)                                       |
| MVP Player Count | 2-player only (architecture supports 2-6)                 |
| AI Opponent      | Yes                                                       |
| Multiplayer      | Online (not hot-seat)                                     |
| Optional Rules   | None in v1 (Fog of War, Sudden Death, Team Mode deferred) |

---

## Physics & Formations

### Formation Type: Straight-Line Only

Support, bracing, and draft formations use **straight-line only** (not V or Y shapes).

```
VALID (inline support):
    W ← W ← W → E
    Attack = 1 + 1 + 1 = 3

INVALID (V-formation - NOT supported in v1):
       W   W
        \ /
         W → E
```

**Future Enhancement:** V-formations may be added in a later version.

### Inline Support Stacking

All friendly pieces **directly behind in a line** add their strength to the attack.

```
W W W → E
│ │ │
│ │ └── +1 support
│ └──── +1 support
└────── Attacker (base 1)

Total Attack = 1 + 1 + 1 = 3
```

### Draft Formation

Jarl can move 2 hexes when **2+ friendly Warriors are behind** in the movement direction.

- Warriors do NOT need to be consecutive
- Must be in the same straight line

```
VALID:
J ← W ← _ ← W    (gap allowed)
J ← W ← W        (consecutive)

INVALID:
J ← W            (only 1 warrior)
```

---

## Combat Resolution

### Blocked Attack Position

When an attack is **blocked** (Attack ≤ Defense), the attacker **moves to the adjacent hex** next to the target. The turn is consumed.

```
Before: W . . E    (W attacks E from 2 hexes away)
Attack: 1 + 1 (momentum) = 2
Defense: 2 (E is braced)
Result: BLOCKED

After:  . . W E    (W stops adjacent to E)
```

### Push Chain Direction

All pieces in a chain move in the **same direction as the attacker's push**.

```
Before: A →→ B ← C ← D [edge]
After:  . ← A ← B ← C    (D eliminated)

All move in A's attack direction (→)
```

### Mixed Allegiance Chains

Chains can contain **both friendly and enemy pieces**. All pieces move regardless of owner.

```
Before: A →→ E1 ← F1 ← E2 [edge]
        (A attacks E1, F1 is A's ally)

After:  . ← A ← E1 ← F1    (E2 eliminated)

F1 (friendly) is pushed along with enemies.
```

---

## Throne Rules

### Throne Compression (CRITICAL RULE)

**Jarls CANNOT be pushed onto the Throne.**

The Throne acts as a compression point for ALL pieces:

- Warriors compress at Throne (cannot enter)
- Jarls compress at Throne (cannot be pushed onto it)

This means:

- Victory requires **voluntary** movement onto the Throne
- A Jarl can never be "accidentally" placed on the Throne
- There is no scenario where a Jarl sits on the Throne without winning

```
Before: A →→ J ← [Throne]
Result: COMPRESSION - J stops adjacent to Throne

A Jarl can ONLY enter the Throne by moving there on their own turn.
```

### Throne Victory

Victory is **immediate** when a Jarl voluntarily moves onto the Throne during their turn.

---

## Turn & Game Flow

### Turn Timeout

When a player's turn timer expires:

- Turn is **auto-skipped**
- Player's pieces remain in current positions
- No penalty beyond losing the turn

### Passing

Players cannot voluntarily pass. If legal moves exist, one must be taken.

### Disconnection Handling

1. **Reconnection Window:** 2 minutes
2. **During Window:** Game waits, turn timer paused
3. **After Window:** Game remains paused (future: AI takeover)
4. **Reconnection:** Player can reconnect and resume control

---

## Miscellaneous

### Spectators

- Unlimited spectators per game
- Spectators receive real-time game state updates
- Spectators cannot affect gameplay

### Game Name

The game is called **Jarls** (not "Norse Wars").

---

## Reference: Strength Values

| Piece   | Strength |
| ------- | -------- |
| Warrior | 1        |
| Jarl    | 2        |

## Reference: Attack Formula

```
Attack = Base Strength + Momentum + Inline Support

Where:
- Base Strength = 1 (Warrior) or 2 (Jarl)
- Momentum = +1 if moved 2 hexes
- Inline Support = sum of strength of all friendly pieces directly behind
```

## Reference: Defense Formula

```
Defense = Base Strength + Bracing

Where:
- Base Strength = 1 (Warrior) or 2 (Jarl)
- Bracing = sum of strength of all friendly pieces directly behind (opposite push direction)
```

## Reference: Push Resolution

```
IF Attack > Defense THEN Push succeeds
IF Attack ≤ Defense THEN Blocked (attacker stops adjacent)
```

---

_Document Version: 1.1_
_Updated: 2026-02-01_
_Removed: Starvation mechanic, Shield pieces_
