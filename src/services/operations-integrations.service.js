import { API_BASE_URL, fetchAPI } from "./api.js";

export const beginGoogleConnection = () => {
  if (!API_BASE_URL) throw new Error("Backend API address is not configured.");
  window.location.assign(`${API_BASE_URL}/api/integrations/google/start`);
};

export const disconnectGoogle = () =>
  fetchAPI("/api/integrations/google/logout", { method: "POST" });

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
    title: event.summary || "Google Calendar event",
    type: "Google Calendar",
    date: event.start?.dateTime || event.start?.date || "",
    time: "",
    project: "",
    notes: event.description || "",
    source: "google_calendar",
    externalId: event.id,
  }));
};
