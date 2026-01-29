# NORSE WARS (Working Title)

### A Push-Combat Strategy Game for 2-6 Players

_Version 0.4.1_

---

## Overview

Norse Wars is a turn-based strategy game where players compete to either claim the central Throne or be the last Jarl standing. Combat uses **push mechanics** governed by physics — strength, momentum, and formations determine who moves whom. Pieces shove enemies toward the board's edge, where falling off means elimination.

---

## Components

**Per player:**

- 1 Jarl (unique color, larger piece)
- 4-5 Warriors (matching color, smaller pieces — varies by player count)

**Neutral:**

- 2-5 Shield tokens (gray, immovable obstacles)
- 1 Throne marker (center hex)

**Board:**

- Hexagonal grid (size scales with player count)

---

## Board Setup

### Scaling Table

| Players | Board Radius | Total Hexes | Shields | Warriors/Player | Total Pieces | Density |
| ------- | ------------ | ----------- | ------- | --------------- | ------------ | ------- |
| 2       | 3            | 37          | 5       | 5               | 12           | ~32%    |
| 3       | 5            | 91          | 4       | 5               | 18           | ~20%    |
| 4       | 6            | 127         | 4       | 4               | 20           | ~16%    |
| 5       | 7            | 169         | 3       | 4               | 25           | ~15%    |
| 6       | 8            | 217         | 3       | 4               | 30           | ~14%    |

_Hex count formula: 3r² + 3r + 1_

_Density scaling is intentionally non-linear: 2-player is tight and tactical, larger games are more open but complexity comes from player interactions._

### Critical Setup Rule: Equidistant Starting Positions

**All Jarls must start exactly the same number of hexes from the Throne.**

Board shape and starting positions are calculated to guarantee this regardless of player count. No first-player advantage in throne races.

### Setup Steps

1. Place the **Throne** on the center hex
2. Place **Shields** using balanced random placement (see Shield Placement Rules)
3. Each player claims an **evenly-spaced edge section** (like pie slices)
4. Players place their pieces in their starting zone:
   - **Jarl** on the edge (furthest corner of their section)
   - **Warriors** in front of the Jarl (toward center)

### Shield Placement Rules

Shields are placed randomly but with constraints:

- **Symmetrically balanced** — rotational symmetry matching player count
- **Equidistant from all starting positions** — no player gets a defensive advantage
- **Never blocking all straight-line paths to Throne** — each player must have at least one unobstructed straight route to center
- **Never on Throne hex** — re-roll if generated there
- **Never on edge hexes** — Shields only in interior

---

## Pieces

| Piece       | Owner   | Strength | Movement                     | Special                           |
| ----------- | ------- | -------- | ---------------------------- | --------------------------------- |
| **Warrior** | Player  | 1        | 1-2 hexes in a straight line | Can provide draft for Jarl        |
| **Jarl**    | Player  | 2        | 1 hex (or 2 with draft)      | Only piece that can enter Throne  |
| **Shield**  | Neutral | ∞        | Immovable                    | Cannot be pushed, blocks movement |

---

## Turn Structure

**Turn order:** Rotating first player. Each round, the starting player shifts clockwise. Within a round, play proceeds clockwise.

**On your turn:** Move exactly ONE piece.

**Passing:** You may not pass. If you have legal moves, you must take one.

**No legal moves:** Extremely rare. If truly boxed in with no legal moves, your turn is skipped.

---

## Movement Rules

### Warrior Movement

- Move 1-2 hexes in a straight line (no turning mid-move)
- Cannot move through other pieces (friend, foe, or Shield)
- Cannot land on friendly pieces
- Can move toward enemies (triggers push attempt)
- Cannot enter the Throne hex

### Jarl Movement

**Standard:** Move 1 hex in any of the 6 directions

**Draft Movement (Extended):** Move 2 hexes in a straight line IF:

- You have **2+ friendly Warriors directly behind** your Jarl (opposite the direction of movement)
- The Warriors propel the Jarl forward — like a slingshot formation
- This allows the Jarl to gain **momentum** (+1 attack if pushing)

```
Draft Formation Example:

     ___     ___     ___
    / J \___/ W \___/ W \___
    \___/   \___/   \___/   \
    → → →  (Jarl can move 2 hexes this direction)

    J = Jarl (moving right)
    W W = Warriors behind (enabling draft)
```

### Throne Rules

- **Only Jarls can enter** the Throne hex — Warriors cannot occupy it
- **Victory is immediate** when your Jarl voluntarily moves onto the Throne
- **No pass-through:** A Jarl cannot move through the Throne — any movement path crossing the Throne stops there (triggering victory)
- **Warriors stop at the edge:** Push chains cannot force Warriors into the Throne hex (compression, like Shields)
- **Being pushed doesn't count:** An enemy Jarl pushed onto the Throne does not win — victory requires voluntary movement on your own turn

---

## Push Combat — The Physics System

### Strength

| Piece   | Base Strength |
| ------- | ------------- |
| Warrior | 1             |
| Jarl    | 2             |
| Shield  | ∞ (immovable) |

### Attack Power

When you move into an enemy's hex, calculate your Attack:

| Factor                | Bonus                                                                           |
| --------------------- | ------------------------------------------------------------------------------- |
| Your piece's strength | +1 (Warrior) or +2 (Jarl)                                                       |
| **Momentum**          | +1 if you moved 2 hexes to reach them                                           |
| **Inline support**    | + strength of each friendly piece directly behind you (opposite push direction) |

### Defense Power

The target's Defense:

| Factor            | Bonus                                                                            |
| ----------------- | -------------------------------------------------------------------------------- |
| Target's strength | +1 (Warrior) or +2 (Jarl)                                                        |
| **Bracing**       | + strength of each friendly piece directly behind them (opposite push direction) |

### Resolution

| Comparison           | Result                                |
| -------------------- | ------------------------------------- |
| **Attack > Defense** | Push succeeds                         |
| **Attack ≤ Defense** | Blocked — you stop adjacent to target |

---

## Formations

### Inline (Offensive)

```
         ___
        /   \
    ___/ You \___
   /   \_____/ E \
   \ S /     \___/
    \_/

   S = Support (behind you)
   You = Attacking piece
   E = Enemy
```

Friendly pieces **directly behind you** add their strength to your attack.

### Bracing (Defensive)

```
         ___
        /   \
    ___/ You \___
   / E \_____/   \
   \___/     \ B /
             \___/

   E = Enemy (attacker)
   You = Defending piece
   B = Brace (behind you)
```

Friendly pieces **directly behind the defender** add their strength to defense.

### Draft (Jarl Movement)

```
    ___     ___     ___
   / J \___/ W \___/ W \
   \___/   \___/   \___/
   → → →

   J = Jarl (moving right)
   W W = Warriors behind (enabling 2-hex movement)
```

2+ Warriors behind the Jarl enable extended movement with momentum.

---

## Combat Examples

### Basic Pushes

```
W → W (1 hex move, both alone)
Attack: 1 | Defense: 1
BLOCKED (stop adjacent)

W →→ W (2 hex move, momentum)
Attack: 1 + 1 = 2 | Defense: 1
PUSH ✓

W W → W (inline support)
Attack: 1 + 1 = 2 | Defense: 1
PUSH ✓
```

### Bracing Defense

```
W → W ← W (defender is braced)
Attack: 1 | Defense: 1 + 1 = 2
BLOCKED

W →→ W ← W (momentum vs braced)
Attack: 2 | Defense: 2
BLOCKED (tie = blocked)

W W →→ W ← W (inline + momentum vs braced)
Attack: 1 + 1 + 1 = 3 | Defense: 1 + 1 = 2
PUSH ✓
```

### Jarl Combat

```
W → J (warrior vs jarl, alone)
Attack: 1 | Defense: 2
BLOCKED

W W W → J (3 warriors inline)
Attack: 1 + 1 + 1 = 3 | Defense: 2
PUSH ✓

J → W
Attack: 2 | Defense: 1
PUSH ✓

J → J (both alone)
Attack: 2 | Defense: 2
BLOCKED

J →→ J (jarl with draft/momentum)
Attack: 2 + 1 = 3 | Defense: 2
PUSH ✓

J → J ← W (jarl vs braced jarl)
Attack: 2 | Defense: 2 + 1 = 3
BLOCKED
```

### Mixed Support

```
W with Jarl behind → Enemy
Attack: 1 (warrior) + 2 (jarl support) = 3

W with 2 Warriors behind → Enemy
Attack: 1 + 1 + 1 = 3

Both equal — Jarl support is efficient (1 piece = +2) but Warriors are more flexible.
```

---

## Chain Pushing

When a piece is pushed, it pushes whatever is directly behind it.

### Chain Rules

- Chains continue until a piece lands in an empty hex
- All pieces in chain move 1 hex in push direction
- **Edge elimination:** Pieces pushed off board are removed permanently

### Shield Compression

**Shields stop chains but don't cancel the push.**

If a chain would push into a Shield:

- Push succeeds up to the Shield
- Pieces compress against the Shield (stop there, don't die)
- Attacker still takes the first defender's spot

```
Before: A →→ W ← W ← [Shield]
After:  _ ← A ← W ← W [Shield]

Push succeeds. Both W's compress against Shield. A takes first position.
```

### Throne Compression

**The Throne blocks Warriors like a Shield.**

If a chain would push a Warrior into the Throne hex:

- Push succeeds up to the Throne
- Warrior stops adjacent to Throne (cannot enter)
- Chain compresses

```
Before: A →→ W ← W ← [Throne]
After:  _ ← A ← W ← W [Throne]

Warriors compress at Throne's edge. They cannot enter.
```

### Multi-Elimination Chain

```
Before: A →→ W1 ← W2 ← W3 [edge]
After:  _ ← A  ← W1 ← W2 [edge]

A pushes W1, W1 pushes W2, W2 pushes W3 off edge.
W3 = ELIMINATED
W2 stops at edge.
W1 stops where W2 was.
A takes W1's original spot.
```

**Yes, chains can eliminate multiple pieces if they're against the edge.**

---

## Edge Elimination

- A piece pushed off the board edge is **permanently eliminated**
- Chain pushes can eliminate multiple pieces in one move
- **Losing your Jarl = you are eliminated from the game**
- When a player is eliminated, all their remaining Warriors are removed (they become spirits and fly away until next game)

---

## Win Conditions

**You win immediately if either occurs:**

1. **Throne Victory:** Your Jarl voluntarily moves onto the Throne — victory is **immediate**
2. **Last Standing:** All other Jarls have been eliminated

### Win Precedence

If multiple win conditions would trigger on the same turn:

- **Throne Victory takes precedence over Last Standing**
- In the impossible case of simultaneous Throne claims: current player wins

---

## Stalemate Prevention: The Starvation Rule

If **no piece is eliminated for 10 consecutive rounds:**

1. **Warriors starve first** — each player removes 1 Warrior (furthest from Throne)
2. **Tie-breaker:** If multiple Warriors are equidistant, the owning player chooses which one starves
3. **No Warriors:** If a player has no Warriors when starvation triggers, their Jarl is immediately at risk
4. Repeat every 5 rounds with no elimination
5. When a player has no Warriors left, their **Jarl begins starving** (eliminated after 5 more rounds of stalemate)

This forces endgame resolution and prevents infinite defensive turtling.

---

## Edge Cases & Clarifications

**Q: Can I push my own pieces?**
A: No. Moving into a friendly piece is illegal.

**Q: If I'm blocked, where do I end up?**
A: Adjacent to the target. You still used your turn.

**Q: Can support/bracing stack from multiple pieces?**
A: Yes. All friendly pieces directly behind (in a line) add their strength.

**Q: Can a Jarl provide inline support?**
A: Yes. Jarl behind a Warrior = +2 support.

**Q: Diagonal support on hex grid?**
A: No diagonals. "Directly behind" = the single hex exactly opposite your movement direction.

**Q: Can Warriors enter the Throne?**
A: No. Only Jarls can enter the Throne hex.

**Q: Can a Jarl pass through the Throne during a 2-hex move?**
A: No. The Throne stops all movement — if your path crosses it, you stop there and win.

**Q: What if a Jarl is pushed onto the Throne?**
A: They don't win. Victory requires voluntary movement on your own turn.

**Q: Can you push an enemy Jarl onto the Throne?**
A: Yes, but they don't win — they were pushed, not moved voluntarily.

**Q: What if a push chain would force a Warrior into the Throne?**
A: The Warrior stops adjacent to the Throne (compression). Warriors cannot enter.

---

## Tactical Concepts

### Offensive Tactics

| Tactic               | Description                                            |
| -------------------- | ------------------------------------------------------ |
| **The Train**        | Line up pieces for maximum inline support              |
| **Momentum Strike**  | 2-hex charge to break even defenses                    |
| **Flanking**         | Attack from the side where they have no brace          |
| **Cut the Brace**    | Push away their support piece, then hit exposed target |
| **Slingshot Launch** | Set up 2 Warriors behind Jarl for momentum charge      |

### Defensive Tactics

| Tactic               | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| **Stay Braced**      | Keep friendly pieces behind valuable units                     |
| **Shield Anchoring** | Position near Shields — compression stops lethal chains        |
| **Throne Buffer**    | Use Throne as a compression point for Warriors                 |
| **Bait**             | Leave piece "exposed" but actually braced — waste their charge |
| **Sidestep**         | Enemy builds a train, you simply move out of the line          |

### Multiplayer Tactics

| Tactic                      | Description                                                   |
| --------------------------- | ------------------------------------------------------------- |
| **Let Them Fight**          | Hang back while others weaken each other                      |
| **Kingmaker Threat**        | "Attack me and I'll push your Jarl off before I die"          |
| **Throne Race**             | Ignore combat, sprint Jarl to center while they're distracted |
| **Alliance of Convenience** | Temporarily coordinate against the leader                     |

---

## Optional Rules

### Fog of War (Digital Only)

Pieces more than 4 hexes from any of your pieces are hidden. Creates scouting and ambush tactics.

### Draft Shields

Instead of random placement, players take turns placing one Shield each (reverse turn order). Adds strategic setup phase.

### Sudden Death

Alternative to Starvation: After 20 rounds with no elimination, the board **shrinks** — outer ring becomes "edge" and pieces there fall off. Repeat every 5 rounds.

### Team Mode (4 or 6 players)

- 2v2 or 3v3
- Teammates share victory
- **Non-adjacent start:** Teammates begin in opposite/separate corners, not side-by-side. Teams must coordinate movement to combine forces.
- Allied pieces can provide support/bracing to each other (once linked up)
- Allied pieces cannot push each other
- **Allied pieces block push chains** — chains compress and stop at allies, teammates are never pushed
- Team loses when both/all Jarls are eliminated

---

## Quick Reference Card

```
STRENGTH
  Warrior = 1
  Jarl = 2

MOVEMENT
  Warrior: 1-2 hexes straight (cannot enter Throne)
  Jarl: 1 hex (or 2 with draft)

DRAFT: 2+ Warriors BEHIND Jarl → Jarl can move 2 hexes forward

ATTACK = Strength + Momentum (+1 if 2-hex) + Inline Support
DEFENSE = Strength + Bracing Support

PUSH if Attack > Defense
BLOCKED if Attack ≤ Defense

CHAIN PUSH: Pushed pieces push what's behind them
SHIELD: Stops chain (compression), doesn't cancel push
THRONE: Stops Warriors (compression), Jarls enter and win
EDGE: Pushed off = eliminated

WIN CONDITIONS (in order of precedence):
  1. Jarl voluntarily moves onto Throne (immediate win)
  2. Last Jarl standing

STARVATION: No kills for 10 rounds → remove 1 Warrior each (player chooses if tied)
            Repeats every 5 rounds until resolution
```

---

## Design Notes

### Why These Rules?

| Rule                       | Purpose                                           |
| -------------------------- | ------------------------------------------------- |
| Push > Capture             | Creates positional chess, not piece trading       |
| Formations (inline/brace)  | Rewards planning, punishes isolation              |
| Momentum                   | Risk/reward for commitment                        |
| Jarl draft (behind)        | Makes Warriors valuable as launch platform        |
| Shield compression         | Shields are defensive, not instant-death blockers |
| Throne compression         | Throne is a goal, not a death trap for Warriors   |
| Throne = instant win       | No ambiguity, clear victory moment                |
| Throne + Last Standing     | Dual win paths prevent turtling                   |
| Starvation + player choice | Guarantees game ends, preserves agency            |
| Equidistant start          | No first-player throne advantage                  |
| Non-linear density         | 2-player tactical, 6-player political             |

### Untested / Needs Playtesting

- Starvation timing (currently 10 rounds — may need adjustment)
- Shield count balance per player count
- Draft requirement (2 Warriors? 3?)
- Whether Jarl-on-edge start is too risky or perfect tension
- Throne compression interactions in complex chains

---

_Version 0.4.1 — Ready for playtesting_
