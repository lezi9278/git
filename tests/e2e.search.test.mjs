import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser, startTestServer } from "./helpers/browser.mjs";

function localDate(offsetDays) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function createSeedNotes() {
  return [
    {
      id: "note-search-a",
      kind: "note",
      title: "项目复盘",
      content: "整理本季度的工作总结。",
      category: "insight",
      date: localDate(0),
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
    {
      id: "note-search-b",
      kind: "note",
      title: "Shopping List",
      content: "buy milk and eggs",
      category: "life",
      date: localDate(-1),
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
    {
      id: "note-search-c",
      kind: "note",
      title: "随笔",
      content: "随便写几句。",
      category: "thinking",
      date: localDate(-2),
      createdAt: "2026-09-01T00:00:00.000Z",
      updatedAt: "2026-09-01T00:00:00.000Z",
    },
  ];
}

test("第三版笔记搜索：放大镜入口、实时过滤、清空与地址恢复", async (t) => {
  const { server, url } = await startTestServer();
  const browser = await launchBrowser();
  t.after(async () => {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  });

  const page = await browser.newPage();
  await page.goto(`${url}/`);
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.evaluate(
    (payload) => {
      window.localStorage.setItem(payload.key, JSON.stringify(payload.notes));
    },
    { key: "local-notes:items:v1", notes: createSeedNotes() },
  );
  await page.reload();
  await page.locator('[data-testid="notes-list-view"]').waitFor();
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 3);

  assert.equal(await page.locator('[data-action="note-search-toggle"]').isVisible(), true);
  await page.locator('[data-view="todos"]').click();
  await page.locator('[data-testid="todos-list-view"]').waitFor();
  assert.equal(await page.locator('[data-action="note-search-toggle"]').count(), 0);
  await page.locator('[data-view="notes"]').click();
  await page.locator('[data-testid="notes-list-view"]').waitFor();

  await page.locator('[data-action="note-search-toggle"]').click();
  const searchInput = page.locator('[data-testid="note-search-input"]');
  await searchInput.waitFor();
  await searchInput.fill("复盘");
  await page.waitForTimeout(50);
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 1);
  assert.match(
    await page.locator('[data-testid="note-item"]').first().textContent(),
    /项目复盘/,
  );
  assert.match(await page.locator("#page-subtitle").textContent(), /找到 1 篇笔记/);

  await searchInput.fill("不存在的关键词");
  await page.waitForTimeout(50);
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 0);
  assert.match(await page.locator(".empty-state").textContent(), /没有匹配的笔记/);

  await searchInput.fill("SHOPPING");
  await page.waitForTimeout(50);
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 1);
  assert.match(
    await page.locator('[data-testid="note-item"]').first().textContent(),
    /Shopping List/,
  );

  await searchInput.fill("milk");
  await page.waitForTimeout(50);
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 1);

  assert.equal(await page.locator("[data-action='note-search-clear']").isVisible(), true);
  await page.locator("[data-action='note-search-clear']").click();
  await page.waitForTimeout(50);
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 3);
  assert.equal(await searchInput.inputValue(), "");

  await searchInput.fill("复盘");
  await page.waitForTimeout(50);
  assert.match(await page.evaluate(() => window.location.search), /q=/);
  await page.reload();
  await searchInput.waitFor();
  assert.equal(await searchInput.inputValue(), "复盘");
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 1);

  await page.locator('[data-action="note-search-toggle"]').click();
  await page.waitForTimeout(50);
  assert.equal(await page.locator('[data-testid="note-search-input"]').count(), 0);
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 3);
  assert.doesNotMatch(await page.evaluate(() => window.location.search), /q=/);
});
