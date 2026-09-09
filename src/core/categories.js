export const CATEGORY_KEYS = Object.freeze(["insight", "life", "thinking"]);

export const CATEGORY_LABELS = Object.freeze({
  insight: "感悟",
  life: "生活",
  thinking: "思考",
});

export const DEFAULT_NOTE_CATEGORIES = Object.freeze(
  CATEGORY_KEYS.map((key) => Object.freeze({ key, label: CATEGORY_LABELS[key] })),
);

export const CATEGORY_LABEL_MAX_LENGTH = 12;

export function normalizeCategories(raw) {
  if (!Array.isArray(raw)) {
    return DEFAULT_NOTE_CATEGORIES.map((category) => ({ ...category }));
  }
  const seen = new Set();
  const cleaned = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") {
      continue;
    }
    const key = typeof entry.key === "string" ? entry.key.trim() : "";
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    if (!key || !label || label.length > CATEGORY_LABEL_MAX_LENGTH || seen.has(key)) {
      continue;
    }
    seen.add(key);
    cleaned.push({ key, label });
  }
  if (!cleaned.length) {
    return DEFAULT_NOTE_CATEGORIES.map((category) => ({ ...category }));
  }
  return cleaned;
}

export function categoryKeysOf(categories) {
  return categories.map((category) => category.key);
}

export function categoryLabelIn(categories, value) {
  const found = categories.find((category) => category.key === value);
  return found ? found.label : "未分类";
}

export function isCategory(value) {
  return CATEGORY_KEYS.includes(value);
}

export function categoryLabel(value) {
  return CATEGORY_LABELS[value] ?? "未分类";
}
