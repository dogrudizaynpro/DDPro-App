import assert from "node:assert/strict";
import { test } from "node:test";
import { createProjectAiAnalysesController } from "../src/controllers/project-ai-analyses.controller.js";

const projectId = "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0";
const requestId = "c6bb5b55-a0e3-4e84-b471-bc52765575e1";
const ownerAccount = "owner@example.com";

const createDatabase = () => {
  const tables = {
    projects: [{
      id: projectId,
      name: "İstanbul Ofis",
      project_type: "Ofis",
      status: "Aktif",
      area_m2: 120,
      systems: ["Cephe"],
    }],
    project_ai_analyses: [],
  };

  const execute = (query) => {
    const rows = tables[query.table];
    if (query.operation === "insert") {
      const duplicate = rows.some((row) =>
        row.owner_account === query.payload.owner_account &&
        row.request_id === query.payload.request_id
      );
      if (duplicate) return { data: null, error: { code: "23505" } };
      const record = {
        id: `analysis-${rows.length + 1}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...query.payload,
      };
      rows.push(record);
      return { data: record, error: null };
    }

    const matches = (row) => query.filters.every(([field, value, operator]) =>
      operator === "is" ? row[field] === value : row[field] === value
    );
    const matched = rows.filter(matches);
    if (query.operation === "update") {
      for (const row of matched) Object.assign(row, query.payload);
    }
    const result = query.operation === "update" ? matched : matched;
    const selected = query.columns === "*" || !query.columns
      ? result
      : result.map((row) => Object.fromEntries(
        query.columns.split(",").map((column) => [column, row[column]])
      ));
    return { data: query.single ? selected[0] || null : selected, error: null };
  };

  return {
    tables,
    from(table) {
      const query = { table, operation: "select", filters: [], columns: "*" };
      const builder = {
        select(columns = "*") {
          query.columns = columns;
          return builder;
        },
        insert(payload) {
          query.operation = "insert";
          query.payload = payload;
          return builder;
        },
        update(payload) {
          query.operation = "update";
          query.payload = payload;
          return builder;
        },
        eq(field, value) {
          query.filters.push([field, value, "eq"]);
          return builder;
        },
        is(field, value) {
          query.filters.push([field, value, "is"]);
          return builder;
        },
        order() { return builder; },
        limit() { return builder; },
        maybeSingle() {
          query.single = true;
          return execute(query);
        },
        then(resolve, reject) {
          return Promise.resolve(execute(query)).then(resolve, reject);
        },
      };
      return builder;
    },
  };
};

const invoke = async (handler, req) => {
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  let error;
  await handler(req, response, (nextError) => { error = nextError; });
  return { response, error };
};

test("project AI analyses persist across controller instances and replay duplicate request IDs", async () => {
  const database = createDatabase();
  let providerCalls = 0;
  const dependencies = {
    getAdmin: () => database,
    complete: async ({ context, readOnly }) => {
      providerCalls += 1;
      assert.equal(context.selectedProject.id, projectId);
      assert.equal(context.selectedProject.name, "İstanbul Ofis");
      assert.equal(readOnly, true);
      return { answer: "Kayıtlı analiz sonucu" };
    },
  };
  const firstController = createProjectAiAnalysesController(dependencies);
  const request = {
    params: { projectId },
    integrationAccount: ownerAccount,
    body: { command: "Proje risklerini analiz et", requestId },
  };
  const first = await invoke(firstController.createProjectAiAnalysis, request);
  assert.equal(first.response.statusCode, 200);
  assert.equal(first.response.body.data.result.answer, "Kayıtlı analiz sonucu");
  assert.equal(providerCalls, 1);

  const restartedController = createProjectAiAnalysesController(dependencies);
  const replay = await invoke(restartedController.createProjectAiAnalysis, request);
  assert.equal(replay.response.statusCode, 200);
  assert.equal(replay.response.body.replayed, true);
  assert.equal(replay.response.body.data.id, first.response.body.data.id);
  assert.equal(providerCalls, 1);

  const history = await invoke(restartedController.listProjectAiAnalyses, {
    params: { projectId },
    integrationAccount: ownerAccount,
  });
  assert.equal(history.response.body.data.length, 1);
  assert.equal(history.response.body.data[0].result.answer, "Kayıtlı analiz sonucu");
});

test("project AI analysis failure is recorded and the retained request ID can safely retry", async () => {
  const database = createDatabase();
  let providerCalls = 0;
  const controller = createProjectAiAnalysesController({
    getAdmin: () => database,
    complete: async () => {
      providerCalls += 1;
      if (providerCalls === 1) {
        throw Object.assign(new Error("AI provider timed out."), {
          statusCode: 502,
          code: "AI_PROVIDER_TIMEOUT",
          expose: true,
        });
      }
      return { answer: "Recovered analysis" };
    },
  });
  const req = {
    params: { projectId },
    integrationAccount: ownerAccount,
    body: { command: "Proje risklerini analiz et", requestId },
  };
  const failed = await invoke(controller.createProjectAiAnalysis, req);
  assert.equal(failed.error.code, "AI_PROVIDER_TIMEOUT");
  assert.equal(database.tables.project_ai_analyses[0].status, "failed");
  assert.equal(database.tables.project_ai_analyses[0].failure_code, "AI_PROVIDER_TIMEOUT");

  const retry = await invoke(controller.createProjectAiAnalysis, req);
  assert.equal(retry.response.body.data.result.answer, "Recovered analysis");
  assert.equal(providerCalls, 2);
});
