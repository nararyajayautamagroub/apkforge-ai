import fs from "node:fs/promises";
import path from "node:path";

const MAX_RECORDS = 200;
const MAX_MEMORY_BYTES = 128 * 1024;

function redact(value) {
  return String(value || "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted-email]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|gh[pousr]_[A-Za-z0-9_]{12,}|AKIA[A-Z0-9]{16})\b/g, "[redacted-secret]")
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .slice(0, 700);
}

function tokens(value) {
  return new Set(String(value || "").toLowerCase().match(/[a-z0-9_+#.-]{3,}/g) || []);
}

function score(request, record) {
  const wanted = tokens(request);
  const past = tokens(record.request + " " + record.summary + " " + (record.fileTypes || []).join(" "));
  let overlap = 0;
  for (const token of wanted) if (past.has(token)) overlap++;
  return overlap / Math.max(1, wanted.size);
}

export async function loadRelevantLearning(workspace, request, limit = 6) {
  const file = path.join(workspace, "ai-learning.json");
  let records = [];
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    if (Array.isArray(parsed.records)) records = parsed.records;
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
  }
  return records
    .filter(record => record.approved === true && typeof record.request === "string")
    .map(record => ({ ...record, relevance: score(request, record) }))
    .filter(record => record.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance || String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit)
    .map(({ request: oldRequest, summary, fileTypes, result, relevance }) => ({
      request: oldRequest,
      summary,
      fileTypes: Array.isArray(fileTypes) ? fileTypes.slice(0, 8) : [],
      result: result || "approved",
      relevance: Number(relevance.toFixed(2))
    }));
}

export async function recordAiLearning(workspace, input = {}) {
  const file = path.join(workspace, "ai-learning.json");
  await fs.mkdir(workspace, { recursive: true });
  let records = [];
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    if (Array.isArray(parsed.records)) records = parsed.records;
  } catch (error) {
    if (error.code !== "ENOENT" && !(error instanceof SyntaxError)) throw error;
  }
  const request = redact(input.request);
  if (!request.trim()) throw new Error("A non-empty AI request is required for learning.");
  const summary = redact(input.summary || "User approved an AI-assisted edit.");
  const fileTypes = Array.isArray(input.fileTypes)
    ? [...new Set(input.fileTypes.filter(x => typeof x === "string").map(x => x.toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 12)))].slice(0, 8)
    : [];
  const record = {
    id: cryptoRandomId(),
    request,
    summary,
    fileTypes,
    result: "approved",
    approved: input.approved === true,
    createdAt: new Date().toISOString()
  };
  records.push(record);
  records = records.slice(-MAX_RECORDS);
  let serialized = JSON.stringify({ version: 1, records }, null, 2);
  while (Buffer.byteLength(serialized, "utf8") > MAX_MEMORY_BYTES && records.length > 1) {
    records.shift();
    serialized = JSON.stringify({ version: 1, records }, null, 2);
  }
  await fs.writeFile(file, serialized, { mode: 0o600 });
  return { saved: true, approved: record.approved, totalRecords: records.length, message: record.approved ? "Pola permintaan yang disetujui disimpan untuk membantu permintaan serupa berikutnya." : "Permintaan dicatat tanpa dianggap sebagai pola yang disetujui." };
}

function cryptoRandomId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
