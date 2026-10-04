import { createTopicRoadmap, enhanceTopicRoadmap } from "@mazann/domain/topic-roadmap";

export class TopicPlanningService {
  constructor({ provider = null } = {}) {
    this.provider = provider;
  }

  async create(input) {
    const fallback = createTopicRoadmap(input);
    if (!this.provider) return fallback;
    try {
      const result = await this.provider.plan({
        brief: fallback.brief,
        methodology: fallback.methodology,
        policyGate: fallback.policy_gate,
      });
      return enhanceTopicRoadmap(fallback, result.draft, {
        provider: result.provider,
        model: result.model,
        responseId: result.response_id,
      });
    } catch (error) {
      return {
        ...fallback,
        planner_status: {
          state: "fallback",
          provider: "openai",
          code: error.code ?? "PLANNER_FAILED",
          message: "تعذر التخطيط بالنموذج؛ استُخدمت الخارطة المنهجية الآمنة ويمكن للمستخدم مراجعتها.",
        },
      };
    }
  }
}
