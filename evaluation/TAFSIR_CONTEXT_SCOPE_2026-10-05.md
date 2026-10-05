# Tafsir context before imam review — 2026-10-05

## Why this source

The challenge reference explicitly accepts early tafsir sources or the Dorar Tafsir platform for explaining an ayah, while requiring the exegete's words to remain distinct from Quran text. We selected [موسوعة التفسير، الدرر السنية](https://dorar.net/tafseer) as the first tafsir source.

## Shipped scope

- A curated manifest maps **exact Quran ayah ranges** to four verified section URLs at `dorar.net/tafseer`: [النساء 58–59](https://dorar.net/tafseer/4/18), [الحجرات 6–8](https://dorar.net/tafseer/49/2), [البقرة 151–157](https://dorar.net/tafseer/2/25), and [المائدة 1–2](https://dorar.net/tafseer/5/1).
- When one of these ayat is returned as a complete Quran record, Step 03 shows the tafsir source and its exact section as a separate contextual reading link. Step 04 and Markdown/Word/print-PDF exports preserve the link beside that ayah.
- The link manifest is checked at server startup. Invalid hosts, imprecise locators and overlapping ranges are rejected. Unmapped ayat remain unmapped; no link is invented.
- The tafsir URL is **not** counted as a retrieved text record, approved evidence, or independent source in coverage metrics. It does not alter Quran text, checksum, or source attribution.

## Honest boundary and next step

The current Dorar site did not expose a documented tafsir-text API to this project, and the page states rights are reserved. We therefore do not bulk-ingest, republish, synthesize, or label page text as a verified tafsir record. This is a source-linked tafsir context pilot, **not full tafsir retrieval**. Before presenting tafsir as independent cards, obtain a permitted API or licensed corpus and build a separate canonical record with work, author/editor, exact ayah/unit, full explanation text, provenance, checksum, rights, and human review.

## Reviewer prompt

If the research returns one of the linked ayat, ask the imam whether the contextual tafsir link helps validate the use of that ayah, whether the section addresses the actual thematic question, and whether the text-vs-commentary distinction is clear. Do not claim all Quran results have tafsir coverage.
