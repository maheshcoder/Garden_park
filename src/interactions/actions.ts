import { BENCHES, SIGNS } from "../config/park";
import { game } from "../state/game";
import { clearInput } from "../controllers/input";
export function interact() {
  const s = game.get();
  if (!s.entered || s.paused || s.hidden || s.sign) return;
  clearInput();
  if (s.seat) {
    game.set({ seat: null });
    return;
  }
  const bench = BENCHES.find((b) => b.id === s.near);
  if (bench) {
    game.set({ seat: bench, near: null });
    return;
  }
  const sign = SIGNS.find((b) => b.id === s.near);
  if (sign) game.set({ sign, near: null });
}
export function respawn() {
  clearInput();
  game.set({
    seat: null,
    sign: null,
    paused: false,
    respawn: game.get().respawn + 1,
    near: null,
  });
}
