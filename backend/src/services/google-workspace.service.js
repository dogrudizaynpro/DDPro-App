import {
  getGoogleAccessToken,
  GOOGLE_OPERATION_SCOPES,
} from "./google-integration.service.js";
import { createCrmContact } from "./crm.service.js";
import { GoogleApiError } from "./google-api-error.js";

const getGoogleOperation = (endpoint) => {
  const path = endpoint.split("?")[0];
  if (path === "/gmail/v1/users/me/profile") return "gmail.profile";
  if (path === "/gmail/v1/users/me/messages") return "gmail.messages.list";
  if (/^\/gmail\/v1\/users\/me\/messages\/[^/]+$/.test(path)) return "gmail.messages.get";
  if (path === "/calendar/v3/users/me/calendarList") return "calendar.list";
  if (path === "/calendar/v3/calendars/primary/events") return "calendar.events";
  if (/^\/calendar\/v3\/calendars\/primary\/events\/[^/]+$/.test(path)) return "calendar.events.get";
  return "google.api.request";
};

const googleRequest = async (account, endpoint, options = {}) => {
  const isGmail = endpoint.startsWith("/gmail/");
  const accessToken = await getGoogleAccessToken(account, {
    requiredScope: isGmail ? GOOGLE_OPERATION_SCOPES.gmail : GOOGLE_OPERATION_SCOPES.calendar,
    provider: isGmail ? "gmail" : "googleCalendar",
    operation: getGoogleOperation(endpoint),
  });
  let response;
  try {
    response = await fetch(`https://www.googleapis.com${endpoint}`, {
      ...options,
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
        ...options.headers,
      },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw Object.assign(new Error(
      error.name === "TimeoutError" ? "Google API request timed out." : "Google API is temporarily unreachable."
    ), { statusCode: error.name === "TimeoutError" ? 504 : 502, expose: true });
  }
  if (response.status === 204) return null;
  let payload;
  try {
    payload = await response.json();
  } catch {
    if (response.ok) {
      throw Object.assign(new Error("Google API returned an invalid response."), { statusCode: 502, expose: true });
    }
  }
  if (!response.ok) {
    throw new GoogleApiError(response.status, payload, [accessToken],
      endpoint.startsWith("/gmail/") ? "gmail" : "googleCalendar", getGoogleOperation(endpoint));
  }
  return payload;
};

const decodeMessagePart = (part) => {
  if (part?.mimeType === "text/plain" && part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  for (const nested of part?.parts || []) {
    const value = decodeMessagePart(nested);
    if (value) return value;
  }
  return "";
};

export const importGmailMessages = async (account, requestedLimit) => {
  const limit = Math.min(Math.max(Number(requestedLimit) || 15, 1), 50);
  const listing = await googleRequest(
    account,
    `/gmail/v1/users/me/messages?maxResults=${limit}&q=in%3Ainbox%20newer_than%3A90d`
  );
  const results = [];
  for (const message of listing.messages || []) {
    const details = await googleRequest(
      account,
      `/gmail/v1/users/me/messages/${encodeURIComponent(message.id)}?format=full`
    );
    const headers = details.payload?.headers || [];
    const readHeader = (name) =>
      headers.find((header) => header.name?.toLowerCase() === name.toLowerCase())?.value || "";
    const sender = readHeader("from");
    const match = sender.match(/^(.*?)\s*<([^>]+)>$/);
    const subject = readHeader("subject");
    const dateHeader = readHeader("date");
    const body =
      decodeMessagePart(details.payload) ||
      (details.snippet || "").slice(0, 2_000);
    const created = await createCrmContact(
      {
        name: match?.[1]?.replace(/^"|"$/g, "").trim() || match?.[2] || sender,
        email: match?.[2] || sender,
        request: [subject, body].filter(Boolean).join("\n\n").slice(0, 20_000),
        contact_date: Number(details.internalDate)
          ? new Date(Number(details.internalDate)).toISOString().slice(0, 10)
          : Number.isNaN(Date.parse(dateHeader))
            ? new Date().toISOString().slice(0, 10)
            : new Date(dateHeader).toISOString().slice(0, 10),
        source: "gmail",
        source_external_id: message.id,
        status: "Yeni",
      },
      { inbound: true }
    );
    results.push(created.contact);
  }
  return { imported: results.length, contacts: results };
};

export const getGoogleCalendarEvents = async (account, start, end) => {
  const from = start || new Date().toISOString();
  const to = end || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  const query = new URLSearchParams({
    timeMin: from,
    timeMax: to,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  });
  const result = await googleRequest(
    account,
    `/calendar/v3/calendars/primary/events?${query}`
  );
  return result.items || [];
};

export const getGoogleCalendarEvent = async (account, id) => {
  const eventId = validateCalendarEventId(id);
  return googleRequest(
    account,
    `/calendar/v3/calendars/primary/events/${eventId}`
  );
};

export const testGoogleWorkspaceConnection = async (account, provider) => {
  if (provider === "gmail") {
    await googleRequest(account, "/gmail/v1/users/me/profile");
    return;
  }
  if (provider === "calendar") {
    await googleRequest(account, "/calendar/v3/calendars/primary/events?maxResults=1");
    return;
  }
  throw Object.assign(new Error("Unsupported Google Workspace provider."), {
    statusCode: 400,
    expose: true,
  });
};

export const createGoogleCalendarEvent = async (account, body = {}) => {
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  const start = body.start;
  const end = body.end;
  if (!summary || typeof start !== "string" || typeof end !== "string") {
    throw Object.assign(new Error("Calendar event requires a summary, start, and end."), {
      statusCode: 400,
      expose: true,
    });
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    endDate <= startDate
  ) {
    throw Object.assign(new Error("Calendar event dates are invalid."), {
      statusCode: 400,
      expose: true,
    });
  }
  return googleRequest(account, "/calendar/v3/calendars/primary/events", {
    method: "POST",
    body: JSON.stringify({
      summary: summary.slice(0, 500),
      description: typeof body.description === "string" ? body.description.slice(0, 5_000) : "",
      start: { dateTime: startDate.toISOString() },
      end: { dateTime: endDate.toISOString() },
    }),
  });
};

const normalizeCalendarEventUpdate = (body = {}) => {
  const payload = {};
  if (Object.hasOwn(body, "summary")) {
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    if (!summary || summary.length > 500) {
      throw Object.assign(new Error("Calendar event summary must be between 1 and 500 characters."), {
        statusCode: 400,
        expose: true,
      });
    }
    payload.summary = summary;
  }
  if (Object.hasOwn(body, "description")) {
    if (typeof body.description !== "string" || body.description.length > 5_000) {
      throw Object.assign(new Error("Calendar event description must be at most 5000 characters."), {
        statusCode: 400,
        expose: true,
      });
    }
    payload.description = body.description;
  }
  if (Object.hasOwn(body, "start") || Object.hasOwn(body, "end")) {
    if (typeof body.start !== "string" || typeof body.end !== "string") {
      throw Object.assign(new Error("Calendar event start and end must be updated together."), {
        statusCode: 400,
        expose: true,
      });
    }
    const start = new Date(body.start);
    const end = new Date(body.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw Object.assign(new Error("Calendar event dates are invalid."), {
        statusCode: 400,
        expose: true,
      });
    }
    payload.start = { dateTime: start.toISOString() };
    payload.end = { dateTime: end.toISOString() };
  }
  if (Object.keys(payload).length === 0) {
    throw Object.assign(new Error("At least one supported calendar event field is required."), {
      statusCode: 400,
      expose: true,
    });
  }
  return payload;
};

const validateCalendarEventId = (id) => {
  if (typeof id !== "string" || !/^[A-Za-z0-9_-]{5,1024}$/.test(id)) {
    throw Object.assign(new Error("Calendar event id is invalid."), {
      statusCode: 400,
      expose: true,
    });
  }
  return encodeURIComponent(id);
};

export const updateGoogleCalendarEvent = async (account, id, body = {}) => {
  const eventId = validateCalendarEventId(id);
  const payload = normalizeCalendarEventUpdate(body);
  return googleRequest(account, `/calendar/v3/calendars/primary/events/${eventId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
};

export const deleteGoogleCalendarEvent = async (account, id) => {
  const eventId = validateCalendarEventId(id);
  return googleRequest(account, `/calendar/v3/calendars/primary/events/${eventId}`, {
    method: "DELETE",
  });
};
