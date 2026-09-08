import { makeId } from "./notes.js";
import { parseLocalDateTime, isValidDateTimeValue } from "./time.js";

export function validateTodoDraft(draft) {
  const text = typeof draft.text === "string" ? draft.text.trim() : "";
  const dueAt = draft.dueAt;
  const errors = [];
  if (!text) {
    errors.push("待办内容不能为空");
  }
  if (!isValidDateTimeValue(dueAt)) {
    errors.push("请选择有效的日期和时间");
  }
  return { valid: errors.length === 0, errors };
}

export function createTodo(draft, now = new Date()) {
  const result = validateTodoDraft(draft);
  if (!result.valid) {
    const error = new Error(`待办信息不完整: ${result.errors.join("；")}`);
    error.validation = result.errors;
    throw error;
  }
  const timestamp = now.toISOString();
  return {
    id: makeId("todo"),
    kind: "todo",
    text: draft.text.trim(),
    dueAt: draft.dueAt,
    completed: false,
    completedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updateTodo(todo, draft, now = new Date()) {
  const result = validateTodoDraft(draft);
  if (!result.valid) {
    const error = new Error(`待办信息不完整: ${result.errors.join("；")}`);
    error.validation = result.errors;
    throw error;
  }
  return {
    ...todo,
    kind: "todo",
    text: draft.text.trim(),
    dueAt: draft.dueAt,
    updatedAt: now.toISOString(),
  };
}

export function setTodoCompleted(todo, completed, now = new Date()) {
  return {
    ...todo,
    completed: Boolean(completed),
    completedAt: completed ? now.toISOString() : null,
    updatedAt: now.toISOString(),
  };
}

export function purgeOverdueTodos(items, now = new Date()) {
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const remaining = [];
  const removed = [];
  for (const item of items) {
    if (item.kind !== "todo" || item.completed) {
      remaining.push(item);
      continue;
    }
    const dueTime = parseLocalDateTime(item.dueAt);
    if (dueTime && dueTime.getTime() <= currentTime) {
      removed.push(item);
    } else {
      remaining.push(item);
    }
  }
  return { remaining, removed };
}

export function sortTodos(items) {
  return [...items].sort((left, right) => {
    const leftTime = parseLocalDateTime(left.dueAt)?.getTime() ?? 0;
    const rightTime = parseLocalDateTime(right.dueAt)?.getTime() ?? 0;
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.createdAt.localeCompare(right.createdAt);
  });
}
