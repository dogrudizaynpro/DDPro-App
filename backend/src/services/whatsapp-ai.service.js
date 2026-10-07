const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export const getWhatsAppAiAccount = (phone) => {
  try {
    const mapping = JSON.parse(process.env.WHATSAPP_AI_ACCOUNTS || "{}");
    if (!mapping || typeof mapping !== "object" || Array.isArray(mapping)) return null;
    const allowed = new Set((process.env.GOOGLE_ALLOWED_EMAILS || "")
      .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
    const accounts = new Set();
    for (const [sender, account] of Object.entries(mapping)) {
      if (!/^\d{8,20}$/.test(sender) || typeof account !== "string" ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account) ||
          account !== account.trim().toLowerCase() || !allowed.has(account) ||
          accounts.has(account)) return null;
      accounts.add(account);
    }
    return Object.hasOwn(mapping, phone) ? mapping[phone] : null;
  } catch {
    return null;
  }
};

const chunkReply = (text) => {
  if (typeof text !== "string" || !text.trim() || text.length > 32_000) {
    throw new Error("WhatsApp AI reply is unavailable.");
  }
  const chunks = [];
  for (let offset = 0; offset < text.length;) {
    let end = Math.min(offset + 4_000, text.length);
    if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end -= 1;
    chunks.push(text.slice(offset, end));
    offset = end;
  }
  return chunks;
};

export const requestWhatsAppAiReply = async ({
  message, sender, account, admin, state, checkpoint, connectionVersion, authorize,
}, { complete, confirm } = {}) => {
  if (typeof authorize !== "function" || !(await authorize())) {
    throw new Error("WhatsApp AI authorization is unavailable.");
  }
  // Only plain inbound text can authorize a write; interactive IDs are untrusted.
  const match = message.type === "text" && /^ONAYLA ([\da-fA-F-]{36})$/.exec(message.text);
  if (match && UUID.test(match[1])) {
    const { data: pending, error } = await admin.from("whatsapp_inbound_messages")
      .select("message_id")
      .eq("sender", sender)
      .eq("owner_account", account)
      .eq("connection_version", connectionVersion)
      .eq("pending_action_id", match[1].toLowerCase())
      .eq("status", "completed")
      .gt("pending_expires_at", new Date().toISOString())
      .limit(1).maybeSingle();
    if (error) throw error;
    if (!pending) {
      return { reply_chunks: ["Bu telefona gönderilmiş geçerli bir onay bulunamadı. İşlem yapılmadı."] };
    }
    if (state.confirmation_attempted) {
      return { reply_chunks: ["Önceki onayın sonucu kesinleştirilemedi. Yeniden işlem yapmadan uygulamadan kontrol edin."] };
    }
    // Persist before crossing the write boundary. A crash must never repeat a write.
    if (!(await authorize())) throw new Error("WhatsApp AI authorization is unavailable.");
    await checkpoint({ confirmation_attempted: true });
    if (!(await authorize())) throw new Error("WhatsApp AI authorization is unavailable.");
    try {
      const confirmAction = confirm || (await import("./ai.service.js")).confirmAiAction;
      await confirmAction(account, match[1]);
      return { reply_chunks: ["Onaylanan işlem tamamlandı."] };
    } catch {
      return { reply_chunks: ["Onay tamamlanamadı veya süresi doldu. Yeniden işlem yapmadan uygulamadan kontrol edin."] };
    }
  }
  // AI tools import the workspace controller; load lazily to avoid a module cycle.
  const completeRequest = complete || (await import("./ai.service.js")).requestAiCompletion;
  const result = await completeRequest({
    message: message.text, context: { channel: "whatsapp" }, integrationAccount: account,
  });
  if (!result.pendingAction) return { reply_chunks: chunkReply(result.answer) };
  const pending = result.pendingAction;
  if (!UUID.test(pending.id || "") || !Number.isFinite(Date.parse(pending.expiresAt))) {
    throw new Error("WhatsApp AI confirmation is unavailable.");
  }
  const preview = JSON.stringify(pending.preview);
  const reply = `${result.answer}\n${pending.summary}\n${preview}\n\nOnaylamak için yalnızca şu metni gönderin: ONAYLA ${pending.id}`;
  return {
    reply_chunks: chunkReply(reply),
    pending_action_id: pending.id.toLowerCase(),
    pending_expires_at: pending.expiresAt,
  };
};
