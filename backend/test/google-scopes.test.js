import assert from "node:assert/strict";
import { test } from "node:test";
import { getMissingGoogleScopes } from "../src/services/google-integration.service.js";

const allScopes = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];

test("Google OAuth grants are checked for every supported service permission", () => {
  assert.deepEqual(getMissingGoogleScopes(allScopes.join(" ")), []);
  assert.deepEqual(
    getMissingGoogleScopes(`${allScopes[0]} ${allScopes[2]}`),
    [allScopes[1]]
  );
  assert.deepEqual(getMissingGoogleScopes(""), allScopes);
});
