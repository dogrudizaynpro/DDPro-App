import { getGoogleAccessToken } from "./google-integration.service.js";
import { createCrmContact } from "./crm.service.js";

const googleRequest = async (account, endpoint, options = {}) => {
  const accessToken = await getGoogleAccessToken(account);
  const response = await fetch(`https://www.googleapis.com${endpoint}`, {
    ...options,
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
      ...options.headers,
    },
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await response.json();
  if (!response.ok) {
    throw Object.assign(
      new Error("Google Workspace request failed."),
      { statusCode: response.status === 401 ? 401 : 502, expose: true }
    );
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
