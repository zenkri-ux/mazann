import { ensureReferenceProvenance, normalizeHadithResponse, normalizeQuranResponse, normalizeSearchResponse } from "@mazann/domain";

const ARABIC_RETRIEVAL_STOPWORDS = new Set([
  "إلى", "الى", "أو", "او", "أي", "اي", "أن", "ان", "إن", "عن", "على", "في", "من", "مع",
  "ما", "ماذا", "متى", "هل", "كيف", "لماذا", "وما", "وهو", "وهي", "هذا", "هذه", "ذلك", "تلك",
  "التي", "الذي", "الذين", "بين", "ضمن", "حول", "لدى", "عند", "كل", "ثم", "دون", "نحو",
  "الموضوع", "البحث", "المحور", "السياق", "الواقع", "المحلي", "فهم", "تأصيل", "معنى", "أثر",
  "المؤسس", "التطبيقي", "تطبيق", "تحويل", "بيان", "عرض", "صور", "أبرز", "يمكن", "ينبغي",
]);

function retrievalTokens(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0640\u064B-\u065F\u0670]/gu, "")
    .match(/[\p{Script=Arabic}\p{N}]+/gu)?.filter((token) => (
      token.length > 2 && !ARABIC_RETRIEVAL_STOPWORDS.has(token)
    )) ?? [];
}

export function compileRetrievalQuery({ roadmap, axis, maxTokens = 7, maxLength = 96 }) {
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

  for (const axis of axes) {
    for (const source of ["quran", "hadith"]) {
      add(available.find((entry) => (
        entry.axis_ids.includes(axis.axis_id)
        && entry.candidate.source_family === source
        && !used.has(entry.candidate.id)
      )));
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

export class EvidenceUnavailableError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "EvidenceUnavailableError";
    this.code = "EVIDENCE_UNAVAILABLE";
    this.details = details;
  }
}

export class EvidenceService {
  constructor({ client, cache, cacheWrite = true, quranIndex = null, hadithLocator = null }) {
    this.client = client;
    this.cache = cache;
    this.cacheWrite = cacheWrite;
    this.quranIndex = quranIndex;
    this.hadithLocator = hadithLocator;
  }

  async search({ query, sources = ["quran", "hadith"], language = "ar", limit = 10 }) {
    const usesLocalQuran = sources.includes("quran") && language === "ar" && this.quranIndex;
    const localQuranCandidates = usesLocalQuran ? this.quranIndex.search(query, { limit }) : [];
    const remoteSources = usesLocalQuran ? sources.filter((source) => source !== "quran") : sources;
    if (!remoteSources.length) {
      return {
        retrieval_mode: "local_quran_fielded_bm25",
        query,
        candidates: localQuranCandidates,
        retry_count: 0,
        source_warnings: [],
        notice: "نتائج البحث مرشحات فقط؛ لا يعتمد نص الآية إلا بعد جلب السجل الكامل من المصدر الرسمي والتحقق منه.",
      };
    }

    const result = await this.client.callTool("search", { query, sources: remoteSources, language, limit });
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

    return {
      retrieval_mode: usesLocalQuran ? "hybrid_local_quran_and_live_mcp" : "live_mcp",
      query,
      candidates: mergeCandidates(localQuranCandidates, firstCandidates, retryCandidates),
      retry_count: unavailableSources.length ? 1 : 0,
      source_warnings: remainingUnavailable.map((source) => ({
        source,
        code: "SOURCE_UNAVAILABLE_AFTER_RETRY",
      })),
      notice: "نتائج البحث مرشحات فقط؛ لا تعتمد حتى يجلب السجل الكامل ويمر بالتحقق.",
    };
  }

  async quran({ surah, ayah, language = "ar" }) {
    const cacheId = `quran:${surah}:${ayah}:ar`;
    return this.#retrieve({
      cacheId,
      tool: "get_quran_verses",
      args: { surah, ayah, language },
      normalize: (result) => normalizeQuranResponse(result, { surah, ayah, language }),
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

  async collectForRoadmap({ roadmap, perAxisLimit = 4, maxRecords = 6 }) {
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
      const result = await this.search({
        query: compiledQuery,
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
        records.push({ ...result.value, axis_ids: selectedCandidate.axis_ids });
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
