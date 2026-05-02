# AutoPlay Snake — AI Research Project

> A self-playing Snake game with a hand-crafted AI that consistently achieves **perfect board clears (score 3970)** on a 20×20 grid using Hamiltonian cycle following, articulation point analysis, and topology-safe shortcut selection.

![snake-preview](https://img.shields.io/badge/score-3970%2F3970-brightgreen) ![tests](https://img.shields.io/badge/tests-10%20passing-brightgreen) ![stack](https://img.shields.io/badge/stack-React%2019%20%2B%20TypeScript%20%2B%20Vite-blue)

---

## Live Demo

```bash
npm install
npm run dev
```

Open `http://localhost:5173`, enable **Settings → Auto Play**, and watch the AI complete the board.

---

## What Makes This Interesting

Classic Snake AI approaches (pure BFS to food, or pure Hamiltonian cycle) both fail in practice:

- **BFS only** — greedy shortcuts that don't account for body topology cause the snake to trap itself in mid-game.
- **Hamiltonian cycle only** — guarantees safety but is extremely slow; the snake traverses all 400 cells per food item (avg. 200 moves per food vs. ~15 for a direct path).

This project implements a **four-phase hybrid** that gets the best of both — near-optimal speed in early/mid game and guaranteed safety in late game.

---

## AI Architecture

### Phase 1 — Topology-safe BFS shortcut

Try the shortest path to food. Accept it only when safe:

| Body state | Condition to accept shortcut |
|---|---|
| Contiguous on Hamiltonian cycle | Always safe — cycle is the proof |
| Scattered (off-cycle), board < 50% | `canReachTail` passes **and** `safeSize ≥ 2 × snake.length` |
| Scattered, board ≥ 50% full | Reject — fall through to cycle |

### Phase 2 — Hamiltonian cycle advance

Follow the precomputed Hamiltonian cycle. For contiguous bodies, the cycle direction is accepted immediately (mathematically proven safe). For scattered bodies, `canReachTail` is checked first.

### Phase 3 — Heuristic scoring

When the cycle direction itself is blocked, score all legal moves by:

```
score = safetyBonus + followTailBonus + safeSize × 5000 + cycleAdvance × 1000 + tailDistanceScore − foodDistance × 10
```

### Phase 4 — Desperate fallback

Pick the move with the most reachable cells. Last resort only.

---

## Key Algorithms

### Hamiltonian Cycle (O(n))

Two variants are precomputed and cached:

- **Standard grid** (no wall wrap): a boustrophedon path that uses the left column as a return lane, visiting all `n²` cells exactly once.
- **Toroidal grid** (wall wrap enabled): even rows left→right, odd rows right→left; the last cell wraps DOWN back to `(0,0)`, closing the loop without a return lane.

### Articulation Point Detection — `getRegionInfo` (O(n))

Iterative Tarjan DFS on the free-cell graph (body blocked, tail treated as free). Produces:

- `totalSize` — all cells reachable from head
- `safeSize` — cells reachable without crossing a *dangerous* articulation point
- `isTrapped` — whether `safeSize < snake.length`

**Dangerous AP detection in O(depth):** An articulation point `p` is dangerous iff it lies on the DFS-tree path from head to tail **and** its child toward tail satisfies `low[child] ≥ disc[p]` (no back edge bypasses it upward). Walk the `parent[]` array from tail to head — no BFS needed.

> This replaced an earlier O(AP × n) approach that ran a full BFS for each AP found, causing 20+ × 400 = 8 000 BFS operations per call in late game.

### `canReachTail` — Static BFS (O(n))

Simple flood-fill treating all body cells except the tail as blocked. Used to verify that a scattered shortcut hasn't enclosed the tail inside a body loop — a case `getRegionInfo` misses when the total free space is large.

### `isBodyContiguousOnCycle`

Verifies each body segment is exactly one step behind the previous on the Hamiltonian cycle. When true, the snake is in the "safe coil" state and expensive topology checks can be skipped entirely.

---

## Performance

All work happens synchronously in the game tick. On a 20×20 grid at 20× speed multiplier (≈10ms ticks):

| Operation | Complexity | Notes |
|---|---|---|
| `getRegionInfo` (Tarjan DFS) | O(n) | n = free cells ≤ 400 |
| Dangerous AP detection | O(depth) | Parent-array walk, no BFS allocation |
| `canReachTail` | O(n) | Static BFS, no snake-array copies |
| `findStaticPathToTarget` | O(n) | BFS, body-blocked grid |
| Phase 3 heuristic | O(4 × n) | One `getRegionInfo` per candidate |

Dynamic BFS (full snake-array copies per node) was completely removed — it was O(nodes × snake_length) and caused frame drops at snake length 200+ when node budgets were set to 15K–60K.

---

## Settings

| Setting | Range | Notes |
|---|---|---|
| Grid Size | 6×6 – 30×30 | Even sizes unlock Hamiltonian cycle |
| Wall Wrapping | on/off | Toroidal cycle used when on |
| Speed Multiplier | 1× – 20× | For testing; stacks on natural speed increase |
| Auto Play | on/off | AI takes control |

---

## Project Structure

```
src/
  snakeAI.ts          # All AI logic — pure functions, no React dependencies
  snakeAI.test.ts     # Vitest unit tests (10 tests)
  types.ts            # Shared types and constants
  components/
    SnakeGame.tsx     # React UI + game loop
  hooks/
    useInterval.ts    # setInterval hook with cleanup
  utils/
    cn.ts             # Tailwind class merge utility
```

---

## Running Tests

```bash
npm test
```

10 tests covering: simulation correctness, safety rejection, pocket detection, wrap-wall adjacency, tail-as-free-cell invariant, no-stall guarantee.

---

## Tech Stack

- **React 19** + **TypeScript 5** — UI and type safety
- **Vite 7** — dev server and build
- **Tailwind CSS 4** — styling
- **Vitest 4** — unit testing
- **Lucide React** — icons

---

## Results

| Grid | Mode | Typical Score | Perfect Clear |
|---|---|---|---|
| 20×20 | Normal | 3970 / 3970 | ✅ Consistent |
| 20×20 | Wall Wrap | 3970 / 3970 | ✅ Consistent |
| 10×10 | Normal | 990 / 990 | ✅ Consistent |
| 30×30 | Normal | ~8500+ | In progress |

---

## References

- Tarjan, R. E. (1972). *Depth-first search and linear graph algorithms*. SIAM Journal on Computing.
- Hamiltonian path on grid graphs — standard boustrophedon construction.
- Classic Snake AI survey: [johnflux.com/2012/02/17/snake-ai](https://johnflux.com/2012/02/17/snake-ai) 
