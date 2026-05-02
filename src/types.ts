export const GRID_SIZE = 20;
export const INITIAL_SPEED = 150;
export const MIN_SPEED = 50;
export const SPEED_INCREMENT = 2;

export type Point = {
  x: number;
  y: number;
};

export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type GameState = 'START' | 'PLAYING' | 'PAUSED' | 'GAME_OVER' | 'WIN';

export type AIState = 'IDLE' | 'THINKING' | 'MOVING';
