import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser, startTestServer } from "./helpers/browser.mjs";

function localDateTimeFromMinutesFromNow(minutes) {
  const date = new Date(Date.now() + minutes * 60_000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

test("待办模块浏览器流程与过期自动清理", async (t) => {
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
  await page.locator('[data-testid="todos-view"]').waitFor();

  await page.locator('button[type="submit"]').click();
  assert.match(await page.locator("[data-form-errors]").textContent(), /待办内容不能为空/);

  const futureTime = localDateTimeFromMinutesFromNow(60);
  await page.locator('input[name="text"]').fill("整理阶段文档");
  await page.locator('input[name="dueAt"]').fill(futureTime);
  await page.locator('button[type="submit"]').click();

  const pending = page.locator('[data-testid="todo-pending"]');
  await pending.locator('[data-testid="todo-item"]').first().waitFor();
  assert.match(
    await pending.locator('[data-testid="todo-item"]').first().textContent(),
    /整理阶段文档/,
  );

  await pending.locator('[data-action="toggle-todo"]').first().click();
  const completed = page.locator('[data-testid="todo-completed"]');
  await completed.locator('[data-testid="todo-item"]').first().waitFor();
  assert.equal(await pending.locator('[data-testid="todo-item"]').count(), 0);

  await completed.locator('[data-action="toggle-todo"]').first().click();
  await pending.locator('[data-testid="todo-item"]').first().waitFor();
  await pending.locator('[data-action="edit-todo"]').first().click();
  assert.equal(
    await page.locator('[data-testid="todo-composer-title"]').textContent(),
    "编辑待办",
  );
  await page.locator('input[name="text"]').fill("整理阶段文档（已修改）");
  const laterTime = localDateTimeFromMinutesFromNow(90);
  await page.locator('input[name="dueAt"]').fill(laterTime);
  await page.locator('button[type="submit"]').click();
  await pending.locator('[data-testid="todo-item"]').first().waitFor();
  assert.match(
    await pending.locator('[data-testid="todo-item"]').first().textContent(),
    /整理阶段文档（已修改）/,
  );

  await page.reload();
  await page.locator('[data-view="todos"]').click();
  await pending.locator('[data-testid="todo-item"]').first().waitFor();
  assert.match(
    await pending.locator('[data-testid="todo-item"]').first().textContent(),
    /整理阶段文档（已修改）/,
  );

  await pending.locator('[data-action="delete-todo"]').first().click();
  assert.equal(await page.locator("#confirm-root").isVisible(), true);
  await page.locator("#confirm-root [data-action='close-confirm']").click();
  assert.equal(await pending.locator('[data-testid="todo-item"]').count(), 1);
  await pending.locator('[data-action="delete-todo"]').first().click();
  await page.locator("#confirm-action").click();
  assert.equal(await pending.locator('[data-testid="todo-item"]').count(), 0);

  const overdue = {
    id: "todo-overdue-seed",
    kind: "todo",
    text: "过期未完成待办",
    dueAt: "2020-01-01T09:00",
    completed: false,
    completedAt: null,
    createdAt: "2020-01-01T08:00:00.000Z",
    updatedAt: "2020-01-01T08:00:00.000Z",
  };
  const completedOverdue = {
    ...overdue,
    id: "todo-completed-overdue-seed",
    text: "已完成的过期待办",
    completed: true,
    completedAt: "2020-01-01T10:00:00.000Z",
  };
  await page.evaluate(
    (payload) => {
      window.localStorage.setItem(payload.key, JSON.stringify([payload.overdue, payload.completedOverdue]));
    },
    {
      key: "local-notes:items:v1",
      overdue,
      completedOverdue,
    },
  );
  await page.reload();
  await page.locator('[data-view="todos"]').click();
  await page.locator('[data-testid="todos-view"]').waitFor();
  assert.equal(
    await page
      .locator('[data-testid="todo-pending"]')
      .getByText("过期未完成待办")
      .count(),
    0,
  );
  assert.equal(
    await page.locator('[data-testid="todo-completed"]').getByText("已完成的过期待办").count(),
    1,
  );
});
