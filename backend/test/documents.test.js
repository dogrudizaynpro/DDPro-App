import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDocumentUpload } from "../src/services/documents.service.js";

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
