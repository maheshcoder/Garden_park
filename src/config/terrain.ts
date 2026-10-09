// The same surface function anchors scenery and the physical terrain mesh.
export function terrainHeight(x: number, z: number) {
  const hill = (cx: number, cz: number, height: number, radius: number) =>
    height * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (radius * radius));
  const rolls =
    hill(-22, 12, 1.05, 8) +
    hill(-22, -12, 0.85, 7) +
    hill(23, 18, 1.1, 8) +
    hill(25, -2, 0.65, 6) +
    hill(-2, -27, 0.65, 6);
  const plaza = Math.min(1, Math.max(0, (Math.hypot(x, z - 3) - 7) / 4));
  const entrance = z > 13 ? Math.min(1, Math.max(0, (Math.abs(x) - 3) / 4)) : 1;
  const pond = Math.min(
    1,
    Math.max(0, (Math.hypot((x - 13) / 8.5, (z + 12) / 7) - 1) * 3),
  );
  return rolls * plaza * entrance * pond;
}
