import { getGoogleAccessToken } from "./google-integration.service.js";
import { GoogleApiError } from "./google-api-error.js";
import { readIntegrationToken } from "./integration-vault.service.js";

const SHEETS_READ_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

const requestSheetsApi = async (account, endpoint) => {
  const accessToken = await getGoogleAccessToken(account);
  let response;
  try {
    response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${endpoint}`, {
      headers: { Authorization: "Bearer " + accessToken },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    throw Object.assign(new Error(
      error.name === "TimeoutError" ? "Google Sheets request timed out." : "Google Sheets is temporarily unreachable."
    ), { statusCode: error.name === "TimeoutError" ? 504 : 502, expose: true });
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    if (response.ok) {
      throw Object.assign(new Error("Google Sheets returned an invalid response."), { statusCode: 502, expose: true });
    }
  }
  if (!response.ok) {
    throw new GoogleApiError(response.status, payload, [accessToken], "googleSheets");
  }
  return payload;
};

export const readProjectsSheet = async (account, spreadsheetId) => {
  const token = await readIntegrationToken({ provider: "google", account });
  if (!token?.scopes?.split(/\s+/).includes(SHEETS_READ_SCOPE)) {
    throw Object.assign(new Error("Google Sheets read-only permission is required. Reconnect Google and approve the Sheets permission."), {
      statusCode: 403,
      expose: true,
      code: "GOOGLE_SHEETS_SCOPE_REQUIRED",
    });
  }

  const encodedId = encodeURIComponent(spreadsheetId);
  const workbook = await requestSheetsApi(
    account,
    `${encodedId}?fields=${encodeURIComponent("sheets.properties(sheetId,title)")}`
  );
  const sheet = workbook.sheets?.find(({ properties }) => properties?.title === "Projects");
  if (!sheet) {
    throw Object.assign(new Error('The spreadsheet does not contain a "Projects" sheet.'), {
      statusCode: 400,
      expose: true,
    });
  }
  const range = encodeURIComponent("'Projects'!A:XFD");
  const result = await requestSheetsApi(
    account,
    `${encodedId}/values/${range}?valueRenderOption=FORMATTED_VALUE`
  );
  return { sheetId: sheet.properties.sheetId, values: result.values || [] };
};
