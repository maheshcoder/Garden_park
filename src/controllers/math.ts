export function movementVector(x: number, z: number, yaw: number) {
  const length = Math.max(1, Math.hypot(x, z));
  return {
    x: (x * Math.cos(yaw) + z * Math.sin(yaw)) / length,
    z: (z * Math.cos(yaw) - x * Math.sin(yaw)) / length,
  };
}
export function smooth(
  current: number,
  target: number,
  rate: number,
  dt: number,
) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}
export function turn(current: number, target: number, dt: number) {
  const diff = Math.atan2(
    Math.sin(target - current),
    Math.cos(target - current),
  );
  return current + diff * (1 - Math.exp(-12 * dt));
}
export function needsRespawn(p: { x: number; y: number; z: number }) {
  return (
    !Number.isFinite(p.x + p.y + p.z) ||
    Math.abs(p.x) > 29 ||
    Math.abs(p.z) > 29 ||
    p.y < -3
  );
}
export function inRange(
  a: { x: number; z: number },
  b: readonly number[],
  range = 2.5,
) {
  return Math.hypot(a.x - b[0], a.z - b[2]) < range;
}
