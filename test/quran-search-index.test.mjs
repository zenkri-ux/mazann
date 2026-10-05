import assert from "node:assert/strict";
import test from "node:test";
import { QuranSearchIndex, normalizeArabicForSearch } from "../apps/api/src/lib/quran-search-index.mjs";

const index = new QuranSearchIndex({
  schema_version: "1.0.0",
  metadata: { source: "test" },
  documents: [
    {
      id: "quran:4:58:ar", surah: 4, ayah: 58, title: "سورة النساء، الآية 58",
      citation_url: "https://islamenc.com/ar/quran/4/58",
      quran_search_text: "ان الله يامركم ان تودوا الامانات الى اهلها واذا حكمتم بين الناس ان تحكموا بالعدل",
      explanation_search_text: "يأمر الله باداء الحقوق والامانات والحكم بالعدل بين الناس",
    },
    {
      id: "quran:21:107:ar", surah: 21, ayah: 107, title: "سورة الأنبياء، الآية 107",
      citation_url: "https://islamenc.com/ar/quran/21/107",
      quran_search_text: "وما ارسلناك الا رحمه للعالمين",
      explanation_search_text: "ارسل الله نبيه محمد رحمة للخلق كافة",
    },
    {
      id: "quran:2:183:ar", surah: 2, ayah: 183, title: "سورة البقرة، الآية 183",
      citation_url: "https://islamenc.com/ar/quran/2/183",
      quran_search_text: "كتب عليكم الصيام كما كتب على الذين من قبلكم لعلكم تتقون",
      explanation_search_text: "فرض الله الصيام لتحقيق التقوى",
    },
  ],
});

test("Arabic search normalization is matching-only and handles Quranic orthography", () => {
  assert.equal(normalizeArabicForSearch("إِنَّ ٱللَّهَ يَأْمُرُكُمْ"), "ان الله يامركم");
});

test("Quran index ranks exact ayah language and returns locators, never display snippets", () => {
  const [result] = index.search("أداء الأمانات والحكم بالعدل", { limit: 2 });
  assert.equal(result.id, "quran:4:58:ar");
  assert.ok(result.retrieval.matched_fields.includes("quran_text"));
  assert.ok(result.retrieval.matched_fields.includes("published_explanation"));
  assert.equal("text" in result, false);
  assert.ok(result.retrieval.query_coverage >= 0.75);
});

test("Published explanation supplies a thematic signal beyond literal verse matching", () => {
  const [result] = index.search("الرحمة للخلق", { limit: 1 });
  assert.equal(result.id, "quran:21:107:ar");
  assert.ok(result.retrieval.matched_fields.includes("published_explanation"));
});

test("Arabic clitics do not hide a high-coverage canonical verse", () => {
  const [result] = index.search("أداء الأمانة والحكم بالعدل", { limit: 1 });
  assert.equal(result.id, "quran:4:58:ar");
  assert.equal(result.retrieval.query_coverage, 1);
});

test("A contextual trust query retains the canonical amanah verse through declared thematic expansion", () => {
  const [result] = index.search("الأمانة وأثرها بناء الثقة داخل المجتمع حدود", { limit: 1 });
  assert.equal(result.id, "quran:4:58:ar");
  assert.ok(result.retrieval.matched_fields.includes("curated_topic_expansion"));
  assert.equal("text" in result, false);
});

test("topic grounding distinguishes kinship from wombs, marital settlement and prayer", async () => {
  const full = await QuranSearchIndex.load(new URL("../data/quran-search-index.json", import.meta.url));
  const topic = "أهمية صلة الرحم";
  for (const id of ["quran:4:1:ar", "quran:13:21:ar", "quran:47:22:ar", "quran:17:26:ar"]) {
    assert.equal(full.isTopicGrounded(id, topic), true, id);
  }
  for (const id of ["quran:3:6:ar", "quran:4:128:ar", "quran:23:2:ar", "quran:14:18:ar", "quran:60:3:ar", "quran:33:6:ar", "quran:90:16:ar"]) {
    assert.equal(full.isTopicGrounded(id, topic), false, id);
  }
});
