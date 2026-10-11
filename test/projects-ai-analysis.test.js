import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../src/modules/ProjectsModule.jsx", import.meta.url), "utf8");
const start = source.indexOf("  const sendProjectCommand = async");
const end = source.indexOf("\n\n  return (", start);
assert.ok(start >= 0 && end > start);

const createAnalysis = ({
  createProjectAiAnalysis,
  projectCommand = "Riskleri analiz et",
  requestId = "request-1",
}) => {
  const state = { analysis: null, history: [], savedDraft: null };
  const context = {
    selectedProject: {
      id: "project-7",
      name: "İstanbul Ofis",
      type: "Ofis",
      status: "Aktif",
      customer: "Örnek müşteri",
      company: "Örnek firma",
      location: "İstanbul",
      product: "Cephe sistemi",
      areaM2: 120,
      systems: ["Cephe"],
      startDate: "2026-01-01",
      endDate: "2026-06-01",
      notes: "Mevcut proje notu",
    },
    projectCommand,
    projectCommandDraft: { projectId: "project-7", command: projectCommand, requestId },
    createProjectAiAnalysis,
    projectAnalysisPendingRef: { current: false },
    projectAnalysisRequestRef: { current: 0 },
    setProjectAnalysis: (value) => { state.analysis = value; },
    setProjectAnalysisHistory: (value) => {
      state.history = typeof value === "function" ? value(state.history) : value;
    },
    setProjectCommandDraft: (value) => { state.draft = value; },
    saveProjectAnalysisDraft: (value) => { state.savedDraft = value; },
    createAnalysisRequestId: () => "request-next",
  };
  const run = runInNewContext(`${source.slice(start, end)}; sendProjectCommand;`, context);
  return { run, state, context };
};

test("project analysis sends the selected project and persists the returned answer", async () => {
  let payload;
  const { run, state } = createAnalysis({
    createProjectAiAnalysis: async (...args) => {
      payload = args;
      return {
        id: "analysis-1",
        result: { answer: "Önerilen analiz" },
        status: "success",
        command: "Riskleri analiz et",
      };
    },
  });
  await run();
  assert.equal(payload[0], "project-7");
  assert.equal(payload[1].command, "Riskleri analiz et");
  assert.equal(payload[1].requestId, "request-1");
  assert.equal(state.analysis.status, "success");
  assert.equal(state.analysis.text, "Önerilen analiz");
  assert.equal(state.history[0].id, "analysis-1");
  assert.equal(state.savedDraft.requestId, "request-next");
});

test("project analysis blocks duplicate requests and shows provider failure", async () => {
  let reject;
  let calls = 0;
  const { run, state, context } = createAnalysis({
    createProjectAiAnalysis: () => {
      calls += 1;
      return new Promise((_resolve, fail) => { reject = fail; });
    },
  });
  const first = run();
  const second = run();
  assert.equal(calls, 1);
  assert.equal(state.analysis.status, "loading");
  reject(new Error("AI sağlayıcısından yanıt alınamadı (zaman aşımı)."));
  await Promise.all([first, second]);
  assert.equal(state.analysis.status, "unavailable");
  assert.equal(state.analysis.text, "AI sağlayıcısından yanıt alınamadı (zaman aşımı).");
  assert.equal(context.projectAnalysisPendingRef.current, false);
});

test("project analysis preserves its command and idempotency key after a network failure", async () => {
  const { run, state } = createAnalysis({
    createProjectAiAnalysis: async () => { throw new Error("Network unavailable"); },
  });
  await run();
  assert.equal(state.analysis.status, "unavailable");
  assert.equal(state.analysis.text, "Network unavailable");
  assert.equal(state.savedDraft, null);
});

test("a stale project analysis response cannot overwrite the currently selected project's state", async () => {
  let resolve;
  const { run, state, context } = createAnalysis({
    createProjectAiAnalysis: () => new Promise((finish) => { resolve = finish; }),
  });
  const pending = run();
  context.projectAnalysisRequestRef.current += 1;
  context.projectAnalysisPendingRef.current = false;
  resolve({ id: "old-analysis", result: { answer: "Old project response" } });
  await pending;
  assert.equal(state.analysis.status, "loading");
  assert.equal(state.history.length, 0);
});
