import test from "node:test";
import assert from "node:assert/strict";
import { mapOfferToViewModel } from "../src/services/offers.service.js";

test("mapOfferToViewModel normalizes API offer shape", () => {
  const mapped = mapOfferToViewModel({
    id: "offer-1",
    title: "  Kurumsal Teklif  ",
    amount: "1.250,50 TL",
    status: "sent",
    created_at: "2026-01-01T10:00:00Z",
    project_id: "project-1",
  });

  assert.equal(mapped.id, "offer-1");
  assert.equal(mapped.title, "Kurumsal Teklif");
  assert.equal(mapped.status, "Gönderildi");
  assert.equal(mapped.source, "api");
  assert.equal(mapped.projectId, "project-1");
  assert.match(mapped.amountDisplay, /₺/);
});

test("mapOfferToViewModel applies safe defaults for local records", () => {
  const mapped = mapOfferToViewModel({
    name: "Yerel Taslak",
  });

  assert.equal(mapped.title, "Yerel Taslak");
  assert.equal(mapped.status, "Hazırlanıyor");
  assert.equal(mapped.source, "local");
  assert.equal(mapped.amountDisplay, "Tutar belirtilmedi");
  assert.equal(mapped.date, "Tarih belirtilmedi");
});

test("mapOfferToViewModel preserves explicit amountDisplay", () => {
  const mapped = mapOfferToViewModel({
    amountDisplay: "Özel Gösterim",
  });

  assert.equal(mapped.title, "Adsız teklif");
  assert.equal(mapped.amountDisplay, "Özel Gösterim");
});
