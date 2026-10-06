# Title-only retrieval benchmark — 6 October 2026

## Protocol

- Fifteen titles are copied exactly from the user's list in `retrieval-threshold-topics-2026-10-06.json`. No descriptions, intended outcomes, audience changes, or edits to generated axes were supplied. The application filled its standard brief defaults; the benchmark set `official_instruction_state=none_declared` consistently.
- The configured OpenAI planner generated each roadmap. The benchmark then used the current Qur'an lexical+semantic and Hadith live+semantic retrieval, fetched complete canonical records, and recorded every model relevance assessment. It did **not** use the user's pasted AI answer as an authority or add its references to the index.
- The benchmark deliberately allows up to **12 final records and 24 full-record assessments** per title to observe scores. The ordinary UI requests about two records per axis (six to twelve total), so the numbers here are diagnostic, not a promise of the same visible count in the UI.
- No Qur'an verse or Hadith was truncated in the scored records. The machine report stores reference IDs, locators, links, model roles and scores, not partial sacred quotations. The URLs should be opened for human review.
- Results are reproducible with `node --env-file-if-exists=.env scripts/benchmark-retrieval-thresholds.mjs --count=15`. Completed topics are checkpointed and skipped on rerun. This makes paid planner, embedding, source, and reranker calls; keep the API key in `.env`.

## Observed funnel

| Stage | Result |
|---|---:|
| Titles completed | 15/15 |
| Generated axes | 59; two roadmaps used the documented planner fallback |
| Complete, validation-passing records assessed | 332 |
| Model role: direct / contextual / irrelevant | 96 / 154 / 82 |
| Passed current thresholds | 78 direct, **0 contextual** |
| Median passing candidates per topic | 4 |
| Topics with 0–3 passing candidates | 7/15 |
| Source-search failures / reranker batch failures | 0 / 0 |
| Full-fetch or source-drift unresolved candidates | 14 |

The contextual gate currently requires `score ≥ 80` and `relationship_score ≥ 25`. Across this run, the **highest contextual score was 76**. Therefore the entire contextual class is mechanically excluded, regardless of whether a qualified reviewer would find some records useful as *context* rather than direct proof. Direct evidence currently requires `score ≥ 75` and `relationship_score ≥ 65`. These scores are model judgments, not calibrated probabilities.

| # | Title | Full records assessed | Pass now | Planner |
|---:|---|---:|---:|---|
| 1 | تجديد النية: لماذا نعمل ولمن نعمل؟ | 23 | 2 | model |
| 2 | العودة إلى الله: لا أحد بعيد عن المغفرة | 24 | 11 | model |
| 3 | الصلاة: من عادة يومية إلى صلة حية بالله | 24 | 12 | model |
| 4 | التوكل على الله مع الأخذ بالأسباب | 19 | 4 | fallback: network error |
| 5 | حفظ اللسان في زمن وسائل التواصل الاجتماعي | 24 | 3 | model |
| 6 | عندما تضيق الحياة: قوة الصبر وحسن الظن بالله | 24 | 4 | model |
| 7 | المسلم في عمله: الإتقان والأمانة والكسب الحلال | 24 | 5 | model |
| 8 | العبادة الخفية داخل البيت | 24 | 2 | model |
| 9 | داء الحسد ودواء القناعة | 23 | 1 | model |
| 10 | الأخوة الإيمانية: مسؤولية وليست مجرد شعار | 19 | 12 | model |
| 11 | الشباب بين الهوية والفتن وصناعة المستقبل | 24 | 1 | model |
| 12 | المال أمانة وليس سيدًا | 22 | 10 | model |
| 13 | الآلام النفسية: إيمان ورحمة وطلب للعلاج | 20 | 0 | fallback: planner timeout |
| 14 | الاستعداد للآخرة دون ترك عمارة الدنيا | 19 | 3 | model |
| 15 | كيف نمثل الإسلام بأخلاقنا؟ | 19 | 8 | model |

### Offline threshold sensitivity—not a quality result

Holding the **direct** gate unchanged and the contextual relationship minimum at 25:

| Contextual score minimum | Passing records before final cap | Approximate total after a 12-per-topic cap |
|---:|---:|---:|
| 80 (current) | 78 | 78 |
| 75 | 79 | 79 |
| 70 | 82 | 82 |
| 65 | 87 | 86 |
| 60 | 105 | 100 |
| 55 | 121 | 114 |

These are **counts**, not precision, recall, or endorsements. For example, lowering the contextual gate to 60 would make 27 more scored candidates eligible before the cap, but their Islamic and methodological suitability has not been labeled by experts. The two fallback roadmaps (#4 and #13) should be analyzed separately when choosing a threshold. The 12-record cap is approximated here; actual per-axis balancing can produce a different selected set.

## What to review before a product change

1. Ask a qualified reviewer to label the **60 blind priority rows** in `retrieval-threshold-priority-review-2026-10-06.csv` as direct, contextual, or irrelevant for the listed axis. They should open the full linked source, assess its attribution and intended use, and explain uncertain judgments. The larger `retrieval-threshold-review-2026-10-06.csv` contains all 180 top-12 rows and model scores for deeper audit; ideally hide those scores while collecting first-pass labels.
2. Compare accepted and rejected candidates with those labels, especially the top contextual candidates and just-below-threshold direct candidates. Measure false positives, missed relevant candidates within the **assessed pool**, and how many axes receive at least one *reviewer-approved* reference. Do not call this corpus-wide recall.
3. Separately audit Qur'an topic grounding against axis-specific examples. Its rejected-ID count measures filter activity, **not** the number of relevant verses lost. A previously checked mercy example showed that several plausible axis references were rejected before reranking; this benchmark alone cannot label the hundreds of rejected candidates.
4. Keep clinical or contemporary applications distinct from what the text itself establishes. Topic #13 had a fallback roadmap and zero passing candidates; this must not be “fixed” by implying that general scriptural references prove clinical treatment claims.

## Provisional recommendation

Do not lower every threshold simply to reach a target number. First test a separately labeled, reviewer-only contextual lane—potentially around score 60 with the current relationship minimum—while retaining the present direct-evidence gate and complete-source verification. Adjust the candidate-generation/topic-grounding stage and rerun this exact suite. Promote any new cutoff only after expert labels demonstrate that its additional references are genuinely useful and correctly qualified.
