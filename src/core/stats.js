import { toMonthKey } from "./time.js";

export function recordDateKey(item) {
  if (item.kind === "note") {
    return item.date;
  }
  if (item.kind === "todo") {
    return (item.startAt ?? item.endAt ?? "").slice(0, 10);
  }
  return "";
}

export function itemMonthKey(item) {
  return recordDateKey(item).slice(0, 7);
}

export function isInRange(item, range, reference = new Date()) {
  if (range !== "month") {
    return true;
  }
  return itemMonthKey(item) === toMonthKey(reference);
}

export function listForRange(items, range, reference = new Date()) {
  return items
    .filter((item) => item.kind === "note" || item.kind === "todo")
    .filter((item) => isInRange(item, range, reference))
    .sort((left, right) => {
      const dateDifference = recordDateKey(right).localeCompare(recordDateKey(left));
      if (dateDifference !== 0) {
        return dateDifference;
      }
      return (right.createdAt ?? "").localeCompare(left.createdAt ?? "");
    });
}

export function summarizeItems(items) {
  const notes = items.filter((item) => item.kind === "note").length;
  const todos = items.filter((item) => item.kind === "todo").length;
  return {
    total: items.length,
    notes,
    todos,
  };
}
