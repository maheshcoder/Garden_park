import { test } from "node:test";
import assert from "node:assert/strict";
import {
  movementVector,
  smooth,
  turn,
  needsRespawn,
  inRange,
} from "../src/controllers/math.ts";
import { readSettings, writeSettings } from "../src/state/settings.ts";
import { BENCHES, SPAWN, random, QUALITY } from "../src/config/park.ts";
test("camera-relative input limits diagonals and rotates forward", () => {
  assert.deepEqual(movementVector(0, -1, 0), { x: 0, z: -1 });
  const d = movementVector(1, -1, 0);
  assert.ok(Math.abs(Math.hypot(d.x, d.z) - 1) < 1e-9);
  const rotated = movementVector(0, -1, Math.PI / 2);
  assert.ok(Math.abs(rotated.x + 1) < 1e-9);
  assert.ok(Math.abs(rotated.z) < 1e-9);
});
test("acceleration is independent of timestep and turning takes the short route", () => {
  const one = smooth(0, 3, 10, 1 / 30);
  const two = smooth(smooth(0, 3, 10, 1 / 60), 3, 10, 1 / 60);
  assert.ok(Math.abs(one - two) < 1e-9);
  assert.ok(turn(Math.PI - 0.01, -Math.PI + 0.01, 0.1) > Math.PI - 0.01);
});
test("safe spawn, explicit reachable seats, local range and out-of-bounds rescue", () => {
  assert.equal(needsRespawn({ x: SPAWN[0], y: SPAWN[1], z: SPAWN[2] }), false);
  assert.ok(needsRespawn({ x: 0, y: -4, z: 0 }));
  assert.ok(needsRespawn({ x: NaN, y: 0, z: 0 }));
  assert.ok(needsRespawn({ x: 30, y: 0, z: 0 }));
  for (const b of BENCHES) {
    assert.ok(inRange({ x: b.stand[0], z: b.stand[2] }, b.position));
    assert.ok(Math.hypot(b.stand[0] - b.seat[0], b.stand[2] - b.seat[2]) > 1.2);
  }
});
test("settings validate corrupt and unavailable storage", () => {
  assert.equal(readSettings({ getItem: () => "{broken" }).outfit, 0);
  assert.equal(
    readSettings({
      getItem: () => {
        throw Error("blocked");
      },
    }).volume,
    0.3,
  );
  const s = readSettings({
    getItem: () =>
      JSON.stringify({
        name: "x".repeat(80),
        outfit: 9,
        quality: "ultra",
        volume: 5,
        muted: "yes",
      }),
  });
  assert.equal(s.name.length, 24);
  assert.equal(s.outfit, 0);
  assert.equal(s.quality, "medium");
  assert.equal(s.volume, 1);
  assert.equal(s.muted, false);
  assert.doesNotThrow(() =>
    writeSettings(
      {
        setItem: () => {
          throw Error("quota");
        },
      },
      s,
    ),
  );
});
test("deterministic scenery and real quality budgets", () => {
  const a = random(5),
    b = random(5);
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
  assert.ok(QUALITY.low.petals < QUALITY.medium.petals);
  assert.ok(QUALITY.medium.shadowSize < QUALITY.high.shadowSize);
  assert.equal(QUALITY.low.shadows, false);
  assert.ok(QUALITY.low.treeDetail < QUALITY.medium.treeDetail);
  assert.ok(QUALITY.medium.treeDetail < QUALITY.high.treeDetail);
});

test("flower beds leave the looping walkway clear", async () => {
  const { CatmullRomCurve3, Vector3 } = await import("three");
  const { LOOP, BEDS } = await import("../src/config/park.ts");
  const path = new CatmullRomCurve3(
    LOOP.map((p) => new Vector3(...p)),
    true,
    "catmullrom",
    0.3,
  ).getPoints(500);
  for (const bed of BEDS) {
    const closest = Math.min(
      ...path.map((p) =>
        Math.hypot(
          (p.x - bed.x) / (bed.rx + 1.8),
          (p.z - bed.z) / (bed.rz + 1.8),
        ),
      ),
    );
    assert.ok(
      closest > 1,
      `Flower bed at ${bed.x},${bed.z} overlaps the walkway: ${closest}`,
    );
  }
});

test("contoured terrain stays walkable and seats share its surface height", async () => {
  const { terrainHeight } = await import("../src/config/terrain.ts");
  assert.equal(terrainHeight(0, 22), 0);
  assert.equal(terrainHeight(0, 3), 0);
  assert.equal(terrainHeight(13, -12), 0);
  assert.ok(terrainHeight(-22, 12) > 0.8);
  for (let x = -28; x <= 28; x += 1)
    for (let z = -28; z <= 28; z += 1) {
      const h = terrainHeight(x, z);
      assert.ok(Number.isFinite(h) && h >= 0);
      assert.ok(Math.abs(terrainHeight(x + 0.1, z) - h) / 0.1 < 0.65);
      assert.ok(Math.abs(terrainHeight(x, z + 0.1) - h) / 0.1 < 0.65);
    }
  for (const bench of BENCHES) {
    assert.equal(
      bench.position[1],
      terrainHeight(bench.position[0], bench.position[2]),
    );
    assert.equal(bench.seat[1], bench.position[1] + 0.59);
    assert.equal(
      bench.stand[1],
      terrainHeight(bench.stand[0], bench.stand[2]) + 0.08,
    );
  }
});
