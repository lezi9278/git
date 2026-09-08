import { makeId } from "./notes.js";
import {
  addMinutesToLocalDateTime,
  isValidDateTimeValue,
  parseLocalDateTime,
} from "./time.js";

export function validateTodoDraft(draft) {
  const text = typeof draft.text === "string" ? draft.text.trim() : "";
  const startAt = draft.startAt;
  const endAt = draft.endAt;
  const errors = [];
  if (!text) {
    errors.push("待办内容不能为空");
  }
  if (!isValidDateTimeValue(startAt)) {
    errors.push("请选择有效的开始时间");
  }
  if (!isValidDateTimeValue(endAt)) {
    errors.push("请选择有效的结束时间");
  }
  if (
    isValidDateTimeValue(startAt) &&
    isValidDateTimeValue(endAt) &&
    parseLocalDateTime(endAt).getTime() <= parseLocalDateTime(startAt).getTime()
  ) {
    errors.push("结束时间必须晚于开始时间");
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
    startAt: draft.startAt,
    endAt: draft.endAt,
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
    startAt: draft.startAt,
    endAt: draft.endAt,
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

export function purgeOverdueTodos(items, now = new Date(), graceMinutes = 5) {
  const currentTime = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const remaining = [];
  const removed = [];
  for (const item of items) {
    if (item.kind !== "todo" || item.completed) {
      remaining.push(item);
      continue;
    }
    const expiry = addMinutesToLocalDateTime(item.endAt, graceMinutes);
    const expiryTime = expiry ? parseLocalDateTime(expiry).getTime() : null;
    if (expiryTime !== null && expiryTime <= currentTime) {
      removed.push(item);
    } else {
      remaining.push(item);
    }
  }
  return { remaining, removed };
}

export function sortTodos(items) {
  return [...items].sort((left, right) => {
    if (left.completed !== right.completed) {
      return left.completed ? 1 : -1;
    }
    const leftTime = parseLocalDateTime(left.startAt ?? left.endAt)?.getTime() ?? 0;
    const rightTime = parseLocalDateTime(right.startAt ?? right.endAt)?.getTime() ?? 0;
    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }
    return left.createdAt.localeCompare(right.createdAt);
  });
}
