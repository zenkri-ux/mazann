# Mazann Competition Readiness and Submission Playbook

Status: working checklist for 1–6 October 2026  
Authority: participant guide and official reference package

## What must be submitted by 6 October

The official guide requires all of the following, not only the four items in our working list:

- [ ] A complete, usable digital product—not only a prototype.
- [ ] A fully working live-demo URL, tested in a clean browser session.
- [ ] A **public GitHub repository** containing publishable source code and operating files.
- [ ] Setup/run documentation, dependencies, source/tool/licence register, and no passwords, API keys, sensitive data, or user data.
- [ ] A **demo video no longer than 2 minutes**. Use two minutes as the hard limit unless an official later update explicitly changes it.
- [ ] A PDF or PowerPoint presentation covering the problem, solution, mechanism, added value, technologies, results, and continuation plan, with project screenshots and detailed explanation of the AI method.
- [ ] Documentation of Islamic and knowledge sources, including how each was used and verified.
- [ ] Final submission through the portal before **23:59 Saudi time on Tuesday 6 October 2026**, followed by retaining the confirmation message.

If selected for final judging, the session is 5 minutes for presentation and 3 minutes for questions.

## Prepare before the build window

### Knowledge and content

- [ ] Approve `KNOWLEDGE_BASE_POLICY.md` as the project-wide ingestion and output contract.
- [ ] Approve `KNOWLEDGE_SOURCE_REGISTRY.md` and freeze the P0/P1 sources for the judging journey.
- [ ] Create a source manifest with edition/URL, authority, language, rights/licence, retrieval date, version, and checksum.
- [ ] Test the official `mcp.islamiccontent.org` connector and the P0 REST APIs; record available tools, IDs, rate limits, and failure behavior.
- [ ] Obtain or prepare a legally usable, versioned judging cache from the approved source allowlist so the demo survives connector outages.
- [ ] Define canonical schemas for ayah, Hadith, tafsir passage, Sirah event, term, and source.
- [ ] Add multilingual identity and provenance fields: source/translation/alignment IDs, originating platform, review stage, authority tier, and responsibility note.
- [ ] Prepare the competition's twelve scientific-safety test cases plus Mazann retrieval and chunk-integrity tests.
- [ ] Identify a qualified content reviewer and a fast review workflow for levels C/D and low-confidence cases.

### Product and engineering

- [ ] Record the pre-competition baseline: commit hash, screenshots, deployed URL, feature inventory, and third-party rights. Only work performed 4–6 October is evaluated.
- [ ] Turn the current UI into a runnable shell with mocked contracts only; keep competition-day implementation changes separately traceable.
- [ ] Decide the smallest complete judging journey: audience brief → approved topic map → evidence retrieval → cited outline/export.
- [ ] Define measurable baselines and targets for retrieval, citation validity, task completion, and safety.
- [ ] Prepare deployment, public-repository, environment-variable, and rollback checklists.
- [ ] Create issue templates for bugs, evidence failures, and content-review decisions.

### Submission production

- [ ] Prepare documentation skeletons: README, architecture, knowledge-base policy, evaluation report, source/licence register, and user guide.
- [ ] Prepare the final deck structure using the official challenge identity or a compliant custom design.
- [ ] Prepare demo accounts/data and a deterministic backup demo path.
- [ ] Draft a two-minute video storyboard and capture plan.

## Three-day execution plan

All official times are Saudi time. Tunisia is two hours behind Saudi Arabia on these dates.

### Day 1 — Sunday 4 October: evidence backbone

Official window: 09:00–22:00 Saudi / 07:00–20:00 Tunisia.

- Freeze and tag the accepted starting version.
- Implement canonical schemas, the official Association MCP adapter, P0 API adapters, and the versioned judging cache.
- Enforce whole-ayah and whole-Hadith boundaries.
- Resolve multilingual evidence through shared source IDs and sentence alignment; reject unapproved ad-hoc translations.
- Build hybrid retrieval: exact IDs + lexical + semantic + authority/language metadata filters + reranking.
- Connect retrieval hits back to full canonical records and citations.
- Run the first safety/retrieval suite and use mentor hours for source, grading, and methodology questions.
- End-of-day gate: one complete topic can return intact, approved, traceable evidence in at least two languages, with a correct cached fallback and “not found” path.

### Day 2 — Monday 5 October: guided product and safety

Official window: 09:00–22:00 Saudi / 07:00–20:00 Tunisia.

- Implement audience-aware brief and editable structured-topic workflow.
- Add content-level A–D classification, warnings, abstention, and referral behavior.
- Separate scripture, sourced explanation, and AI-generated organization in the UI.
- Complete the evidence workspace, source drawer, outline/export flow, loading/error/empty states, and accessibility checks.
- Test with paraphrases, multilingual terms, cross-language alignment, hostile wording, conflicting evidence, unofficial Shamela material, and missing evidence.
- End-of-day gate: the primary journey works end to end for multiple test cases and all critical safety tests pass.

### Day 3 — Tuesday 6 October: verification and submission

Official window: 09:00–23:59 Saudi / 07:00–21:59 Tunisia. Mentoring ends at 19:00 Saudi / 17:00 Tunisia.

- Stop feature expansion early; fix blockers and stabilize the primary journey.
- Run repeatability, clean-browser, deployment, secret, licence, link, and repository checks.
- Complete evaluation results and clearly separate measured achievements from future plans.
- Finalize public GitHub, README, architecture, source documentation, user guide, presentation, and live URL.
- Record and edit the demo video, then verify its duration is at most 2:00.
- Upload before the deadline, re-open every submitted artifact, and retain the portal confirmation.
- Keep a local backup of the exact submitted commit, deck, video, and source manifest.

## Two-minute demo concept

Use motion graphics to clarify the product—not to replace proof of a working product.

| Time | Story |
|---|---|
| 0:00–0:12 | The problem: preparing reliable, audience-appropriate Islamic content is slow and evidence-sensitive. |
| 0:12–0:27 | Mazann's promise and the four-step workflow. |
| 0:27–1:12 | Live product journey: audience brief → topic map → hybrid retrieval → intact cited Quran/Hadith evidence → editable outline. |
| 1:12–1:36 | Safety proof: source traceability, scripture/explanation separation, disagreement handling, abstention, and referral. |
| 1:36–1:52 | Measured results against the baseline and one short user outcome. |
| 1:52–2:00 | Closing identity, live URL, and succinct value statement. |

Record the live interaction first, then add a restrained branded opener, animated callouts, and source-path overlays. Keep the cursor readable, avoid long logo sequences, and do not present mock screens as working functionality.

## Definition of submission-ready

Submission is ready only when an evaluator can, without help: open the URL, complete the core task, inspect every claim's source, understand limitations, reproduce the documented setup, see measured evidence of value, and verify that the submitted artifacts correspond to the same public commit.
