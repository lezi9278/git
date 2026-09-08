import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser, startTestServer } from "./helpers/browser.mjs";

function futureDateTime() {
  const date = new Date(Date.now() + 60 * 60_000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

test("关键页面在桌面和窄窗口下无横向溢出", async (t) => {
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
  const dueAt = futureDateTime();
  const today = dueAt.slice(0, 10);
  await page.evaluate(
    (payload) => {
      window.localStorage.setItem(
        payload.key,
        JSON.stringify([
          {
            id: "layout-note",
            kind: "note",
            title: "布局测试笔记",
            content: "用于验证笔记列表和编辑区在页面中的空间分配。",
            category: "thinking",
            date: payload.today,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "layout-todo",
            kind: "todo",
            text: "布局测试待办事项",
            dueAt: payload.dueAt,
            completed: false,
            completedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ]),
      );
    },
    { key: "local-notes:items:v1", today, dueAt },
  );
  await page.reload();

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "narrow", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.locator('[data-view="notes"]').click();
    await page.locator('[data-testid="notes-view"]').waitFor();
    await page.locator('[data-testid="note-item"]').first().waitFor();
    let dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(
      dimensions.scrollWidth <= dimensions.clientWidth,
      `${viewport.name} 笔记页出现横向溢出`,
    );

    await page.locator('[data-view="todos"]').click();
    await page.locator('[data-testid="todos-view"]').waitFor();
    await page.locator('[data-testid="todo-item"]').first().waitFor();
    dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(
      dimensions.scrollWidth <= dimensions.clientWidth,
      `${viewport.name} 待办页出现横向溢出`,
    );

    await page.locator('[data-view="mine"]').click();
    await page.locator('[data-testid="mine-view"]').waitFor();
    await page.locator('[data-action="set-range"][data-range="all"]').click();
    await page.locator('[data-testid="mine-view"]').waitFor();
    dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(
      dimensions.scrollWidth <= dimensions.clientWidth,
      `${viewport.name} 我的页出现横向溢出`,
    );
  }
});
