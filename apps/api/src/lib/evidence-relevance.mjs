// Provisional operating thresholds. They are not probabilities and must be
// calibrated against imam-labelled direct, contextual and false-positive cases.
export const RELEVANCE_THRESHOLDS = Object.freeze({
  direct: Object.freeze({ score: 75, relationship_score: 65 }),
  contextual: Object.freeze({ score: 60, relationship_score: 25 }),
});

export function validateRelevanceAssessments(assessments, records, axes) {
  if (!Array.isArray(assessments) || assessments.length !== records.length) throw new Error("RERANK_INCOMPLETE_OUTPUT");
  const expected = new Set(records.map((item) => item.record.id));
  const axisIds = new Set(axes.map((axis) => axis.axis_id));
  const seen = new Set();
  for (const item of assessments) {
    if (!expected.has(item?.id) || seen.has(item.id) || !axisIds.has(item.axis_id)
      || !["direct", "contextual", "irrelevant"].includes(item.role)
      || !Number.isInteger(item.score) || item.score < 0 || item.score > 100
      || !Number.isInteger(item.relationship_score) || item.relationship_score < 0 || item.relationship_score > 100
      || typeof item.reason !== "string" || !item.reason.trim() || item.reason.length > 500) {
      throw new Error("RERANK_INVALID_OUTPUT");
    }
    seen.add(item.id);
  }
  return assessments;
}

export function acceptsRelevance(assessment) {
  const minimum = RELEVANCE_THRESHOLDS[assessment?.role];
  return Boolean(minimum && assessment.score >= minimum.score
    && assessment.relationship_score >= minimum.relationship_score);
}
