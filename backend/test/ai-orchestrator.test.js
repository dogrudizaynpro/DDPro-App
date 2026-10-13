import assert from "node:assert/strict";
import { test } from "node:test";
import {
  classifyAiCommand,
  createAiOrchestrator,
} from "../src/services/ai-orchestrator.service.js";

const authenticatedCommand = {
  integrationAccount: "authorized@example.com",
  context: {},
};

test("written AI commands route company data as read-only through the existing completion handler", async () => {
  let received;
  const orchestrate = createAiOrchestrator({
    complete: async (command) => {
      received = command;
      return { answer: "Projeler API'sinden alınan kayıtlar." };
    },
  });

  const result = await orchestrate({
    ...authenticatedCommand,
    message: "Aktif projelerimi listele.",
  });

  assert.equal(received.message, "Aktif projelerimi listele.");
  assert.equal(received.integrationAccount, authenticatedCommand.integrationAccount);
  assert.equal(received.toolPolicy, "read");
  assert.match(received.taskContext.id, /^[\da-f-]{36}$/i);
  assert.equal(result.orchestration.intent, "company_data");
  assert.equal(result.orchestration.status, "completed");
  assert.equal(result.answer, "Projeler API'sinden alınan kayıtlar.");
});

test("direct answers do not advertise operational tools", async () => {
  let received;
  let researchCalled = false;
  const orchestrate = createAiOrchestrator({
    complete: async (command) => {
      received = command;
      return { answer: "Açıklama." };
    },
    search: async () => { researchCalled = true; return []; },
  });

  const result = await orchestrate({
    ...authenticatedCommand,
    message: "Bir tasarım sunumunda hangi bölümler bulunur?",
  });

  assert.equal(received.toolPolicy, "none");
  assert.equal(result.orchestration.intent, "direct_answer");
  assert.equal(researchCalled, false);
});

test("DDPro company questions research only the public website and preserve dated source links", async () => {
  let receivedQuery;
  let searchOptions;
  let completionCalled = false;
  const orchestrate = createAiOrchestrator({
    complete: async () => { completionCalled = true; return { answer: "unexpected" }; },
    search: async (query, options) => {
      receivedQuery = query;
      searchOptions = options;
      return [{
        product: "Hizmetlerimiz",
        source: "Asma tavan çözümleri.",
        technicalInfo: "Doğru Dizayn Pro asma tavan uygulamaları sunar.",
        price: "900 TL",
        date: "2026-04-12T00:00:00.000Z",
        url: "https://www.ddizaynpro.com/hizmetler",
      }];
    },
  });

  const result = await orchestrate({
    ...authenticatedCommand,
    message: "Doğru Dizayn Pro hangi hizmetleri sunuyor?",
  });

  assert.equal(receivedQuery, "Doğru Dizayn Pro hangi hizmetleri sunuyor?");
  assert.equal(searchOptions.siteOnly, true);
  assert.equal(completionCalled, false);
  assert.equal(result.orchestration.intent, "site_research");
  assert.match(result.answer, /yalnızca www\.ddizaynpro\.com/);
  assert.match(result.answer, /Doğru Dizayn Pro asma tavan uygulamaları sunar/);
  assert.match(result.answer, /Sayfa tarihi: 2026-04-12T00:00:00\.000Z/);
  assert.match(result.answer, /https:\/\/www\.ddizaynpro\.com\/hizmetler/);
  assert.doesNotMatch(result.answer, /900 TL/);
  assert.equal(result.researchResults[0].url, "https://www.ddizaynpro.com/hizmetler");
  assert.equal(result.researchResults[0].price, "");
});

test("site research rejects non-DDPro URLs even if a provider returns them", async () => {
  const orchestrate = createAiOrchestrator({
    search: async () => [
      {
        product: "Valid page",
        technicalInfo: "DDPro page summary.",
        url: "https://www.ddizaynpro.com/hizmetler",
      },
      {
        product: "Lookalike host",
        technicalInfo: "Must not be used.",
        url: "https://www.ddizaynpro.com.attacker.example/page",
      },
      {
        product: "Private address",
        technicalInfo: "Must not be used.",
        url: "http://127.0.0.1/internal",
      },
    ],
  });

  const result = await orchestrate({
    ...authenticatedCommand,
    message: "Doğru Dizayn Pro hizmetleri",
  });

  assert.deepEqual(result.researchResults.map(({ url }) => url), [
    "https://www.ddizaynpro.com/hizmetler",
  ]);
  assert.match(result.answer, /Valid page/);
  assert.doesNotMatch(result.answer, /Lookalike host|Private address|Must not be used/);
});

test("DDPro website research reports empty and unavailable sources without inventing answers", async () => {
  const empty = createAiOrchestrator({ search: async () => [] });
  const emptyResult = await empty({
    ...authenticatedCommand,
    message: "Doğru Dizayn Pro referansları",
  });
  assert.match(emptyResult.answer, /bulunamadı veya site araştırması yapılamadı/);
  assert.match(emptyResult.answer, /bilgi uydurulmadı/);
  assert.deepEqual(emptyResult.researchResults, []);

  const unavailable = createAiOrchestrator({
    search: async () => { throw new Error("private provider response"); },
  });
  await assert.rejects(
    unavailable({
      ...authenticatedCommand,
      message: "Doğru Dizayn Pro projeleri",
    }),
    (error) => {
      assert.equal(error.code, "AI_ORCHESTRATOR_RESEARCH_FAILED");
      assert.match(error.message, /web sitesi şu anda araştırılamıyor/);
      assert.doesNotMatch(error.message, /private provider response/);
      return true;
    }
  );
});

test("web research routes only to the configured research adapter and marks sources unverified", async () => {
  let query;
  let searchContext;
  let completionCalled = false;
  const orchestrate = createAiOrchestrator({
    complete: async () => {
      completionCalled = true;
      return { answer: "unexpected" };
    },
    search: async (value, context) => {
      query = value;
      searchContext = context;
      return [{
        product: "Alüminyum profil",
        manufacturer: "Üretici",
        technicalInfo: "Teknik bilgi",
        price: "100",
        url: "https://supplier.example/item",
      }];
    },
  });

  const result = await orchestrate({
    ...authenticatedCommand,
    message: "İnternette alüminyum profil araştır.",
  });

  assert.equal(query, "alüminyum profil");
  assert.equal(completionCalled, false);
  assert.equal(searchContext.integrationAccount, authenticatedCommand.integrationAccount);
  assert.equal(searchContext.taskContext.intent, "web_research");
  assert.match(searchContext.taskContext.id, /^[\da-f-]{36}$/i);
  assert.equal(result.orchestration.intent, "web_research");
  assert.match(result.answer, /Firma üreticiliği DDPro tarafından bağımsız doğrulanmamıştır/);
  assert.match(result.answer, /Fiyat \(doğrulanmadı\): 100/);
  assert.match(result.answer, /Doğrudan kaynak URL'si: https:\/\/supplier\.example\/item/);
  assert.doesNotMatch(result.answer, /Üretici/);
});

test("research output excludes malformed, duplicate, and URL-less provider results", async () => {
  const orchestrate = createAiOrchestrator({
    search: async () => [
      { product: "No direct URL", technicalInfo: "Unverified", url: "" },
      {
        product: "",
        source: "",
        technicalInfo: "",
        url: "https://supplier.example/empty",
      },
      {
        product: "Source result",
        technicalInfo: "Source details",
        url: "https://supplier.example/item?utm_source=one",
      },
      {
        product: "Duplicate result",
        technicalInfo: "Duplicate details",
        url: "https://supplier.example/item#details",
      },
      { product: "Invalid protocol", technicalInfo: "Details", url: "javascript:alert(1)" },
    ],
  });

  const result = await orchestrate({
    ...authenticatedCommand,
    message: "İnternette alüminyum profil araştır.",
  });

  assert.match(result.answer, /Source result/);
  assert.match(result.answer, /https:\/\/supplier\.example\/item\?utm_source=one/);
  assert.doesNotMatch(result.answer, /No direct URL|No content|Duplicate result|Invalid protocol/);
  assert.equal(result.researchResults.length, 1);
});

test("empty or wholly invalid research results report that research was not possible", async () => {
  for (const search of [
    async () => [],
    async () => [{ product: "Unsupported company", manufacturer: "Verified manufacturer" }],
  ]) {
    const orchestrate = createAiOrchestrator({ search });
    const result = await orchestrate({
      ...authenticatedCommand,
      message: "İnternette asma tavan üreticisi araştır.",
    });

    assert.match(result.answer, /Araştırma yapılamadı/);
    assert.doesNotMatch(result.answer, /Unsupported company|Verified manufacturer|bağlı|entegrasyon durumu/i);
    assert.deepEqual(result.researchResults, []);
  }
});

test("missing, overlong, combined, and unsupported commands fail without invoking capabilities", async () => {
  let calls = 0;
  const orchestrate = createAiOrchestrator({
    complete: async () => { calls += 1; return { answer: "unexpected" }; },
    search: async () => { calls += 1; return []; },
  });

  for (const [command, expectedCode, expectedStatus] of [
    ["", "AI_ORCHESTRATOR_COMMAND_REQUIRED", 400],
    ["Araştır.", "AI_ORCHESTRATOR_MISSING_RESEARCH_QUERY", 400],
    ["x".repeat(8_001), "AI_ORCHESTRATOR_COMMAND_TOO_LONG", 400],
    ["Araştır ve projeyi sil.", "AI_ORCHESTRATOR_UNSUPPORTED_COMBINATION", 422],
    ["Gmail'den müşteriye e-posta gönder.", "AI_ORCHESTRATOR_UNSUPPORTED_ACTION", 422],
  ]) {
    await assert.rejects(
      orchestrate({ ...authenticatedCommand, message: command }),
      (error) => error.code === expectedCode && error.statusCode === expectedStatus
    );
  }
  assert.equal(calls, 0);
});

test("unauthorized commands cannot invoke research or company capabilities", async () => {
  let calls = 0;
  const orchestrate = createAiOrchestrator({
    complete: async () => { calls += 1; return { answer: "unexpected" }; },
    search: async () => { calls += 1; return []; },
  });

  await assert.rejects(
    orchestrate({ message: "Projelerimi listele.", context: {} }),
    (error) => error.code === "AI_ORCHESTRATOR_UNAUTHORIZED" && error.statusCode === 401
  );
  assert.equal(calls, 0);
});

test("capability failures and invalid results are never returned as successful answers", async () => {
  const failedResearch = createAiOrchestrator({
    search: async () => { throw new Error("provider details"); },
  });
  await assert.rejects(
    failedResearch({ ...authenticatedCommand, message: "İnternette profil araştır." }),
    (error) => error.code === "AI_ORCHESTRATOR_RESEARCH_FAILED" &&
      error.statusCode === 502 &&
      !/provider details/.test(error.message)
  );

  const failedCompletion = createAiOrchestrator({
    complete: async () => { throw new Error("provider details"); },
  });
  await assert.rejects(
    failedCompletion({ ...authenticatedCommand, message: "Genel bilgi ver." }),
    (error) => error.code === "AI_ORCHESTRATOR_EXECUTION_FAILED" &&
      !/provider details/.test(error.message)
  );

  const invalidResult = createAiOrchestrator({ complete: async () => ({ answer: " " }) });
  await assert.rejects(
    invalidResult({ ...authenticatedCommand, message: "Genel bilgi ver." }),
    { code: "AI_ORCHESTRATOR_INVALID_RESULT" }
  );
});

test("write commands retain the existing prepare_write and explicit confirmation path", async () => {
  let received;
  const orchestrate = createAiOrchestrator({
    complete: async (command) => {
      received = command;
      return {
        answer: "İşlem henüz yapılmadı; onayınızı bekliyor.",
        pendingAction: { id: "confirmation-id" },
      };
    },
  });

  const result = await orchestrate({
    ...authenticatedCommand,
    message: "Projeye yeni kayıt ekle.",
  });

  assert.equal(received.toolPolicy, "all");
  assert.equal(result.pendingAction.id, "confirmation-id");
  assert.equal(result.orchestration.intent, "operational_write");
});

test("command classifier never routes arbitrary text to unregistered research", () => {
  assert.deepEqual(classifyAiCommand({ message: "Referanslarımız nelerdir?" }), {
    intent: "site_research",
    query: "Referanslarımız nelerdir?",
  });
  assert.deepEqual(classifyAiCommand({ message: "Merhaba." }), {
    intent: "direct_answer",
    toolPolicy: "none",
  });
  assert.deepEqual(classifyAiCommand({ message: "Bu dosyayı incele.", attachment: {} }), {
    intent: "attachment_analysis",
    toolPolicy: "all",
  });
});
