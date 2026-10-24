import fs from "node:fs/promises";
import path from "node:path";
import yauzl from "yauzl";

const MAX_ENTRIES = 5000;
const MAX_UNCOMPRESSED_BYTES = 2 * 1024 * 1024 * 1024;

function openZip(file) {
  return new Promise((resolve, reject) => yauzl.open(file, { lazyEntries: true, autoClose: true, decodeStrings: true, validateEntrySizes: true }, (error, zip) => error ? reject(error) : resolve(zip)));
}

export async function inspectUploadedArchive(workspace, id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid upload id.");
  const names = await fs.readdir(workspace);
  const filename = names.find(n => n.startsWith(id + "-"));
  if (!filename) throw new Error("Upload not found. Upload the file again.");
  const filePath = path.join(workspace, filename);
  const stat = await fs.stat(filePath);
  const ext = path.extname(filename).toLowerCase();
  if (![".apk", ".apks", ".aab", ".obb", ".zip", ".apfproj"].includes(ext)) throw new Error("Unsupported file type.");
  const zip = await openZip(filePath);
  return await new Promise((resolve, reject) => {
    const entries = [];
    let total = 0;
    zip.on("entry", entry => {
      if (entries.length >= MAX_ENTRIES) { zip.close(); reject(new Error("Archive has too many entries to preview safely (limit 5,000).")); return; }
      const size = Number(entry.uncompressedSize || 0);
      total += size;
      if (total > MAX_UNCOMPRESSED_BYTES) { zip.close(); reject(new Error("Archive expands beyond the 2 GiB preview safety limit.")); return; }
      entries.push({ name: entry.fileName, compressedBytes: Number(entry.compressedSize || 0), uncompressedBytes: size, directory: entry.fileName.endsWith("/") });
      zip.readEntry();
    });
    zip.on("end", () => resolve({ upload: { id, name: filename.slice(id.length + 1), size: stat.size, extension: ext }, archive: { compatibleZip: true, entryCount: entries.length, uncompressedBytes: total, entries }, note: "Preview only: files have not been changed or rebuilt." }));
    zip.on("error", reject);
    zip.readEntry();
  });
}
