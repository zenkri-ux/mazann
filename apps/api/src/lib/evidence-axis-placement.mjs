const COMMON = new Set([
  "قران", "حديث", "سنه", "الله", "رسول", "نبي", "مسلم", "مجتمع",
  "ناس", "معني", "موضوع", "محور", "دليل", "ادله", "شرعي", "شرعيه",
  "الذي", "التي", "كيف", "ماذا", "ما", "من", "في", "علي", "عن", "الي", "بين",
  "هذا", "هذه", "ذلك", "تلك", "خلال", "قبل", "بعد", "اهم", "اكثر", "يمكن",
]);

function tokens(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u0640\u064B-\u065F\u0670]/gu, "")
    .replace(/[إأآٱ]/gu, "ا")
    .replace(/ى/gu, "ي")
    .replace(/ة/gu, "ه")
    .match(/[\p{Script=Arabic}]+/gu)
    ?.map((word) => word.replace(/^(?:وال|بال|فال|كال|ال)/u, "").replace(/^(?:و|ف|ب)/u, "").replace(/(?:ات|ه)$/u, ""))
    .filter((word) => word.length >= 3 && !COMMON.has(word)) ?? [];
}

export function suggestEvidenceAxis(record, axes) {
  const evidence = new Set(tokens([
    record?.text,
    record?.metadata?.title,
    record?.metadata?.commentary,
  ].filter(Boolean).join(" ")));
  const scored = axes.map((axis) => {
    const terms = new Set(tokens([axis.title, axis.research_question, axis.purpose].filter(Boolean).join(" ")));
    const overlap = [...terms].filter((term) => evidence.has(term));
    return { axis_id: axis.axis_id, score: overlap.length, matched_terms: overlap };
  }).sort((left, right) => right.score - left.score);
  const first = scored[0];
  const second = scored[1];
  if (!first || first.score < 2 || first.score === second?.score) {
    return { axis_ids: [], placement_status: "needs_user_assignment" };
  }
  return { axis_ids: [first.axis_id], placement_status: "suggested_needs_confirmation" };
}
