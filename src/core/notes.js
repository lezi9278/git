import { CATEGORY_KEYS } from "./categories.js";
import { isValidDateKey } from "./time.js";
import { sanitizeRichText, stripHtml } from "./richtext.js";

export function makeId(prefix) {
  const randomPart =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

export function validateNoteDraft(draft, categoryKeys = CATEGORY_KEYS) {
  const title = typeof draft.title === "string" ? draft.title.trim() : "";
  const content = typeof draft.content === "string" ? draft.content.trim() : "";
  const visibleContent = draft.richText === true ? stripHtml(content) : content;
  const category = draft.category;
  const date = draft.date;
  const errors = [];
  if (!title) {
    errors.push("标题不能为空");
  }
  if (!visibleContent) {
    errors.push("内容不能为空");
  }
  if (!categoryKeys.includes(category)) {
    errors.push("请选择有效分类");
  }
  if (!isValidDateKey(date)) {
    errors.push("请选择有效日期");
  }
  return { valid: errors.length === 0, errors };
}

export function createNote(draft, now = new Date(), categoryKeys = CATEGORY_KEYS) {
  const result = validateNoteDraft(draft, categoryKeys);
  if (!result.valid) {
    const error = new Error(`笔记信息不完整: ${result.errors.join("；")}`);
    error.validation = result.errors;
    throw error;
  }
  const timestamp = now.toISOString();
  const richText = draft.richText === true;
  return {
    id: makeId("note"),
    kind: "note",
    title: draft.title.trim(),
    content: richText ? sanitizeRichText(draft.content) : draft.content.trim(),
    richText,
    category: draft.category,
    date: draft.date,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateNote(note, draft, now = new Date(), categoryKeys = CATEGORY_KEYS) {
  const result = validateNoteDraft(draft, categoryKeys);
  if (!result.valid) {
    const error = new Error(`笔记信息不完整: ${result.errors.join("；")}`);
    error.validation = result.errors;
    throw error;
  }
  const richText = draft.richText === true;
  return {
    ...note,
    kind: "note",
    title: draft.title.trim(),
    content: richText ? sanitizeRichText(draft.content) : draft.content.trim(),
    richText,
    category: draft.category,
    date: draft.date,
    updatedAt: now.toISOString(),
  };
}

export function filterNotes(items, category = "all", categoryKeys = CATEGORY_KEYS) {
  const notes = items.filter((item) => item.kind === "note");
  if (category === "all") {
    return notes;
  }
  if (!categoryKeys.includes(category)) {
    return notes;
  }
  return notes.filter((note) => note.category === category);
}

export function searchNotes(items, query = "") {
  const keyword = String(query ?? "").trim().toLowerCase();
  return items.filter((item) => {
    if (item?.kind !== "note") {
      return false;
    }
    if (!keyword) {
      return true;
    }
    const title = typeof item.title === "string" ? item.title : "";
    const content = typeof item.content === "string" ? item.content : "";
    return (
      title.toLowerCase().includes(keyword) ||
      content.toLowerCase().includes(keyword)
    );
  });
}

export function sortNotes(items) {
  return [...items].sort((left, right) => {
    const dateDifference = right.date.localeCompare(left.date);
    if (dateDifference !== 0) {
      return dateDifference;
    }
    return right.createdAt.localeCompare(left.createdAt);
  });
}
