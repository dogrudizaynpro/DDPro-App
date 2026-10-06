import { API_BASE_URL, clearBrowserSession, fetchAPI, setBrowserSession } from "./api.js";

export const formatGoogleIntegrationError = (error) => {
  const details = error.googleApiError;
  if (!details) return error.message || "Bağlantı testi başarısız.";
  const explanations = {
    authorization: "Google API yetkilendirme/token hatası. Kayıtlı Google bağlantısı korunuyor.",
    access_denied: "Google API erişimi reddetti (izin, politika veya kota kısıtlaması). Google OAuth bağlantısı korunuyor.",
    rate_limit: "Google API hız/kota sınırına ulaşıldı. Daha sonra tekrar deneyin; Google bağlantısı korunuyor.",
    api_error: "Google API isteği başarısız. Google bağlantısı korunuyor.",
  };
  const reasons = details.reasons?.length ? ` · ${details.reasons.join(", ")}` : "";
  return `${explanations[details.category] || explanations.api_error} HTTP ${details.httpStatus}${reasons}: ${details.message}`;
};

export const beginGoogleConnection = async () => {
  if (!API_BASE_URL) throw new Error("Backend API address is not configured.");
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (byte) => String.fromCharCode(byte)).join("");
  const encoded = btoa(verifier).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  const challengeBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(encoded));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(challengeBytes)))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  sessionStorage.setItem("ddpro_oauth_verifier", encoded);
  window.location.assign(`${API_BASE_URL}/api/integrations/google/start?challenge=${challenge}`);
};

let pendingGoogleConnection;
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
  setBrowserSession(response.data.session);
  clearGoogleExchange(code);
};

const clearGoogleExchange = (code) => {
  sessionStorage.removeItem("ddpro_oauth_verifier");
  const [path, query = ""] = window.location.hash.split("?");
  const oauthResult = new URLSearchParams(query);
  if (oauthResult.get("exchange_code") === code) {
    oauthResult.delete("exchange_code");
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${path}${oauthResult.size ? `?${oauthResult}` : ""}`);
  }
};

export const disconnectGoogle = async () => {
  const response = await fetchAPI("/api/integrations/google/logout", { method: "POST" });
  clearBrowserSession();
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
