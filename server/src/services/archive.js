import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const ALLOWED_EXTENSIONS = new Set([".apk", ".apks", ".aab", ".obb", ".zip", ".apfproj"]);

export function validateUploadName(name = "") {
  const ext = path.extname(name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) throw new Error(`Unsupported file type: ${ext || "(no extension)"}`);
  return { extension: ext, safeName: path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_") };
}

export async function storeUpload(file, workspaceDir) {
  if (!file?.path || !file?.originalname) throw new Error("Upload is missing required metadata");
  const { extension, safeName } = validateUploadName(file.originalname);
  await fs.mkdir(workspaceDir, { recursive: true });
  const id = crypto.randomUUID();
  const destination = path.join(workspaceDir, `${id}-${safeName}`);
  await fs.rename(file.path, destination);
  const stat = await fs.stat(destination);
  return { id, name: safeName, extension, path: destination, size: stat.size };
}

export function resolveInsideWorkspace(root, relativePath) {
  const base = path.resolve(root);
  const target = path.resolve(base, relativePath);
  if (target !== base && !target.startsWith(base + path.sep)) throw new Error("Path traversal blocked");
  return target;
}
