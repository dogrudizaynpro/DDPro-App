import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DDPRO_TIME_ZONE,
  formatDateOnly,
  formatDateTime,
  fromDateTimeLocalInput,
  toDateTimeLocalInput,
} from "../src/utils/date-time.js";

test("date and time formatting always uses Turkish locale, Istanbul time, and a 24-hour clock", () => {
  const previousTimezone = process.env.TZ;
  process.env.TZ = "America/Los_Angeles";
  try {
    assert.equal(DDPRO_TIME_ZONE, "Europe/Istanbul");
    assert.equal(formatDateTime("2026-10-09T18:30:00.000Z"), "09.10.2026 21:30");
    assert.equal(formatDateOnly("2026-10-09"), "09.10.2026");
    assert.equal(toDateTimeLocalInput("2026-10-09T18:30:00.000Z"), "2026-10-09T21:30");
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});

test("datetime-local edits convert Istanbul wall time to the same UTC instant regardless of host timezone", () => {
  assert.equal(
    fromDateTimeLocalInput("2026-10-09T21:30"),
    "2026-10-09T18:30:00.000Z"
  );
});

test("datetime-local conversion rejects invalid dates and unsupported input shapes", () => {
  assert.throws(() => fromDateTimeLocalInput("2026-02-30T11:00"), /geçerli değil/);
  assert.throws(() => fromDateTimeLocalInput("2026-10-09"), /Europe\/Istanbul/);
});
