import {
  API_BASE_URL, endBrowserSession, fetchAPI, getBrowserSessionRevision, requestBrowserLogout, setBrowserSession,
} from "./api.js";

export const formatGoogleIntegrationError = (error) => {
  const details = error.googleApiError;
  if (!details) return error.message || "Bağlantı testi başarısız.";
  const explanations = {
    authorization: "Google API yetkilendirme/token hatası. Kayıtlı Google bağlantısı korunuyor.",
    connection_invalid: "Google yetkilendirmesi artık geçerli değil. Hesabı yeniden bağlayın.",
    access_denied: "Google API erişimi reddetti (izin, politika veya kota kısıtlaması). Google OAuth bağlantısı korunuyor.",
    api_disabled: "Google Cloud projesinde ilgili API etkinleştirilmeli. Mevcut OAuth bağlantısı korunuyor.",
    scope_required: "Gerekli Google OAuth kapsamı verilmemiş. Kullanıcı onayıyla eksik izinleri tamamlayın; mevcut bağlantı korunuyor.",
    permission_denied: "Google kullanıcısının kaynak erişimi veya Workspace politikası isteği engelliyor. Mevcut bağlantı korunuyor.",
    failed_precondition: "Google servisinin önkoşulu karşılanmadı. Gmail posta kutusu/hizmet durumunu ve aşağıdaki gerçek API nedenini kontrol edin; token sıfırlamak çözüm değildir.",
    rate_limit: "Google API hız/kota sınırına ulaşıldı. Daha sonra tekrar deneyin; Google bağlantısı korunuyor.",
    api_error: "Google API isteği başarısız. Google bağlantısı korunuyor.",
  };
  const reasons = details.reasons?.length ? ` · ${details.reasons.join(", ")}` : "";
  return `${explanations[details.category] || explanations.api_error} HTTP ${details.httpStatus}${reasons}: ${details.message}`;
};

const createOAuthChallenge = async () => {
  if (!API_BASE_URL) throw new Error("Backend API address is not configured.");
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (byte) => String.fromCharCode(byte)).join("");
  const encoded = btoa(verifier).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  const challengeBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(encoded));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(challengeBytes)))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  sessionStorage.setItem("ddpro_oauth_verifier", encoded);
  return challenge;
};

export const beginGoogleConnection = async ({ reconnect = false } = {}) => {
  sessionStorage.removeItem("ddpro_oauth_action");
  const challenge = await createOAuthChallenge();
  if (reconnect) {
    const response = await fetchAPI("/api/integrations/google/reconnect", {
      method: "POST", body: JSON.stringify({ challenge }),
    });
    const url = new URL(response.data?.url);
    if (url.origin !== "https://accounts.google.com") throw new Error("Geçersiz Google doğrulama adresi.");
    window.location.assign(url.toString());
  } else {
    window.location.assign(`${API_BASE_URL}/api/integrations/google/start?challenge=${challenge}`);
  }
};

export const beginSessionReauthentication = async (action) => {
  if (!["revoke-all", "disconnect"].includes(action)) throw new Error("Geçersiz güvenlik işlemi.");
  const challenge = await createOAuthChallenge();
  const response = await fetchAPI("/api/sessions/reauth", {
    method: "POST", body: JSON.stringify({ action, challenge }),
  });
  const url = new URL(response.data?.url);
  if (url.origin !== "https://accounts.google.com") throw new Error("Geçersiz Google doğrulama adresi.");
  sessionStorage.setItem("ddpro_oauth_action", action);
  window.location.assign(url.toString());
};

let pendingGoogleConnection;
let pendingSecurityAction = null;
export const getPendingSecurityAction = () => pendingSecurityAction;
globalThis.window?.addEventListener?.("ddpro:session-ended", () => { pendingSecurityAction = null; });
globalThis.window?.addEventListener?.("ddpro:session-invalid", () => { pendingSecurityAction = null; });
export const completeGoogleConnection = (code) => {
  if (pendingGoogleConnection) return pendingGoogleConnection;
  const oauthResult = new URLSearchParams(window.location.hash?.split("?")[1] || "");
  code ||= oauthResult.get("exchange_code");
  if (!code) return Promise.resolve();
  const pending = exchangeGoogleConnection(code);
  pendingGoogleConnection = pending;
  pending.then(
    () => { if (pendingGoogleConnection === pending) pendingGoogleConnection = null; },
    () => { if (pendingGoogleConnection === pending) pendingGoogleConnection = null; }
  );
  return pending;
};

const exchangeGoogleConnection = async (code) => {
  const revision = getBrowserSessionRevision();
  const action = sessionStorage.getItem("ddpro_oauth_action");
  const verifier = sessionStorage.getItem("ddpro_oauth_verifier");
  if (!verifier) {
    clearGoogleExchange(code);
    throw Object.assign(new Error("OAuth başlatılan tarayıcı sekmesi bulunamadı; tekrar bağlanın."), { status: 400 });
  }
  let response;
  try {
    response = await fetchAPI("/api/integrations/google/exchange", {
      method: "POST",
      body: JSON.stringify({ code, verifier }),
    });
  } catch (error) {
    if ([400, 401].includes(error.status)) clearGoogleExchange(code);
    throw error;
  }
  if (revision !== getBrowserSessionRevision()) {
    clearGoogleExchange(code);
    throw Object.assign(new Error("Browser session changed during authorization."), {
      status: 401, code: "BROWSER_SESSION_CHANGED",
    });
  }
  if (response.data?.proof) {
    if (!action || response.data.action !== action || !["revoke-all", "disconnect"].includes(action)) {
      clearGoogleExchange(code);
      throw new Error("Güvenlik işlemi doğrulaması eşleşmedi; yeniden doğrulayın.");
    }
    pendingSecurityAction = { proof: response.data.proof, action };
  } else {
    if (action) {
      clearGoogleExchange(code);
      throw new Error("Güvenlik işlemi için yeniden doğrulama kanıtı alınamadı.");
    }
    setBrowserSession(response.data.session);
  }
  clearGoogleExchange(code);
};

const clearGoogleExchange = (code) => {
  sessionStorage.removeItem("ddpro_oauth_verifier");
  sessionStorage.removeItem("ddpro_oauth_action");
  const [path, query = ""] = window.location.hash.split("?");
  const oauthResult = new URLSearchParams(query);
  if (oauthResult.get("exchange_code") === code) {
    oauthResult.delete("exchange_code");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${path}${oauthResult.size ? `?${oauthResult}` : ""}`);
  }
};

export const disconnectGoogle = async (proof) => {
  if (!proof) throw new Error("Bu işlem için yeni Google doğrulama kanıtı gerekir.");
  const response = await fetchAPI("/api/integrations/google/disconnect", {
    method: "POST", body: JSON.stringify({ proof }),
  });
  endBrowserSession();
  return response;
};

export const logoutBrowser = async () => {
  try {
    return await requestBrowserLogout();
  } catch (error) {
    throw new Error("Yerel çıkış yapıldı; sunucudaki oturum iptali doğrulanamadı. Ağ bağlantısı kurulunca tekrar giriş yapıp oturumları iptal edin.");
  }
};

export const cancelSecurityAction = () => { pendingSecurityAction = null; };
export const retryGoogleDisconnect = () => fetchAPI("/api/integrations/google/disconnect/retry", {
  method: "POST", body: JSON.stringify({}),
});
export const finishSecurityAction = async () => {
  const pending = pendingSecurityAction;
  pendingSecurityAction = null;
  if (!pending) throw new Error("Yeniden Google doğrulaması gerekir.");
  if (pending.action === "disconnect") return disconnectGoogle(pending.proof);
  const response = await fetchAPI("/api/sessions/revoke-all", {
    method: "POST", body: JSON.stringify({ proof: pending.proof }),
  });
  endBrowserSession();
  return response;
};

export const importGmailToCrm = () =>
  fetchAPI("/api/integrations/gmail/import", {
    method: "POST",
    body: JSON.stringify({ limit: 25 }),
  });

export const getGoogleCalendarEvents = () =>
  fetchAPI("/api/integrations/calendar/events");

export const createGoogleCalendarEvent = (event) =>
  fetchAPI("/api/integrations/calendar/events", {
    method: "POST",
    body: JSON.stringify(event),
  });

export const updateGoogleCalendarEvent = (id, event) =>
  fetchAPI(`/api/integrations/calendar/events/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(event),
  });

export const deleteGoogleCalendarEvent = (id) =>
  fetchAPI(`/api/integrations/calendar/events/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });

export const sendWhatsAppText = (to, text) =>
  fetchAPI("/api/integrations/whatsapp/send", {
    method: "POST",
    body: JSON.stringify({ to, text }),
  });

export const getCrmContacts = () => fetchAPI("/api/crm");

export const createCrmContact = (contact) =>
  fetchAPI("/api/crm", { method: "POST", body: JSON.stringify(contact) });

export const updateCrmContact = (id, contact) =>
  fetchAPI(`/api/crm/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(contact),
  });

export const deleteCrmContact = (id) =>
  fetchAPI(`/api/crm/${encodeURIComponent(id)}`, { method: "DELETE" });

export const importGoogleCalendarToLocal = async () => {
  const response = await getGoogleCalendarEvents();
  return (response.data || []).map((event) => ({
    id: `google-copy:${event.id}`,
    title: event.summary || "Google Calendar event",
    type: "Google Calendar",
    date: event.start?.dateTime || event.start?.date || "",
    end: event.end?.dateTime || event.end?.date || "",
    time: "",
    project: "",
    notes: event.description || "",
    source: "google_calendar",
    externalId: event.id,
  }));
};
