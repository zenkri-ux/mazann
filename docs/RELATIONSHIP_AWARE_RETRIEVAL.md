# Relationship-aware evidence retrieval (Day 2)

Mazann searches for the **whole topic–axis relationship**, not an isolated word. For example, `الكرم عند الصحابة` asks for a verified account of generosity *by a Companion*. A text about generosity alone, or one merely narrated by a Companion, is not direct evidence for that claim.

## Implemented flow

1. Compile a lexical query from the topic and axis. With the configured model, also produce two bounded Arabic paraphrases that preserve the actor, action and relationship. These are search queries only, never citations.
2. Search whole-ayah Quran and whole-Hadith indices using the relationship variants. Fuse lexical and semantic ranks, reserving semantic candidates so a lexical-only top block cannot monopolize the shortlist. Preserve Quran/Hadith diversity when allocating the prefetch budget.
3. Fetch up to twice the requested final record count (maximum 24) as **complete records** from the official connector or a validated cache. Check canonical IDs and the indexed Hadith matn checksum. Search snippets and vectors never become evidence.
4. The model assesses each full record against the original topic and all roadmap axes. It returns one proposed axis, `direct`/`contextual`/`irrelevant`, a 0–100 relevance score, a separate compound-relationship score, and a brief rationale. Outputs are validated for exact record and axis IDs, completeness and bounded fields. A failed batch is **not** promoted to the review UI.
5. Provisional gate: `direct` requires score ≥75 and relationship ≥65; `contextual` requires score ≥60 and relationship ≥25. `irrelevant` is always excluded. The contextual score cutoff was lowered from 80 after the project owner reviewed the 15-title benchmark and reported that contextual records scoring 60+ looked useful while those below 60 began to look unrelated. This is a practical review observation, not a measured precision estimate or a scholarly endorsement of every candidate. Accepted records remain **suggestions requiring imam review**. The numeric score is not a probability, authenticity grade, or scholarly ruling.

The role is source-aware: a general Quranic principle may be contextual support for a Companion-specific topic but cannot be presented as proof of a Companion's particular action. The same assessment contract can accept future tafsir, sīrah and approved-study records once their complete-text retrieval and provenance checks are implemented. Today only Quran and Hadith are independently searched; tafsir is a limited verified link attached to some ayat, not a separate searched corpus.

## Failure and audit behavior

- Missing model configuration retains the previous retrieval path and returns `RERANK_NOT_CONFIGURED_UNFILTERED`; the UI says advanced relevance checking is inactive.
- Query expansion failure falls back to the original semantic question and emits `RELATIONSHIP_QUERY_FALLBACK`.
- Reranker failure hides that batch and emits `RERANK_BATCH_UNAVAILABLE`; it never silently treats unscored candidates as high-relevance.
- API output exposes `search_trace`, `rejected_by_relevance`, `relevance_warnings`, role and score for technical audit. User-facing cards show the proposed evidence role; the detailed view labels the score an **automated suitability estimate**, not a judgment of source authenticity.

## Verification and limits

The local unit suite passes. A live smoke test on `الكرم عند الصحابة` returned complete HadeethEnc record `hadith:65608:ar` as direct and filtered adjacent hits that lacked the required relationship. This is one regression example, **not a general accuracy claim**. The thresholds are operating defaults pending labeled reviewer cases. Before submission, evaluate direct/contextual/false-positive judgments across diverse topics, source types and negative examples; record precision, recall and abstention by role, then recalibrate the thresholds. Retrieval remains bounded by the indexed HadeethEnc corpus and currently available sources; a legitimate topic may correctly show no suitable result.
