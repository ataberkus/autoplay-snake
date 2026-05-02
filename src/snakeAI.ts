import type { Direction, Point } from './types';

export type SnakeAIOptions = {
  gridSize: number;
  wrapWalls: boolean;
  maxNodes?: number;
};

export type SnakeAIInput = SnakeAIOptions & {
  snake: Point[];
  food: Point;
};

export type SimulationResult = {
  snake: Point[];
  head: Point;
  ate: boolean;
  collision: boolean;
};

// =============================================================================
// HAMILTONIAN CYCLE
// =============================================================================

type CycleData = {
  index: Map<string, number>;
  nextDir: Map<string, Direction>;
  length: number;
};

let cycleCache: CycleData | null = null;
let cycleCacheGridSize = -1;
let cycleCacheWrapped: CycleData | null = null;
let cycleCacheWrappedGridSize = -1;

function buildCycle(gridSize: number): CycleData {
  const index = new Map<string, number>();
  const nextDir = new Map<string, Direction>();
  const key = (x: number, y: number) => x + ',' + y;

  const add = (x: number, y: number) => { index.set(key(x, y), index.size); };

  for (let x = 0; x < gridSize; x++) add(x, 0);
  for (let y = 1; y < gridSize - 1; y++) {
    if (y % 2 === 1) for (let x = gridSize - 1; x >= 1; x--) add(x, y);
    else for (let x = 1; x < gridSize; x++) add(x, y);
  }
  for (let x = gridSize - 1; x >= 0; x--) add(x, gridSize - 1);
  for (let y = gridSize - 2; y >= 1; y--) add(0, y);

  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < gridSize; y++)
    for (let x = 0; x < gridSize; x++)
      if (index.has(key(x, y))) cells.push({ x, y });
  cells.sort((a, b) => (index.get(key(a.x, a.y)) ?? 0) - (index.get(key(b.x, b.y)) ?? 0));

  for (let i = 0; i < cells.length; i++) {
    const curr = cells[i], next = cells[(i + 1) % cells.length];
    let dir: Direction;
    if (next.x > curr.x) dir = 'RIGHT';
    else if (next.x < curr.x) dir = 'LEFT';
    else if (next.y > curr.y) dir = 'DOWN';
    else dir = 'UP';
    nextDir.set(key(curr.x, curr.y), dir);
  }

  return { index, nextDir, length: gridSize * gridSize };
}

// Hamiltonian cycle for toroidal (wrap-wall) grids using a boustrophedon path.
// Even rows go left→right, odd rows go right→left. For even N the last cell
// (0, N-1) wraps DOWN back to (0, 0), closing the loop.
function buildWrappedCycle(gridSize: number): CycleData {
  const index = new Map<string, number>();
  const nextDir = new Map<string, Direction>();
  const key = (x: number, y: number) => x + ',' + y;

  for (let y = 0; y < gridSize; y++) {
    if (y % 2 === 0) {
      for (let x = 0; x < gridSize; x++) index.set(key(x, y), index.size);
    } else {
      for (let x = gridSize - 1; x >= 0; x--) index.set(key(x, y), index.size);
    }
  }

  const cells: { x: number; y: number }[] = new Array(gridSize * gridSize);
  index.forEach((idx, k) => {
    const [cx, cy] = k.split(',').map(Number);
    cells[idx] = { x: cx, y: cy };
  });

  for (let i = 0; i < cells.length; i++) {
    const curr = cells[i], next = cells[(i + 1) % cells.length];
    let dx = next.x - curr.x, dy = next.y - curr.y;
    // Normalise for wrap (only the last cell needs this)
    if (dx > 1) dx -= gridSize;
    if (dx < -1) dx += gridSize;
    if (dy > 1) dy -= gridSize;
    if (dy < -1) dy += gridSize;
    let dir: Direction;
    if (dx === 1) dir = 'RIGHT';
    else if (dx === -1) dir = 'LEFT';
    else if (dy === 1) dir = 'DOWN';
    else dir = 'UP';
    nextDir.set(key(curr.x, curr.y), dir);
  }

  return { index, nextDir, length: gridSize * gridSize };
}

function getCycleData(gridSize: number, wrapWalls = false): CycleData {
  if (wrapWalls) {
    if (!cycleCacheWrapped || cycleCacheWrappedGridSize !== gridSize) {
      cycleCacheWrapped = buildWrappedCycle(gridSize);
      cycleCacheWrappedGridSize = gridSize;
    }
    return cycleCacheWrapped;
  }
  if (!cycleCache || cycleCacheGridSize !== gridSize) {
    cycleCache = buildCycle(gridSize);
    cycleCacheGridSize = gridSize;
  }
  return cycleCache;
}

function getCycleIndex(p: Point, cycle: CycleData): number {
  return cycle.index.get(p.x + ',' + p.y) ?? -1;
}

// Check if each body segment is exactly one step behind the previous on the cycle
function isBodyContiguousOnCycle(snake: Point[], cycle: CycleData): boolean {
  if (snake.length < 2) return true;
  const N = cycle.length;
  for (let i = 0; i < snake.length - 1; i++) {
    const currIdx = getCycleIndex(snake[i], cycle);
    const nextIdx = getCycleIndex(snake[i + 1], cycle);
    if (currIdx < 0 || nextIdx < 0) return false;
    if (nextIdx !== (currIdx - 1 + N) % N) return false;
  }
  return true;
}

// =============================================================================
// DIRECTION HELPERS
// =============================================================================

type DirectionVector = { dir: Direction; dx: number; dy: number };

const DIRECTIONS: DirectionVector[] = [
  { dir: 'UP', dx: 0, dy: -1 },
  { dir: 'DOWN', dx: 0, dy: 1 },
  { dir: 'LEFT', dx: -1, dy: 0 },
  { dir: 'RIGHT', dx: 1, dy: 0 },
];

const NO_FOOD: Point = { x: -9999, y: -9999 };

// =============================================================================
// GEOMETRY / UTILITIES
// =============================================================================

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const pointKey = (point: Point) => point.y * 1000 + point.x;

const snakeKey = (snake: Point[]) => {
  let key = 0;
  for (let i = 0; i < snake.length; i++)
    key = (key * 31 + (snake[i].y * 1000 + snake[i].x)) | 0;
  return key;
};

const normalizePoint = (point: Point, options: SnakeAIOptions): Point => {
  if (!options.wrapWalls) return point;
  return { x: (point.x + options.gridSize) % options.gridSize, y: (point.y + options.gridSize) % options.gridSize };
};

const outOfBounds = (point: Point, options: SnakeAIOptions) =>
  !options.wrapWalls && (point.x < 0 || point.x >= options.gridSize || point.y < 0 || point.y >= options.gridSize);

export const getNextPosition = (point: Point, direction: Direction, options: SnakeAIOptions): Point => {
  const vector = DIRECTIONS.find(c => c.dir === direction);
  if (!vector) return point;
  return normalizePoint({ x: point.x + vector.dx, y: point.y + vector.dy }, options);
};

const manhattanDistance = (a: Point, b: Point, options: SnakeAIOptions) => {
  const dx = Math.abs(a.x - b.x), dy = Math.abs(a.y - b.y);
  if (!options.wrapWalls) return dx + dy;
  return Math.min(dx, options.gridSize - dx) + Math.min(dy, options.gridSize - dy);
};

const orderedDirections = (head: Point, target: Point, options: SnakeAIOptions) => {
  const scored = DIRECTIONS.map(d => ({
    dir: d.dir,
    dist: manhattanDistance(getNextPosition(head, d.dir, options), target, options),
  }));
  scored.sort((a, b) => a.dist - b.dist);
  return scored;
};

// =============================================================================
// SIMULATION
// =============================================================================

export const simulateMove = (
  snake: Point[], direction: Direction, food: Point, options: SnakeAIOptions,
): SimulationResult => {
  if (snake.length === 0) return { snake, head: { x: 0, y: 0 }, ate: false, collision: true };
  const head = getNextPosition(snake[0], direction, options);
  if (outOfBounds(head, options)) return { snake, head, ate: false, collision: true };

  const ate = samePoint(head, food);
  let collision = false;
  const checkLen = ate ? snake.length : snake.length - 1;
  for (let i = 0; i < checkLen; i++) {
    if (snake[i].x === head.x && snake[i].y === head.y) { collision = true; break; }
  }
  if (collision) return { snake, head, ate, collision: true };

  const nextSnake = [head];
  const copyLimit = ate ? snake.length : snake.length - 1;
  for (let i = 0; i < copyLimit; i++) nextSnake.push(snake[i]);
  return { snake: nextSnake, head, ate, collision: false };
};

const simulatePath = (snake: Point[], path: Direction[], food: Point, options: SnakeAIOptions): SimulationResult => {
  let currentSnake = snake;
  let result: SimulationResult = { snake, head: snake[0], ate: false, collision: snake.length === 0 };
  for (const direction of path) {
    result = simulateMove(currentSnake, direction, food, options);
    if (result.collision) return result;
    currentSnake = result.snake;
  }
  return result;
};

// =============================================================================
// PATHFINDING
// =============================================================================

const SEARCH_LIMIT = 60000;

function findDynamicPathToTarget(
  startSnake: Point[], target: Point, food: Point, options: SnakeAIOptions, maxNodes = SEARCH_LIMIT,
): Direction[] | null {
  if (startSnake.length === 0) return null;
  if (samePoint(startSnake[0], target)) return [];

  const maxDepth = options.gridSize * options.gridSize + startSnake.length;
  const queue: { snake: Point[]; dir: Direction | null; parent: number; depth: number }[] = [
    { snake: startSnake, dir: null, parent: -1, depth: 0 },
  ];
  const visited = new Set<number>([snakeKey(startSnake)]);
  let cursor = 0, explored = 0;

  while (cursor < queue.length && explored < maxNodes) {
    const nodeIndex = cursor++, node = queue[nodeIndex];
    explored++;
    if (node.depth >= maxDepth) continue;

    for (const { dir } of orderedDirections(node.snake[0], target, options)) {
      const result = simulateMove(node.snake, dir, food, options);
      if (result.collision) continue;

      if (samePoint(result.head, target)) {
        const path: Direction[] = [dir];
        let curr = nodeIndex;
        while (curr !== 0) { path.push(queue[curr].dir!); curr = queue[curr].parent; }
        return path.reverse();
      }

      const key = snakeKey(result.snake);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ snake: result.snake, dir, parent: nodeIndex, depth: node.depth + 1 });
      }
    }
  }
  return null;
}

function findStaticPathToTarget(startSnake: Point[], target: Point, options: SnakeAIOptions): Direction[] | null {
  if (startSnake.length === 0) return null;
  if (samePoint(startSnake[0], target)) return [];

  const blocked = new Set<number>();
  for (let i = 1; i < startSnake.length - 1; i++) blocked.add(pointKey(startSnake[i]));

  const queue: { point: Point; dir: Direction | null; parent: number }[] = [
    { point: startSnake[0], dir: null, parent: -1 },
  ];
  const visited = new Set<number>([pointKey(startSnake[0])]);
  let cursor = 0;

  while (cursor < queue.length) {
    const nodeIndex = cursor++, node = queue[nodeIndex];
    for (const { dir } of orderedDirections(node.point, target, options)) {
      const next = getNextPosition(node.point, dir, options), key = pointKey(next);
      if (outOfBounds(next, options) || blocked.has(key) || visited.has(key)) continue;
      if (samePoint(next, target)) {
        const path: Direction[] = [dir];
        let curr = nodeIndex;
        while (curr !== 0) { path.push(queue[curr].dir!); curr = queue[curr].parent; }
        return path.reverse();
      }
      visited.add(key);
      queue.push({ point: next, dir, parent: nodeIndex });
    }
  }
  return null;
}

// =============================================================================
// SPACE / SAFETY
// =============================================================================

const countReachableCells = (snake: Point[], options: SnakeAIOptions) => {
  if (snake.length === 0) return 0;
  const blocked = new Set<number>();
  for (let i = 1; i < snake.length - 1; i++) blocked.add(pointKey(snake[i]));
  const visited = new Set<number>();
  const queue: Point[] = [snake[0]];
  visited.add(pointKey(snake[0]));
  let cursor = 0;
  while (cursor < queue.length) {
    const point = queue[cursor++];
    for (const { dir } of DIRECTIONS) {
      const next = getNextPosition(point, dir, options), key = pointKey(next);
      if (outOfBounds(next, options) || blocked.has(key) || visited.has(key)) continue;
      visited.add(key); queue.push(next);
    }
  }
  return visited.size;
};

const findLegalMoves = (snake: Point[], food: Point, options: SnakeAIOptions) =>
  DIRECTIONS.map(({ dir }) => ({ dir, result: simulateMove(snake, dir, food, options) })).filter(c => !c.result.collision);

const canReachTail = (snake: Point[], options: SnakeAIOptions) => {
  if (snake.length < 2) return true;
  const tail = snake[snake.length - 1];
  // Static BFS: body cells (except tail) blocked. O(gridSize²) — no snake-array copying.
  return findStaticPathToTarget(snake, tail, options) !== null;
};

const hasLegalContinuation = (snake: Point[], options: SnakeAIOptions) =>
  findLegalMoves(snake, NO_FOOD, options).length > 0;

// =============================================================================
// SAFETY: isSafeFoodResult
// =============================================================================

const isSafeFoodResult = (snake: Point[], options: SnakeAIOptions, cycle?: CycleData, preRegion?: RegionInfo) => {
  const boardCells = options.gridSize * options.gridSize;
  if (snake.length >= boardCells) return true;
  if (!hasLegalContinuation(snake, options)) return false;

  // If the body is contiguous on the Hamiltonian cycle, the cycle itself is the
  // safety guarantee: the snake can always follow the cycle forward indefinitely.
  // Static BFS / AP analysis give false negatives here because the body is a tight
  // coil — skip them entirely and trust the cycle.
  if (cycle && isBodyContiguousOnCycle(snake, cycle)) return true;

  // Body is scattered (off-cycle shortcut). Full topology checks:
  // static tail reachability + AP-based region analysis.
  if (!canReachTail(snake, options)) return false;
  const regionInfo = preRegion ?? getRegionInfo(snake, options);
  if (regionInfo.isTrapped) return false;
  return regionInfo.safeSize >= Math.min(snake.length * 2, boardCells - snake.length);
};

// =============================================================================
// CYCLE MOVEMENT
// =============================================================================

function getBestCycleAdvanceMove(
  head: Point, snake: Point[], food: Point, options: SnakeAIOptions, cycle: CycleData,
): Direction | null {
  const isContiguous = isBodyContiguousOnCycle(snake, cycle);

  // Try exact cycle direction first.
  const cycleDir = cycle.nextDir.get(head.x + ',' + head.y);
  if (cycleDir) {
    const result = simulateMove(snake, cycleDir, food, options);
    if (!result.collision) {
      // Contiguous body: cycle is mathematically safe, no further check needed.
      // Scattered body: verify tail still reachable (static BFS) before committing.
      if (isContiguous || canReachTail(result.snake, options)) {
        return cycleDir;
      }
    }
  }

  // Cycle direction blocked or unsafe — find best alternative.
  const headIdx = getCycleIndex(head, cycle);
  if (headIdx < 0) return null;

  const legalMoves = findLegalMoves(snake, food, options);
  if (legalMoves.length === 0) return null;

  let bestDir: Direction | null = null;
  let bestAdvance = -1;

  for (const { dir, result: r } of legalMoves) {
    const idx = getCycleIndex(r.head, cycle);
    if (idx < 0) continue;
    // Scattered: safety-check each candidate before picking by cycle advance.
    if (!isContiguous && !canReachTail(r.snake, options)) continue;
    const advance = (idx - headIdx + cycle.length) % cycle.length;
    if (advance > bestAdvance) { bestAdvance = advance; bestDir = dir; }
  }

  return bestDir;
}

// =============================================================================
// REGION INFO (ARTICULATION POINT ANALYSIS)
// =============================================================================

export type RegionInfo = {
  safeSize: number;    // cells reachable without crossing a dangerous AP
  totalSize: number;   // raw flood-fill count
  isTrapped: boolean;  // safeSize < snake.length
};

export function getRegionInfo(snake: Point[], options: SnakeAIOptions): RegionInfo {
  if (snake.length === 0) return { safeSize: 0, totalSize: 0, isTrapped: true };

  const head = snake[0];
  const tail = snake[snake.length - 1];
  const tailKey = pointKey(tail);

  // Build blocked set: all body cells except the tail (tail moves away next tick)
  const blocked = new Set<number>();
  for (let i = 1; i < snake.length - 1; i++) blocked.add(pointKey(snake[i]));

  // Collect all free cells indexed for Tarjan's DFS
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

  // Tarjan's AP algorithm (iterative to avoid call stack overflow on large grids)
  const disc = new Array<number>(n).fill(-1);
  const low = new Array<number>(n).fill(0);
  const parent = new Array<number>(n).fill(-1);
  const childCount = new Array<number>(n).fill(0); // DFS tree children per node
  const isAP = new Array<boolean>(n).fill(false);
  let timer = 0;

  // Iterative DFS: each stack frame tracks (node, current direction index)
  const stack: { u: number; dirIdx: number }[] = [];
  disc[headIdx] = low[headIdx] = timer++;
  stack.push({ u: headIdx, dirIdx: 0 });

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const { u } = frame;

    if (frame.dirIdx < DIRECTIONS.length) {
      const { dir } = DIRECTIONS[frame.dirIdx];
      frame.dirIdx++;

      const neighbor = getNextPosition(freeCells[u], dir, options);
      const nk = pointKey(neighbor);
      const v = cellIndex.get(nk);
      if (v === undefined) continue;

      if (disc[v] === -1) {
        childCount[u]++;
        parent[v] = u;
        disc[v] = low[v] = timer++;
        stack.push({ u: v, dirIdx: 0 });
      } else if (v !== parent[u]) {
        // Back edge — update low via discovery time (not low[v], standard Tarjan)
        low[u] = Math.min(low[u], disc[v]);
      }
    } else {
      // Done processing all neighbors of u — pop and propagate low up to parent
      stack.pop();
      const p = parent[u];
      if (p !== -1) {
        low[p] = Math.min(low[p], low[u]);
        // p is an AP if: p is root with 2+ DFS children, OR p is non-root and low[u] >= disc[p]
        if (parent[p] === -1) {
          if (childCount[p] > 1) isAP[p] = true;
        } else {
          if (low[u] >= disc[p]) isAP[p] = true;
        }
      }
    }
  }

  // totalSize: all cells reachable from head
  const totalSize = disc.filter(d => d !== -1).length;

  // If tail is not reachable from head at all, the head is completely cut off —
  // treat safeSize as totalSize (pocket only) which will likely trigger isTrapped.
  if (tailIdx === undefined || disc[tailIdx] === -1) {
    return {
      safeSize: totalSize,
      totalSize,
      isTrapped: totalSize < snake.length,
    };
  }

  // Identify dangerous APs using the DFS tree parent-walk — O(depth) instead of O(AP × n).
  // An AP p is dangerous iff it is on the DFS tree path from head to tail AND the child
  // of p leading toward tail has low[child] >= disc[p] (no back edge bypasses p upward).
  // Proof: if p is an ancestor of tail in the DFS tree, removing p puts tail in p's subtree
  // — which is disconnected from head iff low[child-toward-tail] >= disc[p].
  const dangerousAPs = new Set<number>();
  {
    let curr = tailIdx;
    while (curr !== headIdx) {
      const p = parent[curr];
      if (p === -1) break;
      if (p !== headIdx && isAP[p] && low[curr] >= disc[p]) {
        dangerousAPs.add(p);
      }
      curr = p;
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

// =============================================================================
// MAIN AI: CHOOSE MOVE
// =============================================================================

export const chooseAutoPlayMove = ({
  snake, food, gridSize, wrapWalls, maxNodes,
}: SnakeAIInput): Direction | null => {
  const options: SnakeAIOptions = { gridSize, wrapWalls, maxNodes };
  if (snake.length === 0) return null;

  // Cycle works for any even grid regardless of wrap mode.
  // For non-wrap: use the column-0 return-path cycle.
  // For wrap (torus): use the boustrophedon cycle that closes via the wrap.
  const useCycle = gridSize >= 4 && gridSize % 2 === 0;
  const cycle = useCycle ? getCycleData(gridSize, wrapWalls) : undefined;
  const boardCells = gridSize * gridSize;

  // ---- Phase 1: Try to eat food safely ----
  // Static BFS first (fast, O(grid²)). If blocked by body, try a cheap dynamic
  // BFS (3K nodes) that can thread through cells the body will vacate.
  const pathToFood =
    findStaticPathToTarget(snake, food, options) ??
    findDynamicPathToTarget(snake, food, food, options, 3000);

  if (pathToFood && pathToFood.length > 0) {
    const foodResult = simulatePath(snake, pathToFood, food, options);
    if (!foodResult.collision) {
      const cycleContiguous = !cycle || isBodyContiguousOnCycle(foodResult.snake, cycle);

      if (cycleContiguous) {
        // Shortcut preserves cycle order — safe whenever isSafeFoodResult passes.
        if (isSafeFoodResult(foodResult.snake, options, cycle)) {
          return pathToFood[0];
        }
      } else if (snake.length < boardCells * 0.5) {
        // Scattered shortcut in early/mid game: tail must stay reachable
        // AND there must be ≥ 2× snake.length of topology-safe space.
        // canReachTail catches the case where the path encloses the tail inside
        // a body loop (getRegionInfo alone misses this when totalSize is large).
        if (canReachTail(foodResult.snake, options)) {
          const regionInfo = getRegionInfo(foodResult.snake, options);
          if (!regionInfo.isTrapped && regionInfo.safeSize >= snake.length * 2) {
            return pathToFood[0];
          }
        }
      }
      // Otherwise: body scattered + board ≥ 50% full → fall through to cycle/heuristic.
    }
  }

  // ---- Phase 2: Cycle-advancing ----
  if (cycle) {
    const cycleMove = getBestCycleAdvanceMove(snake[0], snake, food, options, cycle);
    if (cycleMove) return cycleMove;
  }

  // ---- Phase 3: Heuristic scoring ----
  let bestMove: Direction | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const { dir, result } of findLegalMoves(snake, food, options)) {
    // Compute regionInfo once per candidate — passed to isSafeFoodResult to avoid double call.
    const regionInfo = getRegionInfo(result.snake, options);
    if (result.ate && !isSafeFoodResult(result.snake, options, cycle, regionInfo)) continue;

    const tailPath = findStaticPathToTarget(
      result.snake, result.snake[result.snake.length - 1], options,
    );
    const space = regionInfo.safeSize;
    const foodPath = findStaticPathToTarget(result.snake, food, options);
    const foodDistance = foodPath ? foodPath.length : gridSize * gridSize * 2;
    const tailDistance = tailPath ? tailPath.length : 0;

    const followingTail = samePoint(result.head, snake[snake.length - 1]);
    const followBonus = followingTail ? 5_000_000 : 0;
    const safetyScore = tailPath ? 2_000_000 : 0;

    let cycleBonus = 0;
    if (cycle) {
      const headIdx = getCycleIndex(snake[0], cycle);
      const newIdx = getCycleIndex(result.head, cycle);
      if (headIdx >= 0 && newIdx >= 0) {
        cycleBonus = ((newIdx > headIdx ? newIdx - headIdx : newIdx + cycle.length - headIdx) % cycle.length) * 1000;
      }
    }

    const isLateGame = snake.length > boardCells * 0.75;
    const tailDistanceScore = isLateGame ? (100 - tailDistance) * 50 : tailDistance * 20;
    const score = safetyScore + followBonus + space * 5_000 + cycleBonus + tailDistanceScore - foodDistance * 10;

    if (score > bestScore) { bestScore = score; bestMove = dir; }
  }

  if (bestMove) return bestMove;

  // ---- Phase 4: Desperate fallback ----
  const fallback = findLegalMoves(snake, food, options)
    .map(({ dir, result }) => ({ dir, score: countReachableCells(result.snake, options) }))
    .sort((a, b) => b.score - a.score)[0];
  return fallback?.dir ?? null;
};
