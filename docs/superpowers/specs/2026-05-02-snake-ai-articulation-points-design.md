# Snake AI: Articulation Point Detection — Design Spec

**Date:** 2026-05-02  
**Status:** Approved  
**Goal:** Improve mid-to-late-game survival by replacing blind flood-fill space counting with topology-aware region analysis using articulation point detection.

---

## Problem

The snake dies in mid-to-late game (board ~30–70% full) by entering spatial "pockets" — regions of free cells connected to the rest of the board through a single bottleneck cell. The current `countReachableCells` function does a blind BFS and counts total reachable cells, but does not detect whether the head is trapped in a pocket it can never escape. A move into a 60-cell pocket behind a 1-cell bottleneck scores the same as a move into 60 open cells, even though the first will kill the snake after enough food is eaten.

---

## Solution: Articulation Point Detection

Run Tarjan's articulation point algorithm on the free-cell graph to identify nodes whose removal disconnects the graph. Use this to determine the "safe size" — the number of free cells reachable from the head without crossing a dangerous articulation point.

**Dangerous articulation point definition:** An AP is dangerous if removing it splits the free-cell graph such that one component contains the snake's head but *not* the tail. This is the topology that traps the snake.

---

## New Function: `getRegionInfo`

```ts
type RegionInfo = {
  safeSize: number;    // cells reachable without crossing a dangerous AP
  totalSize: number;   // raw flood-fill count (current behavior)
  isTrapped: boolean;  // head is in a pocket smaller than snake.length
}

function getRegionInfo(snake: Point[], options: SnakeAIOptions): RegionInfo
```

### Algorithm

1. Build the free-cell graph: all grid cells not occupied by snake body segments (excluding the tail, which will be free next tick).
2. Run Tarjan's DFS from the head node, computing `disc[]` (discovery time) and `low[]` (lowest disc reachable via tree + back edges).
3. Identify all articulation points: node `u` is an AP if it has a child `v` with `low[v] >= disc[u]` (and `u` is not the DFS root, or the root has 2+ DFS children).
4. For each AP, determine if it is dangerous: temporarily remove the AP from the graph and check whether the tail is still reachable from the head. If not — the AP separates head from tail — it is dangerous.
5. `safeSize`: flood-fill from head, stopping *before* crossing dangerous APs (the AP cell itself is not counted). Count cells in the resulting connected component.
6. `totalSize`: standard flood-fill count (existing behavior).
7. `isTrapped`: `safeSize < snake.length`.

### Tail Handling

The tail occupies `snake[snake.length - 1]`. Since the tail moves away on the next tick, it must be excluded from the blocked-cell set when building the free-cell graph. This matches the existing behavior in `canReachTail` and `countReachableCells`.

### Wrap-Walls Support

Adjacency is computed using `getNextPosition(point, dir, options)`, which already handles toroidal wrapping. No special-casing needed.

---

## Changes to Existing Code

### `isSafeFoodResult`

**Before:**
```ts
const reachableCells = countReachableCells(snake, options);
// ...
return reachableCells >= Math.min(snake.length * 1.5, boardCells - snake.length);
```

**After:**
```ts
const regionInfo = getRegionInfo(snake, options);
if (regionInfo.isTrapped) return false;
return regionInfo.safeSize >= Math.min(snake.length * 1.5, boardCells - snake.length);
```

The existing early-exit guards (`snake.length < boardCells * 0.2`, `!hasLegalContinuation`, `!canReachTail`) remain unchanged. `getRegionInfo` is only called when those pass.

### Phase 3 Heuristic (in `chooseAutoPlayMove`)

**Before:**
```ts
const space = countReachableCells(result.snake, options);
// ...
const score = safetyScore + followBonus + space * 5_000 + cycleBonus + tailDistanceScore - foodDistance * 10;
```

**After:**
```ts
const regionInfo = getRegionInfo(result.snake, options);
const space = regionInfo.safeSize;
// score formula unchanged
const score = safetyScore + followBonus + space * 5_000 + cycleBonus + tailDistanceScore - foodDistance * 10;
```

Using `safeSize` instead of `totalSize` means the heuristic actively steers away from topologically dangerous moves, not just small-space moves.

### `countReachableCells`

Retained as-is. It is still used in:
- `getBestCycleAdvanceMove` (quick dead-end check during cycle following — full AP analysis not needed here)
- `canReachTail` indirectly via `isSafeFoodResult`'s early-game path

---

## Edge Cases

| Scenario | Behavior |
|---|---|
| Open board (early game) | `safeSize === totalSize`, behavior identical to today |
| Snake fills entire board | `isSafeFoodResult` returns `true` immediately, `getRegionInfo` never called |
| No articulation points | `safeSize === totalSize`, behavior identical to today |
| Single-cell bottleneck | Caught as an AP; head side is smaller than tail side → dangerous → `isTrapped = true` |
| Wrap-walls mode | `getNextPosition` handles toroidal adjacency, no special logic needed |
| Tail is the target | Tail excluded from blocked set, same as existing `canReachTail` logic |

---

## Performance

- `getRegionInfo` runs a single DFS: O(V+E) where V = free cells (≤ gridSize²), E ≤ 4V.
- Called at most 4 times per frame (once per candidate direction in Phase 3).
- On a 20×20 grid: 4 × 400-node DFS — sub-millisecond.
- No caching needed given these constraints.

---

## Testing

New test cases to add to `snakeAI.test.ts`:

1. **U-shaped pocket** — snake forms a U, food is at the bottom of the U. AI must refuse to enter.
2. **Hourglass topology** — two open regions connected by a single cell. AI should prefer the region containing the tail.
3. **Open board regression** — behavior on a nearly-empty board must be identical before and after.
4. **Wrap-walls articulation** — AP detection works correctly on a toroidal grid.
5. **`getRegionInfo` unit tests** — directly test `safeSize`, `totalSize`, and `isTrapped` on constructed grid states.

---

## Files Changed

| File | Change |
|---|---|
| `src/snakeAI.ts` | Add `getRegionInfo`, update `isSafeFoodResult`, update Phase 3 heuristic |
| `src/snakeAI.test.ts` | Add articulation point test cases |

No changes to `types.ts`, `SnakeGame.tsx`, or any other file.
