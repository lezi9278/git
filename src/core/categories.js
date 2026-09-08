export const CATEGORY_KEYS = Object.freeze(["insight", "life", "thinking"]);

export const CATEGORY_LABELS = Object.freeze({
  insight: "感悟",
  life: "生活",
  thinking: "思考",
});

export function isCategory(value) {
  return CATEGORY_KEYS.includes(value);
}

export function categoryLabel(value) {
  return CATEGORY_LABELS[value] ?? "未分类";
}
