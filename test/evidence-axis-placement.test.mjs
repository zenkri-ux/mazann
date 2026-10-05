import assert from "node:assert/strict";
import test from "node:test";
import { suggestEvidenceAxis } from "../apps/api/src/lib/evidence-axis-placement.mjs";

const axes = [
  { axis_id: "foundation", title: "تأصيل معنى الأمانة", research_question: "كيف تؤدى الأمانة والحقوق؟" },
  { axis_id: "application", title: "تطبيق الثقة في المعاملات", research_question: "كيف تحفظ الثقة في التعامل اليومي؟" },
];

test("a distinctive full record gets one reviewable axis suggestion", () => {
  const result = suggestEvidenceAxis({
    text: "أدوا الأمانة إلى أهلها واحفظوا الحقوق في المعاملات.",
  }, axes);
  assert.deepEqual(result.axis_ids, ["foundation"]);
  assert.equal(result.placement_status, "suggested_needs_confirmation");
});

test("an unrelated or ambiguous record does not inflate multiple axes", () => {
  const unrelated = suggestEvidenceAxis({ text: "نص صحيح كامل عن موضوع آخر" }, axes);
  assert.deepEqual(unrelated.axis_ids, []);
  assert.equal(unrelated.placement_status, "needs_user_assignment");
  const ambiguous = suggestEvidenceAxis({ text: "الأمانة والحقوق، والثقة في المعاملات" }, axes);
  assert.ok(ambiguous.axis_ids.length <= 1);
});
