import assert from "node:assert/strict";
import test from "node:test";
import { TafsirLinkIndex } from "../apps/api/src/lib/tafsir-link-index.mjs";

const index = await TafsirLinkIndex.load(new URL("../data/dorar-tafsir-links.json", import.meta.url));

test("verified tafsir section is linked to its exact Quran ayat without copying tafsir text", () => {
  const original = { id: "quran:4:58:ar", source_family: "quran", metadata: { surah: 4, ayah: 58 }, text: "نص الآية" };
  const enriched = index.enrich(original);
  assert.equal(enriched.related_tafsir.citation_url, "https://dorar.net/tafseer/4/18");
  assert.equal(enriched.related_tafsir.text_included, false);
  assert.equal(enriched.related_tafsir.access_mode, "external_section_link_only");
  assert.equal(enriched.text, original.text);
  assert.equal(original.related_tafsir, undefined);
});

test("unmapped ayat and hadiths do not receive a fabricated tafsir citation", () => {
  const unmapped = { source_family: "quran", metadata: { surah: 4, ayah: 60 } };
  const hadith = { source_family: "hadith", metadata: { surah: 4, ayah: 58 } };
  assert.equal(index.enrich(unmapped), unmapped);
  assert.equal(index.enrich(hadith), hadith);
});

test("tafsir link index refuses external hosts and overlapping ranges", () => {
  const section = { surah: 4, from_ayah: 58, to_ayah: 59, title_ar: "النساء 58–59", url: "https://dorar.net/tafseer/4/18" };
  assert.throws(() => new TafsirLinkIndex({ schema_version: "1.0.0", sections: [{ ...section, url: "https://example.com/tafseer/4/18" }] }));
  assert.throws(() => new TafsirLinkIndex({ schema_version: "1.0.0", sections: [section, { ...section, from_ayah: 59 }] }));
});
