import { useState, useEffect, useCallback } from 'react';
import { Trophy, Play, Pause, RotateCcw, Settings, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useInterval } from '../hooks/useInterval';
import { chooseAutoPlayMove, simulateMove } from '../snakeAI';
import { GRID_SIZE, INITIAL_SPEED, MIN_SPEED, Point, Direction, GameState } from '../types';
import { cn } from '../utils/cn';

const SnakeGame: React.FC = () => {
  const [gridSize, setGridSize] = useState(GRID_SIZE);
  const mid = (gs: number) => Math.floor(gs / 2);
  const initialSnake = (gs: number): Point[] => [
    { x: mid(gs), y: mid(gs) },
    { x: mid(gs), y: mid(gs) + 1 },
    { x: mid(gs), y: mid(gs) + 2 },
  ];

  const [snake, setSnake] = useState<Point[]>(() => initialSnake(GRID_SIZE));
  const [food, setFood] = useState<Point>({ x: Math.floor(GRID_SIZE / 4), y: Math.floor(GRID_SIZE / 4) });
  const [direction, setDirection] = useState<Direction>('UP');
  const [nextDirection, setNextDirection] = useState<Direction>('UP');
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [wrapWalls, setWrapWalls] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);

  const generateFood = useCallback((currentSnake: Point[], gs = gridSize): Point => {
    const occupied = new Set(currentSnake.map(segment => `${segment.x},${segment.y}`));
    const emptyCells: Point[] = [];

    for (let y = 0; y < gs; y++) {
      for (let x = 0; x < gs; x++) {
        if (!occupied.has(`${x},${y}`)) emptyCells.push({ x, y });
      }
    }

    return emptyCells[Math.floor(Math.random() * emptyCells.length)] ?? currentSnake[0] ?? { x: 0, y: 0 };
  }, [gridSize]);

  const resetGame = () => {
    const s = initialSnake(gridSize);
    setSnake(s);
    setFood(generateFood(s, gridSize));
    setDirection('UP');
    setNextDirection('UP');
    setGameState('PLAYING');
    setScore(0);
    setSpeed(INITIAL_SPEED);
  };

  const applyGridSize = (gs: number) => {
    setGridSize(gs);
    setGameState('START');
    const s = initialSnake(gs);
    setSnake(s);
    setFood(generateFood(s, gs));
    setScore(0);
    setSpeed(INITIAL_SPEED);
  };

  const moveSnake = useCallback(() => {
    const moveDirection = isAutoPlay
      ? chooseAutoPlayMove({
        snake,
        food,
        gridSize,
        wrapWalls,
      }) ?? nextDirection
      : nextDirection;

    setDirection(moveDirection);
    if (isAutoPlay) setNextDirection(moveDirection);

    const result = simulateMove(snake, moveDirection, food, {
      gridSize,
      wrapWalls,
    });

    if (result.collision) {
      setGameState('GAME_OVER');
      return;
    }

    if (result.ate) {
      const nextScore = score + 10;
      setScore(nextScore);
      setSpeed(Math.max(MIN_SPEED, INITIAL_SPEED - Math.floor(nextScore / 20) * 5));

      if (result.snake.length >= gridSize * gridSize) {
        setGameState('WIN');
      } else {
        setFood(generateFood(result.snake));
      }
    }

    setSnake(result.snake);
  }, [snake, nextDirection, food, wrapWalls, generateFood, isAutoPlay, score, gridSize]);

  const intervalDelay = gameState === 'PLAYING' ? Math.max(10, Math.floor(speed / speedMultiplier)) : null;

  useInterval(() => {
    if (gameState === 'PLAYING') {
      moveSnake();
    }
  }, intervalDelay);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAutoPlay && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      
      switch (e.key) {
        case 'ArrowUp': if (direction !== 'DOWN') setNextDirection('UP'); break;
        case 'ArrowDown': if (direction !== 'UP') setNextDirection('DOWN'); break;
        case 'ArrowLeft': if (direction !== 'RIGHT') setNextDirection('LEFT'); break;
        case 'ArrowRight': if (direction !== 'LEFT') setNextDirection('RIGHT'); break;
        case ' ': 
          if (gameState === 'PLAYING') setGameState('PAUSED');
          else if (gameState === 'PAUSED') setGameState('PLAYING');
          else if (gameState === 'START' || gameState === 'GAME_OVER' || gameState === 'WIN') resetGame();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [direction, gameState]);

  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
    }
  }, [score, highScore]);

  const renderCell = (x: number, y: number) => {
    const isFood = food.x === x && food.y === y;
    const isSnakeHead = snake[0].x === x && snake[0].y === y;
    const isSnakeBody = snake.slice(1).some(segment => segment.x === x && segment.y === y);

    return (
      <div
        key={`${x}-${y}`}
        className={cn(
          "w-full h-full rounded-sm transition-all duration-150",
          isSnakeHead ? "bg-emerald-500 scale-105 z-10 shadow-lg shadow-emerald-500/50" :
          isSnakeBody ? "bg-emerald-600/80" :
          isFood ? "bg-rose-500 animate-pulse rounded-full shadow-lg shadow-rose-500/50" :
          "bg-slate-800/20"
        )}
      />
    );
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-4 font-mono">
      <div className="max-w-md w-full space-y-6">
        {/* Header */}
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-emerald-500">SNAKE</h1>
            <p className="text-slate-500 text-sm">Classic Arcade</p>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2 text-rose-500 mb-1">
              <Trophy size={16} />
              <span className="font-bold">{highScore}</span>
            </div>
            <div className="flex items-center justify-end gap-2">
              {isAutoPlay && (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-full font-bold animate-pulse">
                  AUTO
                </span>
              )}
              <div className="text-3xl font-bold">{score}</div>
            </div>
          </div>
        </div>

        {/* Game Board */}
        <div className="relative aspect-square bg-slate-900 rounded-xl border-4 border-slate-800 overflow-hidden shadow-2xl">
          <div 
            className="grid w-full h-full gap-px" 
            style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
          >
            {Array.from({ length: gridSize * gridSize }).map((_, i) => {
              const x = i % gridSize;
              const y = Math.floor(i / gridSize);
              return renderCell(x, y);
            })}
          </div>

          {/* Overlays */}
          {gameState === 'START' && (
            <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
              <Play className="w-16 h-16 text-emerald-500 mb-4 animate-bounce" />
              <h2 className="text-2xl font-bold mb-2">Ready to Play?</h2>
              <p className="text-slate-400 mb-6">Use arrow keys to move and Space to start.</p>
              <button 
                onClick={resetGame}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-full transition-colors"
              >
                START GAME
              </button>
            </div>
          )}

          {gameState === 'PAUSED' && (
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex flex-col items-center justify-center">
              <Pause className="w-16 h-16 text-emerald-500 mb-4" />
              <h2 className="text-2xl font-bold mb-6 text-white">PAUSED</h2>
              <button 
                onClick={() => setGameState('PLAYING')}
                className="px-8 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-full transition-colors"
              >
                RESUME
              </button>
            </div>
          )}

          {gameState === 'WIN' && (
            <div className="absolute inset-0 bg-emerald-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
              <Trophy className="w-20 h-20 text-yellow-400 mb-4 animate-bounce" />
              <h2 className="text-4xl font-black mb-2 text-yellow-400">YOU WIN!</h2>
              <p className="text-emerald-200 text-lg mb-1">Perfect game — board complete!</p>
              <p className="text-yellow-300 font-bold text-2xl mb-6">Score: {score}</p>
              <button
                onClick={resetGame}
                className="px-8 py-3 bg-yellow-400 hover:bg-yellow-300 text-slate-950 font-bold rounded-full transition-colors"
              >
                PLAY AGAIN
              </button>
            </div>
          )}

          {gameState === 'GAME_OVER' && (
            <div className="absolute inset-0 bg-rose-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center">
              <RotateCcw className="w-16 h-16 text-rose-500 mb-4" />
              <h2 className="text-3xl font-bold mb-2 text-white">GAME OVER</h2>
              <div className="mb-6">
                <p className="text-rose-200">Score: {score}</p>
                {score === highScore && score > 0 && <p className="text-yellow-400 font-bold">New High Score!</p>}
              </div>
              <button 
                onClick={resetGame}
                className="px-8 py-3 bg-rose-500 hover:bg-rose-400 text-white font-bold rounded-full transition-colors"
              >
                TRY AGAIN
              </button>
            </div>
          )}
        </div>

        {/* Controls/Settings */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg transition-colors",
                showSettings ? "bg-emerald-500 text-slate-950" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              )}
            >
              <Settings size={18} />
              <span className="font-semibold">Settings</span>
            </button>
            <div className="flex gap-2">
              <button 
                onClick={() => setGameState(prev => prev === 'PLAYING' ? 'PAUSED' : 'PLAYING')}
                disabled={gameState === 'START' || gameState === 'GAME_OVER'}
                className="p-3 bg-slate-800 text-slate-100 rounded-lg hover:bg-slate-700 disabled:opacity-50"
              >
                {gameState === 'PAUSED' ? <Play size={20} /> : <Pause size={20} />}
              </button>
              <button 
                onClick={resetGame}
                className="p-3 bg-slate-800 text-slate-100 rounded-lg hover:bg-slate-700"
              >
                <RotateCcw size={20} />
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-slate-300 font-medium">Grid Size</div>
                  <div className="text-xs text-slate-500">Requires restart</div>
                </div>
                <div className="text-emerald-500 font-bold">{gridSize} × {gridSize}</div>
              </div>
              <input
                type="range"
                min={6}
                max={30}
                step={2}
                value={gridSize}
                onChange={e => applyGridSize(Number(e.target.value))}
                className="w-full accent-emerald-500"
              />
              <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                <span>6</span><span>12</span><span>18</span><span>24</span><span>30</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div>
                  <div className="text-slate-300 font-medium">Wall Wrapping</div>
                  <div className="text-xs text-slate-500">Pass through edges</div>
                </div>
                <button 
                  onClick={() => setWrapWalls(!wrapWalls)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    wrapWalls ? "bg-emerald-500" : "bg-slate-700"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    wrapWalls ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div>
                  <div className="text-slate-300 font-medium">Current Speed</div>
                  <div className="text-xs text-slate-500">Increases as you eat</div>
                </div>
                <div className="text-emerald-500 font-bold">{Math.round(1000 / speed * speedMultiplier)} ticks/s</div>
              </div>
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-slate-300 font-medium">Speed Multiplier</div>
                    <div className="text-xs text-slate-500">Turbo for testing</div>
                  </div>
                  <div className="text-emerald-500 font-bold">{speedMultiplier}×</div>
                </div>
                <input
                  type="range"
                  min={1}
                  max={20}
                  step={1}
                  value={speedMultiplier}
                  onChange={e => setSpeedMultiplier(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
                <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                  <span>1×</span><span>5×</span><span>10×</span><span>15×</span><span>20×</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div>
                  <div className="text-slate-300 font-medium">Auto Play</div>
                  <div className="text-xs text-slate-500">AI takes control</div>
                </div>
                <button 
                  onClick={() => setIsAutoPlay(!isAutoPlay)}
                  className={cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
                    isAutoPlay ? "bg-emerald-500" : "bg-slate-700"
                  )}
                >
                  <span className={cn(
                    "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                    isAutoPlay ? "translate-x-6" : "translate-x-1"
                  )} />
                </button>
              </div>
            </div>
          )}

          {/* Mobile Controls */}
          <div className={cn(
            "grid grid-cols-3 gap-2 max-w-[200px] mx-auto mt-4 md:hidden touch-none transition-opacity",
            isAutoPlay ? "opacity-50 pointer-events-none" : "opacity-100"
          )}>
            <div />
            <button 
              onPointerDown={(e) => { e.preventDefault(); if (direction !== 'DOWN') setNextDirection('UP'); }}
              className="p-4 bg-slate-800 rounded-xl active:bg-emerald-500/50 flex justify-center touch-none select-none"
            >
              <ChevronUp size={24} />
            </button>
            <div />
            <button 
              onPointerDown={(e) => { e.preventDefault(); if (direction !== 'RIGHT') setNextDirection('LEFT'); }}
              className="p-4 bg-slate-800 rounded-xl active:bg-emerald-500/50 flex justify-center touch-none select-none"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onPointerDown={(e) => { e.preventDefault(); if (direction !== 'UP') setNextDirection('DOWN'); }}
              className="p-4 bg-slate-800 rounded-xl active:bg-emerald-500/50 flex justify-center touch-none select-none"
            >
              <ChevronDown size={24} />
            </button>
            <button 
              onPointerDown={(e) => { e.preventDefault(); if (direction !== 'LEFT') setNextDirection('RIGHT'); }}
              className="p-4 bg-slate-800 rounded-xl active:bg-emerald-500/50 flex justify-center touch-none select-none"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SnakeGame;
