import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { validateUploadName, resolveInsideWorkspace } from "../server/src/services/archive.js";

test("accepts supported Android and Windows package extensions", () => {
  for (const name of ["game.apk", "bundle.aab", "data.obb", "app.exe", "installer.msi"]) {
    assert.equal(validateUploadName(name).extension, path.extname(name));
  }
});

test("rejects unsupported executable and document types", () => {
  assert.throws(() => validateUploadName("script.bat"), /Unsupported file type/);
  assert.throws(() => validateUploadName("payload.exe.sh"), /Unsupported file type/);
});

test("sanitizes uploaded file names", () => {
  assert.equal(validateUploadName("../../My App.apk").safeName, "My_App.apk");
});

test("blocks paths escaping the workspace", () => {
  const root = path.resolve("workspace");
  assert.throws(() => resolveInsideWorkspace(root, "../secret.txt"), /Path traversal blocked/);
  assert.equal(resolveInsideWorkspace(root, "project/file.apk"), path.join(root, "project/file.apk"));
});
