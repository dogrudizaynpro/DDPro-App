import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeConversationPayload,
  normalizeMessagePayload,
} from "../src/services/messages.service.js";

const projectId = "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0";
const contactId = "90d3ca41-5120-45b8-91d4-80f006622b1b";

test("conversation payload validates title and project/customer references", () => {
  assert.deepEqual(normalizeConversationPayload({
    title: "Site koordinasyonu",
    projectId,
    crmContactId: contactId,
  }), {
    title: "Site koordinasyonu",
    project_id: projectId,
    crm_contact_id: contactId,
  });
  assert.throws(() => normalizeConversationPayload({ title: "" }), /title is required/);
  assert.throws(() => normalizeConversationPayload({ title: "İş", project_id: "invalid" }), /valid UUID/);
});

test("message payload rejects empty/oversized body and validates direction", () => {
  assert.deepEqual(normalizeMessagePayload({ content: " Merhaba ", direction: "INBOUND" }), {
    content: "Merhaba",
    direction: "INBOUND",
  });
  assert.throws(() => normalizeMessagePayload({ content: "  " }), /content is required/);
  assert.throws(() => normalizeMessagePayload({ content: "Hello", direction: "SYSTEM" }), /direction must be/);
  assert.throws(() => normalizeMessagePayload({ content: "x".repeat(10_001) }), /at most 10000/);
});
