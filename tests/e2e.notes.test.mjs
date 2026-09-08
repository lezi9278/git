import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser, startTestServer } from "./helpers/browser.mjs";

async function resetData(page) {
  await page.goto(`${globalThis.__testBaseUrl}/`);
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
}

test("应用外壳与笔记模块浏览器流程", async (t) => {
  const { server, url } = await startTestServer();
  const browser = await launchBrowser();
  globalThis.__testBaseUrl = url;
  t.after(async () => {
    delete globalThis.__testBaseUrl;
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  });

  const page = await browser.newPage();
  await resetData(page);

  assert.equal(await page.locator(".nav-item").count(), 3);
  await page.locator('[data-view="notes"]').click();
  await page.locator('[data-testid="notes-view"]').waitFor();

  await page.locator('input[name="title"]').fill("第一次整理");
  await page.locator('textarea[name="content"]').fill("把一段零散思考整理成完整记录。");
  await page.locator('[data-category-option="life"]').click();
  await page.locator('input[name="date"]').fill("2026-09-08");
  await page.locator('button[type="submit"]').click();

  const noteItem = page.locator('[data-testid="note-item"]').first();
  await noteItem.waitFor();
  assert.match(await page.locator('[data-testid="note-item"]').first().textContent(), /第一次整理/);

  await noteItem.locator('[data-action="open-note"]').click();
  assert.equal(await page.locator('input[name="title"]').inputValue(), "第一次整理");
  await page.locator('input[name="title"]').fill("第一次整理（已修改）");
  await page.locator('textarea[name="content"]').fill("修改后的正文。");
  await page.locator('[data-category-option="thinking"]').click();
  await page.locator('input[name="date"]').fill("2026-09-09");
  await page.locator('button[type="submit"]').click();
  await page.locator('[data-testid="note-item"]').first().waitFor();
  assert.match(
    await page.locator('[data-testid="note-item"]').first().textContent(),
    /第一次整理（已修改）/,
  );

  await page.locator('[data-category-filter="thinking"]').click();
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 1);
  await page.locator('[data-category-filter="life"]').click();
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 0);
  await page.locator('[data-category-filter="all"]').click();
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 1);

  await page.reload();
  await page.locator('[data-testid="notes-view"]').waitFor();
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

  await page.locator('[data-view="todos"]').click();
  await page.locator('[data-testid="todos-view"]').waitFor();
  await page.locator('[data-view="mine"]').click();
  await page.locator('[data-testid="mine-view"]').waitFor();
});
