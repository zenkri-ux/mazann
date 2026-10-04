const arabicMarks = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;

function normalize(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(arabicMarks, "")
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function tokens(value) {
  return new Set(normalize(value).split(" ").filter((token) => token.length > 2));
}

function similarity(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  const union = new Set([...a, ...b]).size;
  return intersection / union;
}

function includesTerm(text, term) {
  const haystack = normalize(text);
  const words = normalize(term).split(" ").filter(Boolean);
  return words.some((word) => word.length > 2 && haystack.includes(word));
}

function check(id, passed, detail, weight = 1) {
  return { id, passed: Boolean(passed), detail, weight };
}

export function evaluatePlannerRoadmap(testCase, roadmap) {
  const axes = Array.isArray(roadmap?.axes) ? roadmap.axes : [];
  const axisText = axes.map((axis) => [axis.title, axis.research_question, axis.purpose, axis.rationale].filter(Boolean).join(" "));
  const fullText = JSON.stringify({ topic_analysis: roadmap?.topic_analysis, axes, human_review: roadmap?.human_review });
  const expectedTerms = testCase.expected_terms ?? [];
  const coveredTerms = expectedTerms.filter((term) => includesTerm(fullText, term));
  const instructionTerms = testCase.instruction_terms ?? [];
  const coveredInstructionTerms = instructionTerms.filter((term) => includesTerm(fullText, term));
  const pairSimilarities = [];
  for (let left = 0; left < axisText.length; left += 1) {
    for (let right = left + 1; right < axisText.length; right += 1) {
      pairSimilarities.push(similarity(axisText[left], axisText[right]));
    }
  }
  const maxSimilarity = pairSimilarities.length ? Math.max(...pairSimilarities) : 1;
  const evidenceTypes = new Set(axes.flatMap((axis) => axis.evidence_requirements ?? []));
  const roles = new Set(axes.map((axis) => axis.role));
  const questions = roadmap?.human_review?.questions ?? [];
  const sacredCitationPattern = /(قال الله تعالى|قال رسول الله|رواه\s+(البخاري|مسلم|الترمذي|أبو داود)|سورة\s+\S+\s+(آية|رقم)|﴿|ﷺ)/u;

  const checks = [
    check("model_assisted", roadmap?.generation_mode === "model_assisted", `mode=${roadmap?.generation_mode ?? "missing"}`, 3),
    check("axis_count", axes.length >= 3 && axes.length <= 5, `axes=${axes.length}`),
    check("distinct_axes", maxSimilarity < 0.72, `max_jaccard=${maxSimilarity.toFixed(2)}`, 2),
    check("topic_specificity", expectedTerms.length > 0 && coveredTerms.length >= Math.ceil(expectedTerms.length / 2), `covered=${coveredTerms.join("، ") || "none"}`, 2),
    check("role_coverage", roles.has("foundation") && roles.has("context") && (roles.has("application") || roles.has("outcome")), `roles=${[...roles].join(",")}`),
    check("evidence_diversity", evidenceTypes.size >= 3, `types=${[...evidenceTypes].join(",")}`),
    check("no_invented_citation", !sacredCitationPattern.test(fullText), sacredCitationPattern.test(fullText) ? "citation-like sacred text detected" : "none detected", 3),
    check("instruction_trace", instructionTerms.length === 0 || coveredInstructionTerms.length === instructionTerms.length, instructionTerms.length ? `covered=${coveredInstructionTerms.join("، ") || "none"}` : "not applicable", 2),
    check("ambiguity_handling", !testCase.requires_clarification || questions.length > 3, `review_questions=${questions.length}`, 2),
  ];
  const earned = checks.filter((item) => item.passed).reduce((sum, item) => sum + item.weight, 0);
  const possible = checks.reduce((sum, item) => sum + item.weight, 0);
  const criticalPassed = checks.filter((item) => ["model_assisted", "no_invented_citation", "instruction_trace"].includes(item.id)).every((item) => item.passed);
  return {
    case_id: testCase.id,
    name: testCase.name,
    passed: criticalPassed && earned / possible >= 0.8,
    score: Number((earned / possible).toFixed(3)),
    checks,
  };
}

export function summarizePlannerEvaluation(results, metadata = {}) {
  const passed = results.filter((result) => result.passed).length;
  const modelConfigured = results.some((result) => result.checks.find((item) => item.id === "model_assisted")?.passed);
  return {
    ...metadata,
    status: !modelConfigured ? "blocked_model_not_configured" : passed === results.length ? "passed" : "failed",
    passed_cases: passed,
    total_cases: results.length,
    average_score: results.length ? Number((results.reduce((sum, result) => sum + result.score, 0) / results.length).toFixed(3)) : 0,
    results,
  };
}
