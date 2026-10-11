import { randomUUID } from "node:crypto";
import { getIntegrationAdmin } from "../config/integration-admin.js";

const BUCKET = "ddpro-documents";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const MIME_TYPES = new Map([
  [".pdf", "application/pdf"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".webp", "image/webp"],
  [".csv", "text/csv"],
  [".docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  [".xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
]);

const fail = (message, statusCode = 400) => Object.assign(new Error(message), {
  statusCode,
  expose: true,
});

const requireDatabase = () => {
  const client = getIntegrationAdmin();
  if (!client) throw fail("Documents database service-role configuration is required.", 503);
  return client;
};

const isWebp = (buffer) => {
  if (
    buffer.length < 20 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.readUInt32LE(4) !== buffer.length - 8 ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) return false;
  let offset = 12;
  let hasImageChunk = false;
  while (offset + 8 <= buffer.length) {
    const type = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + length + (length % 2);
    if (end > buffer.length) return false;
    if (["VP8 ", "VP8L", "VP8X"].includes(type)) hasImageChunk = true;
    offset = end;
  }
  return hasImageChunk && offset === buffer.length;
};

export const normalizeDocumentUpload = ({
  originalName,
  contentType,
  projectId,
  crmContactId,
  projectAssetType = "document",
  buffer,
}) => {
  const fileBuffer = Buffer.isBuffer(buffer) ? Buffer.from(buffer) : null;
  if (typeof originalName !== "string") throw fail("A document filename is required.");
  const name = originalName.split(/[\\/]/).pop().trim();
  if (!name || name.length > 255 || /[\u0000-\u001f\u007f]/.test(name)) throw fail("Document filename is invalid.");
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (MIME_TYPES.get(extension) !== contentType) throw fail("Document file type is not supported.");
  if (!fileBuffer || fileBuffer.length === 0 || fileBuffer.length > MAX_FILE_SIZE) {
    throw fail("Document must be between 1 byte and 10 MB.");
  }
  const signatureValid = extension === ".pdf"
    ? fileBuffer.subarray(0, 5).toString() === "%PDF-"
    : extension === ".png"
      ? fileBuffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : [".jpg", ".jpeg"].includes(extension)
        ? fileBuffer[0] === 0xff && fileBuffer[1] === 0xd8 && fileBuffer[2] === 0xff
        : extension === ".webp"
          ? isWebp(fileBuffer)
        : [".docx", ".xlsx"].includes(extension)
          ? fileBuffer[0] === 0x50 && fileBuffer[1] === 0x4b
          : !fileBuffer.includes(0);
  if (!signatureValid) throw fail("Document contents do not match the selected file type.");
  const assetType = ["document", "before", "progress", "completed"].includes(projectAssetType)
    ? projectAssetType
    : null;
  if (!assetType || (assetType !== "document" && !contentType.startsWith("image/"))) {
    throw fail("Project asset type is invalid for this file.");
  }
  const reference = (value, label) => {
    if (value === undefined || value === null || value === "") return null;
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw fail(`${label} reference must be a valid UUID.`);
    return value;
  };
  return {
    original_name: name,
    content_type: contentType,
    project_id: reference(projectId, "Project"),
    crm_contact_id: reference(crmContactId, "CRM contact"),
    project_asset_type: assetType,
    file_size: fileBuffer.length,
  };
};

export const listDocuments = async (ownerAccount) => {
  const { data, error } = await requireDatabase().from("document_records").select("*")
    .eq("owner_account", ownerAccount).order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
};

export const uploadDocument = async (ownerAccount, input) => {
  const client = requireDatabase();
  const payload = normalizeDocumentUpload(input);
  const id = randomUUID();
  const storageKey = `${id}${payload.original_name.slice(payload.original_name.lastIndexOf(".")).toLowerCase()}`;
  const { error: uploadError } = await client.storage.from(BUCKET).upload(storageKey, input.buffer, {
    contentType: payload.content_type,
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { data, error } = await client.from("document_records")
    .insert({ ...payload, id, storage_key: storageKey, owner_account: ownerAccount })
    .select("*").single();
  if (error) {
    await client.storage.from(BUCKET).remove([storageKey]).catch(() => {});
    throw error;
  }
  return data;
};

export const getDocumentDownload = async (ownerAccount, id, { preview = false } = {}) => {
  if (!UUID_PATTERN.test(id || "")) throw fail("Document id must be a valid UUID.");
  const client = requireDatabase();
  const { data: record, error } = await client.from("document_records").select("*")
    .eq("id", id).eq("owner_account", ownerAccount).maybeSingle();
  if (error) throw error;
  if (!record) return null;
  if (preview && !record.content_type.startsWith("image/")) {
    throw fail("Only project images can be previewed.");
  }
  const { data, error: signedUrlError } = await client.storage.from(BUCKET)
    .createSignedUrl(record.storage_key, 60, preview ? {} : { download: record.original_name });
  if (signedUrlError) throw signedUrlError;
  return { ...record, download_url: data.signedUrl };
};

export const deleteDocument = async (ownerAccount, id, client = requireDatabase()) => {
  if (!UUID_PATTERN.test(id || "")) throw fail("Document id must be a valid UUID.");
  const { data: record, error: lookupError } = await client.from("document_records").select("storage_key,content_type")
    .eq("id", id).eq("owner_account", ownerAccount).maybeSingle();
  if (lookupError) throw lookupError;
  if (!record) return false;
  const storage = client.storage.from(BUCKET);
  const { data: file, error: downloadError } = await storage.download(record.storage_key);
  if (downloadError) throw downloadError;
  if (!file) throw fail("Document storage object could not be read before deletion.", 503);
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const { error: storageError } = await storage.remove([record.storage_key]);
  if (storageError) throw storageError;
  const { data, error } = await client.from("document_records").delete()
    .eq("id", id).eq("owner_account", ownerAccount).select("id").maybeSingle();
  if (error) {
    const { error: restoreError } = await storage.upload(record.storage_key, fileBuffer, {
      contentType: record.content_type,
      upsert: true,
    });
    if (restoreError) {
      throw Object.assign(
        new Error("Document metadata deletion failed and the storage object could not be restored."),
        { statusCode: 503, expose: true, code: "DOCUMENT_DELETE_RECOVERY_FAILED" }
      );
    }
    throw error;
  }
  return Boolean(data);
};
