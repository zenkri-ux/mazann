# Mazann Knowledge Base and Sacred-Content Policy

Status: competition build policy

Authority: `المرجعية والحزمة العلمية والبيانات`, pp. 2–15 (updated 2 October 2026)

Scope: every ingestion, retrieval, generation, translation, and display path in Mazann

## 1. Non-negotiable principles

1. Quran and authenticated Hadith are sacred source content, not ordinary text. Their wording, boundaries, identity, and provenance must remain intact.
2. Every Islamic fact, quotation, interpretation, or ruling shown by the product must be traceable to an approved source.
3. The interface must distinguish verbatim source text from explanation generated or summarized by AI.
4. When evidence is absent, conflicting, or below the required confidence, Mazann must abstain, qualify the answer, or refer the user to a qualified specialist. It must never invent a verse, Hadith, attribution, grading, consensus, or source.
5. Mazann does not issue an independent personal fatwa, judge individuals or groups, or decide private disputes.
6. Audience adaptation may change vocabulary, depth, sequence, examples, and explanation. It must never alter the Islamic meaning or source authority.

## 2. Approved sources and authority hierarchy

Only sources named in the official reference may feed the competition knowledge base. A general web result, model memory, or unrelated MCP server is not an approved source. The operational catalog, endpoints, priorities, and constraints are maintained in `KNOWLEDGE_SOURCE_REGISTRY.md`.

Use this hierarchy when sources overlap:

1. **Canonical scripture identity:** King Fahd Glorious Qur'an Printing Complex data for Quran text, rasm, ayah/word IDs, fonts, and riwayah metadata; canonical Hadith collections with a verified record and grading.
2. **Approved multilingual structured content:** the Association for Islamic Content in Languages platforms and central database—QuranEnc, HadeethEnc, Byenah, IslamHouse, IslamEnc, TerminologyEnc, and ICADB—plus Risala for its approved visitor guidance. These are the default authorities for approved translations.
3. **Domain-specialist references:** the approved tafsir, Quran-science, fiqh, fatwa, Arabic-language, Dorar, and official Shamela resources listed in the registry.
4. **Media and discovery services:** for example MP3Quran for recitation, stream, reader, riwayah, and timing metadata. These do not replace the canonical Arabic text or interpretation authority.

The six Association platforms identified in the reference expose the official MCP endpoint `mcp.islamiccontent.org`; several platforms also expose dedicated APIs. MCP/API delivery is a transport, not an authority level. Preserve the originating platform, work, author/reviewer, record ID, language, edition, and review status for every item.

The reference explicitly distinguishes external specialist platforms from Association-owned content: they are recommended within their fields, but the Association does not assume responsibility for their content. For approved translations, prefer the Association platforms and Risala. Never flatten that distinction into one generic “verified” badge.

Before ingestion, record the exact edition, URL or bibliographic reference, publisher, source family, authority tier, retrieval date, language, rights/licence, review status, upstream version, and content checksum in a source manifest. If reuse or redistribution rights are unclear, link or retrieve from the source without republishing its corpus until permission is confirmed.

## 3. Canonical content units: never split sacred text

### Quran

- The smallest storable and retrievable canonical unit is one complete ayah.
- Never split an ayah for chunking, embeddings, highlighting, or prompt limits.
- Adjacent ayat may be grouped as a retrieval window, but every ayah remains a separate immutable record and visible boundary.
- Required metadata: surah number/name, ayah number, Arabic script/rasm edition, language and translation authority where applicable, source edition, version, and checksum.
- Tafsir, translation, and generated explanation must be separate linked records. They must never be stored or rendered as part of the Quranic wording.

### Hadith

- The canonical unit is a complete Hadith record. Never split the matn into independently attributable fragments.
- Preserve the complete available matn and its relationship to the isnad. Long commentary may be chunked separately only at semantic boundaries and must link back to the complete Hadith record.
- Required metadata: canonical record ID, Arabic matn, narrator, collection, book/chapter, number or page reference, authenticity grading, grader, edition/source, language/translation authority, and checksum.
- A search hit inside a Hadith must resolve to and display the full canonical record, not an isolated phrase.

### Tafsir, fiqh, aqeedah, sirah, and historical material

- Chunk only on authored semantic boundaries: heading, paragraph, complete argument, complete event, or complete narration.
- Preserve parent work, author, edition, volume/page, chapter, date/chronology where applicable, linked Quran/Hadith IDs, and caution or disagreement metadata.
- A Sirah event must not be cut in a way that removes its cause, outcome, chronology, or evidentiary qualification.

The canonical store is the source of truth. Embedding indexes, keyword indexes, summaries, and model context are derived and rebuildable artifacts; they must never overwrite canonical records.

## 4. Retrieval architecture

Mazann should use evidence-first hybrid retrieval rather than lexical search alone:

1. Normalize Arabic search variants for matching while preserving the original query and canonical source text.
2. Classify the request by intent, audience, language, and content level A–D from the competition reference.
3. Retrieve with a combination of exact identifiers and quotations, BM25/lexical matching, semantic embeddings, and structured metadata filters.
4. For multilingual material, resolve the query to the shared source identity and Arabic original through ICADB's unified IDs and sentence alignment. Do not treat an independently machine-translated passage as an approved translation.
5. Apply source-authority, language, translation-approval, content-level, madhhab/position, and audience constraints before semantic ranking.
6. Rerank for topical relevance, source authority, audience suitability, translation status, and diversity of evidence.
7. Expand any matched fragment to its complete canonical ayah, Hadith, or authored semantic unit.
8. Validate citations, cross-language alignment, and required metadata before allowing content into the final outline.
9. If the evidence threshold is not met, return a clear “not found in the approved sources” state instead of generated evidence.

Retrieval quality must be measured separately for lexical, paraphrased, multilingual, ambiguous, and adversarial queries. At minimum track citation validity, source coverage, Recall@k or hit rate, abstention precision, and whole-unit integrity.

## 5. From keywords to a structured topic set

The AI may propose a structure, but the user remains the editor and approves it before source retrieval or publication.

### Input contract

- topic or initial keywords;
- target audience, language, country/cultural context, and prior familiarity;
- intended outcome and format;
- available duration or depth;
- any explicit boundaries or sensitivities.

Do not infer unnecessary religious or sensitive traits about a person. Ask only for context required to shape the material.

### Topic-building method

1. Preserve the user's original intent and normalize terms through the approved Islamic vocabulary.
2. Identify the governing content level:
   - A: stable foundational information;
   - B: explanation, definition, or reasoning;
   - C: disputed or highly sensitive matter;
   - D: personal fatwa or case requiring referral.
3. Put the foundation before subsidiary detail, as required by the reference: introduce the core meaning, then evidence, explanation, application, and necessary cautions.
4. Produce a small editable topic map containing:
   - core question and intended outcome;
   - foundational concepts;
   - evidence needs and allowed source types;
   - explanatory axes;
   - audience-specific vocabulary and examples;
   - disagreement, sensitivity, and referral boundaries;
   - success criterion for the finished content.
5. Adapt clarity and depth to the audience without distorting meaning or hiding relevant disagreement.
6. Require human approval of the topic map before the system assembles evidence.

This is Mazann's product methodology, not a claim that the competition mandated one universal outline for every Islamic topic.

## 6. Content levels and response controls

| Level | Product behavior |
|---|---|
| A — stable source information | Direct, source-backed retrieval with exact quotation controls. |
| B — explanation and reasoning | Use only approved material, show references, and avoid certainty where disagreement is possible. |
| C — disputed or highly sensitive | Constrain to approved positions, state that disagreement exists when relevant, and enable scholarly review/referral. |
| D — personal fatwa or individual case | Do not decide. Give only general information and refer to a qualified authority. |

Every generated output must expose: source links/references, quotation versus explanation labels, confidence/coverage status, and the relevant limitation or referral state.

## 7. Mandatory validation and human review

- Reject any Quran quotation whose normalized text and canonical ID do not match the approved Quran store.
- Reject any Hadith citation without source and authenticity metadata.
- Reject a generated claim whose cited source does not contain or support it.
- Detect misquoted verses and correct them gently with surah and ayah.
- Detect personal-case and fatwa requests before generation.
- Route levels C and D, low-confidence cases, conflicts, and sensitive translations to review or referral.
- Log source IDs, retrieval scores, model version, prompt/policy version, output, reviewer action, and timestamp without collecting unnecessary personal data.

The competition's twelve safety examples on p. 6 of the scientific reference are the minimum acceptance suite. Add Mazann-specific tests for intact ayat, intact Hadith records, paraphrase retrieval, multilingual terminology, conflicting sources, citation mismatch, and empty-corpus abstention. The updated source package also requires tests for:

- a translation resolving to the correct Arabic source identity and sentence alignment;
- the same canonical record resolving consistently across languages;
- Association-owned content remaining distinguishable from recommended external platforms;
- riwayah, reciter, audio timing, and Quran text identities never being conflated;
- only official Shamela editions entering the store, excluding unofficial additions distributed under the same name;
- a fiqh or fatwa reference never being converted into an automated personal ruling;
- conflicting scholarly answers being surfaced as qualified disagreement rather than silently merged.

## 8. Competition-day implementation decision

Integrate the official Association MCP at `mcp.islamiccontent.org` as the primary discovery and update connector for its first six platforms, and use the named REST APIs for deterministic ingestion and record lookup. Do **not** build a separate MCP server per corpus during the competition.

Keep a versioned canonical cache/snapshot of the records needed by the judging journey, including upstream IDs, retrieval time, version, and checksums. The live MCP/API path gives breadth and current multilingual access; the cache gives predictable latency, repeatable evaluation, and an outage-safe demo. If the connector and cache differ, show the recorded version and do not silently blend them.

No unapproved corpus may silently enter prompts through web search, model memory, or a general-purpose MCP connector.
