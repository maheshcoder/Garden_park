import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
await fs.mkdir("artifacts", { recursive: true });
const browser = await chromium.launch({
  executablePath:
    process.env.CHROME_PATH ||
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
  args: ["--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  checks = [];
function monitor(p) {
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  p.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
}
monitor(page);
const url = process.env.PARK_URL || "http://127.0.0.1:4176";
const installInspector = (p) =>
  p.addInitScript(() => {
    const NativeAudio = window.AudioContext;
    window.__audioContexts = [];
    window.AudioContext = class extends NativeAudio {
      constructor(...args) {
        super(...args);
        window.__audioContexts.push(this);
      }
    };
    window.__parkImport = (path) =>
      import(
        performance
          .getEntriesByType("resource")
          .map((r) => r.name)
          .find((url) => url.includes("/src/" + path)) || "/src/" + path
      );
  });
await installInspector(page);
const state = (p) =>
  p.evaluate(async () => {
    const { game, runtime } = await window.__parkImport("state/game.ts");
    return { game: game.get(), runtime };
  });
async function teleport(x, z, y = 0.08) {
  await page.evaluate(
    async ({ x, z, y }) => {
      const { inspection } = await window.__parkImport(
        "controllers/Player.tsx",
      );
      const { clearInput, input } = await window.__parkImport(
        "controllers/input.ts",
      );
      clearInput();
      input.yaw = 0;
      input.pitch = 0.48;
      input.distance = 7.8;
      if (!inspection.body) throw Error("Physics not ready");
      inspection.body.setTranslation({ x, y: y + 0.92, z }, true);
      inspection.body.setNextKinematicTranslation({ x, y: y + 0.92, z });
    },
    { x, z, y },
  );
  await page.waitForTimeout(450);
}
async function move(key, time, run = false) {
  if (run) await page.keyboard.down("Shift");
  await page.keyboard.down(key);
  await page.waitForTimeout(time);
  await page.keyboard.up(key);
  if (run) await page.keyboard.up("Shift");
  await page.waitForTimeout(300);
}
try {
  await page.goto(url);
  await page
    .getByRole("button", { name: "Enter the park" })
    .waitFor({ timeout: 60000 });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: "artifacts/entry-desktop.png" });
  await page.getByLabel("What should we call you?").fill("Juniper");
  await page.getByRole("button", { name: "Rose outfit", exact: true }).click();
  await page.getByRole("button", { name: "Enter the park" }).click();
  await page.waitForTimeout(1300);
  assert.equal((await state(page)).game.settings.outfit, 1);
  assert.equal((await state(page)).game.settings.name, "Juniper");
  checks.push("Chosen display name and outfit");
  await move("w", 1000);
  let walk = (await state(page)).runtime.position.z;
  assert.ok(walk < 20, `Walk did not move: ${walk}`);
  await teleport(0, 22);
  await move("w", 1000, true);
  let run = (await state(page)).runtime.position.z;
  assert.ok(22 - run > 22 - walk + 1, `Run was not faster: ${run}, ${walk}`);
  checks.push("Actual keyboard walking, running and stopping");
  await page.evaluate(async () => {
    const { input } = await window.__parkImport("controllers/input.ts");
    input.yaw = Math.PI / 2;
  });
  let previous = (await state(page)).runtime.position.x;
  await move("w", 650);
  assert.ok((await state(page)).runtime.position.x < previous - 1);
  checks.push("Camera-relative movement");
  await teleport(0, 15);
  await page.mouse.move(1060, 420);
  await page.mouse.down();
  await page.mouse.move(1160, 460, { steps: 8 });
  await page.mouse.up();
  const orbit = await page.evaluate(async () => {
    const { input } = await window.__parkImport("controllers/input.ts");
    return { yaw: input.yaw, pitch: input.pitch, distance: input.distance };
  });
  assert.ok(Math.abs(orbit.yaw) > 0.3);
  await page.mouse.wheel(0, 250);
  assert.ok(
    (await page.evaluate(async () => {
      const { input } = await window.__parkImport("controllers/input.ts");
      return input.distance;
    })) > orbit.distance,
  );
  checks.push("Pointer orbit and wheel zoom");
  await teleport(-4, 15.8);
  await page.waitForTimeout(900);
  const obstructed = await page.evaluate(async () => {
    const { runtime } = await window.__parkImport("state/game.ts");
    const { _roots } = await import(
      "/node_modules/.vite/deps/@react-three_fiber.js"
    );
    const camera = _roots
      .get(document.querySelector("canvas"))
      .store.getState().camera;
    return Math.hypot(
      camera.position.x - runtime.position.x,
      camera.position.y - runtime.position.y - 1.42,
      camera.position.z - runtime.position.z,
    );
  });
  assert.ok(obstructed < 5.5, "Camera did not avoid tree: " + obstructed);
  checks.push("Camera shortens its distance at solid foliage");
  await teleport(0, 7);
  await move("w", 1600, true);
  let collision = (await state(page)).runtime.position;
  assert.ok(
    collision.z > 5.1,
    `Fountain collision failed: ${JSON.stringify(collision)}`,
  );
  checks.push("Fountain blocks movement");
  await teleport(-4, 21.8);
  await move("w", 1100, true);
  collision = (await state(page)).runtime.position;
  assert.ok(collision.z > 19.3);
  checks.push("Tree trunk collision");
  await teleport(26, 0);
  await move("d", 1300, true);
  collision = (await state(page)).runtime.position;
  assert.ok(collision.x < 28);
  checks.push("Park boundary collision");
  await teleport(13, -4);
  await move("w", 3300, true);
  const bridge = (await state(page)).runtime.position;
  assert.ok(
    bridge.z < -18,
    `Bridge crossing failed: ${JSON.stringify(bridge)}`,
  );
  assert.ok(bridge.y > -0.15);
  checks.push("Walkable bridge from bank to bank");
  await teleport(4, 3);
  await move("d", 1000, true);
  collision = (await state(page)).runtime.position;
  assert.ok(collision.x < 6.1);
  checks.push("Bench blocks movement");
  await teleport(-5.5, 3);
  assert.equal((await state(page)).game.near, "plaza-west");
  await page.keyboard.press("e");
  await page.waitForTimeout(400);
  assert.equal((await state(page)).game.seat.id, "plaza-west");
  const seated = (await state(page)).runtime.position;
  await move("w", 500);
  assert.ok(Math.abs((await state(page)).runtime.position.z - seated.z) < 0.02);
  await page.screenshot({ path: "artifacts/seated.png" });
  await page.getByRole("button", { name: "Stand up", exact: false }).click();
  await page.waitForTimeout(300);
  assert.equal((await state(page)).game.seat, null);
  await move("s", 500);
  assert.ok((await state(page)).runtime.speed < 0.4);
  checks.push("Sit, blocked seated movement, stand and restored control");
  await teleport(2.8, 21.4);
  await page.keyboard.press("e");
  await page.getByRole("dialog", { name: "Welcome to Blossom Park" }).waitFor();
  await page.screenshot({ path: "artifacts/sign.png" });
  await page.getByRole("button", { name: "Keep wandering" }).click();
  assert.equal((await state(page)).game.sign, null);
  checks.push("In-range readable sign and close");
  const configs = await page.evaluate(async () => {
    const { BENCHES, SIGNS } = await window.__parkImport("config/park.ts");
    return { benches: BENCHES, signs: SIGNS };
  });
  for (const bench of configs.benches) {
    await teleport(bench.stand[0], bench.stand[2]);
    await page.keyboard.press("e");
    await page.waitForTimeout(150);
    assert.equal((await state(page)).game.seat?.id, bench.id);
    await page.keyboard.press("e");
    await page.waitForTimeout(150);
    assert.equal((await state(page)).game.seat, null);
  }
  for (const sign of configs.signs) {
    await teleport(sign.position[0], sign.position[2] + 1.4);
    await page.keyboard.press("e");
    await page.getByRole("dialog", { name: sign.title }).waitFor();
    await page.getByRole("button", { name: "Keep wandering" }).click();
  }
  checks.push(
    "Every configured bench and information sign is reachable and usable",
  );
  await teleport(0, 12);
  assert.equal((await state(page)).game.near, null);
  await page.keyboard.press("e");
  assert.equal((await state(page)).game.sign, null);
  assert.equal((await state(page)).game.seat, null);
  checks.push("Out-of-range interactions do nothing");
  await page.getByRole("button", { name: "Wave", exact: false }).click();
  await page.waitForTimeout(150);
  assert.equal((await state(page)).runtime.animation, "wave");
  checks.push("Wave animation action");
  await page.getByRole("button", { name: "Mute sound", exact: true }).click();
  assert.equal((await state(page)).game.settings.muted, true);
  await page.getByRole("button", { name: "Unmute sound", exact: true }).click();
  assert.equal((await state(page)).game.settings.muted, false);
  assert.equal(
    await page.evaluate(() => window.__audioContexts[0]?.state),
    "running",
  );
  checks.push("Mute, unmute and gesture-started audio");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog", { name: "Park settings" }).waitFor();
  await page.getByLabel("Visual quality").selectOption("low");
  await page.getByLabel("Nature volume").fill("0.47");
  await page.getByLabel("Reduce decorative motion").check();
  assert.equal((await state(page)).game.settings.quality, "low");
  assert.equal((await state(page)).game.settings.volume, 0.47);
  await page.getByLabel("Visual quality").selectOption("high");
  assert.equal((await state(page)).game.settings.quality, "high");
  await page.getByLabel("Visual quality").selectOption("medium");
  await page.getByLabel("Reduce decorative motion").uncheck();
  await page.getByRole("button", { name: "Sky outfit", exact: true }).click();
  assert.equal((await state(page)).game.settings.outfit, 2);
  await page.getByRole("button", { name: "Rose outfit", exact: true }).click();
  checks.push("Avatar jacket can change from the settings while playing");
  checks.push("All quality presets, volume and motion controls");
  await page.getByRole("button", { name: "Return to the entrance" }).click();
  await page.waitForTimeout(500);
  assert.ok(Math.abs((await state(page)).runtime.position.z - 22) < 0.1);
  checks.push("Menu respawn");
  await teleport(-5.5, 3);
  await page.keyboard.press("e");
  await page.waitForTimeout(200);
  assert.equal((await state(page)).game.seat?.id, "plaza-west");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Return to the entrance" }).click();
  await page.waitForTimeout(450);
  assert.ok(Math.abs((await state(page)).runtime.position.z - 22) < 0.1);
  assert.equal((await state(page)).game.seat, null);
  checks.push(
    "Returning to the entrance while seated clears the previous seat",
  );
  await teleport(0, 10, -4);
  assert.ok(Math.abs((await state(page)).runtime.position.z - 22) < 0.1);
  checks.push("Automatic fall recovery");
  await page.keyboard.down("w");
  await page.waitForTimeout(250);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await page.keyboard.up("w");
  await page.waitForTimeout(500);
  assert.ok((await state(page)).runtime.speed < 0.1);
  checks.push("Blur clears stuck movement");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      value: true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(250);
  const frozen = (await state(page)).runtime.frames;
  await page.waitForTimeout(300);
  assert.equal((await state(page)).runtime.frames, frozen);
  assert.equal(
    await page.evaluate(() => window.__audioContexts[0]?.state),
    "suspended",
  );
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.waitForTimeout(250);
  assert.equal(
    await page.evaluate(() => window.__audioContexts[0]?.state),
    "running",
  );
  checks.push(
    "Hidden-page hook pauses rendering, physics and audio, then resumes",
  );
  await page.getByRole("button", { name: "Park map" }).click();
  await page.getByRole("img", { name: /Park map: entrance/ }).waitFor();
  await page.getByRole("button", { name: "Close park map" }).click();
  checks.push("Working park map");
  await teleport(0, 11);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: "artifacts/park-desktop.png" });
  const timing = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [];
        let last = 0;
        const sample = (now) => {
          if (last) times.push(now - last);
          last = now;
          if (times.length < 90) requestAnimationFrame(sample);
          else {
            const sorted = [...times].sort((a, b) => a - b);
            resolve({
              sampleFrames: times.length,
              meanMs: times.reduce((a, b) => a + b, 0) / times.length,
              medianMs: sorted[45],
              p95Ms: sorted[85],
            });
          }
        };
        requestAnimationFrame(sample);
      }),
  );
  const stats = await page.evaluate(async () => {
    const { runtime } = await window.__parkImport("state/game.ts");
    const { _roots } = await import(
      "/node_modules/.vite/deps/@react-three_fiber.js"
    );
    const root = _roots.get(document.querySelector("canvas"));
    const gl = root?.store.getState().gl;
    const ctx = gl?.getContext(),
      ext = ctx?.getExtension("WEBGL_debug_renderer_info");
    return {
      smoothedFrameMs: runtime.frameMs,
      drawCalls: gl?.info.render.calls,
      triangles: gl?.info.render.triangles,
      renderer: ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
    };
  });
  await teleport(-15, 5, 0.5);
  await page.evaluate(async () => {
    const { input } = await window.__parkImport("controllers/input.ts");
    input.yaw = -0.65;
    input.pitch = 0.2;
    input.distance = 7;
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "artifacts/grove-desktop.png" });
  await teleport(13, -20);
  await page.evaluate(async () => {
    const { input } = await window.__parkImport("controllers/input.ts");
    input.yaw = Math.PI;
    input.pitch = 0.22;
    input.distance = 7.5;
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "artifacts/pond-desktop.png" });
  await teleport(-10, -14.5, 0.3);
  await page.evaluate(async () => {
    const { input } = await window.__parkImport("controllers/input.ts");
    input.yaw = 0;
    input.pitch = 0.17;
    input.distance = 5.3;
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "artifacts/birds-desktop.png" });
  await teleport(0, 18);
  await page.evaluate(async () => {
    const { input } = await window.__parkImport("controllers/input.ts");
    const { runtime } = await window.__parkImport("state/game.ts");
    input.yaw = 0;
    input.pitch = 0.12;
    input.distance = 3.5;
    runtime.facing = 0;
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: "artifacts/avatar-desktop.png" });
  await page.reload();
  await page
    .getByRole("button", { name: "Enter the park" })
    .waitFor({ timeout: 30000 });
  assert.equal(
    await page.getByLabel("What should we call you?").inputValue(),
    "Juniper",
  );
  assert.equal((await state(page)).game.settings.outfit, 1);
  assert.equal((await state(page)).game.settings.volume, 0.47);
  checks.push("Appearance and settings persist after reload");
  await page.getByLabel("What should we call you?").focus();
  await page.keyboard.press("w");
  assert.equal(
    await page.evaluate(async () => {
      const { input } = await window.__parkImport("controllers/input.ts");
      return input.keys.size;
    }),
    0,
  );
  checks.push("Typing does not trigger gameplay");
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const phone = await mobile.newPage();
  monitor(phone);
  await installInspector(phone);
  await phone.goto(url);
  await phone
    .getByRole("button", { name: "Enter the park" })
    .waitFor({ timeout: 30000 });
  await phone.screenshot({ path: "artifacts/entry-mobile.png" });
  await phone.getByLabel("What should we call you?").fill("Robin");
  await phone.getByRole("button", { name: "Enter the park" }).click();
  await phone.getByRole("region", { name: "Movement joystick" }).waitFor();
  await phone.waitForTimeout(1100);
  assert.ok(
    await phone.getByRole("button", { name: "Run", exact: true }).isVisible(),
  );
  assert.equal(
    await phone.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  const touchSession = await mobile.newCDPSession(phone);
  const jr = await phone
    .getByRole("region", { name: "Movement joystick" })
    .boundingBox();
  const finger = { id: 1, x: jr.x + jr.width / 2, y: jr.y + jr.height / 2 };
  const cameraFinger = { id: 2, x: 310, y: 390 };
  await touchSession.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [finger],
  });
  await touchSession.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [finger, cameraFinger],
  });
  await touchSession.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { ...finger, y: finger.y - 35 },
      { ...cameraFinger, x: 350, y: 410 },
    ],
  });
  await phone.waitForTimeout(600);
  const touch = await state(phone);
  assert.ok(touch.runtime.position.z < 21.5);
  const touchYaw = await phone.evaluate(async () => {
    const { input } = await window.__parkImport("controllers/input.ts");
    return input.yaw;
  });
  assert.ok(Math.abs(touchYaw) > 0.1);
  await touchSession.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await phone.waitForTimeout(300);
  await phone.screenshot({ path: "artifacts/park-mobile.png" });
  checks.push(
    "Responsive mobile layout and simultaneous joystick/camera pointer inputs",
  );
  await mobile.close();
  assert.equal(errors.length, 0, errors.join("\n"));
  checks.push("No browser console errors or failed HTTP assets");
  const failing = await browser.newPage();
  monitor(failing);
  await failing.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return type === "webgl2" || type === "webgl"
        ? null
        : original.call(this, type, ...args);
    };
  });
  await failing.goto(url);
  await failing
    .getByRole("alert")
    .filter({ hasText: "This park needs WebGL 2." })
    .waitFor();
  assert.equal(
    await failing.getByRole("button", { name: "Try again" }).count(),
    1,
  );
  await failing.close();
  checks.push("Helpful WebGL initialization failure state");
  assert.equal(errors.length, 0, errors.join("\n"));
  const report = { checks, errors, stats: { ...stats, timing } };
  await fs.writeFile(
    "artifacts/browser-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} catch (e) {
  await page.screenshot({ path: "artifacts/failure.png" }).catch(() => {});
  console.error(e);
  console.error({ checks, errors });
  process.exitCode = 1;
} finally {
  await browser.close();
}
