import test from "node:test";
import assert from "node:assert/strict";
import { createTopicRoadmap, RoadmapInputError } from "@mazann/domain/topic-roadmap";

const validBrief = {
  topic: "أثر الرحمة في التعامل مع الضعفاء",
  intended_outcome: "تحويل الرحمة إلى سلوك يومي مسؤول",
  target_audience: "ناشئة",
  country_or_context: "السعودية",
  format: "خطبة جمعة",
  duration: "15–20 دقيقة",
  official_instruction_state: "unverified",
  language: "ar",
};

test("roadmap creates a traceable methodological plan for any valid Arabic topic", () => {
  const roadmap = createTopicRoadmap(validBrief);
  assert.match(roadmap.roadmap_id, /^roadmap_[a-f0-9]{16}$/);
  assert.equal(roadmap.generation_mode, "methodology_template");
  assert.equal(roadmap.methodology.id, "friday_sermon_research");
  assert.equal(roadmap.axes.length, 3);
  assert.ok(roadmap.axes.every((axis) => axis.research_question && axis.evidence_requirements.length));
  assert.equal(roadmap.human_review.required, true);
});

test("roadmap output is deterministic for the same normalized brief", () => {
  const first = createTopicRoadmap(validBrief);
  const second = createTopicRoadmap({ ...validBrief, topic: `  ${validBrief.topic}  ` });
  assert.equal(first.roadmap_id, second.roadmap_id);
  assert.deepEqual(first.axes, second.axes);
});

test("roadmap lets an unsure user continue with a visible caveat", () => {
  const roadmap = createTopicRoadmap(validBrief);
  assert.equal(roadmap.policy_gate.decision, "proceed_with_visible_caveat");
  assert.match(roadmap.policy_gate.note, /يمكن متابعة/);
});

test("roadmap traces a supplied governing instruction without treating it as evidence", () => {
  const roadmap = createTopicRoadmap({
    ...validBrief,
    official_instruction_state: "verified",
    governing_instruction: {
      issuing_authority: "جهة إشراف رسمية",
      title: "التراحم والتكافل في المجتمع",
      reference: "https://example.test/instruction/1",
      required_points: "بيان معنى الرحمة؛ تطبيقات عملية تناسب الجمهور",
    },
  });
  assert.equal(roadmap.policy_gate.decision, "proceed");
  assert.deepEqual(roadmap.policy_gate.governing_instruction.required_points, [
    "بيان معنى الرحمة",
    "تطبيقات عملية تناسب الجمهور",
  ]);
  assert.match(roadmap.policy_gate.note, /منفصلة عن الأدلة الشرعية/);
});

test("roadmap allocates the requested duration across all axes", () => {
  const roadmap = createTopicRoadmap({ ...validBrief, duration: "30–45 دقيقة" });
  const total = roadmap.axes.reduce((sum, axis) => sum + axis.time_minutes, 0);
  assert.equal(total, 38);
});

test("roadmap rejects underspecified topics rather than inventing a plan", () => {
  assert.throws(
    () => createTopicRoadmap({ ...validBrief, topic: "الرحمة" }),
    (error) => error instanceof RoadmapInputError && error.code === "INVALID_RESEARCH_BRIEF",
  );
});

test("roadmap does not claim model assistance", () => {
  const roadmap = createTopicRoadmap(validBrief);
  assert.equal(roadmap.generation_mode, "methodology_template");
  assert.ok(roadmap.limitations.some((item) => item.includes("لا تثبت حكمًا")));
});
