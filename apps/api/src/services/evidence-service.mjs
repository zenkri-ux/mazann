import { ensureReferenceProvenance, normalizeHadithResponse, normalizeQuranResponse, normalizeSearchResponse } from "@mazann/domain";
import { suggestEvidenceAxis } from "../lib/evidence-axis-placement.mjs";

const ARABIC_RETRIEVAL_STOPWORDS = new Set([
  "إلى", "الى", "أو", "او", "أي", "اي", "أن", "ان", "إن", "عن", "على", "في", "من", "مع",
  "ما", "ماذا", "متى", "هل", "كيف", "لماذا", "وما", "وهو", "وهي", "هذا", "هذه", "ذلك", "تلك",
  "التي", "الذي", "الذين", "بين", "ضمن", "حول", "لدى", "عند", "كل", "ثم", "دون", "نحو",
  "الموضوع", "البحث", "المحور", "السياق", "الواقع", "المحلي", "فهم", "تأصيل", "معنى", "أثر",
  "المؤسس", "التطبيقي", "تطبيق", "تحويل", "بيان", "عرض", "صور", "أبرز", "يمكن", "ينبغي",
  "أهمية", "اهمية", "مكانة", "المقصود", "المصادر", "المعتمدة", "تعرض", "البناء", "الإيماني", "الاخلاقي",
]);

const CURATED_TOPIC_QUERIES = Object.freeze([
  {
    matches: /(?:^|\s)ال?امانه(?:\s|$)/u,
    query: "الأمانة أداء خيانة",
  },
]);

function normalizedTopicKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0640\u064B-\u065F\u0670]/gu, "")
    .replace(/[إأآٱ]/gu, "ا")
    .replace(/ة/gu, "ه")
    .replace(/[^\p{Script=Arabic}\p{N}]+/gu, " ")
    .trim();
}

function retrievalTokens(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0640\u064B-\u065F\u0670]/gu, "")
    .match(/[\p{Script=Arabic}\p{N}]+/gu)?.filter((token) => (
      token.length > 2 && !ARABIC_RETRIEVAL_STOPWORDS.has(token)
    )) ?? [];
}

export function compileRetrievalQuery({ roadmap, axis, maxTokens = 7, maxLength = 96 }) {
  const topicKey = normalizedTopicKey(roadmap?.brief?.topic);
  const curated = CURATED_TOPIC_QUERIES.find((entry) => entry.matches.test(topicKey));
  if (curated) return curated.query;

  if (/(?:^|\s)صله\s+(?:ال)?(?:رحم|ارحام)(?:\s|$)/u.test(topicKey)) {
    const axisTerms = retrievalTokens([axis?.title, axis?.research_question].filter(Boolean).join(" "))
      .filter((token) => !/(?:صل[هة]|رحم|قرب|اخلاق|ايمان|ادله)/u.test(normalizedTopicKey(token)));
    return ["صلة", "الرحم", "الأرحام", "القربى", ...new Set(axisTerms)].slice(0, maxTokens).join(" ").slice(0, maxLength);
  }

  const ordered = [
    ...retrievalTokens(roadmap?.brief?.topic),
    ...retrievalTokens(axis?.title),
    ...retrievalTokens(axis?.research_question),
  ];
  const unique = [];
  const seen = new Set();
  for (const token of ordered) {
    const key = token.toLocaleLowerCase("ar");
    if (seen.has(key)) continue;
    seen.add(key);
    if ([...unique, token].join(" ").length > maxLength) break;
    unique.push(token);
    if (unique.length >= maxTokens) break;
  }
  return unique.length >= 2
    ? unique.join(" ")
    : String(axis?.research_question ?? roadmap?.brief?.topic ?? "").trim().slice(0, maxLength);
}

function selectDiverseCandidates(candidateMap, axes, maxRecords) {
  const available = [...candidateMap.values()];
  const selected = [];
  const used = new Set();
  const add = (entry) => {
    if (!entry || used.has(entry.candidate.id) || selected.length >= maxRecords) return;
    selected.push(entry);
    used.add(entry.candidate.id);
  };

  // Give every axis a first opportunity before using the limited result budget
  // for a second source on an earlier axis.
  for (const axis of axes) {
    add(available.find((entry) => entry.axis_ids.includes(axis.axis_id)
      && entry.candidate.source_family === "quran" && !used.has(entry.candidate.id))
      ?? available.find((entry) => entry.axis_ids.includes(axis.axis_id) && !used.has(entry.candidate.id)));
  }
  for (const axis of axes) {
    for (const source of ["quran", "hadith"]) {
      add(available.find((entry) => entry.axis_ids.includes(axis.axis_id)
        && entry.candidate.source_family === source && !used.has(entry.candidate.id)));
    }
  }
  for (const entry of available) add(entry);
  return selected;
}

function sourceFailures(result, requestedSources) {
  const diagnosticText = (result?.content ?? [])
    .filter((item) => item?.type === "text" && typeof item.text === "string")
    .map((item) => item.text)
    .join("\n");

  return requestedSources.filter((source) => {
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`${escaped}:\\s*unavailable`, "i").test(diagnosticText);
  });
}

function mergeCandidates(...groups) {
  const candidates = new Map();
  for (const group of groups) {
    for (const candidate of group) candidates.set(candidate.id, candidate);
  }
  return [...candidates.values()];
}

function fuseQuranCandidates(lexical, semantic, limit) {
  if (!semantic.length) return lexical.slice(0, limit);
  const fused = new Map();
  const strongLexicalAnchor = lexical[0]?.retrieval?.exact_quran_phrase
    || (lexical[0]?.retrieval?.query_coverage ?? 0) >= 0.5
    || lexical[0]?.retrieval?.matched_fields?.includes("curated_topic_expansion");
  const lexicalWeight = strongLexicalAnchor ? 3 : 2;
  const semanticWeight = 1;
  for (const [channel, candidates] of [["lexical", lexical], ["semantic", semantic]]) {
    candidates.forEach((candidate, rank) => {
      const current = fused.get(candidate.id) ?? { candidate, score: 0, channels: [] };
      current.score += (channel === "lexical" ? lexicalWeight : semanticWeight) / (60 + rank + 1);
      current.channels.push(channel);
      fused.set(candidate.id, current);
    });
  }
  const ranked = [...fused.values()].sort((left, right) => right.score - left.score);
  if (strongLexicalAnchor && lexical[0]) {
    const anchorIndex = ranked.findIndex((item) => item.candidate.id === lexical[0].id);
    if (anchorIndex > 0) ranked.unshift(ranked.splice(anchorIndex, 1)[0]);
  }
  return ranked.slice(0, limit).map(({ candidate, score, channels }) => ({
      ...candidate,
      retrieval: {
        ...candidate.retrieval,
        mode: "quran_lexical_semantic_rrf",
        score: Number(score.toFixed(6)),
        channels,
      },
    }));
}

function fuseHadithCandidates(lexical, semantic, limit) {
  if (!semantic.length) return lexical.slice(0, limit);
  const fused = new Map();
  for (const [channel, candidates, weight] of [["lexical", lexical, 2], ["semantic", semantic, 1]]) {
    candidates.forEach((candidate, rank) => {
      const current = fused.get(candidate.id) ?? { candidate, score: 0, channels: [] };
      current.score += weight / (60 + rank + 1);
      current.channels.push(channel);
      if (channel === "semantic") {
        current.indexedMatnSha256 = candidate.retrieval?.indexed_matn_sha256;
        current.semanticMatchedFields = candidate.retrieval?.matched_fields;
      }
      fused.set(candidate.id, current);
    });
  }
  return [...fused.values()].sort((a, b) => b.score - a.score).slice(0, limit).map(({ candidate, score, channels, indexedMatnSha256, semanticMatchedFields }) => ({
    ...candidate,
    retrieval: { ...candidate.retrieval, mode: "hadith_live_lexical_semantic_rrf", score: Number(score.toFixed(6)), channels,
      ...(indexedMatnSha256 ? { indexed_matn_sha256: indexedMatnSha256 } : {}),
      ...(semanticMatchedFields ? { matched_fields: semanticMatchedFields } : {}) },
  }));
}

export class EvidenceUnavailableError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "EvidenceUnavailableError";
    this.code = "EVIDENCE_UNAVAILABLE";
    this.details = details;
  }
}

export class EvidenceService {
  constructor({ client, cache, cacheWrite = true, quranIndex = null, quranSemanticIndex = null, hadithSemanticIndex = null, hadithLocator = null, tafsirLinks = null }) {
    this.client = client;
    this.cache = cache;
    this.cacheWrite = cacheWrite;
    this.quranIndex = quranIndex;
    this.quranSemanticIndex = quranSemanticIndex;
    this.hadithSemanticIndex = hadithSemanticIndex;
    this.hadithLocator = hadithLocator;
    this.tafsirLinks = tafsirLinks;
  }

  async search({ query, semanticQuery = query, topic = query, sources = ["quran", "hadith"], language = "ar", limit = 10 }) {
    const usesLocalQuran = sources.includes("quran") && language === "ar" && this.quranIndex;
    const grounded = (candidate) => !this.quranIndex.isTopicGrounded || this.quranIndex.isTopicGrounded(candidate.id, topic);
    const lexicalQuranCandidates = usesLocalQuran ? this.quranIndex.search(query, { limit: limit * 8 }).filter(grounded) : [];
    let semanticQuranCandidates = [];
    const semanticWarnings = [];
    if (usesLocalQuran && this.quranSemanticIndex) {
      try { semanticQuranCandidates = (await this.quranSemanticIndex.search(semanticQuery, { limit: limit * 8 })).filter(grounded); }
      catch { semanticWarnings.push({ source: "quran_semantic", code: "SEMANTIC_UNAVAILABLE_LEXICAL_FALLBACK" }); }
    }
    const localQuranCandidates = usesLocalQuran
      ? fuseQuranCandidates(lexicalQuranCandidates, semanticQuranCandidates, limit) : [];
    let semanticHadithCandidates = [];
    if (sources.includes("hadith") && language === "ar" && this.hadithSemanticIndex) {
      try { semanticHadithCandidates = await this.hadithSemanticIndex.search(semanticQuery, { limit: limit * 5 }); }
      catch { semanticWarnings.push({ source: "hadith_semantic", code: "SEMANTIC_UNAVAILABLE_LEXICAL_FALLBACK" }); }
    }
    const remoteSources = usesLocalQuran ? sources.filter((source) => source !== "quran") : sources;
    if (!remoteSources.length) {
      return {
        retrieval_mode: semanticQuranCandidates.length ? "quran_lexical_semantic_rrf" : "local_quran_fielded_bm25",
        query,
        candidates: localQuranCandidates,
        retry_count: 0,
        source_warnings: semanticWarnings,
        notice: "نتائج البحث مرشحات فقط؛ لا يعتمد نص الآية إلا بعد جلب السجل الكامل من المصدر الرسمي والتحقق منه.",
      };
    }

    let result;
    try { result = await this.client.callTool("search", { query, sources: remoteSources, language, limit }); }
    catch (error) {
      if (!localQuranCandidates.length && !semanticHadithCandidates.length) throw error;
      result = { content: remoteSources.map((source) => ({ type: "text", text: `${source}: unavailable` })), structuredContent: { results: [] } };
    }
    const firstCandidates = normalizeSearchResponse(result);
    const unavailableSources = sourceFailures(result, remoteSources);
    let retryCandidates = [];
    let remainingUnavailable = unavailableSources;

    // The official Qur'an index can time out on a cold query while completing
    // the lookup in the background. One bounded retry recovers that result and
    // keeps a persistent upstream failure distinct from a genuine empty match.
    if (unavailableSources.length) {
      try {
        const retry = await this.client.callTool("search", {
          query,
          sources: unavailableSources,
          language,
          limit,
        });
        retryCandidates = normalizeSearchResponse(retry);
        remainingUnavailable = sourceFailures(retry, unavailableSources);
      } catch {
        // Preserve candidates returned by healthy corpora. The warning below
        // still makes the failed source visible to the caller and interface.
        remainingUnavailable = unavailableSources;
      }
    }

    const lexicalHadithCandidates = mergeCandidates(firstCandidates, retryCandidates)
      .filter((candidate) => candidate.source_family === "hadith");
    const hadithCandidates = fuseHadithCandidates(lexicalHadithCandidates, semanticHadithCandidates, limit);
    const otherRemoteCandidates = mergeCandidates(firstCandidates, retryCandidates)
      .filter((candidate) => candidate.source_family !== "hadith");
    return {
      retrieval_mode: usesLocalQuran
        ? (semanticQuranCandidates.length ? "quran_lexical_semantic_rrf_and_live_mcp" : "local_quran_bm25_and_live_mcp")
        : (semanticHadithCandidates.length ? "hadith_live_lexical_semantic_rrf" : "live_mcp"),
      query,
      candidates: mergeCandidates(localQuranCandidates, hadithCandidates, otherRemoteCandidates),
      retry_count: unavailableSources.length ? 1 : 0,
      source_warnings: [...semanticWarnings, ...remainingUnavailable.map((source) => ({
        source,
        code: "SOURCE_UNAVAILABLE_AFTER_RETRY",
      }))],
      notice: "نتائج البحث مرشحات فقط؛ لا تعتمد حتى يجلب السجل الكامل ويمر بالتحقق.",
    };
  }

  async quran({ surah, ayah, language = "ar" }) {
    const cacheId = `quran:${surah}:${ayah}:ar`;
    return this.#retrieve({
      cacheId,
      tool: "get_quran_verses",
      args: { surah, ayah, language },
      normalize: (result) => {
        const record = normalizeQuranResponse(result, { surah, ayah, language });
        return this.tafsirLinks?.enrich(record) ?? record;
      },
      enrichCached: (record) => this.tafsirLinks?.enrich(record) ?? record,
    });
  }

  async hadith({ id, language = "ar" }) {
    const cacheId = `hadith:${id}:ar`;
    return this.#retrieve({
      cacheId,
      tool: "get_hadith",
      args: { id, language },
      normalize: (result) => {
        const record = normalizeHadithResponse(result, { id, language });
        return this.hadithLocator?.enrich(record) ?? record;
      },
      enrichCached: (record) => this.hadithLocator?.enrich(record) ?? record,
    });
  }

  async fetchCandidate({ id, language = "ar" }) {
    const hadith = /^hadith:(\d+):/.exec(id);
    if (hadith) return this.hadith({ id: hadith[1], language });

    const quran = /^quran:(\d+):(\d+):/.exec(id);
    if (quran) return this.quran({ surah: Number(quran[1]), ayah: Number(quran[2]), language });

    throw Object.assign(new Error("نوع النتيجة غير مدعوم بعد في مسار المراجعة"), {
      status: 422,
      code: "UNSUPPORTED_CANDIDATE_TYPE",
    });
  }

  async collectForRoadmap({ roadmap, perAxisLimit = 8, maxRecords = 12 }) {
    if (!roadmap || typeof roadmap.roadmap_id !== "string" || !Array.isArray(roadmap.axes)) {
      throw Object.assign(new Error("خارطة البحث غير صالحة"), { status: 400, code: "INVALID_ROADMAP" });
    }
    if (!roadmap.axes.length || roadmap.axes.length > 6) {
      throw Object.assign(new Error("عدد محاور الخارطة غير صالح"), { status: 400, code: "INVALID_ROADMAP_AXES" });
    }

    const searches = await Promise.allSettled(roadmap.axes.map(async (axis) => {
      if (typeof axis.axis_id !== "string" || typeof axis.research_question !== "string") {
        throw Object.assign(new Error("بيانات المحور غير مكتملة"), { code: "INVALID_ROADMAP_AXIS" });
      }
      const requested = new Set(axis.evidence_requirements ?? []);
      const sources = ["quran", "hadith"].filter((source) => requested.has(source));
      const effectiveSources = sources.length ? sources : ["quran", "hadith"];
      const compiledQuery = compileRetrievalQuery({ roadmap, axis });
      const semanticQuery = [roadmap.brief?.topic, axis.title, axis.research_question]
        .filter(Boolean).join(". ").slice(0, 500);
      const result = await this.search({
        query: compiledQuery,
        semanticQuery,
        topic: roadmap.brief?.topic ?? compiledQuery,
        sources: effectiveSources,
        language: roadmap.brief?.language ?? "ar",
        limit: perAxisLimit,
      });
      return {
        axis_id: axis.axis_id,
        candidates: result.candidates,
        source_warnings: result.source_warnings,
        trace: {
          axis_id: axis.axis_id,
          original_question: axis.research_question,
          compiled_query: compiledQuery,
          semantic_query: semanticQuery,
          sources: effectiveSources,
          candidate_count: result.candidates.length,
          retry_count: result.retry_count,
          retrieval_mode: result.retrieval_mode,
          ranked_candidates: result.candidates.slice(0, perAxisLimit).map((candidate) => ({
            id: candidate.id,
            score: candidate.retrieval?.score ?? null,
            query_coverage: candidate.retrieval?.query_coverage ?? null,
            matched_fields: candidate.retrieval?.matched_fields ?? null,
          })),
        },
      };
    }));

    const candidateMap = new Map();
    const searchFailures = [];
    const searchTrace = [];
    searches.forEach((search, index) => {
      const axisId = roadmap.axes[index]?.axis_id ?? `axis-${index + 1}`;
      if (search.status === "rejected") {
        searchFailures.push({ axis_id: axisId, code: search.reason?.code ?? "SEARCH_FAILED" });
        return;
      }
      searchTrace.push(search.value.trace);
      for (const warning of search.value.source_warnings ?? []) {
        searchFailures.push({ axis_id: axisId, source: warning.source, code: warning.code });
      }
      for (const candidate of search.value.candidates) {
        if (!candidateMap.has(candidate.id)) candidateMap.set(candidate.id, { candidate, axis_ids: [] });
        candidateMap.get(candidate.id).axis_ids.push(axisId);
      }
    });

    const selected = selectDiverseCandidates(candidateMap, roadmap.axes, maxRecords);
    const fetched = await Promise.allSettled(selected.map(({ candidate }) => this.fetchCandidate({
      id: candidate.id,
      language: roadmap.brief?.language ?? "ar",
    })));
    const records = [];
    const unresolved = [];
    fetched.forEach((result, index) => {
      const selectedCandidate = selected[index];
      if (result.status === "fulfilled") {
        const expectedHash = selectedCandidate.candidate.retrieval?.indexed_matn_sha256;
        if (expectedHash && result.value.record.checksum_sha256 !== expectedHash) {
          unresolved.push({ id: selectedCandidate.candidate.id, axis_ids: selectedCandidate.axis_ids, code: "INDEXED_MATN_SOURCE_DRIFT" });
          return;
        }
        records.push({
          ...result.value,
          ...suggestEvidenceAxis(result.value.record, roadmap.axes),
          search_axis_ids: selectedCandidate.axis_ids,
        });
      } else {
        unresolved.push({
          id: selectedCandidate.candidate.id,
          axis_ids: selectedCandidate.axis_ids,
          code: result.reason?.code ?? "FULL_FETCH_FAILED",
        });
      }
    });

    return {
      roadmap_id: roadmap.roadmap_id,
      retrieval_mode: "roadmap_search_then_full_fetch",
      records,
      unresolved,
      search_failures: searchFailures,
      search_trace: searchTrace,
      notice: "اعتمدت السجلات الكاملة فقط؛ لم تتحول مقتطفات البحث أو النتائج المتعذرة إلى أدلة.",
    };
  }

  async #retrieve({ cacheId, tool, args, normalize, enrichCached = (record) => record }) {
    try {
      const result = await this.client.callTool(tool, args);
      const record = normalize(result);
      if (record.validation.status !== "valid") {
        throw new EvidenceUnavailableError("أعيد السجل لكنه لم يجتز فحوص السلامة", {
          record_id: record.id,
          validation: record.validation,
        });
      }
      if (this.cacheWrite) await this.cache.write(record);
      return { retrieval_mode: "live", record };
    } catch (error) {
      if (error instanceof EvidenceUnavailableError) throw error;
      const cached = await this.cache.read(cacheId);
      if (cached?.record?.validation?.status === "valid") {
        return {
          retrieval_mode: "cache",
          cached_at: cached.cached_at,
          upstream_error: { code: error.code ?? "UPSTREAM_ERROR", message: error.message },
          record: enrichCached(ensureReferenceProvenance(cached.record)),
        };
      }
      throw new EvidenceUnavailableError("تعذر جلب الدليل ولا توجد نسخة مخزنة صالحة", {
        record_id: cacheId,
        upstream_error: { code: error.code ?? "UPSTREAM_ERROR", message: error.message },
      });
    }
  }
}
