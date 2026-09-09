import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser, startTestServer } from "./helpers/browser.mjs";

test("第三版自定义分类：添加、筛选、编辑菜单、重命名与删除", async (t) => {
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

  // 设置中添加自定义分类
  await page.locator('[data-view="mine"]').click();
  await page.locator('[data-action="mine-section"][data-section="settings"]').click();
  await page.locator('[data-testid="category-settings"]').waitFor();
  await page.locator('[data-form="category-add"] input[name="label"]').fill("工作");
  await page.locator('[data-form="category-add"] button[type="submit"]').click();
  await page.locator("#toast").waitFor();
  assert.match(await page.locator("#toast").textContent(), /已添加分类“工作”/);
  assert.equal(
    await page.locator('[data-testid="category-list"]', { hasText: "工作" }).count(),
    1,
  );

  // 重复名称与空名称的校验
  await page.locator('[data-form="category-add"] input[name="label"]').fill("感悟");
  await page.locator('[data-form="category-add"] button[type="submit"]').click();
  assert.match(await page.locator("[data-category-errors]").textContent(), /分类名称已存在/);
  await page.locator('[data-form="category-add"] input[name="label"]').fill(" ");
  await page.locator('[data-form="category-add"] button[type="submit"]').click();
  assert.match(await page.locator("[data-category-errors]").textContent(), /分类名称不能为空/);

  // 顶栏筛选下拉出现新分类
  await page.locator('[data-view="notes"]').click();
  await page.locator('[data-testid="notes-list-view"]').waitFor();
  await page.locator('[data-action="category-menu"]').click();
  const workFilter = page.locator('[data-category-filter]', { hasText: "工作" });
  await workFilter.waitFor();
  await workFilter.click();
  assert.equal(await page.locator('[data-testid="note-item"]').count(), 0);

  // 编辑页分类菜单出现新分类，并用它新建笔记
  await page.locator('[data-action="new-note"]').click();
  await page.locator('[data-testid="note-editor-page"]').waitFor();
  await page.locator('input[name="title"]').fill("工作笔记一");
  await page.locator('textarea[name="content"]').fill("记录工作内容。");
  await page.locator('[data-action="toggle-editor-category"]').click();
  await page.locator('[data-testid="editor-category-menu"]').waitFor();
  await page.locator("[data-category-option]", { hasText: "工作" }).click();
  assert.equal(await page.locator(".category-name").textContent(), "工作");
  await page.locator('button[type="submit"]').click();
  const noteItem = page.locator('[data-testid="note-item"]').first();
  await noteItem.waitFor();
  assert.match(await noteItem.textContent(), /工作笔记一/);
  assert.match(await noteItem.textContent(), /工作/);

  // 重命名分类后，旧笔记的分类名称同步更新
  await page.locator('[data-view="mine"]').click();
  await page.locator('[data-action="mine-section"][data-section="settings"]').click();
  await page.locator('.category-row:has-text("工作") [data-action="rename-category"]').click();
  const renameInput = page.locator('[data-form="category-rename"] input[name="label"]');
  await renameInput.waitFor();
  assert.equal(await renameInput.inputValue(), "工作");
  await renameInput.fill("任务");
  await page.locator('[data-form="category-rename"] button[type="submit"]').click();
  await page.locator("#toast").waitFor();
  assert.match(await page.locator("#toast").textContent(), /分类已重命名/);
  assert.equal(
    await page.locator('[data-testid="category-list"]', { hasText: "任务" }).count(),
    1,
  );
  assert.equal(
    await page.locator('[data-testid="category-list"] .category-row', {
      hasText: "工作",
    }).count(),
    0,
  );

  await page.locator('[data-view="notes"]').click();
  await page.locator('[data-testid="note-item"]').first().waitFor();
  assert.match(await page.locator('[data-testid="note-item"]').first().textContent(), /任务/);

  // 删除分类需要确认，且提示受影响的笔记数量
  await page.locator('[data-view="mine"]').click();
  await page.locator('[data-action="mine-section"][data-section="settings"]').click();
  await page.locator('.category-row:has-text("任务") [data-action="delete-category"]').click();
  await page.locator("#confirm-root").waitFor();
  const confirmDetail = await page.locator("#confirm-detail").textContent();
  assert.match(confirmDetail, /1 篇笔记/);
  assert.match(confirmDetail, /未分类/);
  await page.locator("#confirm-action").click();
  await page.locator("#toast").waitFor();
  assert.match(await page.locator("#toast").textContent(), /分类已删除/);
  assert.equal(
    await page
      .locator('[data-testid="category-list"] .category-row', { hasText: "任务" })
      .count(),
    0,
  );

  // 被删除分类下的笔记显示为未分类，刷新后保持
  await page.locator('[data-view="notes"]').click();
  await page.locator('[data-testid="note-item"]').first().waitFor();
  assert.match(await page.locator('[data-testid="note-item"]').first().textContent(), /未分类/);
  await page.reload();
  await page.locator('[data-testid="note-item"]').first().waitFor();
  assert.match(await page.locator('[data-testid="note-item"]').first().textContent(), /未分类/);
});
