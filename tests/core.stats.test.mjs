import test from "node:test";
import assert from "node:assert/strict";
import { createNote } from "../src/core/notes.js";
import { createTodo } from "../src/core/todos.js";
import {
  listForRange,
  recordDateKey,
  summarizeItems,
} from "../src/core/stats.js";

const noteInMonth = createNote({
  title: "本月笔记",
  content: "内容",
  category: "thinking",
  date: "2026-09-05",
});
const noteOutsideMonth = createNote({
  title: "上月笔记",
  content: "内容",
  category: "life",
  date: "2026-08-31",
});
const todoInMonth = createTodo({
  text: "本月待办",
  dueAt: "2026-09-10T09:00",
});
const completedTodoInMonth = {
  ...createTodo({
    text: "已完成待办",
    dueAt: "2026-09-02T09:00",
  }),
  completed: true,
  completedAt: "2026-09-02T10:00:00.000Z",
};

test("recordDateKey 从笔记日期和待办时间中取出日期", () => {
  assert.equal(recordDateKey(noteInMonth), "2026-09-05");
  assert.equal(recordDateKey(todoInMonth), "2026-09-10");
});

test("本月创作只包含日期落在参考月份的内容", () => {
  const reference = new Date(2026, 8, 20, 12, 0);
  const result = listForRange(
    [noteInMonth, noteOutsideMonth, todoInMonth, completedTodoInMonth],
    "month",
    reference,
  );
  assert.deepEqual(
    result.map((item) => item.title ?? item.text),
    ["本月待办", "本月笔记", "已完成待办"],
  );
});

test("全部创作包含所有未被删除的内容并按日期倒序", () => {
  const reference = new Date(2026, 8, 20, 12, 0);
  const result = listForRange(
    [noteOutsideMonth, noteInMonth, completedTodoInMonth, todoInMonth],
    "all",
    reference,
  );
  assert.deepEqual(
    result.map((item) => item.title ?? item.text),
    ["本月待办", "本月笔记", "已完成待办", "上月笔记"],
  );
});

test("统计会分别计算总数、笔记数和待办数，并包含已完成待办", () => {
  const counts = summarizeItems([
    noteInMonth,
    noteOutsideMonth,
    todoInMonth,
    completedTodoInMonth,
  ]);
  assert.deepEqual(counts, { total: 4, notes: 2, todos: 2 });
});
