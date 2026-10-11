import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../src/modules/ProjectsModule.jsx", import.meta.url), "utf8");
const start = source.indexOf("  const sendProjectCommand = async");
const end = source.indexOf("\n\n  return (", start);
assert.ok(start >= 0 && end > start);

const createAnalysis = ({ sendAiMessage, projectCommand = "Riskleri analiz et" }) => {
  const state = { analysis: null };
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
    sendAiMessage,
    projectAnalysisPendingRef: { current: false },
    setProjectAnalysis: (value) => { state.analysis = value; },
  };
  const run = runInNewContext(`${source.slice(start, end)}; sendProjectCommand;`, context);
  return { run, state, context };
};

test("project analysis sends the selected project and displays the returned answer", async () => {
  let payload;
  const { run, state } = createAnalysis({
    sendAiMessage: async (...args) => {
      payload = args;
      return { status: "success", text: "Önerilen analiz" };
    },
  });
  await run();
  assert.equal(payload[0], "Riskleri analiz et");
  assert.equal(payload[1], "");
  assert.equal(payload[2].selectedProject.name, "İstanbul Ofis");
  assert.equal(payload[2].selectedProject.areaM2, 120);
  assert.equal(state.analysis.status, "success");
  assert.equal(state.analysis.text, "Önerilen analiz");
});

test("project analysis blocks duplicate requests and shows provider failure", async () => {
  let resolve;
  let calls = 0;
  const { run, state, context } = createAnalysis({
    sendAiMessage: () => {
      calls += 1;
      return new Promise((finish) => { resolve = finish; });
    },
  });
  const first = run();
  const second = run();
  assert.equal(calls, 1);
  assert.equal(state.analysis.status, "loading");
  resolve({ status: "unavailable", text: "AI sağlayıcısından yanıt alınamadı (zaman aşımı)." });
  await Promise.all([first, second]);
  assert.equal(state.analysis.status, "unavailable");
  assert.equal(state.analysis.text, "AI sağlayıcısından yanıt alınamadı (zaman aşımı).");
  assert.equal(context.projectAnalysisPendingRef.current, false);
});
