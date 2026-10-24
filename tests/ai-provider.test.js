import test from "node:test";
import assert from "node:assert/strict";
import { proposePatch, proposeProjectPatch } from "../server/src/services/ai.js";

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;

function configureAi() {
  process.env.AI_BASE_URL = "https://ai.example.test/v1/chat/completions";
  process.env.AI_API_KEY = "test-key";
  process.env.AI_MODEL = "test-model";
  delete process.env.AI_MAX_RESPONSE_BYTES;
  delete process.env.AI_TIMEOUT_MS;
}

function mockProvider(content, options = {}) {
  globalThis.fetch = async (_url, init) => {
    assert.equal(init.method, "POST");
    assert.match(init.headers.Authorization, /^Bearer /);
    return new Response(JSON.stringify({
      choices: [{ message: { content } }]
    }), { status: options.status || 200, headers: options.headers });
  };
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of ["AI_BASE_URL", "AI_API_KEY", "AI_MODEL", "AI_MAX_RESPONSE_BYTES", "AI_TIMEOUT_MS"]) {
    if (Object.hasOwn(originalEnv, key)) process.env[key] = originalEnv[key];
    else delete process.env[key];
  }
});

test("legacy AI planner accepts a valid structured proposal", async () => {
  configureAi();
  mockProvider(JSON.stringify({
    summary: "Update a source file",
    files_to_change: ["src/main.js"],
    patch: { "src/main.js": "updated" },
    risks: [],
    tests: ["Run tests"]
  }));
  const result = await proposePatch({ request: "Update source", fileInventory: [] });
  assert.equal(result.configured, true);
  const proposal = JSON.parse(result.proposal);
  assert.equal(proposal.summary, "Update a source file");
  assert.deepEqual(proposal.files_to_change, ["src/main.js"]);
});

test("legacy AI planner rejects missing required fields", async () => {
  configureAi();
  mockProvider(JSON.stringify({ summary: "Incomplete", files_to_change: [] }));
  await assert.rejects(
    () => proposePatch({ request: "Update source" }),
    /missing required field: patch/
  );
});

test("project AI planner rejects a path not present in the editable inventory", async () => {
  configureAi();
  mockProvider(JSON.stringify({
    summary: "Change file",
    files: [{ path: "../secrets.env", proposedContent: "exposed", rationale: "bad path" }]
  }));
  await assert.rejects(
    () => proposeProjectPatch({
      request: "Change a file",
      currentFiles: [{ path: "src/main.js", content: "safe" }]
    }),
    /outside the selected editable files/
  );
});

test("AI provider response is rejected when it exceeds the configured byte limit", async () => {
  configureAi();
  process.env.AI_MAX_RESPONSE_BYTES = "1024";
  globalThis.fetch = async () => new Response("x".repeat(2048), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
  await assert.rejects(
    () => proposePatch({ request: "Update source" }),
    /exceeds the configured 1024-byte limit/
  );
});


test("AI provider configuration is reported as unavailable without credentials", async () => {
  configureAi();
  delete process.env.AI_API_KEY;
  const result = await proposePatch({ request: "Add a feature" });
  assert.equal(result.configured, false);
  assert.match(result.message, /AI_API_KEY/);
});

test("AI provider HTTP failures are surfaced without parsing the response as a proposal", async () => {
  configureAi();
  globalThis.fetch = async () => new Response("provider unavailable", { status: 503 });
  await assert.rejects(
    () => proposePatch({ request: "Add a feature" }),
    /AI provider returned HTTP 503/
  );
});

test("AI provider invalid JSON is rejected with a bounded parser error", async () => {
  configureAi();
  globalThis.fetch = async () => new Response("{invalid", { status: 200 });
  await assert.rejects(
    () => proposePatch({ request: "Add a feature" }),
    /AI provider returned invalid JSON/
  );
});

test("project AI planner accepts a valid proposal for an exact editable path", async () => {
  configureAi();
  mockProvider(JSON.stringify({
    summary: "Improve the home page",
    assumptions: ["Keep existing layout"],
    files: [{
      path: "public/index.html",
      proposedContent: "<main>Updated</main>",
      rationale: "Add the requested content"
    }],
    risks: [],
    tests: ["Open the page"]
  }));
  const result = await proposeProjectPatch({
    request: "Improve the home page",
    currentFiles: [{ path: "public/index.html", content: "<main>Old</main>" }]
  });
  assert.equal(result.configured, true);
  assert.equal(result.proposal.summary, "Improve the home page");
  assert.equal(result.proposal.files[0].path, "public/index.html");
  assert.equal(result.proposal.files[0].proposedContent, "<main>Updated</main>");
});

test("project AI planner rejects duplicate paths in one proposal", async () => {
  configureAi();
  mockProvider(JSON.stringify({
    summary: "Duplicate changes",
    files: [
      { path: "public/index.html", proposedContent: "one" },
      { path: "public/index.html", proposedContent: "two" }
    ]
  }));
  await assert.rejects(
    () => proposeProjectPatch({
      request: "Change the page",
      currentFiles: [{ path: "public/index.html", content: "current" }]
    }),
    /duplicate file path/
  );
});

test("project AI planner rejects non-string proposed file content", async () => {
  configureAi();
  mockProvider(JSON.stringify({
    summary: "Invalid content",
    files: [{ path: "public/index.html", proposedContent: { html: "not a string" } }]
  }));
  await assert.rejects(
    () => proposeProjectPatch({
      request: "Change the page",
      currentFiles: [{ path: "public/index.html", content: "current" }]
    }),
    /content is invalid or exceeds 2 MiB/
  );
});
