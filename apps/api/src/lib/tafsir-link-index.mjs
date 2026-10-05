import fs from "node:fs/promises";

export class TafsirLinkIndex {
  constructor(payload) {
    if (payload?.schema_version !== "1.0.0" || !Array.isArray(payload.sections)) {
      throw new TypeError("Tafsir link index is invalid");
    }
    this.source = payload.source;
    this.verifiedAt = payload.verified_at;
    this.sections = payload.sections.map((section) => {
      const { surah, from_ayah: fromAyah, to_ayah: toAyah, title_ar: title, url } = section;
      const parsed = new URL(url);
      if (![surah, fromAyah, toAyah].every(Number.isInteger) || surah < 1 || surah > 114 || fromAyah < 1 || toAyah < fromAyah || !title || parsed.protocol !== "https:" || parsed.hostname !== "dorar.net" || !parsed.pathname.startsWith(`/tafseer/${surah}/`)) {
        throw new TypeError("Tafsir section must have a precise, trusted locator");
      }
      return Object.freeze({ surah, fromAyah, toAyah, title, url });
    });
    for (let i = 0; i < this.sections.length; i += 1) {
      for (let j = i + 1; j < this.sections.length; j += 1) {
        const a = this.sections[i];
        const b = this.sections[j];
        if (a.surah === b.surah && a.fromAyah <= b.toAyah && b.fromAyah <= a.toAyah) {
          throw new TypeError("Overlapping tafsir sections are ambiguous");
        }
      }
    }
  }

  static async load(filePath) {
    return new TafsirLinkIndex(JSON.parse(await fs.readFile(filePath, "utf8")));
  }

  enrich(record) {
    if (record?.source_family !== "quran") return record;
    const surah = Number(record.metadata?.surah_number ?? record.metadata?.surah);
    const ayah = Number(record.metadata?.ayah_number ?? record.metadata?.ayah);
    const section = this.sections.find((entry) => entry.surah === surah && ayah >= entry.fromAyah && ayah <= entry.toAyah);
    if (!section) return record;
    return {
      ...record,
      related_tafsir: {
        source_family: "tafsir",
        source_name_ar: this.source,
        section_title_ar: section.title,
        citation_url: section.url,
        verified_at: this.verifiedAt,
        access_mode: "external_section_link_only",
        text_included: false,
        note_ar: "رابط سياقي لمراجعة التفسير؛ ليس نص تفسير مسترجعًا ولا دليلًا مستقلًا في الحقيبة.",
      },
    };
  }
}
