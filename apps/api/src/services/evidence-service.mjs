import { normalizeHadithResponse, normalizeQuranResponse, normalizeSearchResponse } from "@mazann/domain";

export class EvidenceUnavailableError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "EvidenceUnavailableError";
    this.code = "EVIDENCE_UNAVAILABLE";
    this.details = details;
  }
}

export class EvidenceService {
  constructor({ client, cache, cacheWrite = true }) {
    this.client = client;
    this.cache = cache;
    this.cacheWrite = cacheWrite;
  }

  async search({ query, sources = ["quran", "hadith"], language = "ar", limit = 10 }) {
    const result = await this.client.callTool("search", { query, sources, language, limit });
    return {
      retrieval_mode: "live",
      query,
      candidates: normalizeSearchResponse(result),
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
      normalize: (result) => normalizeHadithResponse(result, { id, language }),
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

  async #retrieve({ cacheId, tool, args, normalize }) {
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
          record: cached.record,
        };
      }
      throw new EvidenceUnavailableError("تعذر جلب الدليل ولا توجد نسخة مخزنة صالحة", {
        record_id: cacheId,
        upstream_error: { code: error.code ?? "UPSTREAM_ERROR", message: error.message },
      });
    }
  }
}
