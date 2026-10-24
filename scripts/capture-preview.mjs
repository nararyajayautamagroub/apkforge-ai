import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const port = Number(process.env.PREVIEW_PORT || 8799);
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["server/src/index.js"], {
  env: { ...process.env, PORT: String(port), HOST: "127.0.0.1", WORKSPACE_DIR: path.resolve(".preview-workspace") },
  stdio: "ignore"
});
let browser;
try {
  let healthy = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error("Preview server exited before becoming ready.");
    try {
      const response = await fetch(origin + "/api/health");
      if (response.ok) { healthy = true; break; }
    } catch {}
    await delay(500);
  }
  if (!healthy) throw new Error("Preview server did not become ready.");
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.screenshot({ path: "artifacts/apkforge-ai-home.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "artifacts/apkforge-ai-mobile.png", fullPage: true });
  console.log("Captured desktop and mobile APKForge AI preview screenshots.");
} finally {
  if (browser) await browser.close();
  server.kill();
  await fs.rm(path.resolve(".preview-workspace"), { recursive: true, force: true }).catch(() => {});
}
