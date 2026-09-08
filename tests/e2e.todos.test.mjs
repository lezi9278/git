import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser, startTestServer } from "./helpers/browser.mjs";

function localDateTimeFromMinutesFromNow(minutes) {
  const date = new Date(Date.now() + minutes * 60_000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

test("第二版待办列表、独立编辑页、完成状态与过期清理", async (t) => {
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
  await page.reload();
  await page.locator('[data-view="todos"]').click();
  await page.locator('[data-testid="todos-list-view"]').waitFor();

  await page.locator('[data-action="new-todo"]').click();
  await page.locator('[data-testid="todo-editor-page"]').waitFor();
  assert.equal(await page.locator('[data-testid="todos-list-view"]').count(), 0);

  const startTime = localDateTimeFromMinutesFromNow(60);
  const endTime = localDateTimeFromMinutesFromNow(90);
  await page.locator('input[name="text"]').fill("整理第二版阶段文档");
  await page.locator('input[name="startAt"]').fill(startTime);
  await page.locator('input[name="endAt"]').fill(endTime);
  await page.locator('button[type="submit"]').click();

  await page.locator('[data-testid="todos-list-view"]').waitFor();
  const todoItem = page.locator('[data-testid="todo-item"]').first();
  await todoItem.waitFor();
  assert.match(await todoItem.textContent(), /整理第二版阶段文档/);
  assert.equal(await todoItem.locator(".status-foot").textContent(), "未完成");
  assert.equal(await page.locator('[data-testid="todo-completed"]').count(), 0);

  await todoItem.locator('[data-action="toggle-todo"]').click();
  assert.equal(await todoItem.locator(".status-foot").textContent(), "已完成");
  assert.equal(await page.locator('[data-testid="todo-item"]').count(), 1);

  await todoItem.locator('[data-action="open-todo"]').click();
  await page.locator('[data-testid="todo-editor-page"]').waitFor();
  assert.equal(await page.locator('input[name="text"]').inputValue(), "整理第二版阶段文档");
  await page.locator('input[name="text"]').fill("整理第二版阶段文档（已修改）");
  const laterEnd = localDateTimeFromMinutesFromNow(120);
  await page.locator('input[name="endAt"]').fill(laterEnd);
  await page.locator('button[type="submit"]').click();

  await page.locator('[data-testid="todos-list-view"]').waitFor();
  assert.match(
    await page.locator('[data-testid="todo-item"]').first().textContent(),
    /整理第二版阶段文档（已修改）/,
  );
  assert.equal(
    await page.locator('[data-testid="todo-item"]').first().locator(".status-foot").textContent(),
    "已完成",
  );

  await page.reload();
  await page.locator('[data-view="todos"]').click();
  await page.locator('[data-testid="todo-item"]').first().waitFor();
  assert.match(
    await page.locator('[data-testid="todo-item"]').first().textContent(),
    /整理第二版阶段文档（已修改）/,
  );

  await page.locator('[data-testid="todo-item"] [data-action="delete-todo"]').click();
  assert.equal(await page.locator("#confirm-root").isVisible(), true);
  await page.locator("#confirm-root [data-action='close-confirm']").click();
  assert.equal(await page.locator('[data-testid="todo-item"]').count(), 1);
  await page.locator('[data-testid="todo-item"] [data-action="delete-todo"]').click();
  await page.locator("#confirm-action").click();
  assert.equal(await page.locator('[data-testid="todo-item"]').count(), 0);

  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const dateKey = (date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timeKey = (date) =>
    `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const pastEnd = new Date(Date.now() - 10 * 60_000);
  const pastStart = new Date(Date.now() - 60 * 60_000);
  const overdue = {
    id: "todo-overdue-v2",
    kind: "todo",
    text: "过期未完成待办",
    startAt: `${dateKey(pastStart)}T${timeKey(pastStart)}`,
    endAt: `${dateKey(pastEnd)}T${timeKey(pastEnd)}`,
    completed: false,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const completedOverdue = {
    ...overdue,
    id: "todo-completed-v2",
    text: "已完成的过期待办",
    completed: true,
    completedAt: "2026-01-01T00:00:00.000Z",
  };
  await page.evaluate(
    (payload) => {
      window.localStorage.setItem(
        payload.key,
        JSON.stringify([payload.overdue, payload.completedOverdue]),
      );
    },
    { key: "local-notes:items:v1", overdue, completedOverdue },
  );
  await page.reload();
  await page.locator('[data-view="todos"]').click();
  await page.locator('[data-testid="todos-list-view"]').waitFor();
  assert.equal(
    await page.locator('[data-testid="todo-item"]').filter({ hasText: "过期未完成待办" }).count(),
    0,
  );
  assert.equal(
    await page.locator('[data-testid="todo-item"]').filter({ hasText: "已完成的过期待办" }).count(),
    1,
  );
  assert.equal(
    await page
      .locator('[data-testid="todo-item"]')
      .filter({ hasText: "已完成的过期待办" })
      .locator(".status-foot")
      .textContent(),
    "已完成",
  );
});
