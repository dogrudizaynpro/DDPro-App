import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../src/App.jsx", import.meta.url), "utf8");
const start = source.indexOf("const useCatalogDataState =");
const end = source.indexOf("const modules =", start);
assert.ok(start >= 0 && end > start);
const hookSource = source.slice(start, end);

const mountCatalogState = (request) => {
  const state = [];
  let index = 0;
  let requestCount = 0;
  const context = {
    EMPTY_ITEMS: [],
    useState(initialValue) {
      const slot = index++;
      state[slot] = initialValue;
      return [state[slot], (value) => { state[slot] = value; }];
    },
    useEffect(effect) {
      effect();
    },
    getCatalogRecords(resource) {
      requestCount += 1;
      assert.equal(resource, "products");
      return request();
    },
  };
  const hook = runInNewContext(`${hookSource}; useCatalogDataState;`, context);
  return { result: hook("products"), state, get requestCount() { return requestCount; } };
};

test("catalog data state distinguishes loading, successful empty results, and failures", async () => {
  let resolveRequest;
  const pending = mountCatalogState(() => new Promise((resolve) => { resolveRequest = resolve; }));
  assert.equal(pending.result.status, "loading");
  assert.equal(pending.result.records.length, 0);
  assert.equal(pending.requestCount, 1);
  resolveRequest([]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(pending.state, [[], "success"]);

  const empty = mountCatalogState(() => Promise.resolve([]));
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(empty.state, [[], "success"]);
  assert.equal(empty.requestCount, 1);

  const failed = mountCatalogState(() => Promise.reject(new Error("API unavailable")));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(failed.state[1], "error");
  assert.deepEqual(failed.state[0], []);
  assert.equal(failed.requestCount, 1);
});
