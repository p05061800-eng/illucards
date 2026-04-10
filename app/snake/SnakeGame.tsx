"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  createInitialSnakeGameState,
  type Direction,
  SNAKE_GRID_SIZE,
  stepSnakeGame,
  togglePause,
} from "@/app/lib/snake";

const TICK_MS = 140;

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  W: "up",
  a: "left",
  A: "left",
  s: "down",
  S: "down",
  d: "right",
  D: "right",
};

export default function SnakeGame() {
  const [game, setGame] = useState(() => createInitialSnakeGameState());
  const [pendingDirection, setPendingDirection] = useState<Direction | null>(null);
  const pendingDirectionRef = useRef<Direction | null>(null);

  const cells = useMemo(
    () =>
      Array.from({ length: game.gridSize * game.gridSize }, (_, index) => ({
        x: index % game.gridSize,
        y: Math.floor(index / game.gridSize),
      })),
    [game.gridSize],
  );

  useEffect(() => {
    pendingDirectionRef.current = pendingDirection;
  }, [pendingDirection]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === " " || event.code === "Space") {
        event.preventDefault();
        setGame((current) => togglePause(current));
        return;
      }

      if (event.key === "Enter" && game.status === "over") {
        event.preventDefault();
        setGame(createInitialSnakeGameState());
        setPendingDirection(null);
        pendingDirectionRef.current = null;
        return;
      }

      const nextDirection = KEY_TO_DIRECTION[event.key];

      if (!nextDirection) {
        return;
      }

      event.preventDefault();
      setPendingDirection(nextDirection);
      setGame((current) =>
        current.status === "idle" ? { ...current, status: "running" } : current,
      );
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [game.status]);

  useEffect(() => {
    if (game.status !== "running") {
      return;
    }

    const timer = window.setInterval(() => {
      setGame((current) => {
        const nextState = stepSnakeGame(
          current,
          pendingDirectionRef.current,
        );

        return nextState;
      });
      pendingDirectionRef.current = null;
      setPendingDirection(null);
    }, TICK_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [game.status]);

  const handleDirectionPress = (direction: Direction) => {
    setPendingDirection(direction);
    setGame((current) =>
      current.status === "idle" ? { ...current, status: "running" } : current,
    );
  };

  const handleRestart = () => {
    setGame(createInitialSnakeGameState());
    setPendingDirection(null);
    pendingDirectionRef.current = null;
  };

  const handlePause = () => {
    setGame((current) => togglePause(current));
  };

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-col gap-6 rounded-[28px] border border-white/10 bg-black/50 p-4 shadow-[0_20px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:p-6">
      <div className="flex flex-col gap-3 rounded-[24px] border border-white/10 bg-zinc-950/70 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">
            Snake
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">
            Classic grid run
          </h1>
          <p className="mt-2 max-w-xl text-sm text-zinc-400">
            Use arrow keys or WASD to move. Press space to pause, enter to restart
            after game over.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start rounded-2xl border border-white/10 bg-black/60 px-4 py-3 sm:self-auto">
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Score
            </p>
            <p className="text-2xl font-semibold text-white tabular-nums">
              {game.score}
            </p>
          </div>
          <div className="h-10 w-px bg-white/10" aria-hidden />
          <div>
            <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              Status
            </p>
            <p className="text-sm font-medium capitalize text-zinc-200">
              {game.status === "over" ? "Game over" : game.status}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="rounded-[24px] border border-white/10 bg-zinc-950/80 p-3 sm:p-4">
          <div
            className="grid aspect-square w-full overflow-hidden rounded-[20px] border border-white/10 bg-black"
            style={{
              gridTemplateColumns: `repeat(${SNAKE_GRID_SIZE}, minmax(0, 1fr))`,
            }}
          >
            {cells.map((cell) => {
              const isHead =
                game.snake[0]?.x === cell.x && game.snake[0]?.y === cell.y;
              const isSnake = game.snake.some(
                (segment) => segment.x === cell.x && segment.y === cell.y,
              );
              const isFood = game.food.x === cell.x && game.food.y === cell.y;

              return (
                <div
                  key={`${cell.x}-${cell.y}`}
                  className="border border-white/[0.04] bg-black"
                >
                  <div
                    className={`h-full w-full rounded-[3px] ${
                      isFood
                        ? "bg-emerald-400"
                        : isHead
                          ? "bg-violet-300"
                          : isSnake
                            ? "bg-violet-500"
                            : "bg-transparent"
                    }`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-[24px] border border-white/10 bg-zinc-950/80 p-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handlePause}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
            >
              {game.status === "running" ? "Pause" : "Start"}
            </button>
            <button
              type="button"
              onClick={handleRestart}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
            >
              Restart
            </button>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Controls
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <div />
              <ControlButton label="Up" onPress={() => handleDirectionPress("up")} />
              <div />
              <ControlButton
                label="Left"
                onPress={() => handleDirectionPress("left")}
              />
              <ControlButton
                label="Down"
                onPress={() => handleDirectionPress("down")}
              />
              <ControlButton
                label="Right"
                onPress={() => handleDirectionPress("right")}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/50 p-4 text-sm text-zinc-400">
            <p>Stay inside the board, avoid your own tail, and keep eating to grow.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ControlButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPress}
      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-4 text-sm font-medium text-zinc-100 transition hover:bg-white/10"
    >
      {label}
    </button>
  );
}
