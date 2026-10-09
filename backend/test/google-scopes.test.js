import assert from "node:assert/strict";
import { test } from "node:test";
import { getMissingGoogleScopes, hasGoogleOperationScope } from "../src/services/google-integration.service.js";

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

test("broader Google grants satisfy supported operations without granting unrelated permissions", () => {
  assert.deepEqual(getMissingGoogleScopes([
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/spreadsheets",
  ].join(" ")), []);
  assert.equal(hasGoogleOperationScope("https://mail.google.com/", allScopes[0]), true);
  assert.equal(hasGoogleOperationScope(allScopes[0], allScopes[1]), false);
  assert.equal(hasGoogleOperationScope("https://www.googleapis.com/auth/calendar.readonly", allScopes[1]), false);
});
