import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadRelevantLearning, recordAiLearning } from "../server/src/services/ai-memory.js";

test("AI learning only reuses user-approved patterns", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "apkforge-ai-memory-"));
  try {
    await recordAiLearning(workspace, { request: "Add a vehicle selection button", summary: "Added a validated UI control", fileTypes: [".js"], approved: false });
    assert.equal((await loadRelevantLearning(workspace, "vehicle selection button")).length, 0);
    await recordAiLearning(workspace, { request: "Add a vehicle selection button", summary: "Added a validated UI control", fileTypes: [".js"], approved: true });
    const lessons = await loadRelevantLearning(workspace, "vehicle selection button");
    assert.equal(lessons.length, 1);
    assert.equal(lessons[0].summary, "Added a validated UI control");
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test("AI learning redacts emails, URLs and common API tokens", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "apkforge-ai-redact-"));
  try {
    await recordAiLearning(workspace, { request: "Fix user@example.com using sk-12345678901234567890 at https://private.example/path", approved: true });
    const raw = await fs.readFile(path.join(workspace, "ai-learning.json"), "utf8");
    assert.doesNotMatch(raw, /user@example\.com/);
    assert.doesNotMatch(raw, /sk-12345678901234567890/);
    assert.doesNotMatch(raw, /https:\/\/private\.example/);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
