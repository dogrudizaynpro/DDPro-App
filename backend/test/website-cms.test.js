import assert from "node:assert/strict";
import { test } from "node:test";
import { requestWebsiteCms } from "../src/services/website-cms.service.js";

const configureProvider = (t, values = {}) => {
  const keys = ["WEBSITE_CMS_API_URL", "WEBSITE_CMS_API_TOKEN"];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    WEBSITE_CMS_API_URL: "https://cms.example/api",
    WEBSITE_CMS_API_TOKEN: "test-token",
    ...values,
  });
  t.after(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });
};

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("CMS provider sends authorized JSON requests to the supported content paths", async (t) => {
  configureProvider(t);
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push({ url: String(url), options });
    return jsonResponse({ ok: true });
  });

  await requestWebsiteCms({ method: "GET", contentType: "pages" });
  await requestWebsiteCms({
    method: "POST",
    contentType: "products",
    body: { title: "Ürün" },
  });
  await requestWebsiteCms({
    method: "PATCH",
    contentType: "references",
    id: "item/42",
    body: { title: "Güncel" },
  });

  assert.deepEqual(requests.map(({ url, options }) => [new URL(url).pathname, options.method]), [
    ["/api/pages", "GET"],
    ["/api/products", "POST"],
    ["/api/references/item%2F42", "PATCH"],
  ]);
  assert.equal(requests[0].options.headers.Authorization, ["Bearer", "test-token"].join(" "));
  assert.equal(requests[0].options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(requests[1].options.body), { title: "Ürün" });
  assert.deepEqual(JSON.parse(requests[2].options.body), { title: "Güncel" });
});

test("CMS provider returns null for an empty successful response", async (t) => {
  configureProvider(t);
  t.mock.method(globalThis, "fetch", async () => new Response(null, { status: 204 }));

  assert.equal(await requestWebsiteCms({ method: "GET", contentType: "pages" }), null);
});

test("CMS provider rejects unsupported content types before making a request", async (t) => {
  configureProvider(t);
  let called = false;
  t.mock.method(globalThis, "fetch", async () => { called = true; });

  await assert.rejects(
    requestWebsiteCms({ method: "GET", contentType: "customers" }),
    (error) => error.statusCode === 400 && error.expose === true,
  );
  assert.equal(called, false);
});

test("CMS provider requires HTTPS outside localhost", async (t) => {
  configureProvider(t, { WEBSITE_CMS_API_URL: "http://cms.example/api" });
  let called = false;
  t.mock.method(globalThis, "fetch", async () => { called = true; });

  await assert.rejects(
    requestWebsiteCms({ method: "GET", contentType: "pages" }),
    (error) => error.statusCode === 503 && error.expose === true,
  );
  assert.equal(called, false);
});

test("CMS provider does not expose upstream response details", async (t) => {
  configureProvider(t);
  t.mock.method(globalThis, "fetch", async () => jsonResponse({ error: "private provider detail" }, 500));

  await assert.rejects(
    requestWebsiteCms({ method: "GET", contentType: "pages" }),
    (error) => error.statusCode === 502 &&
      error.expose === true &&
      !error.message.includes("private provider detail"),
  );
});
