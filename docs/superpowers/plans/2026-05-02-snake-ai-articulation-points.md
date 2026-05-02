# Snake AI: Articulation Point Detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace blind flood-fill space counting in the snake AI with topology-aware region analysis using articulation point detection, preventing mid-to-late game deaths caused by the snake entering spatial "pockets."

**Architecture:** Add a `getRegionInfo` function to `snakeAI.ts` that runs Tarjan's articulation point algorithm on the free-cell graph and returns both raw and topology-safe reachable cell counts. Update `isSafeFoodResult` and the Phase 3 heuristic to use `safeSize` instead of the raw flood-fill count.

**Tech Stack:** TypeScript, Vitest (test runner: `npm test`)

---

## File Map

| File | Change |
|---|---|
| `src/snakeAI.ts` | Add `RegionInfo` type + `getRegionInfo` function; update `isSafeFoodResult`; update Phase 3 heuristic |
| `src/snakeAI.test.ts` | Add articulation point test cases |

---

### Task 1: Add `getRegionInfo` — failing tests first

**Files:**
- Modify: `src/snakeAI.test.ts`
- Modify: `src/snakeAI.ts`

- [ ] **Step 1: Export `getRegionInfo` from `snakeAI.ts` as a stub that throws**

  In `src/snakeAI.ts`, add this block just before the `// MAIN AI: CHOOSE MOVE` section comment (around line 383):

  ```ts
  // =============================================================================
  // REGION INFO (ARTICULATION POINT ANALYSIS)
  // =============================================================================

  export type RegionInfo = {
    safeSize: number;    // cells reachable without crossing a dangerous AP
    totalSize: number;   // raw flood-fill count
    isTrapped: boolean;  // safeSize < snake.length
  };

  export function getRegionInfo(snake: Point[], options: SnakeAIOptions): RegionInfo {
    throw new Error('not implemented');
  }
  ```

- [ ] **Step 2: Write failing tests for `getRegionInfo`**

  Add a new `describe` block at the end of `src/snakeAI.test.ts`:

  ```ts
  import { chooseAutoPlayMove, simulateMove, getRegionInfo } from './snakeAI';
  ```

  Update the existing import line to include `getRegionInfo`, then add at the bottom of the file:

  ```ts
  describe('getRegionInfo', () => {
    // Open board: no APs, safeSize === totalSize
    it('returns safeSize === totalSize on an open board', () => {
      const snake: Point[] = [{ x: 2, y: 2 }, { x: 2, y: 3 }];
      const result = getRegionInfo(snake, { gridSize: 5, wrapWalls: false });
      expect(result.totalSize).toBe(result.safeSize);
      expect(result.isTrapped).toBe(false);
    });

    // U-shaped pocket: food at bottom of U, head about to enter
    // Grid 5x5, snake forms a U along top, head is at the mouth of the U
    //   . . . . .
    //   S S S S .
    //   . . . S .
    //   . . . S .
    //   . . . . .
    // Head at (0,1), body goes right then down. Free space to the left of
    // the U is the pocket — only accessible through (0,1) which is the head.
    // After head moves down to (0,2), the only way back out is through (0,1).
    it('detects a U-shaped pocket: isTrapped true when head is inside pocket', () => {
      // Snake occupies right column and top row forming a U
      // Head at (0,2), tail at (0,1)
      // Free cells to the left (x=0..2, y=2..4) are in a pocket
      // accessible only through the cell above head
      const snake: Point[] = [
        { x: 0, y: 2 }, // head — inside pocket
        { x: 0, y: 1 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 3, y: 2 },
        { x: 3, y: 3 },
        { x: 3, y: 4 },
        { x: 2, y: 4 },
        { x: 1, y: 4 },
      ];
      const result = getRegionInfo(snake, { gridSize: 5, wrapWalls: false });
      // Pocket side (head side) has only a few cells; tail is outside
      expect(result.isTrapped).toBe(true);
      expect(result.safeSize).toBeLessThan(result.totalSize);
    });

    // Hourglass: two regions connected by single cell — head on one side, tail on other
    it('identifies safe side as the tail side in an hourglass topology', () => {
      // 5x5 grid, snake blocks col 2 except (2,2), creating hourglass
      // Head at (0,2), tail at (4,2), bottleneck at (2,2)
      const snake: Point[] = [
        { x: 0, y: 2 }, // head — left region
        { x: 2, y: 0 },
        { x: 2, y: 1 },
        // bottleneck: (2,2) is free
        { x: 2, y: 3 },
        { x: 2, y: 4 },
        { x: 4, y: 2 }, // tail — right region
      ];
      const result = getRegionInfo(snake, { gridSize: 5, wrapWalls: false });
      // Head is on left, tail on right — (2,2) is an AP separating them
      // safeSize should be smaller than totalSize (head is in smaller pocket)
      expect(result.safeSize).toBeLessThan(result.totalSize);
    });

    // Tail excluded from blocked set — tail cell is free next tick
    it('treats the tail cell as free (not blocked)', () => {
      // Snake forms a loop with one gap at the tail
      // Head can only escape through where the tail currently is
      const snake: Point[] = [
        { x: 1, y: 0 }, // head
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 2, y: 1 },
        { x: 2, y: 0 }, // tail — if blocked, head would be trapped
      ];
      const result = getRegionInfo(snake, { gridSize: 3, wrapWalls: false });
      expect(result.isTrapped).toBe(false);
    });

    // Wrap-walls: adjacency wraps around edges
    it('handles wrap-walls adjacency correctly', () => {
      const snake: Point[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
      const result = getRegionInfo(snake, { gridSize: 4, wrapWalls: true });
      expect(result.totalSize).toBeGreaterThan(0);
      expect(result.isTrapped).toBe(false);
    });
  });
  ```

- [ ] **Step 3: Run tests — verify they fail**

  ```
  npm test
  ```

  Expected: 5 new tests FAIL with `Error: not implemented`. Existing tests still pass.

---

### Task 2: Implement `getRegionInfo`

**Files:**
- Modify: `src/snakeAI.ts`

- [ ] **Step 1: Replace the stub with the full implementation**

  Replace the stub `getRegionInfo` function in `src/snakeAI.ts` with the implementation below. The `RegionInfo` type export above it stays unchanged.

  ```ts
  export function getRegionInfo(snake: Point[], options: SnakeAIOptions): RegionInfo {
    if (snake.length === 0) return { safeSize: 0, totalSize: 0, isTrapped: true };

    const head = snake[0];
    const tail = snake[snake.length - 1];
    const tailKey = pointKey(tail);

    // Build blocked set: all body cells except the tail (tail moves away next tick)
    const blocked = new Set<number>();
    for (let i = 1; i < snake.length - 1; i++) blocked.add(pointKey(snake[i]));

    // Collect all free cells (not blocked, not out of bounds)
    // We need them indexed for Tarjan's DFS
    const freeCells: Point[] = [];
    const cellIndex = new Map<number, number>(); // pointKey -> index in freeCells

    for (let y = 0; y < options.gridSize; y++) {
      for (let x = 0; x < options.gridSize; x++) {
        const p = { x, y };
        const k = pointKey(p);
        if (!blocked.has(k)) {
          cellIndex.set(k, freeCells.length);
          freeCells.push(p);
        }
      }
    }

    const n = freeCells.length;
    if (n === 0) return { safeSize: 0, totalSize: 0, isTrapped: true };

    const headIdx = cellIndex.get(pointKey(head));
    const tailIdx = cellIndex.get(tailKey);
    if (headIdx === undefined) return { safeSize: 0, totalSize: 0, isTrapped: true };

    // Tarjan's AP algorithm
    const disc = new Array<number>(n).fill(-1);
    const low = new Array<number>(n).fill(0);
    const parent = new Array<number>(n).fill(-1);
    const isAP = new Array<boolean>(n).fill(false);
    let timer = 0;

    const dfs = (u: number) => {
      disc[u] = low[u] = timer++;
      let childCount = 0;

      for (const { dir } of DIRECTIONS) {
        const neighbor = getNextPosition(freeCells[u], dir, options);
        const nk = pointKey(neighbor);
        const v = cellIndex.get(nk);
        if (v === undefined) continue; // out of bounds or blocked

        if (disc[v] === -1) {
          childCount++;
          parent[v] = u;
          dfs(v);
          low[u] = Math.min(low[u], low[v]);

          // u is an AP if:
          // - u is root with 2+ children, OR
          // - u is non-root and low[v] >= disc[u]
          if (parent[u] === -1 && childCount > 1) isAP[u] = true;
          if (parent[u] !== -1 && low[v] >= disc[u]) isAP[u] = true;
        } else if (v !== parent[u]) {
          low[u] = Math.min(low[u], disc[v]);
        }
      }
    };

    // Run DFS from head (we only care about the component containing head)
    dfs(headIdx);

    // totalSize: all cells visited from head (standard flood-fill equivalent)
    const totalSize = disc.filter((d, i) => d !== -1).length;

    // Identify dangerous APs: APs whose removal disconnects head from tail
    const dangerousAPs = new Set<number>();
    if (tailIdx !== undefined && disc[tailIdx] !== -1) {
      for (let i = 0; i < n; i++) {
        if (!isAP[i] || i === headIdx) continue;

        // BFS from head without node i — check if tail is still reachable
        const visited = new Set<number>([headIdx]);
        const queue: number[] = [headIdx];
        let qCursor = 0;
        let tailReachable = false;

        while (qCursor < queue.length) {
          const u = queue[qCursor++];
          if (u === tailIdx) { tailReachable = true; break; }
          for (const { dir } of DIRECTIONS) {
            const neighbor = getNextPosition(freeCells[u], dir, options);
            const nk = pointKey(neighbor);
            const v = cellIndex.get(nk);
            if (v === undefined || v === i || visited.has(v) || disc[v] === -1) continue;
            visited.add(v);
            queue.push(v);
          }
        }

        if (!tailReachable) dangerousAPs.add(i);
      }
    }

    // safeSize: flood-fill from head, stopping before dangerous APs
    let safeSize: number;
    if (dangerousAPs.size === 0) {
      safeSize = totalSize;
    } else {
      const visited = new Set<number>([headIdx]);
      const queue: number[] = [headIdx];
      let qCursor = 0;

      while (qCursor < queue.length) {
        const u = queue[qCursor++];
        for (const { dir } of DIRECTIONS) {
          const neighbor = getNextPosition(freeCells[u], dir, options);
          const nk = pointKey(neighbor);
          const v = cellIndex.get(nk);
          if (v === undefined || visited.has(v) || disc[v] === -1) continue;
          if (dangerousAPs.has(v)) continue; // stop before dangerous AP
          visited.add(v);
          queue.push(v);
        }
      }
      safeSize = visited.size;
    }

    return {
      safeSize,
      totalSize,
      isTrapped: safeSize < snake.length,
    };
  }
  ```

- [ ] **Step 2: Run tests — verify new tests pass**

  ```
  npm test
  ```

  Expected: all 5 new `getRegionInfo` tests PASS. All existing tests still pass.

- [ ] **Step 3: Commit**

  ```
  git init  # only if repo not yet initialized
  git add src/snakeAI.ts src/snakeAI.test.ts
  git commit -m "feat: add getRegionInfo with articulation point detection"
  ```

---

### Task 3: Wire `getRegionInfo` into `isSafeFoodResult`

**Files:**
- Modify: `src/snakeAI.ts`

- [ ] **Step 1: Update `isSafeFoodResult` to use `getRegionInfo`**

  Locate the `isSafeFoodResult` function. It currently ends with two return statements using `countReachableCells`. Replace the body from the `canReachTail` check onward:

  **Find this block** (around line 310–330 in current file):

  ```ts
  // Tail must be reachable (BFS-verified, 30K node limit)
  if (!canReachTail(snake, options)) return false;

  const reachableCells = countReachableCells(snake, options);

  // Non-contiguous body (scattered by shortcuts) needs more safety margin
  // because the scattered segments can block escape routes unexpectedly.
  if (cycle && !isBodyContiguousOnCycle(snake, cycle)) {
    // Stricter: need 2× snake length of reachable space
    return reachableCells >= Math.min(snake.length * 2, boardCells - snake.length);
  }

  // Contiguous body: standard margin
  return reachableCells >= Math.min(snake.length * 1.5, boardCells - snake.length);
  ```

  **Replace with:**

  ```ts
  // Tail must be reachable (BFS-verified, 30K node limit)
  if (!canReachTail(snake, options)) return false;

  const regionInfo = getRegionInfo(snake, options);
  if (regionInfo.isTrapped) return false;

  // Non-contiguous body (scattered by shortcuts) needs more safety margin
  // because the scattered segments can block escape routes unexpectedly.
  if (cycle && !isBodyContiguousOnCycle(snake, cycle)) {
    // Stricter: need 2× snake length of reachable space
    return regionInfo.safeSize >= Math.min(snake.length * 2, boardCells - snake.length);
  }

  // Contiguous body: standard margin
  return regionInfo.safeSize >= Math.min(snake.length * 1.5, boardCells - snake.length);
  ```

- [ ] **Step 2: Run tests — all must still pass**

  ```
  npm test
  ```

  Expected: all tests pass (no behavior change on existing test cases since they use open/semi-open boards).

- [ ] **Step 3: Commit**

  ```
  git add src/snakeAI.ts
  git commit -m "feat: use getRegionInfo in isSafeFoodResult for pocket detection"
  ```

---

### Task 4: Wire `getRegionInfo` into Phase 3 heuristic

**Files:**
- Modify: `src/snakeAI.ts`

- [ ] **Step 1: Update Phase 3 heuristic to use `safeSize`**

  Locate the Phase 3 loop in `chooseAutoPlayMove`. Find this block:

  ```ts
  const tailPath = findDynamicPathToTarget(
    result.snake, result.snake[result.snake.length - 1], NO_FOOD,
    { ...options, maxNodes: Math.min(options.maxNodes ?? SEARCH_LIMIT, 15000) }, 15000,
  );
  const space = countReachableCells(result.snake, options);
  ```

  Replace with:

  ```ts
  const tailPath = findDynamicPathToTarget(
    result.snake, result.snake[result.snake.length - 1], NO_FOOD,
    { ...options, maxNodes: Math.min(options.maxNodes ?? SEARCH_LIMIT, 15000) }, 15000,
  );
  const regionInfo = getRegionInfo(result.snake, options);
  const space = regionInfo.safeSize;
  ```

- [ ] **Step 2: Run tests — all must still pass**

  ```
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 3: Commit**

  ```
  git add src/snakeAI.ts
  git commit -m "feat: use topology-safe space in Phase 3 heuristic"
  ```

---

### Task 5: Add integration tests for pocket avoidance via `chooseAutoPlayMove`

**Files:**
- Modify: `src/snakeAI.test.ts`

- [ ] **Step 1: Add pocket-avoidance integration tests**

  Add to the existing `describe('chooseAutoPlayMove', ...)` block in `src/snakeAI.test.ts`:

  ```ts
  it('refuses to enter a U-shaped pocket even when food is inside', () => {
    // 5x5 grid. Snake forms a U along top and right side.
    // Head is at the mouth of the U (0,2). Food is inside the pocket (1,3).
    // Entering DOWN leads into the pocket; AI should refuse and go elsewhere.
    const snake: Point[] = [
      { x: 0, y: 2 }, // head — at mouth of pocket
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 3, y: 3 },
      { x: 3, y: 4 },
      { x: 2, y: 4 },
      { x: 1, y: 4 },
    ];
    const move = chooseAutoPlayMove({
      snake,
      food: { x: 1, y: 3 },
      gridSize: 5,
      wrapWalls: false,
    });
    // Moving DOWN (0,3) enters a pocket with no exit — AI must not do this
    expect(move).not.toBe('DOWN');
  });

  it('prefers the open region over a pocket when both contain safe moves', () => {
    // 6x6 grid. Two open regions separated by a near-full column.
    // Head is adjacent to both regions. Tail is in the larger open region.
    // AI should prefer the side the tail is on.
    const snake: Point[] = [
      { x: 2, y: 3 }, // head — can go left (pocket) or right (open)
      { x: 3, y: 3 },
      { x: 3, y: 2 },
      { x: 3, y: 1 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
      { x: 4, y: 3 },
      { x: 4, y: 4 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
      { x: 3, y: 4 }, // tail — on the right/open side
    ];
    const move = chooseAutoPlayMove({
      snake,
      food: { x: 5, y: 5 },
      gridSize: 6,
      wrapWalls: false,
    });
    // Going LEFT leads into a small pocket, RIGHT stays in open space with tail
    expect(move).not.toBe('LEFT');
  });
  ```

- [ ] **Step 2: Run tests**

  ```
  npm test
  ```

  Expected: all tests pass. If either new integration test fails, the `getRegionInfo` wiring is not working correctly — re-check Tasks 3 and 4.

- [ ] **Step 3: Commit**

  ```
  git add src/snakeAI.test.ts
  git commit -m "test: add pocket-avoidance integration tests for AI"
  ```

---

### Task 6: Smoke test in the browser

**Files:** none

- [ ] **Step 1: Start the dev server**

  ```
  npm run dev
  ```

- [ ] **Step 2: Enable Auto Play and observe mid-game behavior**

  Open the game, enable Auto Play, and watch the snake on a 20×20 grid for 2–3 full runs. The snake should no longer enter obvious U-shaped pockets or hourglass bottlenecks in mid-game. It may still die occasionally in very tight late-game positions — that is expected and outside this scope.

- [ ] **Step 3: Stop the server**

  `Ctrl+C`

---

## Done

All tasks complete when:
- `npm test` passes with zero failures
- The snake demonstrably avoids spatial pockets during manual observation
- Changes are committed in 4 focused commits
