import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deleteDocument,
  normalizeDocumentUpload,
} from "../src/services/documents.service.js";

const projectId = "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0";
const pdf = Buffer.from("%PDF-1.7\nsample");

test("document upload validates supported file signatures, size, name, and relations", () => {
  assert.deepEqual(normalizeDocumentUpload({
    originalName: "C:\\fakepath\\invoice.pdf",
    contentType: "application/pdf",
    projectId,
    buffer: pdf,
  }), {
    original_name: "invoice.pdf",
    content_type: "application/pdf",
    project_id: projectId,
    crm_contact_id: null,
    project_asset_type: "document",
    file_size: pdf.length,
  });
});

const createDeleteClient = ({ deleteError, removeError } = {}) => {
  const calls = [];
  const record = {
    storage_key: "document.pdf",
    content_type: "application/pdf",
  };
  const client = {
    from: () => {
      let operation = "select";
      const query = {
        select() { return this; },
        delete() { operation = "delete"; return this; },
        eq() { return this; },
        maybeSingle: async () => operation === "select"
          ? { data: record, error: null }
          : { data: null, error: deleteError },
      };
      return query;
    },
    storage: {
      from: () => ({
        download: async (key) => {
          calls.push(["download", key]);
          return { data: new Blob([pdf], { type: "application/pdf" }), error: null };
        },
        remove: async ([key]) => {
          calls.push(["remove", key]);
          return { error: removeError };
        },
        upload: async (key, body, options) => {
          calls.push(["upload", key, Buffer.from(body), options]);
          return { error: null };
        },
      }),
    },
  };
  return { client, calls };
};

test("document delete restores its private object when metadata deletion fails", async () => {
  const databaseError = new Error("database unavailable");
  const { client, calls } = createDeleteClient({ deleteError: databaseError });

  await assert.rejects(deleteDocument("owner@example.com", projectId, client), databaseError);
  assert.deepEqual(calls.map(([operation]) => operation), ["download", "remove", "upload"]);
  assert.deepEqual(calls[2], [
    "upload",
    "document.pdf",
    pdf,
    { contentType: "application/pdf", upsert: true },
  ]);
});

test("document delete keeps its metadata and object when storage removal fails", async () => {
  const storageError = new Error("storage unavailable");
  const { client, calls } = createDeleteClient({ removeError: storageError });

  await assert.rejects(deleteDocument("owner@example.com", projectId, client), storageError);
  assert.deepEqual(calls.map(([operation]) => operation), ["download", "remove"]);
});

test("document delete reports unrecoverable object restoration failure explicitly", async () => {
  const { client } = createDeleteClient({ deleteError: new Error("database unavailable") });
  client.storage.from = () => ({
    download: async () => ({ data: new Blob([pdf], { type: "application/pdf" }), error: null }),
    remove: async () => ({ error: null }),
    upload: async () => ({ error: new Error("storage unavailable") }),
  });

  await assert.rejects(
    deleteDocument("owner@example.com", projectId, client),
    (error) => error.code === "DOCUMENT_DELETE_RECOVERY_FAILED" && error.statusCode === 503
  );
});

test("document upload supports genuine WebP images for project galleries", () => {
  const webp = Buffer.alloc(20);
  webp.write("RIFF", 0, "ascii");
  webp.writeUInt32LE(webp.length - 8, 4);
  webp.write("WEBPVP8 ", 8, "ascii");
  webp.writeUInt32LE(0, 16);
  const metadata = normalizeDocumentUpload({
    originalName: "site.webp",
    contentType: "image/webp",
    projectId,
    projectAssetType: "progress",
    buffer: webp,
  });
  assert.equal(metadata.project_asset_type, "progress");
  assert.throws(() => normalizeDocumentUpload({
    originalName: "site.webp",
    contentType: "image/webp",
    projectId,
    projectAssetType: "before",
    buffer: Buffer.from("not an image"),
  }), /contents do not match/);
  assert.throws(() => normalizeDocumentUpload({
    originalName: "invoice.pdf",
    contentType: "application/pdf",
    projectId,
    projectAssetType: "completed",
    buffer: pdf,
  }), /invalid for this file/);
});

test("document upload rejects unsafe names, unsupported types, invalid relations, and oversized files", () => {
  assert.throws(() => normalizeDocumentUpload({
    originalName: "../invoice.pdf",
    contentType: "application/pdf",
    buffer: Buffer.from("not a pdf"),
  }), /contents do not match/);
  assert.throws(() => normalizeDocumentUpload({
    originalName: "invoice.exe",
    contentType: "application/octet-stream",
    buffer: pdf,
  }), /type is not supported/);
  assert.throws(() => normalizeDocumentUpload({
    originalName: "invoice.pdf",
    contentType: "application/pdf",
    projectId: "invalid",
    buffer: pdf,
  }), /valid UUID/);
  assert.throws(() => normalizeDocumentUpload({
    originalName: "invoice.pdf",
    contentType: "application/pdf",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  }), /between 1 byte and 10 MB/);
});
