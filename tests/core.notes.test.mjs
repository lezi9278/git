import test from "node:test";
import assert from "node:assert/strict";
import {
  createNote,
  filterNotes,
  searchNotes,
  sortNotes,
  updateNote,
  validateNoteDraft,
} from "../src/core/notes.js";

const validDraft = {
  title: "  一次阅读感悟  ",
  content: "  记录今天读到的内容  ",
  category: "insight",
  date: "2026-09-08",
};

test("笔记草稿校验会拒绝空标题、空内容、无效分类和无效日期", () => {
  assert.equal(validateNoteDraft({ ...validDraft, title: " " }).valid, false);
  assert.equal(validateNoteDraft({ ...validDraft, content: " " }).valid, false);
  assert.equal(validateNoteDraft({ ...validDraft, category: "unknown" }).valid, false);
  assert.equal(validateNoteDraft({ ...validDraft, date: "2026-02-31" }).valid, false);
  assert.equal(validateNoteDraft(validDraft).valid, true);
});

test("创建笔记会清理首尾空白并保存完整字段", () => {
  const now = new Date("2026-09-08T10:00:00.000Z");
  const note = createNote(validDraft, now);
  assert.equal(note.kind, "note");
  assert.equal(note.title, "一次阅读感悟");
  assert.equal(note.content, "记录今天读到的内容");
  assert.equal(note.category, "insight");
  assert.equal(note.date, "2026-09-08");
  assert.equal(note.createdAt, now.toISOString());
  assert.ok(note.id.startsWith("note-"));
});

test("修改笔记后保留原 id 并更新修改时间", () => {
  const note = createNote(validDraft, new Date("2026-09-08T10:00:00.000Z"));
  const updated = updateNote(
    note,
    { ...validDraft, title: "新标题", category: "life", date: "2026-09-09" },
    new Date("2026-09-09T12:00:00.000Z"),
  );
  assert.equal(updated.id, note.id);
  assert.equal(updated.title, "新标题");
  assert.equal(updated.category, "life");
  assert.equal(updated.date, "2026-09-09");
  assert.equal(updated.createdAt, note.createdAt);
  assert.equal(updated.updatedAt, "2026-09-09T12:00:00.000Z");
});

test("按分类筛选笔记，全部返回所有笔记而不返回待办", () => {
  const notes = [
    createNote({ ...validDraft, title: "A", category: "insight", date: "2026-09-01" }),
    createNote({ ...validDraft, title: "B", category: "life", date: "2026-09-02" }),
    { kind: "todo", text: "不应出现", dueAt: "2026-09-03T10:00" },
  ];
  assert.deepEqual(filterNotes(notes, "insight").map((item) => item.title), ["A"]);
  assert.equal(filterNotes(notes, "all").length, 2);
  assert.equal(filterNotes(notes, "thinking").length, 0);
});

test("笔记按用户填写的日期从新到旧排序", () => {
  const oldNote = createNote({ ...validDraft, date: "2026-08-30" });
  const newNote = createNote({ ...validDraft, date: "2026-09-10" });
  const middleNote = createNote({ ...validDraft, date: "2026-09-01" });
  assert.deepEqual(sortNotes([oldNote, middleNote, newNote]).map((item) => item.title), [
    newNote.title,
    middleNote.title,
    oldNote.title,
  ]);
});

test("搜索笔记按标题与正文进行不区分大小写的匹配", () => {
  const notes = [
    createNote({ ...validDraft, title: "项目复盘", content: "整理本季度总结", date: "2026-09-01" }),
    createNote({
      ...validDraft,
      title: "Shopping List",
      content: "buy milk and eggs",
      category: "life",
      date: "2026-09-02",
    }),
    { kind: "todo", text: "待办不应被搜索到" },
  ];
  assert.equal(searchNotes(notes, "").length, 2);
  assert.equal(searchNotes(notes, "   ").length, 2);
  assert.deepEqual(searchNotes(notes, "复盘").map((item) => item.title), ["项目复盘"]);
  assert.deepEqual(searchNotes(notes, "总结").map((item) => item.title), ["项目复盘"]);
  assert.deepEqual(searchNotes(notes, "shopping").map((item) => item.title), [
    "Shopping List",
  ]);
  assert.equal(searchNotes(notes, "BUY").length, 1);
  assert.equal(searchNotes(notes, "不存在的关键词").length, 0);
  assert.equal(searchNotes(notes, "待办").length, 0);
});

test("校验与筛选支持自定义分类列表", () => {
  const keys = ["work", "insight"];
  assert.equal(validateNoteDraft({ ...validDraft, category: "work" }, keys).valid, true);
  assert.equal(validateNoteDraft({ ...validDraft, category: "life" }, keys).valid, false);

  const now = new Date("2026-09-08T10:00:00.000Z");
  const workNote = createNote({ ...validDraft, title: "A", category: "work" }, now, keys);
  assert.equal(workNote.category, "work");
  const updated = updateNote(workNote, { ...validDraft, category: "insight" }, now, keys);
  assert.equal(updated.category, "insight");

  const lifeNote = createNote({ ...validDraft, title: "B", category: "life", date: "2026-09-02" });
  const items = [workNote, lifeNote];
  assert.deepEqual(filterNotes(items, "work", keys).map((item) => item.title), ["A"]);
  assert.equal(filterNotes(items, "all", keys).length, 2);
  assert.equal(filterNotes(items, "life", keys).length, 2);
});
