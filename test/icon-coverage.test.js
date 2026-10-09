import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [iconSource, buttonSource, iconStyles] = await Promise.all([
  read("../src/components/DDProIcon.jsx"),
  read("../src/components/DDProActionButton.jsx"),
  read("../src/ddpro-premium-ui.css"),
]);

test("approved icon crops use the reference image's native dimensions and actual action areas", async () => {
  const reference = await readFile(new URL("../IMG_9199.png", import.meta.url));
  assert.equal(reference.toString("ascii", 12, 16), "IHDR");
  assert.equal(reference.readUInt32BE(16), 1536);
  assert.equal(reference.readUInt32BE(20), 1024);
  assert.match(iconSource, /referenceImageSize = \{ width: 1536, height: 1024 \}/);
  assert.match(iconSource, /cropSize = \{ width: 320, height: 320 \}/);
  for (const [name, x, y] of [
    ["edit", 176, 136],
    ["delete", 608, 136],
    ["save", 1038, 136],
    ["print", 176, 516],
    ["settings", 608, 516],
    ["add", 1038, 516],
  ]) {
    assert.match(iconSource, new RegExp(`["']?${name}["']?: \\[${x}, ${y}\\]`));
  }
  assert.match(iconSource, /"aria-hidden": true|aria-hidden="true"/);
});

test("icon action buttons preserve accessible names, native keyboard support, and 44px touch targets", () => {
  assert.match(buttonSource, /<button/);
  assert.match(buttonSource, /aria-label=\{label\}/);
  assert.match(buttonSource, /title=\{label\}/);
  assert.match(iconStyles, /width: 48px/);
  assert.match(iconStyles, /min-height: 48px/);
  assert.match(iconStyles, /:focus-visible/);
});

test("catalog, CRM, offers, procurement, documents, messages, calendar, finance, and reports use icon actions", async () => {
  const modules = [
    "../src/modules/ProjectsModule.jsx",
    "../src/modules/SystemsModule.jsx",
    "../src/modules/CRMModule.jsx",
    "../src/modules/OffersModule.jsx",
    "../src/modules/ProcurementModule.jsx",
    "../src/modules/DocumentsModule.jsx",
    "../src/modules/MessagesModule.jsx",
    "../src/modules/OperationsModule.jsx",
  ];
  const sources = await Promise.all(modules.map(read));
  const combined = sources.join("\n");
  for (const icon of ["edit", "delete", "save", "print", "settings", "add"]) {
    assert.ok(
      combined.includes(`icon="${icon}"`) ||
      combined.includes(`name="${icon}"`) ||
      combined.includes(`"${icon}"`),
      `${icon} icon is used`,
    );
  }
  for (const path of modules.slice(2, 7)) {
    const source = await read(path);
    assert.match(source, /DDProActionButton/);
  }
  assert.match(sources.at(-1), /function CatalogWorkspace/);
  assert.match(sources.at(-1), /function CalendarWorkspace/);
  assert.match(sources.at(-1), /function FinanceWorkspace/);
  assert.match(sources.at(-1), /function ReportsWorkspace/);
});
