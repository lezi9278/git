import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser, startTestServer } from "./helpers/browser.mjs";

function futureDateTime(minutes) {
  const date = new Date(Date.now() + minutes * 60_000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

test("第二版关键页面在桌面和窄窗口下无横向溢出", async (t) => {
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
  const today = futureDateTime(0).slice(0, 10);
  await page.evaluate(
    (payload) => {
      window.localStorage.setItem(
        payload.key,
        JSON.stringify([
          {
            id: "layout-note",
            kind: "note",
            title: "布局测试笔记",
            content: "用于验证笔记卡片在页面中的空间分配。",
            category: "thinking",
            date: payload.today,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
          {
            id: "layout-todo",
            kind: "todo",
            text: "布局测试待办事项",
            startAt: payload.startAt,
            endAt: payload.endAt,
            completed: false,
            completedAt: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ]),
      );
    },
    {
      key: "local-notes:items:v1",
      today,
      startAt: futureDateTime(60),
      endAt: futureDateTime(90),
    },
  );
  await page.reload();

  async function noHorizontalOverflow(name) {
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    assert.ok(
      dimensions.scrollWidth <= dimensions.clientWidth,
      `${name} 出现横向溢出`,
    );
  }

  for (const viewport of [
    { name: "desktop", width: 1440, height: 900 },
    { name: "narrow", width: 390, height: 844 },
  ]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.locator('[data-view="notes"]').click();
    await page.locator('[data-testid="notes-list-view"]').waitFor();
    await page.locator('[data-testid="note-item"]').first().waitFor();
    await noHorizontalOverflow(`${viewport.name} 笔记列表`);

    await page.locator('[data-testid="note-item"] [data-action="open-note"]').first().click();
    await page.locator('[data-testid="note-editor-page"]').waitFor();
    await noHorizontalOverflow(`${viewport.name} 笔记编辑页`);
    await page.locator('[data-action="cancel-editor"]').click();

    await page.locator('[data-view="todos"]').click();
    await page.locator('[data-testid="todos-list-view"]').waitFor();
    await page.locator('[data-testid="todo-item"]').first().waitFor();
    await noHorizontalOverflow(`${viewport.name} 待办列表`);

    await page.locator('[data-action="new-todo"]').click();
    await page.locator('[data-testid="todo-editor-page"]').waitFor();
    await noHorizontalOverflow(`${viewport.name} 待办编辑页`);
    await page.locator('[data-action="cancel-editor"]').click();

    await page.locator('[data-view="mine"]').click();
    await page.locator('[data-testid="mine-view"]').waitFor();
    await noHorizontalOverflow(`${viewport.name} 我的页`);
  }
});
