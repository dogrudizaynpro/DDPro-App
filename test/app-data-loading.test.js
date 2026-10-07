import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const domains = [
  { name: "Projects", fetch: "fetchProjectsFromApi", service: "getProjects", items: "Projects" },
  { name: "Procurement", fetch: "fetchProcurementFromApi", service: "getProcurementItems", items: "ProcurementItems" },
  { name: "Offers", fetch: "fetchOffersFromApi", service: "getOffers", items: "Offers" },
];
const flush = () => new Promise((resolve) => setImmediate(resolve));

const createLoader = ({ name, fetch, service, items }) => {
  const marker = source.indexOf(`const ${fetch} = async`);
  const start = source.lastIndexOf("  useEffect(() => {", marker);
  const end = source.indexOf("]);", marker) + 3;
  assert.ok(marker >= 0 && start >= 0 && end > marker);
  const state = { rows: [{ id: "earlier-edit" }] };
  const revision = { current: 1 };
  const active = { current: 0 };
  let response;
  let cleanup;
  const context = {
    useEffect: (effect) => { cleanup = effect(); },
    integrationState: { google: { connected: true } },
    offersReloadKey: 0,
    [`${name.toLowerCase()}TouchedRef`]: revision,
    [`${name.toLowerCase()}ActiveMutationsRef`]: active,
    [service]: () => response(),
    [`set${items}`]: (rows) => { state.rows = typeof rows === "function" ? rows(state.rows) : rows; },
    [`set${name}Loading`]: (loading) => { state.loading = loading; },
    [`set${name}Error`]: (error) => { state.error = error; },
    [`set${name}FetchState`]: (status) => { state.status = typeof status === "function" ? status(state.status) : status; },
    offerDetailsCacheRef: { current: new Map() },
    setSelectedOfferId: () => {},
    getInitialItems: () => [],
    getStoredData: () => [],
    mapOffersToViewModel: (rows) => rows,
    STORAGE_KEYS: {},
    CAN_USE_LOCAL_FALLBACK: false,
    EMPTY_ITEMS: [],
    addLog: () => {},
    getApiFailureReason: (error) => error.message,
    console: { warn: () => {} },
  };
  return {
    state, revision, active, context,
    load: (nextResponse) => {
      cleanup?.();
      response = nextResponse;
      runInNewContext(source.slice(start, end), context);
    },
  };
};

for (const domain of domains) {
  test(`${domain.name} recovers real API records after an earlier edit and failed session reload`, async () => {
    const loader = createLoader(domain);
    loader.load(() => Promise.reject(new Error("Browser session required")));
    await flush();
    assert.equal(loader.state.rows.length, 0);
    assert.equal(loader.state.status, "error");
    const persisted = [{ id: "persistent-backend-record" }];
    loader.load(() => Promise.resolve(persisted));
    await flush();
    assert.deepEqual(loader.state.rows, persisted);
    assert.equal(loader.state.status, "success");
    assert.equal(loader.state.error, null);
  });

  for (const outcome of ["success", "failure"]) {
    test(`${domain.name} ignores a stale ${outcome} read after a concurrent mutation`, async () => {
      const loader = createLoader(domain);
      let finish;
      loader.load(() => new Promise((resolve, reject) => { finish = outcome === "success" ? resolve : reject; }));
      const edited = [{ id: "newer-confirmed-edit" }];
      loader.revision.current += 1;
      loader.state.rows = edited;
      finish(outcome === "success" ? [{ id: "stale-backend-record" }] : new Error("Stale session failure"));
      await flush();
      assert.deepEqual(loader.state.rows, edited);
      assert.equal(loader.state.status, "success");
    });
    test(`${domain.name} preserves records when a ${outcome} read completes before an already-active mutation`, async () => {
      const loader = createLoader(domain);
      const edited = loader.state.rows;
      loader.active.current = 1;
      loader.load(() => outcome === "success"
        ? Promise.resolve([])
        : Promise.reject(new Error("Session failed during an active write")));
      await flush();
      assert.deepEqual(loader.state.rows, edited);
      assert.equal(loader.state.status, "success");
    });
  }

}

test("a project creation already in flight fences a stale reload when its write completes", async () => {
  const loader = createLoader(domains[0]);
  let finishCreate;
  let finishRead;
  Object.assign(loader.context, {
    projectName: "New project", projectType: "Genel Proje", projectStatus: "Aktif",
    createId: () => "draft-id", formatDate: () => "2026-10-07",
    createProjectRequest: () => new Promise((resolve) => { finishCreate = resolve; }),
    setProjectName: () => {}, setProjectType: () => {},
    setProjectStatus: () => {}, setShowProjectForm: () => {},
  });
  const start = source.indexOf("  const createProject = async");
  const end = source.indexOf("  const deleteProject = async", start);
  const createProject = runInNewContext(`${source.slice(start, end)}; createProject;`, loader.context);
  const creating = createProject({ preventDefault: () => {} });
  loader.load(() => new Promise((resolve) => { finishRead = resolve; }));
  finishCreate({ id: "saved-project", name: "New project" });
  await creating;
  finishRead([]);
  await flush();
  assert.equal(loader.state.rows[0].id, "saved-project");
  assert.equal(loader.state.rows.length, 2);
  assert.equal(loader.state.status, "success");
  assert.equal(loader.active.current, 0);
});

test("a pending project update stays visible when session reload fails before the write finishes", async () => {
  const loader = createLoader(domains[0]);
  const id = loader.state.rows[0].id;
  let finishUpdate;
  Object.assign(loader.context, {
    projects: loader.state.rows, isUuid: () => true,
    updateProjectRequest: () => new Promise((resolve) => { finishUpdate = resolve; }),
  });
  const start = source.indexOf("  const updateProject = async");
  const end = source.indexOf("  const persistProcurementRecord = async", start);
  const updateProject = runInNewContext(`${source.slice(start, end)}; updateProject;`, loader.context);
  const updating = updateProject(id, { status: "Tamamlandı" });
  loader.load(() => Promise.reject(new Error("Session restore temporarily failed")));
  await flush();
  assert.equal(loader.state.rows.length, 1);
  finishUpdate({ id, status: "Tamamlandı" });
  assert.equal(await updating, true);
  assert.equal(loader.state.rows[0].status, "Tamamlandı");
  assert.equal(loader.active.current, 0);
});
