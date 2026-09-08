import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser, startTestServer } from "./helpers/browser.mjs";

function localDate(year, month, day) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

function createSeedData() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const previousMonth = month === 1 ? 12 : month - 1;
  const previousYear = month === 1 ? year - 1 : year;
  const lastDay = new Date(year, month, 0).getDate();
  const currentMonthDate = localDate(year, month, lastDay);
  const previousMonthDate = localDate(previousYear, previousMonth, 18);

  const timestamp = `${currentMonthDate}T00:00:00.000Z`;
  return {
    currentNote: {
      id: "note-current",
      kind: "note",
      title: "本月感悟",
      content: "这条记录应该出现在本月创作中。",
      category: "insight",
      date: currentMonthDate,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    previousNote: {
      id: "note-previous",
      kind: "note",
      title: "上月生活",
      content: "这条记录只出现在全部创作中。",
      category: "life",
      date: previousMonthDate,
      createdAt: `${previousMonthDate}T00:00:00.000Z`,
      updatedAt: `${previousMonthDate}T00:00:00.000Z`,
    },
    currentTodo: {
      id: "todo-current",
      kind: "todo",
      text: "本月待办",
      dueAt: `${currentMonthDate}T23:59`,
      completed: true,
      completedAt: `${currentMonthDate}T23:00:00.000Z`,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

test("我的创作统计、时间线、设置页与内容跳转", async (t) => {
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
  const seed = createSeedData();
  await page.evaluate(
    (payload) => {
      window.localStorage.setItem(
        payload.key,
        JSON.stringify([payload.currentNote, payload.previousNote, payload.currentTodo]),
      );
    },
    {
      key: "local-notes:items:v1",
      ...seed,
    },
  );
  await page.reload();

  await page.locator('[data-view="mine"]').click();
  await page.locator('[data-testid="mine-view"]').waitFor();
  assert.equal(await page.locator('[data-testid="stat-total"] .stat-value').textContent(), "2");
  assert.equal(await page.locator('[data-testid="stat-notes"] .stat-value').textContent(), "1");
  assert.equal(await page.locator('[data-testid="stat-todos"] .stat-value').textContent(), "1");
  assert.equal(await page.locator('[data-testid="mine-view"]').getByText("本月感悟").count(), 1);
  assert.equal(await page.locator('[data-testid="mine-view"]').getByText("上月生活").count(), 0);

  await page.locator('[data-action="set-range"][data-range="all"]').click();
  assert.equal(await page.locator('[data-testid="stat-total"] .stat-value').textContent(), "3");
  assert.equal(await page.locator('[data-testid="mine-view"]').getByText("上月生活").count(), 1);

  await page
    .locator('.timeline-item:has-text("本月感悟")')
    .click();
  await page.locator('[data-testid="notes-view"]').waitFor();
  assert.equal(await page.locator('input[name="title"]').inputValue(), "本月感悟");

  await page.locator('[data-view="mine"]').click();
  await page.locator('[data-action="mine-section"][data-section="settings"]').click();
  await page.locator('[data-testid="settings-view"]').waitFor();
  assert.match(
    await page.locator('[data-testid="settings-view"]').textContent(),
    /后续版本/,
  );

  await page.locator('[data-action="mine-section"][data-section="creations"]').click();
  await page.locator('[data-testid="mine-view"]').waitFor();
  assert.equal(await page.locator('[data-testid="mine-view"]').getByText("本月待办").count(), 1);
});
