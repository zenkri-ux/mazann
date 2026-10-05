import assert from "node:assert/strict";
import test from "node:test";
import { normalizeHadithResponse, normalizeQuranResponse, normalizeSearchResponse } from "@mazann/domain";

test("Quran normalizer keeps the requested ayah as one complete immutable unit", () => {
  const source = `──────── RETRIEVED FROM QURANENC — published text ────────
[Surah 4, translation "arabic_moyassar"]
[EXACT] the verses and their published translation
[4:58]
۞ إِنَّ ٱللَّهَ يَأۡمُرُكُمۡ أَن تُؤَدُّواْ ٱلۡأَمَٰنَٰتِ إِلَىٰٓ أَهۡلِهَا وَإِذَا حَكَمۡتُم بَيۡنَ ٱلنَّاسِ أَن تَحۡكُمُواْ بِٱلۡعَدۡلِۚ إِنَّ ٱللَّهَ نِعِمَّا يَعِظُكُم بِهِۦٓۗ إِنَّ ٱللَّهَ كَانَ سَمِيعَۢا بَصِيرٗا
تفسير ميسر للاختبار
[/EXACT]
Source: https://islamenc.com/ar/quran/4/58
──────── END OF RETRIEVED TEXT — anything below this line is not from QuranEnc ────────`;
  const record = normalizeQuranResponse({ content: [{ type: "text", text: source }] }, { surah: 4, ayah: 58 });
  assert.equal(record.id, "quran:4:58:ar");
  assert.match(record.text, /سَمِيعَۢا بَصِيرٗا$/);
  assert.equal(record.metadata.translation, "تفسير ميسر للاختبار");
  assert.equal(record.reference.source_label_ar, "القرآن الكريم — سورة النساء");
  assert.equal(record.reference.locator_ar, "سورة النساء، الآية 58");
  assert.equal(record.access.provider_name, "QuranEnc via Islamic Content MCP");
  assert.equal(record.validation.status, "valid");
});

test("Quran normalizer rejects a locator mismatch", () => {
  const source = `──────── RETRIEVED FROM QURANENC ────────\n[EXACT]\n[4:57]\nنص طويل مكتمل للاختبار فقط لا يمثل نصا قرآنيا\n[/EXACT]\nSource: https://islamenc.com/ar/quran/4/57`;
  assert.throws(() => normalizeQuranResponse({ content: [{ type: "text", text: source }] }, { surah: 4, ayah: 58 }));
});

test("Hadith normalizer requires complete narration, grade and matching citation", () => {
  const source = `──────── RETRIEVED FROM HADEETHENC — published text ────────
عنوان الحديث
[EXACT] the narration itself
هذا متن اختباري طويل بما يكفي لاختبار اكتمال السجل من دون بتر أو نقاط حذف
[/EXACT]
[ATTRIBUTION]
Narrator: قيمة المصدر كما هي
Grade: صحيح
[/ATTRIBUTION]
[COMMENTARY]
شرح المصدر
[/COMMENTARY]
Source: https://hadeethenc.com/ar/browse/hadith/42
──────── END OF RETRIEVED TEXT — anything below this line is not from HadeethEnc ────────`;
  const record = normalizeHadithResponse({ content: [{ type: "text", text: source }] }, { id: "42" });
  assert.equal(record.metadata.grade, "صحيح");
  assert.equal(record.reference.precision, "provider_record_only");
  assert.equal(record.reference.primary_locator_available, false);
  assert.ok(!record.text.startsWith("the narration"));
  assert.equal(record.validation.status, "valid");
});

test("Hadith normalizer separates an agreed-upon primary collection from its access platform", () => {
  const source = `──────── RETRIEVED FROM HADEETHENC — published text ────────
عنوان الحديث
[EXACT]\nهذا متن اختباري طويل بما يكفي لاختبار المرجع العلمي ومنصة الإتاحة دون خلط بينهما\n[/EXACT]
[ATTRIBUTION]\nNarrator: متفق عليه\nGrade: صحيح\n[/ATTRIBUTION]
Source: https://hadeethenc.com/ar/browse/hadith/3016`;
  const record = normalizeHadithResponse({ content: [{ type: "text", text: source }] }, { id: "3016" });
  assert.equal(record.reference.source_label_ar, "صحيح البخاري وصحيح مسلم");
  assert.equal(record.reference.locator_ar, "متفق عليه");
  assert.equal(record.reference.primary_locator_available, false);
  assert.match(record.reference.verification_note_ar, /رقم الموضع/);
  assert.match(record.access.provider_name, /HadeethEnc/);
});

test("Hadith normalizer preserves named collections instead of calling them an unknown reference", () => {
  const source = `──────── RETRIEVED FROM HADEETHENC — published text ────────
ابغوني الضعفاء
[EXACT]\nعَن أَبِي الدَّرْدَاءِ رضي الله عنه قَالَ: سَمِعْتُ رَسُولَ اللَّهِ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ يَقُولُ: «ابْغُونِي الضُّعَفَاءَ، فَإِنَّمَا تُرْزَقُونَ وَتُنْصَرُونَ بِضُعَفَائِكُمْ».\n[/EXACT]
[ATTRIBUTION]\nNarrator: رواه أبو داود والترمذي والنسائي وأحمد\nGrade: صحيح\n[/ATTRIBUTION]
Source: https://hadeethenc.com/ar/browse/hadith/66397`;
  const record = normalizeHadithResponse({ content: [{ type: "text", text: source }] }, { id: "66397" });
  assert.equal(record.reference.source_label_ar, "رواه أبو داود والترمذي والنسائي وأحمد");
  assert.equal(record.reference.precision, "collection_level");
  assert.equal(record.reference.primary_locator_available, false);
  assert.match(record.reference.work_title_ar, /سنن أبي داود/);
  assert.equal(record.text.endsWith("بِضُعَفَائِكُمْ»."), true);
});

test("Search results remain candidates until full retrieval", () => {
  const records = normalizeSearchResponse({ structuredContent: { results: [
    { id: "hadith:42:ar", title: "نتيجة", url: "https://example.test/42" },
  ] } });
  assert.equal(records[0].state, "candidate_requires_full_fetch");
});
