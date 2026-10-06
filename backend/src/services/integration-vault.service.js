import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { getIntegrationAdmin } from "../config/integration-admin.js";

const getEncryptionKey = () => {
  const value = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY || "";
  if (!/^[\da-f]{64}$/i.test(value)) return null;
  return Buffer.from(value, "hex");
};

export const isSecureTokenStorageReady = () =>
  Boolean(getIntegrationAdmin() && getEncryptionKey());

export const isTokenTableAvailable = async () => {
  const client = getIntegrationAdmin();
  if (!client || !getEncryptionKey()) return false;
  try {
    const { error } = await client
      .from("integration_tokens")
      .select("provider")
      .limit(1);
    if (error) console.error("OAuth token table probe failed", { code: error.code, status: error.status });
    return !error;
  } catch (error) {
    console.error("OAuth token table probe failed", { name: error?.name });
    return false;
  }
};

export const encryptIntegrationToken = (value) => {
  const key = getEncryptionKey();
  if (!key) throw new Error("INTEGRATION_TOKEN_ENCRYPTION_KEY must be 32-byte hex.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return {
    version: 1,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
};

export const decryptIntegrationToken = (encrypted) => {
  const key = getEncryptionKey();
  if (!key || encrypted?.version !== 1) {
    throw new Error("Encrypted integration token cannot be read.");
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(encrypted.iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(encrypted.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted.ciphertext, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString("utf8"));
};

export const saveIntegrationToken = async ({ provider, account, value }) => {
  const client = getIntegrationAdmin();
  if (!client || !getEncryptionKey()) {
    throw new Error("Secure integration token storage is not configured.");
  }
  const { error } = await client.from("integration_tokens").upsert(
    {
      provider,
      account,
      encrypted_token: encryptIntegrationToken(value),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "provider,account" }
  );
  if (error) throw error;
};

export const readIntegrationTokenSnapshot = async ({ provider, account }) => {
  const client = getIntegrationAdmin();
  if (!client || !getEncryptionKey()) return null;
  const { data, error } = await client
    .from("integration_tokens")
    .select("encrypted_token")
    .eq("provider", provider)
    .eq("account", account)
    .maybeSingle();
  if (error) throw error;
  return data ? {
    value: decryptIntegrationToken(data.encrypted_token),
    encryptedToken: data.encrypted_token,
  } : null;
};

export const readIntegrationToken = async (options) =>
  (await readIntegrationTokenSnapshot(options))?.value || null;

export const replaceIntegrationToken = async ({ provider, account, value, encryptedToken }) => {
  const client = getIntegrationAdmin();
  if (!client || !getEncryptionKey()) {
    throw new Error("Secure integration token storage is not configured.");
  }
  const { data, error } = await client.from("integration_tokens")
    .update({
      encrypted_token: encryptIntegrationToken(value),
      updated_at: new Date().toISOString(),
    })
    .eq("provider", provider)
    .eq("account", account)
    .eq("encrypted_token", JSON.stringify(encryptedToken))
    .select("provider")
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
};

export const removeIntegrationToken = async ({ provider, account }) => {
  const client = getIntegrationAdmin();
  if (!client) throw new Error("Supabase service-role configuration is required.");
  const { error } = await client
    .from("integration_tokens")
    .delete()
    .eq("provider", provider)
    .eq("account", account);
  if (error) throw error;
};

export const hasStoredIntegrationToken = async (provider, account = "") => {
  const client = getIntegrationAdmin();
  if (!client || !getEncryptionKey()) return false;
  let query = client
    .from("integration_tokens")
    .select("provider")
    .eq("provider", provider);
  if (account) query = query.eq("account", account);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) return false;
  return Boolean(data);
};
