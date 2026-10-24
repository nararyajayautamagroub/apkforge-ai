import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
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
  if ([".exe", ".msi"].includes(ext)) {
    const handle = await fs.open(filePath, "r");
    try {
      const header = Buffer.alloc(Math.min(4096, stat.size));
      await handle.read(header, 0, header.length, 0);
      const digest = crypto.createHash("sha256");
      const stream = (await import("node:fs")).createReadStream(filePath);
      for await (const chunk of stream) digest.update(chunk);
      const isMz = header.length >= 2 && header[0] === 0x4d && header[1] === 0x5a;
      let pe = null;
      if (isMz && header.length >= 64) {
        const peOffset = header.readUInt32LE(0x3c);
        if (peOffset >= 64 && peOffset + 24 <= stat.size && peOffset + 24 <= header.length) {
          const sig = Buffer.alloc(24);
          await handle.read(sig, 0, sig.length, peOffset);
          if (sig.toString("ascii", 0, 4) === "PE\\0\\0") {
            const machine = sig.readUInt16LE(4);
            const machineNames = { 0x014c: "x86", 0x8664: "x64", 0xaa64: "ARM64", 0x01c4: "ARM" };
            pe = { machine: machineNames[machine] || `unknown (0x${machine.toString(16)})`, sections: sig.readUInt16LE(6), optionalHeaderBytes: sig.readUInt16LE(20) };
          }
        }
      }
      const isMsiCompound = header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1]));
      return {
        upload: { id, name: filename.slice(id.length + 1), size: stat.size, extension: ext },
        executable: {
          format: ext === ".msi" ? "Windows Installer package" : "Windows executable",
          signature: isMz ? "MZ" : isMsiCompound ? "OLE Compound File" : "unknown",
          signatureMatchesExtension: ext === ".exe" ? Boolean(pe) : isMsiCompound,
          pe,
          sha256: digest.digest("hex"),
          safeInspectionOnly: true
        },
        note: "Metadata only. The file was not executed, unpacked, modified, or treated as trusted."
      };
    } finally {
      await handle.close();
    }
  }
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
