import test from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_LABEL_MAX_LENGTH } from "../src/core/categories.js";
import {
  clearItems,
  createMemoryBackend,
  DEFAULT_SETTINGS,
  loadRepository,
  migrateItems,
  readItems,
  readSettings,
  SETTINGS_KEY,
  STORAGE_KEY,
  writeItems,
  writeSettings,
} from "../src/core/storage.js";

test("损坏的本地数据会被安全读取为空列表", () => {
  const backend = createMemoryBackend("{bad json");
  assert.deepEqual(readItems(backend), []);
  assert.equal(backend.getItem(STORAGE_KEY), "{bad json");
});

test("写入和读取可以保留同一份数据", () => {
  const backend = createMemoryBackend();
  const items = [{ id: "note-1", kind: "note" }];
  writeItems(backend, items);
  assert.deepEqual(readItems(backend), items);
});

test("clearItems 会移除本地数据", () => {
  const backend = createMemoryBackend();
  writeItems(backend, [{ id: "1" }]);
  clearItems(backend);
  assert.deepEqual(readItems(backend), []);
});

test("仓库支持新增、更新和删除并持久化", () => {
  const backend = createMemoryBackend();
  const repo = loadRepository(backend);
  const item = { id: "note-a", kind: "note", title: "第一版" };
  repo.upsert(item);
  assert.deepEqual(repo.items(), [item]);

  repo.upsert({ ...item, title: "更新版" });
  assert.deepEqual(repo.items()[0].title, "更新版");
  assert.deepEqual(readItems(backend)[0].title, "更新版");

  repo.remove("note-a");
  assert.deepEqual(repo.items(), []);
  assert.deepEqual(readItems(backend), []);
});

test("旧的单时间待办数据会自动迁移为开始与结束时间", () => {
  const legacy = [
    {
      id: "todo-old",
      kind: "todo",
      text: "旧待办",
      dueAt: "2026-09-08T18:00",
      completed: false,
    },
    {
      id: "note-old",
      kind: "note",
      title: "旧笔记",
    },
  ];
  const migrated = migrateItems(legacy);
  assert.equal(migrated[0].startAt, "2026-09-08T18:00");
  assert.equal(migrated[0].endAt, "2026-09-08T18:00");
  assert.equal(migrated[0].dueAt, undefined);
  assert.equal(migrated[1], legacy[1]);
});

test("设置使用默认值并可读写", () => {
  const backend = createMemoryBackend();
  assert.deepEqual(readSettings(backend), DEFAULT_SETTINGS);
  writeSettings(backend, { noteDateMode: "manual", todoGraceMinutes: 10 });
  assert.deepEqual(readSettings(backend), {
    ...DEFAULT_SETTINGS,
    noteDateMode: "manual",
    todoGraceMinutes: 10,
  });
  assert.equal(backend.getItem(SETTINGS_KEY) !== null, true);
});

test("无效设置会回退到默认值并限制范围", () => {
  const backend = createMemoryBackend(
    JSON.stringify({ noteDateMode: "invalid", todoGraceMinutes: 9999 }),
  );
  const settings = readSettings(backend);
  assert.equal(settings.noteDateMode, "auto");
  assert.equal(settings.todoGraceMinutes, 1440);
});

test("主题设置默认为亮色，仅接受护眼模式取值", () => {
  const emptyBackend = createMemoryBackend();
  assert.equal(readSettings(emptyBackend).theme, "light");

  const eyeBackend = createMemoryBackend(JSON.stringify({ theme: "eye" }));
  assert.equal(readSettings(eyeBackend).theme, "eye");

  const invalidBackend = createMemoryBackend(JSON.stringify({ theme: "dark" }));
  assert.equal(readSettings(invalidBackend).theme, "light");
});

test("分类设置缺失或非法时回退到默认分类", () => {
  const emptyBackend = createMemoryBackend();
  assert.deepEqual(readSettings(emptyBackend).noteCategories, DEFAULT_SETTINGS.noteCategories);

  const invalidBackend = createMemoryBackend(
    JSON.stringify({
      noteCategories: [
        { key: "", label: " " },
        { key: "x", label: "" },
        "bad",
        null,
        { key: "long", label: "一".repeat(CATEGORY_LABEL_MAX_LENGTH + 1) },
      ],
    }),
  );
  assert.deepEqual(readSettings(invalidBackend).noteCategories, DEFAULT_SETTINGS.noteCategories);
});

test("合法的自定义分类会被保留", () => {
  const backend = createMemoryBackend(
    JSON.stringify({
      noteCategories: [
        { key: "insight", label: "感悟" },
        { key: "cat-1", label: "工作" },
      ],
    }),
  );
  assert.deepEqual(readSettings(backend).noteCategories, [
    { key: "insight", label: "感悟" },
    { key: "cat-1", label: "工作" },
  ]);
});

test("编辑默认字体、字号与颜色设置会被校验和限制", () => {
  const validBackend = createMemoryBackend(
    JSON.stringify({ editorFontFamily: "kaiti", editorFontSize: 20, editorColor: "red" }),
  );
  const valid = readSettings(validBackend);
  assert.equal(valid.editorFontFamily, "kaiti");
  assert.equal(valid.editorFontSize, 20);
  assert.equal(valid.editorColor, "red");

  const invalidBackend = createMemoryBackend(
    JSON.stringify({ editorFontFamily: "comic", editorFontSize: 99, editorColor: "pink" }),
  );
  const invalid = readSettings(invalidBackend);
  assert.equal(invalid.editorFontFamily, "default");
  assert.equal(invalid.editorFontSize, 32);
  assert.equal(invalid.editorColor, "ink");

  const fallback = readSettings(createMemoryBackend());
  assert.equal(fallback.editorFontFamily, "default");
  assert.equal(fallback.editorFontSize, 17);
  assert.equal(fallback.editorColor, "ink");
});
