import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AI_AGENT_REGISTRY,
  getAiAgentIdForResource,
  planAiAgents,
} from "../src/services/ai-agent-registry.service.js";

test("central registry maps every supported operational resource to one specialist", () => {
  const expected = {
    project: ["projects"],
    crm: ["customers"],
    pricing: ["price-analysis", "material-analysis", "products", "systems"],
    offers: ["offers"],
    procurement: ["procurement"],
    reporting: ["reports"],
    calendar: ["calendar"],
  };

  assert.deepEqual(
    Object.fromEntries(AI_AGENT_REGISTRY.map(({ id, resources }) => [id, [...resources]])),
    expected
  );
  for (const [agentId, resources] of Object.entries(expected)) {
    for (const resource of resources) {
      assert.equal(getAiAgentIdForResource(resource), agentId);
    }
  }
  assert.equal(getAiAgentIdForResource("unregistered-resource"), null);
});

test("central router plans matching specialists and retains the research route", () => {
  assert.deepEqual(
    planAiAgents({ message: "Projelerimi ve müşterilerimi listele." }).map(({ id }) => id),
    ["project", "crm"]
  );
  assert.deepEqual(
    planAiAgents({ message: "Tekliflerimi ve maliyetlerimi incele." }).map(({ id }) => id),
    ["pricing", "offers"]
  );
  assert.deepEqual(
    planAiAgents({ message: "Takvim etkinliklerimi göster." }).map(({ id }) => id),
    ["calendar"]
  );
  assert.deepEqual(
    planAiAgents({ message: "İnternette ürün araştır.", intent: "web_research" }).map(({ id }) => id),
    ["research"]
  );
});
