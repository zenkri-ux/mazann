# Mazann Solution Architecture

Status: competition implementation contract

## Product boundary

Mazann starts with one complete use case: an Arabic-speaking Friday preacher or Islamic-content researcher builds a source-grounded research package before writing. The product does not generate a complete sermon and does not issue personal fatwas.

The architecture is format-aware rather than sermon-specific. `content_format`, `target_audience`, `audience_familiarity`, `language`, `duration`, and `intended_outcome` are first-class fields so the same engine can later support lessons, articles, introductory Islamic material, and approved multilingual content.

## End-to-end flow

```text
research brief
  → intent, audience, and A–D content-level gate
  → methodology-aware topic planner
  → researcher edits and approves the plan
  → source router chooses approved source families per axis
  → official MCP/API retrieval or versioned cache fallback
  → canonical normalization and hybrid retrieval
  → authority filters, reranking, and whole-unit expansion
  → deterministic citation and safety validation
  → evidence cards and source explorer
  → human evidence decisions
  → coverage recalculation
  → saved research package and export
```

## Layers

| Layer | Responsibilities |
|---|---|
| Experience | Research brief, editable topic map, evidence feed, source explorer, coverage map, saved research and export. |
| AI orchestration | Structured topic proposal, source-specific query construction, relevance explanation and evidence-grounded coverage suggestion. |
| Policy engine | Content levels A–D, source allowlist, no-fatwa boundary, disagreement handling, abstention and referral. |
| Knowledge connectors | Official Association MCP, named REST APIs, timeouts and a visible versioned-cache fallback. |
| Retrieval | Exact IDs/quotations, Arabic lexical search, semantic search, metadata filters, reranking and whole-unit expansion. |
| Canonical store | Immutable source records, approved translations, provenance, versions and checksums. Search indexes remain derived and rebuildable. |
| Validation | Quran identity, complete sacred units, Hadith grading, translation alignment, citation support and authority checks. |
| Persistence | Research projects, plan versions, source scope, evidence decisions, coverage state and reproducible source snapshots. |
| Operations | Structured logs, health checks, secrets, deployment, public-repository reproducibility and judging-cache monitoring. |

## AI versus deterministic controls

The AI may propose axes, create search queries, rerank candidates, explain relevance and organize accepted material. It may not manufacture sacred text, source metadata, Hadith grading or an unsupported claim.

Deterministic controls resolve source records, preserve ayah/Hadith boundaries, validate citations, enforce the allowlist, apply content-level rules and block publication when required fields are missing.

## Core entities

- `ResearchProject`: title, brief, format, audience, language, status and timestamps.
- `TopicPlanVersion`: each generated, edited or approved plan.
- `TopicAxis`: question, purpose, position, evidence requirements, content level and review boundary.
- `Source`: platform, publisher, authority tier, responsibility, rights and connector.
- `SourceScope`: source families enabled for a project or axis.
- `CanonicalRecord`: immutable Quran, Hadith or authored semantic unit.
- `Translation`: approved translation linked to its Arabic source identity.
- `EvidenceCandidate`: retrieved record plus scores and validation state.
- `EvidenceDecision`: accepted, excluded or specialist-review state with reason.
- `CoverageAssessment`: evidence sufficiency and gap reason per axis.
- `RetrievalRun`: query, filters, model/adapter version, timestamps and cache state.
- `ProjectSnapshot`: reproducible plan, source versions, checksums and decisions.

## Minimum API surface

- `GET /projects`
- `POST /projects`
- `GET /projects/{id}`
- `PATCH /projects/{id}`
- `POST /projects/{id}/duplicate`
- `POST /projects/{id}/archive`
- `POST /projects/{id}/plans`
- `PATCH /plans/{id}`
- `POST /plans/{id}/approve`
- `POST /plans/{id}/retrieve`
- `GET /projects/{id}/sources`
- `PATCH /projects/{id}/source-scope`
- `PATCH /evidence/{id}/decision`
- `GET /projects/{id}/coverage`
- `POST /projects/{id}/export`
- `GET /health`

## Competition implementation order

### P0: complete judging journey

1. Arabic research brief and methodology-aware plan.
2. Human approval before retrieval.
3. Real approved-source retrieval for the selected demo topic.
4. Complete Quran/Hadith records and verifiable citations.
5. Evidence decisions and automatic coverage recalculation.
6. Source explorer with filtering and retrieved/accepted counts.
7. Safety, abstention, referral and cached fallback.
8. Basic project persistence and resume.
9. Working live deployment, public repository and reproducible setup.

### P1: only after P0 is stable

- Duplicate/archive research and plan-version comparison.
- Source-update comparison.
- Regenerate one axis.
- Approved second-language proof.
- More source families and refined exports.

### Deferred

- Full sermon generation.
- Team workspaces and permissions.
- Broad multi-corpus ingestion.
- Open-web research.
- Advanced audio features.
- Separate MCP servers per corpus.

## Scalability statement

The competition proves the research engine through one sensitive and testable workflow. Expansion changes the research brief, planning template and final format. It does not replace the canonical store, retrieval, validation, evidence-review or coverage layers.
