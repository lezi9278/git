import test from "node:test";
import assert from "node:assert/strict";
import {
  clearItems,
  createMemoryBackend,
  loadRepository,
  readItems,
  STORAGE_KEY,
  writeItems,
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
