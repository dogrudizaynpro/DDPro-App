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

test("filters off-topic results and deduplicates direct source URLs", async (t) => {
  mockProvider(t, async () => jsonResponse({
    results: [
      {
        title: "Alüminyum lineer asma tavan sistemleri",
        content: "Türkiye'de lineer alüminyum tavan uygulamaları.",
        url: "https://supplier.example/ceiling?utm_source=search",
      },
      {
        title: "Alüminyum lineer asma tavan sistemleri kopya",
        content: "Aynı kaynak, farklı takip parametresi.",
        url: "https://supplier.example/ceiling#details",
      },
      {
        title: "Türkiye'deki güneş paneli üreticileri",
        content: "Güneş paneli ve enerji sistemleri.",
        url: "https://supplier.example/solar",
      },
    ],
  }));

  const results = await searchResearchProvider(
    "Türkiye’deki alüminyum lineer asma tavan üreticilerini araştır. En az 3 sonuç ve her biri için doğrudan kaynak bağlantısı göster.",
  );

  assert.equal(results.length, 1);
  assert.equal(results[0].url, "https://supplier.example/ceiling?utm_source=search");
  assert.equal(results[0].manufacturer, "");
  assert.equal(results[0].price, "");
});

test("ranks relevant results and returns only short query-related summaries", async (t) => {
  mockProvider(t, async () => jsonResponse({
    results: [
      {
        title: "Asma tavan uygulamaları",
        content: "Asma tavan hizmetleri için ürün seçenekleri sunulur. Gençlik kampları hakkında bilgiler.",
        url: "https://supplier.example/ceiling",
        score: 0.7,
      },
      {
        title: "Alakasız gençlik kampları",
        content: "Gençlik kampları, yaz etkinlikleri ve konaklama seçenekleri.",
        url: "https://supplier.example/camps",
        score: 1,
      },
      {
        title: "Asma tavan hizmetleri ve çözümleri",
        content: `Asma tavan hizmetleri için doğrudan ürün seçenekleri. Alakasız metin ${"uzun ".repeat(150)}`,
        url: "https://supplier.example/ceiling?utm_source=search",
        score: 0.5,
      },
      {
        title: "Acrobat hizmetleri",
        content: "Adobe Acrobat PDF araçları ve belge düzenleme.",
        url: "https://supplier.example/acrobat",
        score: 0.99,
      },
    ],
  }));

  const results = await searchResearchProvider("asma tavan hizmetleri");

  assert.deepEqual(results.map(({ url }) => url), [
    "https://supplier.example/ceiling?utm_source=search",
  ]);
  assert.match(results[0].source, /Asma tavan hizmetleri/);
  assert.doesNotMatch(results[0].source, /Gençlik kampları|Alakasız metin/);
  assert.ok(results[0].source.length <= 500);
  assert.equal(results[0].technicalInfo, "");
});

test("returns no result when provider pages do not support the requested topic", async (t) => {
  mockProvider(t, async () => jsonResponse({
    results: [
      {
        title: "KVKK ve kişisel verilerin korunması",
        content: "Kişisel veriler ve açık rıza hakkında.",
        url: "https://www.ddizaynpro.com/kvkk",
      },
      {
        title: "Gençlik kampları",
        content: "Kamp alanları, konaklama ve gençlik faaliyetleri.",
        url: "https://www.ddizaynpro.com/kamplar",
      },
      {
        title: "Adobe Acrobat",
        content: "PDF belgelerini oluşturma ve düzenleme.",
        url: "https://www.ddizaynpro.com/acrob",
      },
    ],
  }));

  assert.deepEqual(
    await searchResearchProvider("asma tavan hizmetleri", { siteOnly: true }),
    [],
  );
});

test("sends a concise Tavily search request and converts results to the DDPro format", async (t) => {
  let request;
  const content = `aluminum profile ${"x".repeat(4_100)}`;
  mockProvider(t, async (url, options) => {
    request = { url: String(url), ...options, body: JSON.parse(options.body) };
    return jsonResponse({
      results: [{
        title: `Aluminum profile ${"T".repeat(310)}`,
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
    include_answer: false,
    max_results: 10,
  });
  assert.ok(result.source.length <= 500);
  assert.equal(result.product, `Aluminum profile ${"T".repeat(310)}`.slice(0, 200));
  assert.equal(result.manufacturer, "");
  assert.equal(result.technicalInfo, "");
  assert.equal(result.price, "");
  assert.equal(result.priceVerification, "Doğrulanmadı");
  assert.equal(result.url, "https://supplier.example/product");
  assert.equal(Number.isNaN(Date.parse(result.date)), false);
  assert.equal(result.status, "Harici sonuç · kullanıcı doğrulaması bekliyor");
});

test("site-scoped searches use Tavily with an exact DDPro host filter and accept only safe page URLs", async (t) => {
  let request;
  mockProvider(t, async (url, options) => {
    request = { url: String(url), body: JSON.parse(options.body) };
    return jsonResponse({
      results: [
        {
          title: "Hizmetlerimiz",
          content: "Doğru Dizayn Pro asma tavan uygulamaları.",
          url: "https://www.ddizaynpro.com/hizmetler/",
          published_date: "2026-04-12",
        },
        {
          title: "Apex hostname",
          content: "Doğru Dizayn Pro hizmetleri.",
          url: "https://ddizaynpro.com/hizmetler",
        },
        {
          title: "Lookalike hostname",
          content: "Not DDPro.",
          url: "https://www.ddizaynpro.com.attacker.example/hizmetler",
        },
        {
          title: "Credentials",
          content: "Not DDPro.",
          url: "https://user@www.ddizaynpro.com/hizmetler",
        },
        {
          title: "Nonstandard port",
          content: "Not DDPro.",
          url: "https://www.ddizaynpro.com:8443/hizmetler",
        },
        {
          title: "Other website",
          content: "Not DDPro.",
          url: "https://supplier.example/hizmetler",
        },
        {
          title: "KVKK aydınlatma metni",
          content: "KVKK ve kişisel verilerin korunması hakkında bilgi.",
          url: "https://www.ddizaynpro.com/kvkk",
        },
      ],
    });
  });

  const results = await searchResearchProvider(
    "Doğru Dizayn Pro hangi hizmetleri sunuyor?",
    { siteOnly: true },
  );

  assert.equal(request.url, "https://api.tavily.com/search");
  assert.equal(request.body.query,
    "site:ddizaynpro.com Doğru Dizayn Pro hangi hizmetleri sunuyor?");
  assert.deepEqual(results.map(({ url }) => url), [
    "https://www.ddizaynpro.com/hizmetler/",
    "https://ddizaynpro.com/hizmetler",
  ]);
  assert.equal(results[0].date, "2026-04-12T00:00:00.000Z");
});

test("handles missing and null result fields without inventing data", async (t) => {
  mockProvider(t, async () => jsonResponse({
    results: [
      null,
      {
        title: null,
        content: "aluminum profile technical data",
        url: "https://supplier.example/item",
        manufacturer: "Unsupported",
        price: "100",
      },
    ],
  }));

  const results = await searchResearchProvider("aluminum profile");

  assert.equal(results.length, 1);
  assert.deepEqual(
    Object.fromEntries(Object.entries(results[0]).filter(([key]) => !["date", "status"].includes(key))),
    {
      source: "aluminum profile technical data",
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

  const [result] = await searchResearchProvider("product without price");

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
      { title: "Embedded credentials", url: "https://user@supplier.example/item" },
    ],
  }));

  const results = await searchResearchProvider("valid");

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
