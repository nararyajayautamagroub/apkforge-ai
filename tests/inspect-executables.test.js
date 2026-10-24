import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inspectUploadedArchive } from "../server/src/services/inspect.js";

test("inspects EXE metadata without executing the file", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "apkforge-exe-"));
  const id = "12345678-1234-4234-8234-123456789abc";
  try {
    const bytes = Buffer.alloc(512);
    bytes.write("MZ", 0, "ascii");
    bytes.writeUInt32LE(128, 0x3c);
    bytes.write("PE\0\0", 128, "binary");
    bytes.writeUInt16LE(0x8664, 132);
    bytes.writeUInt16LE(4, 134);
    bytes.writeUInt16LE(240, 148);
    await fs.writeFile(path.join(workspace, id + "-sample.exe"), bytes);
    const result = await inspectUploadedArchive(workspace, id);
    assert.equal(result.executable.format, "Windows executable");
    assert.equal(result.executable.signatureMatchesExtension, true);
    assert.equal(result.executable.pe.machine, "x64");
    assert.equal(result.executable.safeInspectionOnly, true);
    assert.equal(result.executable.sha256.length, 64);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});

test("recognizes MSI compound-file signature without installing it", async () => {
  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), "apkforge-msi-"));
  const id = "12345678-1234-4234-8234-123456789abc";
  try {
    const bytes = Buffer.alloc(64);
    Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]).copy(bytes);
    await fs.writeFile(path.join(workspace, id + "-sample.msi"), bytes);
    const result = await inspectUploadedArchive(workspace, id);
    assert.equal(result.executable.format, "Windows Installer package");
    assert.equal(result.executable.signatureMatchesExtension, true);
    assert.equal(result.executable.safeInspectionOnly, true);
  } finally {
    await fs.rm(workspace, { recursive: true, force: true });
  }
});
