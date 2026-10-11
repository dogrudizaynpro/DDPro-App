import assert from "node:assert/strict";
import { test } from "node:test";
import { searchResearchProvider } from "../src/services/research-provider.service.js";

const mockProvider = (t, fetchMock, { apiKey = "test-key" } = {}) => {
  const previousApiKey = process.env.RESEARCH_API_KEY;
  const previousApiUrl = process.env.RESEARCH_API_URL;
  if (apiKey === null) {
    delete process.env.RESEARCH_API_KEY;
  } else {
    process.env.RESEARCH_API_KEY = apiKey;
  }
  t.mock.method(globalThis, "fetch", fetchMock);
  t.after(() => {
    if (previousApiKey === undefined) delete process.env.RESEARCH_API_KEY;
    else process.env.RESEARCH_API_KEY = previousApiKey;
    if (previousApiUrl === undefined) delete process.env.RESEARCH_API_URL;
    else process.env.RESEARCH_API_URL = previousApiUrl;
  });
};

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

test("sends a Tavily search request and converts results to the DDPro format", async (t) => {
  let request;
  const content = "x".repeat(4_100);
  mockProvider(t, async (url, options) => {
    request = { url: String(url), ...options, body: JSON.parse(options.body) };
    return jsonResponse({
      results: [{
        title: "T".repeat(310),
        url: "https://supplier.example/product",
        content,
        score: 0.97,
      }],
      answer: "Ignored provider answer",
    });
  });

  const [result] = await searchResearchProvider("aluminum profile");

  assert.equal(request.url, "https://api.tavily.com/search");
  assert.equal(request.method, "POST");
  assert.equal(request.headers["Content-Type"], "application/json");
  assert.deepEqual(request.body, {
    api_key: "test-key",
    query: "aluminum profile",
    include_answer: true,
    max_results: 10,
  });
  assert.equal(result.source, content.slice(0, 300));
  assert.equal(result.product, "T".repeat(300));
  assert.equal(result.manufacturer, "");
  assert.equal(result.technicalInfo, content.slice(0, 4_000));
  assert.equal(result.price, "");
  assert.equal(result.priceVerification, "Doğrulanmadı");
  assert.equal(result.url, "https://supplier.example/product");
  assert.equal(Number.isNaN(Date.parse(result.date)), false);
  assert.equal(result.status, "Harici sonuç · kullanıcı doğrulaması bekliyor");
});

test("handles missing and null result fields without inventing data", async (t) => {
  mockProvider(t, async () => jsonResponse({
    results: [
      null,
      { title: null, content: null, url: "https://supplier.example/item", manufacturer: "Unsupported", price: "100" },
    ],
  }));

  const results = await searchResearchProvider("query");

  assert.equal(results.length, 1);
  assert.deepEqual(
    Object.fromEntries(Object.entries(results[0]).filter(([key]) => key !== "date" && key !== "status")),
    {
      source: "",
      product: "",
      manufacturer: "",
      technicalInfo: "",
      price: "",
      priceVerification: "Doğrulanmadı",
      url: "https://supplier.example/item",
    }
  );
});

test("leaves price empty when a source does not provide a price field", async (t) => {
  mockProvider(t, async () => jsonResponse({
    results: [{
      title: "Product without price",
      content: "Technical details only",
      url: "https://supplier.example/item",
    }],
  }));

  const [result] = await searchResearchProvider("query");

  assert.equal(result.price, "");
  assert.equal(result.priceVerification, "Doğrulanmadı");
});

test("filters results with invalid or non-HTTP URLs", async (t) => {
  mockProvider(t, async () => jsonResponse({
    results: [
      { title: "Valid", url: "https://supplier.example/item" },
      { title: "Missing", url: null },
      { title: "Unsupported protocol", url: "javascript:alert(1)" },
      { title: "Invalid URL", url: "https://?bad" },
    ],
  }));

  const results = await searchResearchProvider("query");

  assert.deepEqual(results.map((result) => result.product), ["Valid"]);
});

test("rejects Tavily responses without a results array", async (t) => {
  mockProvider(t, async () => jsonResponse({ answer: "No results" }));

  await assert.rejects(searchResearchProvider("query"), (error) =>
    error.statusCode === 502 && error.expose === true && /results array/.test(error.message)
  );
});

test("returns 503 without an API key and does not call Tavily", async (t) => {
  let called = false;
  mockProvider(t, async () => { called = true; }, { apiKey: null });

  await assert.rejects(searchResearchProvider("query"), (error) =>
    error.statusCode === 503 && error.expose === true
  );
  assert.equal(called, false);
});

test("uses a 30-second timeout and safely reports an aborted request", async (t) => {
  let timeoutController;
  t.mock.method(AbortSignal, "timeout", (milliseconds) => {
    assert.equal(milliseconds, 30_000);
    timeoutController = new AbortController();
    return timeoutController.signal;
  });
  mockProvider(t, async (_url, options) => {
    assert.equal(options.signal, timeoutController.signal);
    timeoutController.abort();
    throw options.signal.reason;
  });

  await assert.rejects(searchResearchProvider("query"), (error) =>
    error.statusCode === 504 &&
    error.expose === true &&
    error.message === "Research provider request timed out." &&
    !error.message.includes("test-key")
  );
});

test("always sends requests to the configured HTTPS Tavily endpoint", async (t) => {
  let requestUrl;
  mockProvider(t, async (url) => {
    requestUrl = String(url);
    return jsonResponse({ results: [] });
  });
  process.env.RESEARCH_API_URL = "http://untrusted.example/search";

  await searchResearchProvider("query");

  assert.equal(new URL(requestUrl).protocol, "https:");
  assert.equal(requestUrl, "https://api.tavily.com/search");
});

test("does not expose Tavily error response details", async (t) => {
  mockProvider(t, async () => jsonResponse({ error: "test-key must not be disclosed" }, 500));

  await assert.rejects(searchResearchProvider("query"), (error) =>
    error.statusCode === 502 &&
    error.expose === true &&
    !error.message.includes("test-key")
  );
});
