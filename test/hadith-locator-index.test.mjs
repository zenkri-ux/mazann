import assert from "node:assert/strict";
import test from "node:test";
import { HadithLocatorIndex } from "../apps/api/src/lib/hadith-locator-index.mjs";

const locator = new HadithLocatorIndex({
  schema_version: "1.0.0",
  metadata: { version: "test.1" },
  records: [{
    hadeethenc_id: "3016",
    matn_checksum_sha256: "trusted-checksum",
    reference_key: "hadith:bukhari-muslim",
    source_label_ar: "صحيح البخاري وصحيح مسلم",
    primary_sources: [
      { collection_ar: "صحيح البخاري", number_ar: "6497", verification_url: "https://dorar.net/hadith/sharh/10932" },
      { collection_ar: "صحيح مسلم", number_ar: "143", verification_url: "https://dorar.net/hadith/sharh/10930" },
    ],
    verification: { authority: "الدرر السنية", evidence_url: "https://dorar.net/hadith/sharh/10938" },
    verified_at: "2026-10-05",
  }],
});

function record(checksum = "trusted-checksum") {
  return {
    id: "hadith:3016:ar",
    source_family: "hadith",
    checksum_sha256: checksum,
    metadata: { hadith_id: "3016" },
    reference: { primary_locator_available: false, precision: "collection_level" },
  };
}

test("Hadith locator promotes only an id-and-checksum match to exact primary locators", () => {
  const enriched = locator.enrich(record());
  assert.equal(enriched.reference.primary_locator_available, true);
  assert.equal(enriched.reference.precision, "exact_collection_number");
  assert.equal(enriched.reference.locator_ar, "صحيح البخاري رقم 6497؛ صحيح مسلم رقم 143");
  assert.equal(enriched.metadata.locator_audit.status, "matched_id_and_checksum");
});

test("Hadith locator blocks stale crosswalk data when the matn checksum changes", () => {
  const enriched = locator.enrich(record("changed-upstream-text"));
  assert.equal(enriched.reference.primary_locator_available, false);
  assert.equal(enriched.metadata.locator_audit.status, "blocked_checksum_mismatch");
});

test("Hadith locator leaves unknown records visibly unresolved", () => {
  const unknown = { ...record(), metadata: { hadith_id: "999" } };
  assert.equal(locator.enrich(unknown), unknown);
});
