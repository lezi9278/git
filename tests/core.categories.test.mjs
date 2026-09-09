import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORY_LABEL_MAX_LENGTH,
  DEFAULT_NOTE_CATEGORIES,
  categoryKeysOf,
  categoryLabelIn,
  normalizeCategories,
} from "../src/core/categories.js";

test("normalizeCategories 缺失或全非法时回退默认分类", () => {
  assert.deepEqual(normalizeCategories(undefined), DEFAULT_NOTE_CATEGORIES.map((entry) => ({ ...entry })));
  assert.deepEqual(normalizeCategories("bad"), DEFAULT_NOTE_CATEGORIES.map((entry) => ({ ...entry })));
  assert.deepEqual(
    normalizeCategories([
      { key: "", label: " " },
      { key: "x", label: "" },
      "bad",
      null,
      { key: "long", label: "一".repeat(CATEGORY_LABEL_MAX_LENGTH + 1) },
    ]),
    DEFAULT_NOTE_CATEGORIES.map((entry) => ({ ...entry })),
  );
});

test("normalizeCategories 清洗重复与非法项并保留合法自定义分类", () => {
  const cleaned = normalizeCategories([
    { key: "insight", label: "  感悟 " },
    { key: "insight", label: "重复键" },
    { key: "cat-1", label: "工作" },
    { key: "cat-2", label: "" },
    { key: "cat-3", label: "生活" },
    { key: "cat-3", label: "再次重复" },
  ]);
  assert.deepEqual(cleaned, [
    { key: "insight", label: "感悟" },
    { key: "cat-1", label: "工作" },
    { key: "cat-3", label: "生活" },
  ]);
});

test("categoryLabelIn 对已知分类返回名称，未知分类回退未分类", () => {
  const categories = [{ key: "work", label: "工作" }];
  assert.equal(categoryLabelIn(categories, "work"), "工作");
  assert.equal(categoryLabelIn(categories, "unknown"), "未分类");
});

test("categoryKeysOf 提取分类键列表", () => {
  assert.deepEqual(categoryKeysOf(DEFAULT_NOTE_CATEGORIES), ["insight", "life", "thinking"]);
});
