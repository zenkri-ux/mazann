# Mazann Approved Knowledge Source Registry

Status: implementation registry

Authority: `المرجعية والحزمة العلمية والبيانات`, pp. 2–15, updated 2 October 2026

Reference snapshot SHA-256: `446911252F2012D36AFE52DB3E9AFAF0DAE52615DA34E134AA4E95A199CD65BF`

Purpose: tell engineering exactly which source to use, for what, and under which constraint

## Integration order for the competition build

| Priority | Deliverable | Why it matters |
|---|---|---|
| P0 | King Fahd Quran identity + QuranEnc translations; HadeethEnc + Dorar grading; ICADB IDs/alignment; approved terminology | Powers the core evidence journey with canonical IDs, approved multilingual text, and traceability. |
| P1 | Official Association MCP plus deterministic API adapters and a versioned local judging cache | Gives breadth without making the live demo dependent on network availability. |
| P1 | Tafsir Center/Dorar, first-three-centuries sources, and audience/topic metadata | Supports structured topic maps and source-backed explanations. |
| P1 | Twelve official safety cases plus multilingual/alignment and whole-unit tests | Makes safety and source fidelity demonstrable rather than asserted. |
| P2 | Fiqh and fatwa references, Risala, Sirah/history, doubts, Arabic corpora | Expands specialist coverage with stricter disagreement and referral controls. |
| P3 | Recitation/audio services and the broader publication libraries | Valuable enrichment after the cited-text workflow is stable. |

## Association for Islamic Content in Languages

The Association is a licensed Saudi nonprofit (registration 2131) serving more than 130 languages. Its published workflow includes translation, linguistic review, and Sharia review/approval. The reference states that the first six platforms below expose `mcp.islamiccontent.org`.

| Platform | Endpoint | Use in Mazann | Required constraint |
|---|---|---|---|
| Quran Encyclopedia | `quranenc.com`; API `quranenc.com/en/home/api` | Approved meanings translations, tafsir-linked multilingual Quran evidence, text/audio/print variants. | Link every translation to canonical surah/ayah and its translation authority; never treat translation as Quranic Arabic. |
| Hadith Encyclopedia | `hadeethenc.com`; API `hadeethenc.com/api-docs` | Authenticated Hadith, explanations, benefits, topics, and approved multilingual versions. | Return the complete Hadith record and preserve collection, number, grading, grader, explanation, and language. |
| Byenah | `byenah.com`; API `byenah.com/ar/api` | Introductory Islam and Muslim-education books and publications. | Store publication, author/reviewer, language, edition, and page/section locator. |
| IslamHouse | `islamhouse.com`; API documentation at `documenter.getpostman.com/view/7929737/TzkyMfPc` | Topic-classified books, articles, published fatwas, audio, and video. | Preserve content type and publication provenance; published fatwa material must not become a personal automated fatwa. |
| Islamic Content Encyclopedia | `islamenc.com/ar`; documented REST link to the central database | Fixed-field cards for Hadith, Q&A, places, names of Allah, terms, figures, and text translations. | Preserve unified card and translation IDs; do not merge card fields into an unattributed paragraph. |
| Islamic Terminology Encyclopedia | `terminologyenc.com` | Reviewed definitions and equivalents for frequent Islamic terms across aqeedah, fiqh, usul, virtues, adab, and Hadith. | Prefer approved equivalents over ad-hoc machine translation; keep definition, explanation, domain, and language. |
| Central Database (ICADB) | `icadb.com`; API docs `icadb.com/api/docs` | Shared source/translation IDs, sentence alignment, book metadata, and semantic retrieval across the Association corpus. | Make it the cross-language identity layer, not a replacement for each originating source's provenance. |

ICADB's sentence-level alignment and unified identifiers should be represented explicitly. At minimum, store `canonical_id`, `source_text_id`, `translation_id`, `sentence_alignment_id`, `language`, `origin_platform`, and `upstream_version`.

## Canonical scripture and Quran sciences

| Source | Endpoint | Approved role | Do not use it as |
|---|---|---|---|
| King Fahd Glorious Qur'an Printing Complex | `qurancomplex.gov.sa`; translations `/quran-translations/`; fonts `fonts.qurancomplex.gov.sa`; developer portal `/quran-dev` | Canonical Quran text/rasm, ayah and word IDs, approved translations, Unicode fonts, and riwayat-aware assets in XML/JSON. | A generic tafsir or free-form topic source. |
| Quranpedia | `quranpedia.net` | Quran material explicitly allowed in the original source table. | A reason to bypass ayah identity and edition checks. |
| Tafsir Center for Quranic Studies | `tafsir.net`; `modoee.com`; `surahapp.com`; `wahy.net` | Scholarly Quran studies, thematic tafsir, surah study, and access to a broad tafsir library; approved apps include Gharib, Al-Kashshaf, Bayyinat, and Mufassal. | Canonical Quran text when the Complex identifier is available. |
| Early tafsir sources and Dorar Tafsir | first three centuries; `dorar.net/tafseer` | Tafsir evidence under the original competition rule. | Quran wording; visually and structurally separate interpretation. |
| MP3Quran | `mp3quran.net`; API `mp3quran.net/api` | Reciter, riwayah/mushaf, radio, stream, recitation audio, and ayah-timing metadata. | Textual authority, translation authority, or interpretation. |

## Hadith, aqeedah, fiqh, fatwa, Sirah, and guidance

| Domain/source | Endpoint or scope | Use and safeguards |
|---|---|---|
| Sahih al-Bukhari and Sahih Muslim | canonical approved editions | Primary Hadith collections. Preserve full record and exact edition/locator. |
| Dorar | `dorar.net`; Hadith JSON search `dorar.net/article/389` | Hadith search, takhrij, scholars' gradings, sources, and identification of widespread unauthentic narrations; also approved domain encyclopedias. Do not reduce multiple gradings to an unexplained boolean. |
| Official Shamela | `shamela.ws/page/download` | Numbered text matching print editions and searchable approved books. Accept only the institution's official database/edition manifest; reject third-party “Shamela” copies and unofficial added books. |
| Aqeedah | first-three-centuries sources or `dorar.net/aqeeda` | Stay within the approved doctrinal scope and preserve work/author/edition. |
| Fiqh | a recognized work in one of the four madhhabs or `dorar.net/feqhia` | Preserve madhhab, position, evidence, and disagreement. Never make an independent automated preference for a personal case. |
| Kuwaiti Fiqh Encyclopedia | `bohoth.awqaf.gov.kw` | Comparative four-madhhab terminology and documented reference material. Keep article, volume/page, and represented positions. |
| Islam Question & Answer | `islamqa.info` | Topic-classified, evidence-based published answers in supported languages. Treat as a named external specialist source, not Association-owned content. |
| Official Bin Baz site | `binbaz.org.sa` | Published books, articles, lessons, programs, and fatwas. Preserve authorship and context. |
| Official Ibn Uthaymeen site | `binothaimeen.net` | Published books, meetings, fatwas, audio library, and transcriptions. Preserve authorship and context. |
| Sirah/history | first-three-centuries sources or `dorar.net/history` | Preserve chronology, event boundary, evidence status, and necessary qualification. |
| Risala of the Two Holy Mosques | `risala.prh.gov.sa` | Sharia- and language-reviewed visitor guidance, rites correction, and multilingual text/audio/video. Approved translation source for this content. |
| Bayyinat Q&A | `dawa.center/file/7937` | Dialogical handling of common doubts. Keep question/answer boundary and cited evidence. |

All external specialist sources are recommended within their fields but remain independently responsible for their content. The UI must name the actual source instead of displaying the Association's review badge.

## Topics, Arabic language, and terminology

| Source | Endpoint | Role |
|---|---|---|
| Digital Da'wah Repository | `dawa.center` | Topic taxonomy and audience adaptation by country, religion, language, and audience category. |
| Al-Jamhara | `islamic-content.com`; dictionary `/dictionary` | Islamic-content vocabulary and sensitive terminology equivalents. |
| King Salman Global Academy for Arabic Language | `ksaa.gov.sa` | Official Arabic linguistic and terminological resources. |
| Riyadh Dictionary | `dictionary.ksaa.gov.sa` | Contemporary Arabic meanings and English equivalents. |
| Siwar dictionaries | `siwar.ksaa.gov.sa` | Multi-dictionary lookup and developer API for Arabic lexical evidence. |
| Falak corpora | `falak.ksaa.gov.sa` | Concordance, frequency, collocation, and corpus evidence. Use for linguistic analysis—not as Islamic doctrinal authority. |

## Source record contract

Every stored record must include the applicable fields below; absence of a required field blocks publication:

- `source_id`, `source_family`, `origin_platform`, `publisher`, `authority_tier`;
- `canonical_id`, upstream URL/locator, work, author/reviewer, edition, volume/page or record number;
- `content_type`, `language`, `source_text_id`, `translation_id`, `sentence_alignment_id` where applicable;
- Quran: surah/ayah, rasm edition, word ID, riwayah; Hadith: narrator, collection, book/chapter, grading and grader;
- `review_stage`, `translation_authority`, `madhhab_or_position`, disagreement/caution flags;
- rights/licence and redistribution status;
- `fetched_at`, `upstream_version`, checksum, adapter version, and cache version;
- `use_constraints` and the source-responsibility note.

Generated explanations, summaries, embeddings, search indexes, and topic maps are derived artifacts. They must point back to these source records and may always be rebuilt without changing canonical content.

## Connector and fallback design

```text
user query
  → intent/language/audience/content-level classification
  → official MCP discovery + source-specific API lookup
  → canonical ID and translation-alignment resolution
  → authority and safety filters
  → hybrid retrieval/reranking
  → whole-unit expansion and citation validation
  → cited evidence workspace

network failure
  → versioned judging cache
  → same IDs, checksums, filters, and citations
  → visible cached-version indicator
```

Never fall back from an unavailable approved connector to open web search or model memory. The correct fallback is the approved cache or an explicit unavailable/not-found state.
