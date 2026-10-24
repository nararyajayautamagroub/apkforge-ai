import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { applyProjectPatch } from "../server/src/services/project.js";

test("applies a reviewed multi-file patch and keeps backups", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "apkforge-project-patch-"));
  const id = "12345678-1234-4234-8234-123456789abc";
  const root = path.join(workspace, "projects", id);
  try {
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, ".apkforge-project.json"), JSON.stringify({ id, format: "test" }));
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "main.js"), "export const value = 1;\n");
    await fs.writeFile(path.join(root, "src", "config.json"), "{\n  \"enabled\": false\n}\n");
    const result = await applyProjectPatch(workspace, id, [
      { path: "src/main.js", proposedContent: "export const value = 2;\n" },
      { path: "src/config.json", proposedContent: "{\n  \"enabled\": true\n}\n" }
    ]);
    assert.equal(result.updated.length, 2);
    assert.equal(await fs.readFile(path.join(root, "src", "main.js"), "utf8"), "export const value = 2;\n");
    assert.equal(await fs.readFile(path.join(root, "src", "config.json"), "utf8"), "{\n  \"enabled\": true\n}\n");
    assert.equal(await fs.readFile(path.join(workspace, "backups", id, "src", "main.js"), "utf8"), "export const value = 1;\n");
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test("rejects duplicate paths and patches with too many files", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "apkforge-project-patch-invalid-"));
  const id = "12345678-1234-4234-8234-123456789abc";
  const root = path.join(workspace, "projects", id);
  try {
    await fs.mkdir(root, { recursive: true });
    await fs.writeFile(path.join(root, ".apkforge-project.json"), JSON.stringify({ id }));
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "main.js"), "x");
    await assert.rejects(() => applyProjectPatch(workspace, id, [
      { path: "src/main.js", proposedContent: "a" },
      { path: "src/main.js", proposedContent: "b" }
    ]), /duplicate file path/);
    await assert.rejects(() => applyProjectPatch(workspace, id, Array.from({ length: 6 }, (_, i) => ({ path: "src/main.js", proposedContent: String(i) }))), /between 1 and 5/);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
