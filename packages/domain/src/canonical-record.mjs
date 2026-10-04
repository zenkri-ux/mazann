import { createHash } from "node:crypto";

const BEGIN_RETRIEVED = /──────── RETRIEVED FROM ([A-Z]+).*?────────/;
const SOURCE_URL = /(?:^|\n)Source:\s*(https:\/\/[^\s]+)/;
const CITE_URL = /(?:^|\n)(https:\/\/[^\s]+)\s*\nCopy it exactly/;
const surahNames = ["الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس","هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه","الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم","لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر","فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق","الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة","الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج","نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس","التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد","الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات","القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر","المسد","الإخلاص","الفلق","الناس"];

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function between(text, opening, closing) {
  const start = text.indexOf(opening);
  const end = text.indexOf(closing, start + opening.length);
  if (start === -1 || end === -1) return null;
  return text.slice(start + opening.length, end).trim();
}

function stripMarkerInstruction(block) {
  const lines = block.split(/\r?\n/);
  if (/^the\b/i.test(lines[0]?.trim() ?? "")) lines.shift();
  return lines.join("\n").trim();
}

function sourceUrl(text) {
  return text.match(SOURCE_URL)?.[1] ?? text.match(CITE_URL)?.[1] ?? null;
}

function hadithReference(label, providerId) {
  const value = label?.trim() ?? "";
  if (value.includes("متفق عليه")) return {
    key: "hadith:bukhari-muslim", work_title_ar: "صحيح البخاري وصحيح مسلم",
    locator_ar: "متفق عليه", source_label_ar: "صحيح البخاري وصحيح مسلم",
    precision: "collection_level", primary_locator_available: false,
    verification_note_ar: "اسم الكتابين ثابت من وسم «متفق عليه»، لكن رقم الموضع داخلهما غير متاح من الموصل الحالي.",
  };
  const collection = value.includes("البخاري") ? "صحيح البخاري" : value.includes("مسلم") ? "صحيح مسلم" : null;
  if (collection) return {
    key: collection === "صحيح البخاري" ? "hadith:bukhari" : "hadith:muslim",
    work_title_ar: collection, locator_ar: value, source_label_ar: collection,
    precision: "collection_level", primary_locator_available: false,
    verification_note_ar: "رقم الموضع داخل الكتاب الأصلي غير متاح من الموصل الحالي.",
  };
  return {
    key: `hadith:provider:${providerId}`, work_title_ar: "لم يحدد الكتاب الحديثي في بيانات الموصل",
    locator_ar: `سجل HadeethEnc رقم ${providerId}`, source_label_ar: "مرجع حديثي يحتاج استكمالًا",
    precision: "provider_record_only", primary_locator_available: false,
    verification_note_ar: "لا يعتمد في الحقيبة النهائية حتى يضاف اسم الكتاب والباب أو رقم الحديث من مصدر موثوق.",
  };
}

function quranReference(surah, ayah) {
  const name = surahNames[surah - 1] ?? `رقم ${surah}`;
  return {
    key: `quran:${surah}`, work_title_ar: "القرآن الكريم",
    locator_ar: `سورة ${name}، الآية ${ayah}`, source_label_ar: `القرآن الكريم — سورة ${name}`,
    precision: "exact_unit", primary_locator_available: true, verification_note_ar: null,
  };
}

export function ensureReferenceProvenance(record) {
  if (record?.reference && record?.access) return record;
  if (record?.source_family === "quran") {
    record.reference = quranReference(Number(record.metadata?.surah), Number(record.metadata?.ayah));
  } else if (record?.source_family === "hadith") {
    record.reference = hadithReference(record.metadata?.publisher_attribution_label, record.metadata?.hadith_id);
  }
  record.access = { provider_name: record.origin_platform, provider_record_id: record.id, url: record.citation_url };
  return record;
}

function commonRecord({ id, sourceFamily, originPlatform, contentType, language, text, url, metadata, reference }) {
  const checks = {
    has_canonical_id: Boolean(id),
    has_complete_text: Boolean(text?.trim()),
    has_citation_url: Boolean(url),
    has_no_ellipsis: !text?.includes("..."),
  };

  return ensureReferenceProvenance({
    schema_version: "1.0.0",
    id,
    canonical_id: id,
    source_family: sourceFamily,
    origin_platform: originPlatform,
    authority_tier: "official_association_source",
    content_type: contentType,
    language,
    text,
    citation_url: url,
    checksum_sha256: sha256(text),
    fetched_at: new Date().toISOString(),
    upstream_version: null,
    publication_status: "blocked_until_upstream_version_is_recorded",
    metadata,
    reference,
    access: { provider_name: originPlatform, provider_record_id: id, url },
    validation: {
      checks,
      status: Object.values(checks).every(Boolean) ? "valid" : "blocked",
    },
  });
}

export function normalizeQuranResponse(result, { surah, ayah, language = "ar" }) {
  const text = result?.content?.find((item) => item?.type === "text")?.text;
  if (!text || !BEGIN_RETRIEVED.test(text)) throw new Error("Quran response has no retrieved block");

  const exactRaw = between(text, "[EXACT]", "[/EXACT]");
  if (!exactRaw) throw new Error("Quran response has no exact block");

  const exact = stripMarkerInstruction(exactRaw);
  const lines = exact.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const locatorIndex = lines.findIndex((line) => line === `[${surah}:${ayah}]`);
  if (locatorIndex === -1 || !lines[locatorIndex + 1]) {
    throw new Error("Quran response locator does not match the requested ayah");
  }

  const quranText = lines[locatorIndex + 1];
  const translation = lines.slice(locatorIndex + 2).join("\n") || null;
  const url = sourceUrl(text);
  const expectedPath = `/quran/${surah}/${ayah}`;
  const record = commonRecord({
    id: `quran:${surah}:${ayah}:ar`,
    sourceFamily: "quran",
    originPlatform: "QuranEnc via Islamic Content MCP",
    contentType: "ayah",
    language: "ar",
    text: quranText,
    url,
    metadata: {
      surah,
      ayah,
      requested_language: language,
      translation,
      translation_key: text.match(/translation \"([^\"]+)\"/)?.[1] ?? null,
      publisher_marker: "QURANENC",
    },
    reference: quranReference(surah, ayah),
  });

  record.validation.checks.locator_matches = Boolean(url?.includes(expectedPath));
  record.validation.checks.single_complete_ayah = !quranText.includes("…") && quranText.length > 20;
  record.validation.status = Object.values(record.validation.checks).every(Boolean) ? "valid" : "blocked";
  return record;
}

export function normalizeHadithResponse(result, { id, language = "ar" }) {
  const text = result?.content?.find((item) => item?.type === "text")?.text;
  if (!text || !BEGIN_RETRIEVED.test(text)) throw new Error("Hadith response has no retrieved block");

  const exactRaw = between(text, "[EXACT]", "[/EXACT]");
  if (!exactRaw) throw new Error("Hadith response has no exact narration block");
  const narration = stripMarkerInstruction(exactRaw);
  const attribution = between(text, "[ATTRIBUTION]", "[/ATTRIBUTION]") ?? "";
  const commentary = between(text, "[COMMENTARY]", "[/COMMENTARY]");
  const url = sourceUrl(text);
  const grade = attribution.match(/(?:^|\n)Grade:\s*(.+)/)?.[1]?.trim() ?? null;
  const attributionLabel = attribution.match(/(?:^|\n)Narrator:\s*(.+)/)?.[1]?.trim() ?? null;
  const languagesText = text.match(/published in \d+ languages.*?:\s*([^\n.]+)\./)?.[1] ?? "";
  const title = text.split("\n").map((line) => line.trim()).find((line) => line && !line.startsWith("────────")) ?? null;

  const record = commonRecord({
    id: `hadith:${id}:ar`,
    sourceFamily: "hadith",
    originPlatform: "HadeethEnc via Islamic Content MCP",
    contentType: "hadith",
    language,
    text: narration,
    url,
    metadata: {
      hadith_id: String(id),
      title,
      grade,
      publisher_attribution_label: attributionLabel,
      attribution_raw: attribution,
      commentary,
      published_languages: languagesText ? languagesText.split(",").map((item) => item.trim()) : [],
      publisher_marker: "HADEETHENC",
    },
    reference: hadithReference(attributionLabel, String(id)),
  });

  record.validation.checks.locator_matches = Boolean(url?.includes(`/hadith/${id}`));
  record.validation.checks.has_grade = Boolean(grade);
  record.validation.checks.complete_narration = narration.length > 20 && !narration.endsWith("...");
  record.validation.status = Object.values(record.validation.checks).every(Boolean) ? "valid" : "blocked";
  return record;
}

export function normalizeSearchResponse(result) {
  const structured = result?.structuredContent?.results;
  if (!Array.isArray(structured)) throw new Error("Search response has no structured results");
  return structured.map((item) => ({
    id: item.id,
    title: item.title,
    citation_url: item.url,
    source_family: item.id.split(":", 1)[0],
    state: "candidate_requires_full_fetch",
  }));
}
