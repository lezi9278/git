import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser, startTestServer } from "./helpers/browser.mjs";

function todayKey() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

test("第二版笔记列表、独立编辑页与分类流程", async (t) => {
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
  await page.locator('[data-view="notes"]').click();
  await page.locator('[data-testid="notes-list-view"]').waitFor();
  assert.equal(await page.locator(".tab-item").count(), 3);
  assert.equal(await page.locator('[data-action="new-note"]').isVisible(), true);

  await page.locator('[data-action="new-note"]').click();
  await page.locator('[data-testid="note-editor-page"]').waitFor();
  assert.equal(await page.locator('[data-testid="note-date-field"]').count(), 0);
  assert.equal(await page.locator("[data-word-count]").textContent(), "0字");

  await page.locator('input[name="title"]').fill("第一次整理");
  await page.locator('[data-testid="note-content-editor"]').fill("把一段零散思考整理成完整记录。");
  assert.notEqual(await page.locator("[data-word-count]").textContent(), "0字");
  await page.locator('[data-action="toggle-editor-category"]').click();
  await page.locator('[data-testid="editor-category-menu"]').waitFor();
  await page.locator('[data-category-option="life"]').click();
  await page.locator('button[type="submit"]').click();

  const noteItem = page.locator('[data-testid="note-item"]').first();
  await noteItem.waitFor();
  assert.match(await noteItem.textContent(), /第一次整理/);
  assert.match(await noteItem.textContent(), new RegExp(todayKey()));

  await noteItem.locator('[data-action="open-note"]').click();
  await page.locator('[data-testid="note-editor-page"]').waitFor();
  assert.equal(await page.locator('input[name="title"]').inputValue(), "第一次整理");
  assert.equal(await page.locator('[data-testid="note-date-field"]').count(), 0);
  await page.locator('input[name="title"]').fill("第一次整理（已修改）");
  await page.locator('[data-testid="note-content-editor"]').fill("修改后的正文。");
  await page.locator('[data-action="toggle-editor-category"]').click();
  await page.locator('[data-testid="editor-category-menu"]').waitFor();
  await page.locator('[data-category-option="thinking"]').click();
  await page.locator('button[type="submit"]').click();
  await page.locator('[data-testid="notes-list-view"]').waitFor();
  assert.match(
    await page.locator('[data-testid="note-item"]').first().textContent(),
    /第一次整理（已修改）/,
  );

  await page.locator('[data-action="category-menu"]').click();
  await page.locator('[data-category-filter="thinking"]').click();
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 1);
  await page.locator('[data-action="category-menu"]').click();
  await page.locator('[data-category-filter="life"]').click();
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 0);
  await page.locator('[data-action="category-menu"]').click();
  await page.locator('[data-category-filter="all"]').click();
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 1);

  await page.reload();
  await page.locator('[data-view="notes"]').click();
  await page.locator('[data-testid="notes-list-view"]').waitFor();
  assert.match(
    await page.locator('[data-testid="note-item"]').first().textContent(),
    /第一次整理（已修改）/,
  );

  await page.locator('[data-testid="note-item"] [data-action="delete-note"]').click();
  assert.equal(await page.locator("#confirm-root").isVisible(), true);
  await page.locator("#confirm-root [data-action='close-confirm']").click();
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 1);
  await page.locator('[data-testid="note-item"] [data-action="delete-note"]').click();
  await page.locator("#confirm-action").click();
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 0);

  await page.locator('[data-action="new-note"]').click();
  await page.locator('button[type="submit"]').click();
  assert.match(
    await page.locator("[data-form-errors]").textContent(),
    /标题不能为空/,
  );

  await page.locator('[data-action="cancel-editor"]').click();
  await page.locator('[data-view="todos"]').click();
  await page.locator('[data-testid="todos-list-view"]').waitFor();
  await page.locator('[data-view="mine"]').click();
  await page.locator('[data-testid="mine-view"]').waitFor();
});
