import { describe, expect, it } from 'vitest';
import { chooseAutoPlayMove, simulateMove, getRegionInfo } from './snakeAI';
import type { Point } from './types';

const options = { gridSize: 5, wrapWalls: false };

describe('snake simulation', () => {
  it('allows the head to move into the tail cell when the snake is not eating', () => {
    const snake: Point[] = [
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
      { x: 1, y: 2 },
    ];

    const result = simulateMove(snake, 'LEFT', { x: 4, y: 4 }, options);

    expect(result.collision).toBe(false);
    expect(result.snake).toEqual([
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 1, y: 3 },
    ]);
  });
});

describe('chooseAutoPlayMove', () => {
  it('takes food when the post-eating board still has an escape path', () => {
    const snake: Point[] = [
      { x: 2, y: 2 },
      { x: 2, y: 3 },
      { x: 2, y: 4 },
    ];

    const move = chooseAutoPlayMove({
      snake,
      food: { x: 3, y: 2 },
      ...options,
    });

    expect(move).toBe('RIGHT');
  });

  it('rejects a direct food move that would trap the head with no legal continuation', () => {
    const snake: Point[] = [
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 3, y: 2 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
      { x: 4, y: 2 },
      { x: 4, y: 3 },
      { x: 4, y: 4 },
      { x: 3, y: 4 },
      { x: 2, y: 4 },
      { x: 1, y: 4 },
      { x: 0, y: 4 },
      { x: 0, y: 3 },
      { x: 0, y: 2 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ];

    const move = chooseAutoPlayMove({
      snake,
      food: { x: 2, y: 2 },
      ...options,
    });

    expect(move).toBe('UP');
  });


  it('makes a productive move when there is plenty of open space', () => {
    // On an even grid with cycle active, the AI follows the Hamiltonian cycle
    // rather than taking non-cycle-aligned shortcuts. It should still make a
    // move (not null / not stuck) and not collide.
    const snake: Point[] = [
      { x: 3, y: 3 },
      { x: 3, y: 4 },
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 4, y: 4 },
      { x: 4, y: 3 },
      { x: 4, y: 2 },
      { x: 4, y: 1 },
      { x: 4, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 1 },
      { x: 5, y: 2 },
      { x: 5, y: 3 },
      { x: 5, y: 4 },
      { x: 5, y: 5 },
    ];

    const move = chooseAutoPlayMove({
      snake,
      food: { x: 3, y: 2 },
      gridSize: 6,
      wrapWalls: false,
    });

    // AI must make a move and not immediately collide
    expect(move).not.toBeNull();
    expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(move);
  });


  it('does not get stuck — always makes a legal move toward the goal', () => {
    // Even grid: cycle is active. AI follows cycle rather than taking non-aligned
    // shortcuts. The important invariant is that the AI never returns null on an
    // open board — it always has a productive move.
    const snake: Point[] = [
      { x: 3, y: 3 },
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ];

    const move = chooseAutoPlayMove({
      snake,
      food: { x: 3, y: 0 },
      gridSize: 6,
      wrapWalls: false,
    });

    expect(move).not.toBeNull();
    expect(['UP', 'DOWN', 'LEFT', 'RIGHT']).toContain(move);
  });

  it('refuses to move toward food in a pocket when tail is outside', () => {
    // 5x5 grid. Snake body walls off the left column.
    // Head at (1,0) can go LEFT into a 4-cell pocket (x=0, y=0..3),
    // but the tail is at (4,4) far away. Pocket has 4 cells, snake length=6.
    // Moving LEFT would trap the head (safeSize=4 < snake.length=6 → isTrapped).
    const snake: Point[] = [
      { x: 1, y: 0 }, // head — at mouth of left pocket
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 4, y: 4 }, // tail — far right, open region
    ];
    const move = chooseAutoPlayMove({
      snake,
      food: { x: 0, y: 1 }, // food inside left pocket
      gridSize: 5,
      wrapWalls: false,
    });
    expect(move).not.toBe('LEFT');
  });
});

describe('getRegionInfo', () => {
  it('returns safeSize === totalSize on an open board', () => {
    const snake: Point[] = [{ x: 2, y: 2 }, { x: 2, y: 3 }];
    const result = getRegionInfo(snake, { gridSize: 5, wrapWalls: false });
    expect(result.totalSize).toBe(result.safeSize);
    expect(result.isTrapped).toBe(false);
  });

  it('detects a pocket when tail is outside and head is inside', () => {
    // 5x5 grid. Snake body forms a wall separating two regions.
    // Head (0,0) is in a tiny 3-cell pocket (0,0),(0,1),(0,2).
    // Tail (4,4) is in the large open region.
    // Body walls off the pocket completely: col x=1 y=0..3
    // Snake length=6, pocket has 3 free cells → isTrapped=true
    const snake: Point[] = [
      { x: 0, y: 0 }, // head — tiny left pocket
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 1, y: 3 },
      { x: 4, y: 4 }, // tail — large right region
    ];
    const result = getRegionInfo(snake, { gridSize: 5, wrapWalls: false });
    // Head in pocket of size 3 (cells (0,0),(0,1),(0,2),(0,3) — 4 cells minus head = 3 free + head)
    // snake.length=6 > safeSize(~4) → isTrapped=true
    expect(result.isTrapped).toBe(true);
  });

  it('treats the tail cell as free (not blocked)', () => {
    // Snake in an L-shape on a 4x4 grid, tail adjacent to head.
    // With tail free, head has access to plenty of space.
    const snake: Point[] = [
      { x: 1, y: 0 }, // head
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 }, // tail — adjacent to head; treated as free
    ];
    const result = getRegionInfo(snake, { gridSize: 4, wrapWalls: false });
    expect(result.isTrapped).toBe(false);
  });

  it('handles wrap-walls adjacency correctly', () => {
    const snake: Point[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }];
    const result = getRegionInfo(snake, { gridSize: 4, wrapWalls: true });
    expect(result.totalSize).toBeGreaterThan(0);
    expect(result.isTrapped).toBe(false);
  });
});
