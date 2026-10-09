import { useEffect } from "react";
import { game } from "../state/game";
import { interact } from "../interactions/actions";
export const input = {
  keys: new Set<string>(),
  stick: { x: 0, z: 0 },
  run: false,
  yaw: 0,
  pitch: 0.36,
  distance: 6.8,
  orbit: { id: -1, x: 0, y: 0 },
};
export function clearInput() {
  input.keys.clear();
  input.stick.x = 0;
  input.stick.z = 0;
  input.run = false;
  input.orbit.id = -1;
}
export function typing(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}
export function useInput() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (typing(e.target)) return;
      const key = e.key.toLowerCase();
      if (
        ["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)
      )
        e.preventDefault();
      if (e.repeat) return;
      if (key === "escape") {
        const s = game.get();
        clearInput();
        if (s.sign) game.set({ sign: null });
        else if (s.entered) game.set({ paused: !s.paused });
      } else if (key === "e") interact();
      else input.keys.add(key);
    };
    const up = (e: KeyboardEvent) => input.keys.delete(e.key.toLowerCase());
    const hide = () => {
      clearInput();
      game.set({ hidden: document.hidden });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", hide);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clearInput);
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
}
export function attachCamera(canvas: HTMLCanvasElement) {
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || input.orbit.id !== -1) return;
    input.orbit = { id: e.pointerId, x: e.clientX, y: e.clientY };
    canvas.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (input.orbit.id !== e.pointerId) return;
    input.yaw -= (e.clientX - input.orbit.x) * 0.006;
    input.pitch = Math.max(
      0.15,
      Math.min(1.15, input.pitch + (e.clientY - input.orbit.y) * 0.004),
    );
    input.orbit.x = e.clientX;
    input.orbit.y = e.clientY;
  };
  const up = (e: PointerEvent) => {
    if (input.orbit.id === e.pointerId) input.orbit.id = -1;
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    input.distance = Math.max(
      3.3,
      Math.min(12, input.distance + e.deltaY * 0.008),
    );
  };
  canvas.addEventListener("pointerdown", down);
  canvas.addEventListener("pointermove", move);
  canvas.addEventListener("pointerup", up);
  canvas.addEventListener("pointercancel", up);
  canvas.addEventListener("lostpointercapture", up);
  canvas.addEventListener("wheel", wheel, { passive: false });
  return () => {
    canvas.removeEventListener("pointerdown", down);
    canvas.removeEventListener("pointermove", move);
    canvas.removeEventListener("pointerup", up);
    canvas.removeEventListener("pointercancel", up);
    canvas.removeEventListener("lostpointercapture", up);
    canvas.removeEventListener("wheel", wheel);
  };
}
