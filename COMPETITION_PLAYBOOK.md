# Mazann Competition Readiness and Submission Playbook

Status: working checklist for 1–6 October 2026

Authority: participant guide, official reference package, and 1 October opening session

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

The final-project deck has no stated maximum slide count in the opening session. Keep it concise enough to support a five-minute presentation. Prefer the official challenge template or retain all required official branding components at publication quality.

## Fixed competition scope

- Primary user: Friday preacher or Islamic-content researcher.
- Primary journey: Arabic research brief → approved topic map → approved evidence → coverage map → research package.
- Primary differentiation: methodology-aware planning, whole-unit sacred content, source-level control, and visible evidence gaps.
- The product does not generate a complete sermon.
- Broader formats and multilingual material belong to the continuation plan unless the P0 journey is stable and measured.

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
- [ ] Schedule one qualified reviewer and two representative preachers/researchers for a short Day 2 test; prepare consent, tasks and a scoring form.

### Product and engineering

- [ ] Record the pre-competition baseline: commit hash, screenshots, deployed URL, feature inventory, and third-party rights. Only work performed 4–6 October is evaluated.
- [ ] Freeze functional implementation until 4 October. Keep the current visual-only UI as a clearly documented baseline and ask the mentor whether it may be used as the starting shell.
- [ ] Prepare contracts, diagrams, tasks, questions and test cases without presenting them as implemented functionality.
- [ ] Decide the smallest complete judging journey: audience brief → approved topic map → evidence retrieval → cited outline/export.
- [ ] Keep the Friday-preacher use case and document why it is the feasible starting point for a broader verified-content engine.
- [ ] Define measurable baselines and targets for retrieval, citation validity, task completion, and safety.
- [ ] Prepare deployment, public-repository, environment-variable, and rollback checklists.
- [ ] Create issue templates for bugs, evidence failures, and content-review decisions.

### Submission production

- [ ] Approve `SOLUTION_ARCHITECTURE.md` and prepare documentation skeletons: README, evaluation report, source/licence register, and user guide.
- [ ] Prepare the final deck structure using the official challenge identity or a compliant custom design.
- [ ] Prepare demo accounts/data and a deterministic backup demo path.
- [ ] Draft a two-minute video storyboard and capture plan.
- [ ] Prepare a 60-second mentor explanation and a written list of source, methodology, scope, rights and deployment questions.

### Challenge operations

- [ ] Confirm the team Discord channel, assigned mentors and team-leader submission responsibility.
- [ ] Plan daily Discord login, progress reporting and logout for every member.
- [ ] Create the portal submission on Day 1 and update it progressively rather than waiting for the deadline.
- [ ] Plan to keep every submitted URL and service available throughout preliminary judging, 7–15 October.

## Three-day execution plan

All official times are Saudi time. Tunisia is two hours behind Saudi Arabia on these dates.

### Day 1 — Sunday 4 October: evidence backbone

Official window: 09:00–22:00 Saudi / 07:00–20:00 Tunisia.

- Freeze and tag the accepted starting version.
- Log in to Discord at 09:00 Saudi / 07:00 Tunisia, publish the day's goals, and prepare mentor questions before guidance begins.
- Implement canonical schemas, the official Association MCP adapter, P0 API adapters, and the versioned judging cache.
- Enforce whole-ayah and whole-Hadith boundaries.
- Preserve multilingual IDs/alignment in the schema, but complete the Arabic path first and reject unapproved ad-hoc translations.
- Build hybrid retrieval: exact IDs + lexical + semantic + authority/language metadata filters + reranking.
- Connect retrieval hits back to full canonical records and citations.
- Run the first safety/retrieval suite and use mentor hours for source, grading, and methodology questions.
- Create the portal submission record and upload every artifact or link already safe to share; the portal can be updated later.
- End-of-day gate: one Arabic topic returns intact, approved, traceable evidence with a correct cached fallback and “not found” path.

### Day 2 — Monday 5 October: guided product and safety

Official window: 09:00–22:00 Saudi / 07:00–20:00 Tunisia.

- Implement audience-aware brief and editable structured-topic workflow.
- Implement source requirements per axis and plan-quality checks before retrieval.
- Add content-level A–D classification, warnings, abstention, and referral behavior.
- Separate scripture, sourced explanation, and AI-generated organization in the UI.
- Complete the evidence workspace, source explorer, retrieved/accepted counts, coverage recalculation, outline/export flow, and loading/error/empty states.
- Add basic server-side save/resume; implement duplicate/archive only if the core path remains stable.
- Test with paraphrases, hostile wording, conflicting evidence, unofficial Shamela material, missing evidence, source exclusion and saved-project reproduction. Run multilingual alignment tests at schema/validation level; the visible second-language demo is optional.
- Update the portal with the integrated live build and draft documentation.
- End-of-day gate: the primary journey works end to end for multiple test cases and all critical safety tests pass.

### Day 3 — Tuesday 6 October: verification and submission

Official window: 09:00–23:59 Saudi / 07:00–21:59 Tunisia. Mentoring ends at 19:00 Saudi / 17:00 Tunisia.

- Stop feature expansion early; fix blockers and stabilize the primary journey.
- Run repeatability, clean-browser, deployment, secret, licence, link, and repository checks.
- Complete evaluation results and clearly separate measured achievements from future plans.
- Finalize public GitHub, README, architecture, source documentation, user guide, presentation, and live URL.
- Record and edit the demo video, then verify its duration is at most 2:00.
- Upload the final artifacts by 21:30 Saudi / 19:30 Tunisia where possible, leaving more than two hours for contingency before the official deadline.
- Re-open every submitted artifact anonymously, verify the public repository and video permissions, and retain the portal confirmation.
- Keep a local backup of the exact submitted commit, deck, video, and source manifest.
- Keep the live URL, backend, database and public artifacts available throughout 7–15 October preliminary judging.

## Two-minute demo concept

Use motion graphics to clarify the product—not to replace proof of a working product.

| Time | Story |
|---|---|
| 0:00–0:12 | The problem: preparing reliable, audience-appropriate Islamic content is slow and evidence-sensitive. |
| 0:12–0:27 | Why the Friday-preacher research package is the focused first use case and how the workflow operates. |
| 0:27–1:12 | Live product journey: brief → methodological topic map → source-filtered retrieval → intact cited evidence → coverage map. |
| 1:12–1:36 | Safety proof: source traceability, scripture/explanation separation, disagreement handling, abstention, and referral. |
| 1:36–1:52 | Measured results against the baseline and one short user outcome. |
| 1:52–2:00 | Closing identity, live URL, and expansion from the tested use case to other verified Islamic-content formats. |

Record the live interaction first, then add a restrained branded opener, animated callouts, and source-path overlays. Keep the cursor readable, avoid long logo sequences, and do not present mock screens as working functionality.

## Definition of submission-ready

Submission is ready only when an evaluator can, without help: open the URL, complete the core task, inspect every claim's source, understand limitations, reproduce the documented setup, see measured evidence of value, and verify that the submitted artifacts correspond to the same public commit.
