export const SNAKE_GRID_SIZE = 16;

export type Direction = "up" | "down" | "left" | "right";

export type GameStatus = "idle" | "running" | "paused" | "over";

export type Point = {
  x: number;
  y: number;
};

export type SnakeGameState = {
  direction: Direction;
  food: Point;
  gridSize: number;
  score: number;
  snake: Point[];
  status: GameStatus;
};

const DIRECTION_VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE_DIRECTIONS: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export function getInitialSnake(gridSize: number): Point[] {
  const center = Math.floor(gridSize / 2);

  return [
    { x: center, y: center },
    { x: center - 1, y: center },
    { x: center - 2, y: center },
  ];
}

export function getNextDirection(
  currentDirection: Direction,
  requestedDirection: Direction,
): Direction {
  if (OPPOSITE_DIRECTIONS[currentDirection] === requestedDirection) {
    return currentDirection;
  }

  return requestedDirection;
}

export function getNextHead(head: Point, direction: Direction): Point {
  const offset = DIRECTION_VECTORS[direction];

  return {
    x: head.x + offset.x,
    y: head.y + offset.y,
  };
}

export function isOutOfBounds(point: Point, gridSize: number): boolean {
  return (
    point.x < 0 ||
    point.y < 0 ||
    point.x >= gridSize ||
    point.y >= gridSize
  );
}

export function isPointOnSnake(point: Point, snake: Point[]): boolean {
  return snake.some((segment) => segment.x === point.x && segment.y === point.y);
}

export function placeFood(
  snake: Point[],
  gridSize: number,
  random: () => number = Math.random,
): Point {
  const openCells: Point[] = [];

  for (let y = 0; y < gridSize; y += 1) {
    for (let x = 0; x < gridSize; x += 1) {
      const point = { x, y };

      if (!isPointOnSnake(point, snake)) {
        openCells.push(point);
      }
    }
  }

  if (openCells.length === 0) {
    return snake[0] ?? { x: 0, y: 0 };
  }

  const index = Math.min(
    openCells.length - 1,
    Math.floor(random() * openCells.length),
  );

  return openCells[index];
}

export function createInitialSnakeGameState(
  gridSize: number = SNAKE_GRID_SIZE,
  random: () => number = Math.random,
): SnakeGameState {
  const snake = getInitialSnake(gridSize);

  return {
    direction: "right",
    food: placeFood(snake, gridSize, random),
    gridSize,
    score: 0,
    snake,
    status: "idle",
  };
}

export function stepSnakeGame(
  state: SnakeGameState,
  requestedDirection: Direction | null,
  random: () => number = Math.random,
): SnakeGameState {
  if (state.status !== "running") {
    return state;
  }

  const direction = requestedDirection
    ? getNextDirection(state.direction, requestedDirection)
    : state.direction;
  const nextHead = getNextHead(state.snake[0], direction);
  const ateFood = nextHead.x === state.food.x && nextHead.y === state.food.y;
  const nextSnake = ateFood
    ? [nextHead, ...state.snake]
    : [nextHead, ...state.snake.slice(0, -1)];

  if (
    isOutOfBounds(nextHead, state.gridSize) ||
    isPointOnSnake(nextHead, nextSnake.slice(1))
  ) {
    return {
      ...state,
      direction,
      snake: nextSnake,
      status: "over",
    };
  }

  return {
    ...state,
    direction,
    food: ateFood ? placeFood(nextSnake, state.gridSize, random) : state.food,
    score: ateFood ? state.score + 1 : state.score,
    snake: nextSnake,
    status:
      nextSnake.length === state.gridSize * state.gridSize ? "over" : state.status,
  };
}

export function togglePause(state: SnakeGameState): SnakeGameState {
  if (state.status === "running") {
    return { ...state, status: "paused" };
  }

  if (state.status === "paused" || state.status === "idle") {
    return { ...state, status: "running" };
  }

  return state;
}
