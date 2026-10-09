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
const errors = [];
try {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  await page.goto(process.env.PARK_URL || "http://127.0.0.1:4177");
  await page
    .getByRole("button", { name: "Enter the park" })
    .waitFor({ timeout: 60000 });
  await page.screenshot({ path: "artifacts/entry-production.png" });
  await page.getByLabel("What should we call you?").fill("Fern");
  await page.getByRole("button", { name: "Sky outfit", exact: true }).click();
  await page.getByRole("button", { name: "Enter the park" }).click();
  await page.getByText("Fern", { exact: true }).waitFor();
  await page.keyboard.down("w");
  await page.waitForTimeout(900);
  await page.keyboard.up("w");
  await page.mouse.move(500, 400);
  await page.mouse.down();
  await page.mouse.move(949, 400, { steps: 20 });
  await page.mouse.up();
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(700);
  await page.screenshot({ path: "artifacts/avatar-production.png" });
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByLabel("Visual quality").selectOption("low");
  await page.getByRole("button", { name: "Back to the park" }).click();
  await page.getByRole("button", { name: "Mute sound", exact: true }).click();
  await page
    .getByRole("button", { name: "Unmute sound", exact: true })
    .waitFor();
  await page.screenshot({ path: "artifacts/production.png" });
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log(
    "Production Chrome smoke passed: bundled physics, entry, chosen profile, settings, sound control; no failed assets or browser errors.",
  );
} finally {
  await browser.close();
}
