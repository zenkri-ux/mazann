import fs from "node:fs/promises";

export class HadithLocatorIndex {
  constructor(payload) {
    if (payload?.schema_version !== "1.0.0" || !Array.isArray(payload?.records)) {
      throw new TypeError("Hadith locator index is invalid");
    }
    this.metadata = Object.freeze({ ...payload.metadata, record_count: payload.records.length });
    this.records = new Map(payload.records.map((record) => [String(record.hadeethenc_id), record]));
  }

  static async load(filePath) {
    return new HadithLocatorIndex(JSON.parse(await fs.readFile(filePath, "utf8")));
  }

  enrich(record) {
    if (record?.source_family !== "hadith") return record;
    const locator = this.records.get(String(record.metadata?.hadith_id));
    if (!locator) return record;
    if (locator.matn_checksum_sha256 !== record.checksum_sha256) {
      return {
        ...record,
        metadata: {
          ...record.metadata,
          locator_audit: {
            status: "blocked_checksum_mismatch",
            locator_version: this.metadata.version ?? null,
          },
        },
      };
    }

    const sourceLabels = locator.primary_sources.map((source) => `${source.collection_ar} رقم ${source.number_ar}`);
    return {
      ...record,
      reference: {
        ...record.reference,
        key: locator.reference_key,
        work_title_ar: locator.primary_sources.map((source) => source.collection_ar).join(" و"),
        locator_ar: sourceLabels.join("؛ "),
        source_label_ar: locator.source_label_ar,
        precision: "exact_collection_number",
        primary_locator_available: true,
        verification_note_ar: "طابق محدد التخريج رقم سجل HadeethEnc وبصمة المتن قبل إظهار أرقام المصادر الأصلية.",
        primary_sources: locator.primary_sources,
        verification: locator.verification,
      },
      metadata: {
        ...record.metadata,
        locator_audit: {
          status: "matched_id_and_checksum",
          locator_version: this.metadata.version ?? null,
          verified_at: locator.verified_at,
        },
      },
    };
  }
}
