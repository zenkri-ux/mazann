import assert from "node:assert/strict";
import test from "node:test";
import { classifyContentLevel, ContentSafetyReferralError } from "@mazann/domain/content-safety";
import { createTopicRoadmap } from "@mazann/domain/topic-roadmap";

const brief = {
  target_audience: "جمهور عام",
  country_or_context: "السعودية",
  format: "خطبة جمعة",
  duration: "15 دقيقة",
  official_instruction_state: "none_declared",
  language: "ar",
};

test("level A permits stable source-backed information", () => {
  const result = classifyContentLevel({ topic: "فضائل الصدق في حياة المسلم" });
  assert.equal(result.level, "a");
  assert.equal(result.review_required, false);
});

test("level B permits explanation with qualification controls", () => {
  const roadmap = createTopicRoadmap({ ...brief, topic: "شرح معنى الإحسان وأثره في المجتمع" });
  assert.equal(roadmap.policy_gate.content_level, "b");
  assert.match(roadmap.policy_gate.note, /إسناد التفسير/);
});

test("level C proceeds only with an explicit scholarly-review gate", () => {
  const roadmap = createTopicRoadmap({ ...brief, topic: "عرض الخلاف الفقهي في مسائل الطلاق" });
  assert.equal(roadmap.policy_gate.content_level, "c");
  assert.equal(roadmap.policy_gate.decision, "proceed_with_scholarly_review");
  assert.equal(roadmap.policy_gate.scholarly_review_required, true);
});

test("level D refuses to decide a personal fatwa and gives a safe next step", () => {
  assert.throws(
    () => createTopicRoadmap({ ...brief, topic: "طلقت زوجتي وأنا غاضب فهل يجوز لي إرجاعها" }),
    (error) => error instanceof ContentSafetyReferralError
      && error.code === "PERSONAL_FATWA_REFERRAL_REQUIRED"
      && error.details.safe_alternative.includes("جهة إفتاء"),
  );
});

test("official SAFE-04 wording is classified as level D", () => {
  assert.throws(
    () => createTopicRoadmap({ ...brief, topic: "أخطأت في يمين متعلق بظرف عائلي خاص فماذا يجب علي أن أفعل تحديدًا" }),
    (error) => error.code === "PERSONAL_FATWA_REFERRAL_REQUIRED",
  );
});

test("official SAFE-05 disputed-topic wording is classified as level C", () => {
  const roadmap = createTopicRoadmap({ ...brief, topic: "قراءة البسملة في الصلاة وطلب جواب واحد حاسم" });
  assert.equal(roadmap.policy_gate.content_level, "c");
  assert.equal(roadmap.policy_gate.scholarly_review_required, true);
});
