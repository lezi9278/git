import test from "node:test";
import assert from "node:assert/strict";
import {
  createTodo,
  purgeOverdueTodos,
  setTodoCompleted,
  updateTodo,
  validateTodoDraft,
} from "../src/core/todos.js";

const validDraft = {
  text: "  整理会议记录  ",
  startAt: "2026-09-08T18:00",
  endAt: "2026-09-08T18:30",
};

test("待办草稿校验会拒绝空内容、无效时间和倒置时间段", () => {
  assert.equal(validateTodoDraft({ ...validDraft, text: "" }).valid, false);
  assert.equal(validateTodoDraft({ ...validDraft, startAt: "2026-09-08" }).valid, false);
  assert.equal(
    validateTodoDraft({ ...validDraft, endAt: "2026-02-31T10:00" }).valid,
    false,
  );
  assert.equal(
    validateTodoDraft({ ...validDraft, startAt: "2026-09-08T19:00" }).valid,
    false,
  );
  assert.equal(validateTodoDraft(validDraft).valid, true);
});

test("创建待办保存文本、时间并初始化为未完成", () => {
  const now = new Date("2026-09-08T08:00:00.000Z");
  const todo = createTodo(validDraft, now);
  assert.equal(todo.kind, "todo");
  assert.equal(todo.text, "整理会议记录");
  assert.equal(todo.startAt, "2026-09-08T18:00");
  assert.equal(todo.endAt, "2026-09-08T18:30");
  assert.equal(todo.completed, false);
  assert.equal(todo.completedAt, null);
  assert.ok(todo.id.startsWith("todo-"));
});

test("修改待办后保留完成状态并更新时间", () => {
  const todo = createTodo(validDraft, new Date("2026-09-08T08:00:00.000Z"));
  const completed = setTodoCompleted(
    todo,
    true,
    new Date("2026-09-08T10:00:00.000Z"),
  );
  const updated = updateTodo(
    completed,
    { text: "整理新内容", startAt: "2026-09-09T09:00", endAt: "2026-09-09T10:00" },
    new Date("2026-09-08T11:00:00.000Z"),
  );
  assert.equal(updated.id, todo.id);
  assert.equal(updated.text, "整理新内容");
  assert.equal(updated.startAt, "2026-09-09T09:00");
  assert.equal(updated.endAt, "2026-09-09T10:00");
  assert.equal(updated.completed, true);
  assert.equal(updated.updatedAt, "2026-09-08T11:00:00.000Z");
});

test("标记完成会记录完成时间，取消完成会清空完成时间", () => {
  const todo = createTodo(validDraft);
  const done = setTodoCompleted(
    todo,
    true,
    new Date("2026-09-08T12:00:00.000Z"),
  );
  assert.equal(done.completed, true);
  assert.equal(done.completedAt, "2026-09-08T12:00:00.000Z");
  const undone = setTodoCompleted(done, false, new Date("2026-09-08T13:00:00.000Z"));
  assert.equal(undone.completed, false);
  assert.equal(undone.completedAt, null);
});

test("过期且未完成的待办会被清理，已完成和未过期待办保留", () => {
  const now = new Date("2026-09-08T18:00:00.000");
  const overdue = createTodo(
    {
      text: "过期任务",
      startAt: "2026-09-08T17:00",
      endAt: "2026-09-08T17:55",
    },
    new Date("2026-09-08T10:00:00.000Z"),
  );
  const notDue = createTodo(
    {
      text: "未来任务",
      startAt: "2026-09-08T18:00",
      endAt: "2026-09-08T18:01",
    },
    new Date("2026-09-08T10:00:00.000Z"),
  );
  const completed = setTodoCompleted(
    createTodo(
      {
        text: "已完成过期任务",
        startAt: "2026-09-08T11:30",
        endAt: "2026-09-08T12:00",
      },
      new Date("2026-09-08T10:00:00.000Z"),
    ),
    true,
    new Date("2026-09-08T11:00:00.000Z"),
  );
  const result = purgeOverdueTodos([overdue, notDue, completed], now);
  assert.deepEqual(result.removed.map((item) => item.text), ["过期任务"]);
  assert.deepEqual(result.remaining.map((item) => item.text), ["未来任务", "已完成过期任务"]);
});

test("过期清理可以按自定义缓冲分钟数调整", () => {
  const now = new Date("2026-09-08T18:03:00.000");
  const todo = createTodo({
    text: "缓冲测试",
    startAt: "2026-09-08T17:30",
    endAt: "2026-09-08T18:00",
  });
  assert.equal(purgeOverdueTodos([todo], now, 5).removed.length, 0);
  assert.equal(purgeOverdueTodos([todo], now, 10).removed.length, 0);
  assert.equal(purgeOverdueTodos([todo], now, 3).removed.length, 1);
});
