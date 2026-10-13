import { randomUUID } from "node:crypto";
import { getIntegrationAdmin } from "../config/integration-admin.js";

const BUCKET = "ddpro-system-images";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const UUID_PATTERN = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const IMAGE_TYPES = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const fail = (message, statusCode = 400, code) => Object.assign(new Error(message), {
  statusCode,
  expose: true,
  ...(code ? { code } : {}),
});

const requireDatabase = () => {
  const client = getIntegrationAdmin();
  if (!client) throw fail("Görsel veritabanı yapılandırılmamış.", 503);
  return client;
};

const validWebp = (buffer) => {
  if (
    buffer.length < 20 ||
    buffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
    buffer.readUInt32LE(4) !== buffer.length - 8 ||
    buffer.subarray(8, 12).toString("ascii") !== "WEBP"
  ) return false;
  let offset = 12;
  let foundImageChunk = false;
  while (offset + 8 <= buffer.length) {
    const chunk = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const end = offset + 8 + length + (length % 2);
    if (end > buffer.length) return false;
    if (["VP8 ", "VP8L", "VP8X"].includes(chunk)) foundImageChunk = true;
    offset = end;
  }
  return foundImageChunk && offset === buffer.length;
};

export const normalizeSystemImageUpload = ({ originalName, contentType, buffer }) => {
  if (typeof originalName !== "string") throw fail("Görsel dosya adı gerekli.");
  const name = originalName.split(/[\\/]/).pop().trim();
  if (!name || name.length > 255 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw fail("Görsel dosya adı geçersiz.");
  }
  const extension = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (IMAGE_TYPES.get(extension) !== contentType) {
    throw fail("Yalnızca JPEG, PNG ve WebP görseller kabul edilir.");
  }
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_FILE_SIZE) {
    throw fail("Görsel 1 bayt ile 10 MB arasında olmalıdır.");
  }
  const signatureValid = contentType === "image/png"
    ? buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : contentType === "image/jpeg"
      ? buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff
      : validWebp(buffer);
  if (!signatureValid) throw fail("Görsel içeriği seçilen dosya türüyle eşleşmiyor.");
  return {
    original_name: name,
    content_type: contentType,
    file_size: buffer.length,
    extension,
  };
};

const validateUuid = (value, label) => {
  if (!UUID_PATTERN.test(value || "")) throw fail(`${label} kimliği geçersiz.`);
};

const getSystem = async (client, systemId) => {
  const { data, error } = await client.from("systems").select("id").eq("id", systemId).maybeSingle();
  if (error) throw error;
  if (!data) throw fail("Sistem kaydı bulunamadı.", 404);
  return data;
};

const signedImage = async (client, record) => {
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(record.storage_key, 3600);
  if (error) throw error;
  return { ...record, preview_url: data.signedUrl };
};

const downloadObject = async (storage, key) => {
  const { data, error } = await storage.download(key);
  if (error) throw error;
  if (!data) throw fail("Görsel dosyası depolamadan okunamadı.", 503);
  return Buffer.from(await data.arrayBuffer());
};

const restoreObjects = async (storage, objects) => {
  const results = await Promise.all(objects.map(({ key, buffer, contentType }) =>
    storage.upload(key, buffer, { contentType, upsert: true })
  ));
  return results.find((result) => result.error)?.error;
};

const recoveryFailure = (message) =>
  fail(message, 503, "SYSTEM_IMAGE_RECOVERY_FAILED");

const validateSystemImageDeletionScope = (systemId, ownerAccount, records) => {
  if (typeof ownerAccount !== "string" || !ownerAccount.trim()) {
    throw fail("Sistem görseli silme yetkisi doğrulanamadı.", 403);
  }
  const prefix = `${systemId}/`;
  const valid = records.every((record) => {
    const key = record.storage_key;
    return record.system_id === systemId &&
      record.owner_account === ownerAccount &&
      typeof key === "string" &&
      key.startsWith(prefix) &&
      key.length > prefix.length &&
      !/[\/\\\u0000-\u001f\u007f]/.test(key.slice(prefix.length));
  });
  if (!valid) {
    throw fail(
      "Sistem görseli silme kapsamı doğrulanamadı; hiçbir dosya silinmedi.",
      409,
      "SYSTEM_IMAGE_OWNERSHIP_CONFLICT"
    );
  }
};

const removeStoredObject = async (storage, key, rollbackObjects = []) => {
  const { error } = await storage.remove([key]);
  if (!error) return;
  const restoreError = await restoreObjects(storage, rollbackObjects);
  if (restoreError) {
    throw recoveryFailure("Görsel işlemi başarısız oldu ve depolama geri yüklenemedi.");
  }
  throw error;
};

export const listSystemImages = async (ownerAccount, systemId, client = requireDatabase()) => {
  validateUuid(systemId, "Sistem");
  await getSystem(client, systemId);
  const { data, error } = await client.from("system_images").select("*")
    .eq("system_id", systemId).eq("owner_account", ownerAccount)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return Promise.all((data || []).map((record) => signedImage(client, record)));
};

export const uploadSystemImage = async (ownerAccount, systemId, input, client = requireDatabase()) => {
  validateUuid(systemId, "Sistem");
  await getSystem(client, systemId);
  const payload = normalizeSystemImageUpload(input);
  const storage = client.storage.from(BUCKET);
  const storageKey = `${systemId}/${randomUUID()}${payload.extension}`;
  const { error: uploadError } = await storage.upload(storageKey, input.buffer, {
    contentType: payload.content_type,
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { extension, ...metadata } = payload;
  const { data, error } = await client.from("system_images")
    .insert({ ...metadata, system_id: systemId, owner_account: ownerAccount, storage_key: storageKey })
    .select("*").single();
  if (error) {
    const { error: cleanupError } = await storage.remove([storageKey]);
    if (cleanupError) throw recoveryFailure("Görsel kaydı başarısız oldu ve yüklenen dosya temizlenemedi.");
    throw error;
  }
  return signedImage(client, data);
};

export const replaceSystemImage = async (ownerAccount, systemId, imageId, input, client = requireDatabase()) => {
  validateUuid(systemId, "Sistem");
  validateUuid(imageId, "Görsel");
  await getSystem(client, systemId);
  const payload = normalizeSystemImageUpload(input);
  const { data: record, error: lookupError } = await client.from("system_images").select("*")
    .eq("id", imageId).eq("system_id", systemId).eq("owner_account", ownerAccount).maybeSingle();
  if (lookupError) throw lookupError;
  if (!record) return null;

  const storage = client.storage.from(BUCKET);
  const oldBuffer = await downloadObject(storage, record.storage_key);
  const storageKey = `${systemId}/${randomUUID()}${payload.extension}`;
  const { error: uploadError } = await storage.upload(storageKey, input.buffer, {
    contentType: payload.content_type,
    upsert: false,
  });
  if (uploadError) throw uploadError;
  const { extension, ...metadata } = payload;
  const { data, error } = await client.from("system_images").update({
    ...metadata,
    storage_key: storageKey,
    updated_at: new Date().toISOString(),
  }).eq("id", imageId).eq("system_id", systemId).eq("owner_account", ownerAccount).select("*").maybeSingle();
  if (error || !data) {
    const { error: cleanupError } = await storage.remove([storageKey]);
    if (cleanupError) throw recoveryFailure("Görsel değiştirilemedi ve yeni dosya temizlenemedi.");
    if (error) throw error;
    return null;
  }

  const { error: oldRemoveError } = await storage.remove([record.storage_key]);
  if (oldRemoveError) {
    const oldRestoreError = await storage.upload(record.storage_key, oldBuffer, {
      contentType: record.content_type,
      upsert: true,
    });
    const { error: rollbackError } = await client.from("system_images").update({
      original_name: record.original_name,
      content_type: record.content_type,
      file_size: record.file_size,
      storage_key: record.storage_key,
      updated_at: record.updated_at,
    }).eq("id", imageId).eq("system_id", systemId).eq("owner_account", ownerAccount);
    const { error: cleanupError } = await storage.remove([storageKey]);
    if (oldRestoreError || rollbackError || cleanupError) {
      throw recoveryFailure("Görsel değiştirilemedi; eski görselin geri yüklenmesi başarısız oldu.");
    }
    throw oldRemoveError;
  }
  return signedImage(client, data);
};

export const deleteSystemImage = async (ownerAccount, systemId, imageId, client = requireDatabase()) => {
  validateUuid(systemId, "Sistem");
  validateUuid(imageId, "Görsel");
  const { data: record, error: lookupError } = await client.from("system_images").select("*")
    .eq("id", imageId).eq("system_id", systemId).eq("owner_account", ownerAccount).maybeSingle();
  if (lookupError) throw lookupError;
  if (!record) return false;

  const storage = client.storage.from(BUCKET);
  const buffer = await downloadObject(storage, record.storage_key);
  await removeStoredObject(storage, record.storage_key, [{
    key: record.storage_key,
    buffer,
    contentType: record.content_type,
  }]);
  const { data, error } = await client.from("system_images").delete()
    .eq("id", imageId).eq("system_id", systemId).eq("owner_account", ownerAccount)
    .select("id").maybeSingle();
  if (error || !data) {
    const { error: restoreError } = await storage.upload(record.storage_key, buffer, {
      contentType: record.content_type,
      upsert: true,
    });
    if (restoreError) {
      throw recoveryFailure("Görsel kaydı silinemedi ve dosya depolamaya geri yüklenemedi.");
    }
    if (error) throw error;
    return false;
  }
  return true;
};

export const deleteSystemRecordWithImages = async (systemId, ownerAccount, client = requireDatabase()) => {
  validateUuid(systemId, "Sistem");
  await getSystem(client, systemId);
  const { data: records, error: lookupError } = await client.from("system_images").select("*")
    .eq("system_id", systemId);
  if (lookupError) throw lookupError;
  validateSystemImageDeletionScope(systemId, ownerAccount, records || []);
  const storage = client.storage.from(BUCKET);
  const objects = await Promise.all((records || []).map(async (record) => ({
    key: record.storage_key,
    buffer: await downloadObject(storage, record.storage_key),
    contentType: record.content_type,
  })));

  if (objects.length) {
    const { error: removeError } = await storage.remove(objects.map(({ key }) => key));
    if (removeError) {
      const restoreError = await restoreObjects(storage, objects);
      if (restoreError) {
        throw recoveryFailure("Sistem görselleri silinemedi ve depolama geri yüklenemedi.");
      }
      throw removeError;
    }
  }

  const { data, error } = await client.from("systems").delete()
    .eq("id", systemId).select("id").maybeSingle();
  if (error || !data) {
    if (objects.length) {
      const restoreError = await restoreObjects(storage, objects);
      if (restoreError) {
        throw recoveryFailure("Sistem silinemedi ve görseller depolamaya geri yüklenemedi.");
      }
    }
    if (error) throw error;
    throw fail("Sistem kaydı bulunamadı.", 404);
  }
  return true;
};
