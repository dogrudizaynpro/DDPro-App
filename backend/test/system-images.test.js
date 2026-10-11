import assert from "node:assert/strict";
import { test } from "node:test";
import {
  deleteSystemImage,
  deleteSystemRecordWithImages,
  normalizeSystemImageUpload,
  uploadSystemImage,
} from "../src/services/system-images.service.js";

const systemId = "4bc6f5a6-0b6c-4ddb-b29b-208c84c344d0";
const imageId = "d8a1e2d1-6332-41a4-89a4-2c7fcf25c001";
const imageBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]);
const imageRecord = {
  id: imageId,
  system_id: systemId,
  owner_account: "owner@example.com",
  original_name: "system.png",
  content_type: "image/png",
  file_size: imageBuffer.length,
  storage_key: `${systemId}/stored.png`,
  updated_at: "2026-10-10T12:00:00.000Z",
};

const makeClient = ({ respond, storageOverrides = {} }) => {
  const calls = [];
  const client = {
    from(table) {
      let action = "select";
      let payload;
      const filters = {};
      const execute = async () => {
        calls.push(["query", table, action, { ...filters }, payload]);
        return respond(table, action, filters, payload);
      };
      const query = {
        select() { return this; },
        eq(name, value) { filters[name] = value; return this; },
        order() { return this; },
        insert(value) { action = "insert"; payload = value; return this; },
        update(value) { action = "update"; payload = value; return this; },
        delete() { action = "delete"; return this; },
        maybeSingle: execute,
        single: execute,
        then(resolve, reject) { return execute().then(resolve, reject); },
      };
      return query;
    },
    storage: {
      from(bucket) {
        return {
          upload: async (key, body, options) => {
            calls.push(["upload", bucket, key, Buffer.from(body), options]);
            return storageOverrides.upload
              ? storageOverrides.upload(key, body, options)
              : { error: null };
          },
          remove: async (keys) => {
            calls.push(["remove", bucket, keys]);
            return storageOverrides.remove
              ? storageOverrides.remove(keys)
              : { error: null };
          },
          download: async (key) => {
            calls.push(["download", bucket, key]);
            return storageOverrides.download
              ? storageOverrides.download(key)
              : { data: new Blob([imageBuffer], { type: "image/png" }), error: null };
          },
          createSignedUrl: async (key, expiresIn) => {
            calls.push(["signed-url", bucket, key, expiresIn]);
            return { data: { signedUrl: `https://storage.test/${key}` }, error: null };
          },
        };
      },
    },
  };
  return { client, calls };
};

test("system image uploads validate safe image signatures, extensions, and the 10 MB limit", () => {
  assert.deepEqual(normalizeSystemImageUpload({
    originalName: "C:\\fakepath\\system.png",
    contentType: "image/png",
    buffer: imageBuffer,
  }), {
    original_name: "system.png",
    content_type: "image/png",
    file_size: imageBuffer.length,
    extension: ".png",
  });
  assert.throws(() => normalizeSystemImageUpload({
    originalName: "system.svg",
    contentType: "image/svg+xml",
    buffer: imageBuffer,
  }), /JPEG, PNG ve WebP/);
  assert.throws(() => normalizeSystemImageUpload({
    originalName: "system.png",
    contentType: "image/png",
    buffer: Buffer.from("not an image"),
  }), /eşleşmiyor/);
  assert.throws(() => normalizeSystemImageUpload({
    originalName: "system.png",
    contentType: "image/png",
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  }), /10 MB/);
});

test("system image upload links the private object to its system and owning account", async () => {
  const { client, calls } = makeClient({
    respond: (table, action, _filters, payload) => {
      if (table === "systems") return { data: { id: systemId }, error: null };
      if (table === "system_images" && action === "insert") {
        return { data: { ...payload, id: imageId }, error: null };
      }
      throw new Error(`Unexpected query: ${table} ${action}`);
    },
  });

  const image = await uploadSystemImage("owner@example.com", systemId, {
    originalName: "system.png",
    contentType: "image/png",
    buffer: imageBuffer,
  }, client);

  assert.equal(image.system_id, systemId);
  assert.equal(image.owner_account, "owner@example.com");
  assert.match(image.storage_key, new RegExp(`^${systemId}/[\\da-f-]+\\.png$`));
  assert.match(image.preview_url, /^https:\/\/storage\.test\//);
  const insert = calls.find((call) => call[0] === "query" && call[1] === "system_images");
  assert.equal(insert[4].system_id, systemId);
  assert.equal(insert[4].owner_account, "owner@example.com");
  assert.equal(calls[0][1], "systems");
  assert.equal(calls.find((call) => call[0] === "upload")[1], "ddpro-system-images");
});

test("system image upload removes the stored object when its database insert fails", async () => {
  const databaseError = new Error("database unavailable");
  const { client, calls } = makeClient({
    respond: (table, action) => {
      if (table === "systems") return { data: { id: systemId }, error: null };
      if (table === "system_images" && action === "insert") return { data: null, error: databaseError };
      throw new Error(`Unexpected query: ${table} ${action}`);
    },
  });

  await assert.rejects(uploadSystemImage("owner@example.com", systemId, {
    originalName: "system.png",
    contentType: "image/png",
    buffer: imageBuffer,
  }, client), databaseError);
  assert.deepEqual(calls.filter(([action]) => ["upload", "remove"].includes(action))
    .map(([action]) => action), ["upload", "remove"]);
});

test("system image deletion is restricted to the system and account owning the record", async () => {
  const { client, calls } = makeClient({
    respond: (table, action) => {
      if (table === "system_images" && action === "select") return { data: null, error: null };
      throw new Error(`Unexpected query: ${table} ${action}`);
    },
  });

  assert.equal(await deleteSystemImage("other@example.com", systemId, imageId, client), false);
  assert.equal(calls.some(([action]) => action === "remove"), false);
});

test("system deletion restores private image files when the system database delete fails", async () => {
  const databaseError = new Error("database unavailable");
  const { client, calls } = makeClient({
    respond: (table, action) => {
      if (table === "systems" && action === "select") return { data: { id: systemId }, error: null };
      if (table === "system_images" && action === "select") return { data: [imageRecord], error: null };
      if (table === "systems" && action === "delete") return { data: null, error: databaseError };
      throw new Error(`Unexpected query: ${table} ${action}`);
    },
  });

  await assert.rejects(deleteSystemRecordWithImages(systemId, client), databaseError);
  assert.deepEqual(calls.filter(([action]) => ["download", "remove", "upload"].includes(action))
    .map(([action]) => action), ["download", "remove", "upload"]);
  assert.deepEqual(calls.find(([action]) => action === "upload").slice(2), [
    imageRecord.storage_key,
    imageBuffer,
    { contentType: imageRecord.content_type, upsert: true },
  ]);
});
