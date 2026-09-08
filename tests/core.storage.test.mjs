import test from "node:test";
import assert from "node:assert/strict";
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
