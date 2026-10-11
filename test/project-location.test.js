import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getVerifiedProjectCoordinates,
  toWorldMapPoint,
} from "../src/utils/project-location.js";

test("dashboard map excludes projects without explicit verified coordinates", () => {
  assert.equal(getVerifiedProjectCoordinates({ location: "İstanbul" }), null);
  assert.equal(getVerifiedProjectCoordinates({
    raw: { source_data: { verified_coordinates: { latitude: 41, longitude: 29 } } },
  }), null);
});

test("dashboard map accepts only dated, sourced, in-range verified coordinates", () => {
  const project = {
    raw: {
      source_data: {
        verified_coordinates: {
          latitude: 41,
          longitude: 29,
          verified: true,
          verified_at: "2026-10-10T00:00:00Z",
          source: "survey",
        },
      },
    },
  };
  assert.deepEqual(getVerifiedProjectCoordinates(project), { latitude: 41, longitude: 29 });
  assert.deepEqual(toWorldMapPoint({ latitude: 0, longitude: 0 }), { x: 300, y: 160 });
  assert.equal(getVerifiedProjectCoordinates({
    raw: { source_data: { verified_coordinates: { ...project.raw.source_data.verified_coordinates, latitude: 91 } } },
  }), null);
});
