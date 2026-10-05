import fs from "node:fs/promises";
import { OpenAIEvidenceReranker } from "../apps/api/src/lib/openai-evidence-reranker.mjs";
import { validateRelevanceAssessments } from "../apps/api/src/lib/evidence-relevance.mjs";

if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
  console.error("OPENAI_API_KEY and OPENAI_MODEL are required for the live smoke check");
  process.exitCode = 2;
} else {
  const paths = ["../data/cache/quran_4_58_ar.json", "../data/cache/hadith_3016_ar.json"];
  const records = await Promise.all(paths.map(async (relative) => ({
    record: JSON.parse(await fs.readFile(new URL(relative, import.meta.url), "utf8")).record,
  })));
  const axes = [
    { axis_id: "foundation", title: "أداء الأمانة", research_question: "ما أصل وجوب أداء الأمانة؟", purpose: "تأصيل المفهوم" },
    { axis_id: "social", title: "أثر الأمانة في الثقة", research_question: "كيف تؤثر الأمانة في تعامل الناس؟", purpose: "وصل الموضوع بواقع الجمهور" },
  ];
  const reranker = new OpenAIEvidenceReranker({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL });
  const result = validateRelevanceAssessments(await reranker.assess({ topic: "الأمانة وأثرها في بناء الثقة", axes, records }), records, axes);
  console.log(JSON.stringify(result.map(({ id, axis_id, role, score, relationship_score }) => ({ id, axis_id, role, score, relationship_score })), null, 2));
}
