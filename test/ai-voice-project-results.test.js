import assert from "node:assert/strict";
import { after, test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";
import { RealtimeVoiceSession } from "../src/utils/realtime-voice.js";

const vite = await createServer({
  root: new URL("..", import.meta.url).pathname,
  server: { middlewareMode: true, hmr: false },
});
after(() => vite.close());
const { renderVoiceProjectRecords } = await vite.ssrLoadModule("/src/modules/AIModule.jsx");

const executeRead = async (executeTool) => {
  const operations = [];
  const session = new RealtimeVoiceSession({
    executeTool,
    onOperation: (operation) => operations.push(operation),
  });
  const response = await session.executeFunctionCall({
    id: "real-call-1", name: "read_records", args: { resource: "projects" },
  });
  return { operations, response };
};

test("actual Live operation data renders project names/statuses safely in the existing UI", async () => {
  const records = [
    { id: "project-1", name: "Gerçek proje <script>", status: "Tamamlandı" },
    { id: "project-2" },
  ];
  const { operations, response } = await executeRead(async () => ({ type: "records", data: records }));
  assert.equal(renderVoiceProjectRecords(operations[0]), null);
  assert.deepEqual(response.response.data, records);
  const element = renderVoiceProjectRecords(operations.at(-1));
  const markup = renderToStaticMarkup(element);
  assert.match(markup, /Backend proje kayıtları/);
  assert.match(markup, /Gerçek proje &lt;script&gt;/);
  assert.doesNotMatch(markup, /<script\b/i);
  assert.doesNotMatch(markup, /Aktif/);
  assert.match(markup, /Tamamlandı/);
  assert.match(markup, /Proje adı belirtilmemiş/);
  assert.match(markup, /Durum: Belirtilmemiş/);
  assert.match(markup, /real-call-1/);
  assert.match(markup, /Proje listesini kaydet/);
});

test("the displayed list can be saved without a backend write", async (t) => {
  const records = [{ id: "project-1", name: "Gerçek proje", status: "Beklemede" }];
  const { operations } = await executeRead(async () => ({ type: "records", data: records }));
  let blob;
  let clicked = false;
  const link = { click() { clicked = true; }, remove() {} };
  t.mock.method(URL, "createObjectURL", (value) => { blob = value; return "blob:test"; });
  const revoke = t.mock.method(URL, "revokeObjectURL", () => {});
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  try {
    globalThis.document = { createElement: () => link, body: { appendChild() {} } };
    globalThis.window = { setTimeout: (callback) => callback() };
    const element = renderVoiceProjectRecords(operations.at(-1));
    element.props.children.at(-1).props.onClick();
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
  assert.deepEqual(JSON.parse(await blob.text()), records);
  assert.equal(link.download, "ddpro-proje-kayitlari.json");
  assert.equal(clicked, true);
  assert.equal(revoke.mock.calls[0].arguments[0], "blob:test");
});

test("empty backend results render an explicit empty list, not cached projects", async () => {
  for (const data of [[], null]) {
    const { operations } = await executeRead(async () => ({ type: "records", data }));
    const markup = renderToStaticMarkup(renderVoiceProjectRecords(operations.at(-1)));
    assert.match(markup, /Bu sorguda proje kaydı bulunamadı/);
    assert.doesNotMatch(markup, /Backend proje kayıtları/);
  }
});

test("failed reads expose the real failure event and never render a project list", async () => {
  const { operations, response } = await executeRead(async () => { throw new Error("Yetki yetersiz."); });
  assert.equal(operations.at(-1).status, "failed");
  assert.equal(operations.at(-1).summary, "Yetki yetersiz.");
  assert.deepEqual(response.response, { error: "Yetki yetersiz." });
  assert.equal(renderVoiceProjectRecords(operations.at(-1)), null);
});
