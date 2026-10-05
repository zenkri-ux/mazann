import fs from "node:fs/promises";

const ARABIC_DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/gu;
const TOKEN_PATTERN = /[\p{Script=Arabic}\p{N}]+/gu;
const STOPWORDS = new Set([
  "إلى", "الى", "أو", "او", "أن", "ان", "إن", "عن", "على", "في", "من", "مع", "ما", "ماذا",
  "متى", "هل", "كيف", "لماذا", "هذا", "هذه", "ذلك", "تلك", "التي", "الذي", "الذين", "بين", "كل",
  "ثم", "دون", "نحو", "عند", "لدى", "هو", "هي", "كان", "كانت", "يكون", "تكون", "حول", "ضمن",
  "الي", "التي", "الذي", "الذين",
]);
const GENERIC_TOPIC_TOKENS = new Set(["اهميه", "مكانه", "فضل", "اثر", "دور", "بحث", "موضوع", "خطبه", "جمعه", "اسلام"]);
// A high-precision disambiguation pilot: these ayat mention kinship as an
// incidental example, an inheritance rule, or a context-specific statement,
// not as a clear primary proof for a general sermon on maintaining kinship.
const KINSHIP_CONTEXT_ONLY = new Set(["quran:14:18:ar", "quran:33:6:ar", "quran:42:23:ar", "quran:60:3:ar"]);
const THEMATIC_EXPANSIONS = Object.freeze({
  امانه: ["امانات", "تودوا", "اهلها", "عدل", "عهد"],
  امانات: ["امانه", "تودوا", "اهلها", "عدل", "عهد"],
  شائعه: ["نبا", "خبر", "افك", "قول", "فاسق", "تبين", "تثبت"],
  شائعات: ["نبا", "خبر", "افك", "قول", "فاسق", "تبين", "تثبت"],
  اخبار: ["نبا", "خبر", "فاسق", "تبين", "تثبت"],
  ضعفاء: ["مستضعف", "مسكين", "فقير", "يتيم", "سائل", "محتاج"],
  كرامه: ["تكريم", "اهانه", "اذلال"],
  تكافل: ["تعاون", "انفاق", "صدقه", "مسكين", "يتيم", "محتاج"],
  تعاون: ["بر", "تقوي", "انفاق", "تكافل"],
});

export function normalizeArabicForSearch(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(ARABIC_DIACRITICS, "")
    .replace(/\u0640/gu, "")
    .replace(/[إأآٱ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ؤ/gu, "و")
    .replace(/ئ/gu, "ي")
    .replace(/ة/gu, "ه")
    .replace(/[^\p{Script=Arabic}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function arabicSearchTokens(value) {
  return normalizeArabicForSearch(value).match(TOKEN_PATTERN)?.map((token) => {
    let stem = token;
    if (STOPWORDS.has(stem)) return stem;
    if (!stem.startsWith("والد")) stem = stem.replace(/^و(?=ال)/u, "");
    stem = stem.replace(/^(?:فال|بال|كال|لل)/u, "");
    if (stem !== "الله") stem = stem.replace(/^ال/u, "");
    if (/^ب.{4,}$/u.test(stem)) stem = stem.slice(1);
    const withoutPronoun = stem.replace(/(?:كما|هما|كم|كن|هم|هن|ها|نا|تم)$/u, "");
    if (withoutPronoun !== stem && withoutPronoun.length >= 3) {
      stem = withoutPronoun.endsWith("ت") ? `${withoutPronoun.slice(0, -1)}ه` : withoutPronoun;
    }
    if (stem.endsWith("ات") && stem.length > 4) stem = `${stem.slice(0, -2)}ه`;
    return stem;
  }).filter((token) => token.length > 1 && !STOPWORDS.has(token)) ?? [];
}

function termFrequency(tokens) {
  const counts = new Map();
  for (const token of tokens) {
    const variants = new Set([token]);
    const queue = [token];
    while (queue.length) {
      const value = queue.shift();
      const derived = [];
      if (/^[وبفك].{3,}$/u.test(value) && !value.startsWith("والد")) derived.push(value.slice(1));
      if (/^ال.{2,}$/u.test(value) && value !== "الله") derived.push(value.slice(2));
      const withoutSuffix = value.replace(/(?:هما|كما|هم|هن|ها|كم|كن|وا|ون|ين|ه)$/u, "");
      if (withoutSuffix.length >= 3 && withoutSuffix !== value) derived.push(withoutSuffix);
      for (const item of derived) {
        if (variants.has(item)) continue;
        variants.add(item);
        queue.push(item);
      }
    }
    for (const variant of variants) counts.set(variant, (counts.get(variant) ?? 0) + 1);
  }
  return counts;
}

function bm25(queryTokens, document, stats, field) {
  const frequencies = document[`${field}_frequencies`];
  const length = document[`${field}_length`];
  const averageLength = stats[`average_${field}_length`] || 1;
  const k1 = 1.2;
  const b = 0.75;
  let score = 0;

  for (const token of queryTokens) {
    const frequency = frequencies.get(token) ?? 0;
    if (!frequency) continue;
    const documentFrequency = stats.document_frequencies.get(token) ?? 0;
    const inverseFrequency = Math.log(1 + ((stats.document_count - documentFrequency + 0.5) / (documentFrequency + 0.5)));
    score += inverseFrequency * ((frequency * (k1 + 1)) / (frequency + k1 * (1 - b + b * (length / averageLength))));
  }
  return score;
}

function scoreDocument(queryTokens, normalizedQuery, document, stats) {
  const quranScore = bm25(queryTokens, document, stats, "quran");
  const explanationScore = bm25(queryTokens, document, stats, "explanation");
  const matched = new Set(queryTokens.filter((token) => (
    document.quran_frequencies.has(token) || document.explanation_frequencies.has(token)
  ))).size;
  const coverage = queryTokens.length ? matched / new Set(queryTokens).size : 0;
  const exactPhrase = normalizedQuery.length > 2 && document.quran_search_text.includes(normalizedQuery) ? 1 : 0;
  const expansionTokens = [...new Set(queryTokens.flatMap((token) => THEMATIC_EXPANSIONS[token] ?? []))];
  const thematicScore = expansionTokens.length
    ? (bm25(expansionTokens, document, stats, "quran") * 1.4) + (bm25(expansionTokens, document, stats, "explanation") * 0.6)
    : 0;
  const score = (quranScore * 2.4) + explanationScore + (thematicScore * 0.55) + (coverage * 3) + (exactPhrase * 8);
  return { score, quranScore, explanationScore, thematicScore, coverage, exactPhrase };
}

export class QuranSearchIndex {
  constructor(payload) {
    if (payload?.schema_version !== "1.0.0" || !Array.isArray(payload?.documents)) {
      throw new TypeError("Quran search index is invalid");
    }
    this.metadata = Object.freeze({ ...payload.metadata, document_count: payload.documents.length });
    this.documents = payload.documents.map((document) => {
      const quranTokens = arabicSearchTokens(document.quran_search_text);
      const explanationTokens = arabicSearchTokens(document.explanation_search_text);
      return {
        ...document,
        quran_length: quranTokens.length,
        explanation_length: explanationTokens.length,
        quran_frequencies: termFrequency(quranTokens),
        explanation_frequencies: termFrequency(explanationTokens),
      };
    });
    this.documentsById = new Map(this.documents.map((document) => [document.id, document]));

    const documentFrequencies = new Map();
    for (const document of this.documents) {
      const unique = new Set([
        ...document.quran_frequencies.keys(),
        ...document.explanation_frequencies.keys(),
      ]);
      for (const token of unique) documentFrequencies.set(token, (documentFrequencies.get(token) ?? 0) + 1);
    }
    this.stats = {
      document_count: this.documents.length,
      document_frequencies: documentFrequencies,
      average_quran_length: this.documents.reduce((sum, item) => sum + item.quran_length, 0) / this.documents.length,
      average_explanation_length: this.documents.reduce((sum, item) => sum + item.explanation_length, 0) / this.documents.length,
    };
  }

  static async load(filePath) {
    return new QuranSearchIndex(JSON.parse(await fs.readFile(filePath, "utf8")));
  }

  isTopicGrounded(id, topic) {
    const document = this.documentsById.get(id);
    if (!document) return false;
    const normalizedTopic = normalizeArabicForSearch(topic);
    const content = `${document.quran_search_text} ${document.explanation_search_text}`;
    if (/(?:^| )صله (?:ال)?(?:رحم|ارحام)(?: |$)/u.test(normalizedTopic)) {
      if (KINSHIP_CONTEXT_ONLY.has(id)) return false;
      const previous = this.documentsById.get(`quran:${document.surah}:${document.ayah - 1}:ar`);
      const next = this.documentsById.get(`quran:${document.surah}:${document.ayah + 1}:ar`);
      const sharedExplanation = document.explanation_search_text === previous?.explanation_search_text
        || document.explanation_search_text === next?.explanation_search_text;
      if (sharedExplanation && !/(?:ارحام|قربي|قراب|مقربه|يصلون|يوصل|تقطع)/u.test(document.quran_search_text)) return false;
      // "الأرحام" can also refer to wombs. Require a kinship cue, not the word alone.
      return /(?:قربي|قراب|اقارب|اقربين)/u.test(content)
        || (/(?:ارحام|رحم)/u.test(content) && /(?:صله|يصلون|يوصل|تقطع|قطعوا|وصل|برهم)/u.test(content));
    }
    const anchors = arabicSearchTokens(topic).filter((token) => !GENERIC_TOPIC_TOKENS.has(token));
    return anchors.length > 0 && anchors.some((token) => document.quran_frequencies.has(token) || document.explanation_frequencies.has(token));
  }

  search(query, { limit = 10 } = {}) {
    const normalizedQuery = normalizeArabicForSearch(query);
    const queryTokens = arabicSearchTokens(query);
    if (!queryTokens.length) return [];

    return this.documents
      .map((document) => ({ document, relevance: scoreDocument(queryTokens, normalizedQuery, document, this.stats) }))
      .filter(({ relevance }) => relevance.score > 0 && (relevance.coverage >= 0.2 || relevance.thematicScore > 0))
      .sort((left, right) => (
        right.relevance.exactPhrase - left.relevance.exactPhrase
        || right.relevance.score - left.relevance.score
        || right.relevance.coverage - left.relevance.coverage
        || left.document.surah - right.document.surah
        || left.document.ayah - right.document.ayah
      ))
      .slice(0, limit)
      .map(({ document, relevance }) => ({
        id: document.id,
        title: document.title,
        citation_url: document.citation_url,
        source_family: "quran",
        state: "candidate_requires_full_fetch",
        retrieval: {
          mode: "local_fielded_bm25",
          matched_fields: [
            ...(relevance.quranScore > 0 ? ["quran_text"] : []),
            ...(relevance.explanationScore > 0 ? ["published_explanation"] : []),
            ...(relevance.thematicScore > 0 ? ["curated_topic_expansion"] : []),
          ],
          score: Number(relevance.score.toFixed(4)),
          query_coverage: Number(relevance.coverage.toFixed(4)),
          exact_quran_phrase: Boolean(relevance.exactPhrase),
        },
      }));
  }
}
