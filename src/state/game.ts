import { useSyncExternalStore } from "react";
import type { Bench, Sign } from "../config/park";
import { readSettings, writeSettings, type Settings } from "./settings";
let storage: Storage | undefined;
try {
  storage = localStorage;
} catch {
  /* Settings still work for this session. */
}
export type GameState = {
  settings: Settings;
  entered: boolean;
  paused: boolean;
  hidden: boolean;
  ready: boolean;
  near: string | null;
  seat: Bench | null;
  sign: Sign | null;
  zone: string;
  respawn: number;
  wave: number;
};
let state: GameState = {
  settings: readSettings(storage),
  entered: false,
  paused: false,
  hidden: false,
  ready: false,
  near: null,
  seat: null,
  sign: null,
  zone: "The entrance",
  respawn: 0,
  wave: 0,
};
const listeners = new Set<() => void>();
export const game = {
  get: () => state,
  set: (patch: Partial<GameState>) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  },
  settings: (patch: Partial<Settings>) => {
    const settings = { ...state.settings, ...patch };
    writeSettings(storage, settings);
    game.set({ settings });
  },
};
export function useGame() {
  return useSyncExternalStore((fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, game.get);
}
export const runtime = {
  position: { x: 0, y: 0, z: 22 },
  speed: 0,
  facing: Math.PI,
  animation: "idle" as "idle" | "walk" | "run" | "wave" | "sit",
  waveUntil: 0,
  grounded: true,
  frames: 0,
  frameMs: 0,
};
