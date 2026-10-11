import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

// Exercise the shell's actual route definitions without loading JSX in Node.
const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const start = source.indexOf("const modules = [");
const end = source.indexOf("const OFFER_STATUS_TONES");
assert.ok(start >= 0 && end > start);
const { modules, moduleRouteMap, resolveModuleFromHash } = runInNewContext(
  `${source.slice(start, end)}; ({ modules, moduleRouteMap, resolveModuleFromHash });`,
);

test("GitHub Pages direct and refreshed hash routes resolve both existing paths and module aliases", () => {
  for (const module of modules) {
    for (const path of [module.path, `/${module.id}`]) {
      const url = new URL(`https://dogrudizaynpro.github.io/DDPro-App/#${path}`);
      assert.equal(url.pathname, "/DDPro-App/");
      assert.equal(resolveModuleFromHash(url.hash), module.id);
      assert.equal(resolveModuleFromHash(new URL(url.href).hash), module.id);
      assert.equal(resolveModuleFromHash(`${url.hash}/?id=project-id`), module.id);
    }
    assert.equal(moduleRouteMap[module.id], module.path);
  }
  assert.equal(resolveModuleFromHash("#/dashboard"), "dashboard");
  assert.equal(resolveModuleFromHash("#/projects"), "projects");
  assert.equal(resolveModuleFromHash("#/projeler"), "projects");
  assert.equal(resolveModuleFromHash("#/unknown"), "dashboard");
});

test("OAuth result parameters preserve settings navigation and never become the route", () => {
  assert.equal(resolveModuleFromHash("#/ayarlar?integration=google_connected&exchange_code=opaque-code"), "settings");
  assert.equal(resolveModuleFromHash("#/integrations?integration=google_connected"), "integrations");
});

test("a selected project stays in the route while switching modules and returning", async () => {
  const handlerStart = source.indexOf("  const handleModuleNavigation =");
  const handlerEnd = source.indexOf("  const getConnectionTone", handlerStart);
  assert.ok(handlerStart >= 0 && handlerEnd > handlerStart);
  const state = {
    hash: "#/projeler?id=project-7",
    selectedProjectId: "project-7",
    activeModule: "projects",
  };
  const context = {
    window: { location: state },
    moduleRouteMap,
    selectedProjectId: state.selectedProjectId,
    setShowDashboardReference: () => {},
    setSelectedProjectId: (value) => { state.selectedProjectId = value; },
    setActiveModule: (value) => { state.activeModule = value; },
  };
  const navigate = runInNewContext(
    `${source.slice(handlerStart, handlerEnd)}; handleModuleNavigation;`,
    context
  );
  navigate("ai-assistant");
  assert.equal(state.hash, "#/ai-assistant?id=project-7");
  state.activeModule = "ai-assistant";
  navigate("projects");
  assert.equal(state.hash, "#/projeler?id=project-7");
});
