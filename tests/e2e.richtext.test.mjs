import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser, startTestServer } from "./helpers/browser.mjs";

function todayKey() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

test("第三版编辑器格式工具、默认样式设置与富文本持久化", async (t) => {
  const { server, url } = await startTestServer();
  const browser = await launchBrowser();
  t.after(async () => {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  });

  const page = await browser.newPage();
  page.on("pageerror", (error) => {
    throw new Error(`页面脚本错误: ${error.message}`);
  });
  await page.goto(`${url}/`);
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();

  // 设置中配置默认字体、字号与颜色
  await page.locator('[data-view="mine"]').click();
  await page.locator('[data-action="mine-section"][data-section="settings"]').click();
  await page.locator('[data-testid="appearance-settings"]').waitFor();
  await page.locator('select[name="editorFontFamily"]').selectOption("kaiti");
  await page.locator('[data-action="editor-font-size"][data-value="20"]').click();
  await page.locator('[data-action="editor-color"][data-value="red"]').click();

  // 新建笔记，编辑器应用默认样式并展示格式工具栏
  await page.locator('[data-view="notes"]').click();
  await page.locator('[data-action="new-note"]').click();
  await page.locator('[data-testid="note-editor-page"]').waitFor();
  assert.equal(await page.locator('[data-testid="editor-format-bar"] .format-button').count(), 9);
  const editor = page.locator('[data-testid="note-content-editor"]');
  const defaults = await page.evaluate(() => {
    const element = document.querySelector('[data-testid="note-content-editor"]');
    const style = window.getComputedStyle(element);
    return { fontSize: style.fontSize, color: style.color, fontFamily: style.fontFamily };
  });
  assert.equal(defaults.fontSize, "20px");
  assert.equal(defaults.color, "rgb(211, 49, 34)");
  assert.match(defaults.fontFamily, /KaiTi/i);

  await page.locator('input[name="title"]').fill("富文本笔记");
  await editor.fill("这是一段需要强调的正文内容。");
  assert.notEqual(await page.locator("[data-word-count]").textContent(), "0字");
  await page.locator('[data-action="toggle-editor-category"]').click();
  await page.locator('[data-category-option="life"]').click();

  // 选中正文加粗
  await page.evaluate(() => {
    const element = document.querySelector('[data-testid="note-content-editor"]');
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.locator('[data-format-cmd="bold"]').click();
  assert.match(await editor.innerHTML(), /font-weight/);

  // 无选中时应用字号会提示
  await page.evaluate(() => window.getSelection().removeAllRanges());
  await page.locator('[data-action="format-menu"][data-menu="size"]').click();
  await page.locator('[data-format-apply="size"][data-value="24"]').click();
  await page.locator("#toast").waitFor();
  assert.match(await page.locator("#toast").textContent(), /请先选中/);

  // 光标置于正文，点击居中
  await page.evaluate(() => {
    const element = document.querySelector('[data-testid="note-content-editor"]');
    element.focus();
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });
  await page.locator('[data-format-cmd="justifyCenter"]').click();
  await page.locator('button[type="submit"]').click();
  await page.locator('[data-testid="notes-list-view"]').waitFor();

  // 富文本与对齐被持久化
  const stored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("local-notes:items:v1")),
  );
  assert.equal(stored[0].richText, true);
  assert.match(stored[0].content, /font-weight/);
  assert.match(stored[0].content, /text-align:\s*center/);

  // 重新打开编辑器，格式仍在
  await page.locator('[data-testid="note-item"] [data-action="open-note"]').click();
  await page.locator('[data-testid="note-editor-page"]').waitFor();
  assert.match(await editor.innerHTML(), /font-weight/);
  const boldWrapper = await page.evaluate(() => {
    const element = document.querySelector(
      '[data-testid="note-content-editor"] [style*="font-weight"]',
    );
    return element ? element.style.fontWeight : "";
  });
  assert.equal(boldWrapper, "bold");
  await page.locator('[data-action="cancel-editor"]').click();

  // 旧版纯文本笔记在编辑器中保留换行，保存后升级为富文本
  await page.evaluate(
    (payload) => {
      window.localStorage.setItem(
        payload.key,
        JSON.stringify([
          {
            id: "note-legacy",
            kind: "note",
            title: "旧版纯文本",
            content: "第一行\n第二行",
            category: "life",
            date: payload.today,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ]),
      );
    },
    { key: "local-notes:items:v1", today: todayKey() },
  );
  await page.reload();
  await page.locator('[data-testid="note-item"] [data-action="open-note"]').click();
  await page.locator('[data-testid="note-editor-page"]').waitFor();
  assert.match(await editor.innerHTML(), /第一行<br>第二行/);
  await page.locator('button[type="submit"]').click();
  await page.locator('[data-testid="notes-list-view"]').waitFor();
  const legacyStored = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("local-notes:items:v1")),
  );
  assert.equal(legacyStored[0].richText, true);
  assert.match(legacyStored[0].content, /第一行<br>第二行/);
  assert.match(await page.locator('[data-testid="note-item"]').first().textContent(), /第一行 第二行/);
});
