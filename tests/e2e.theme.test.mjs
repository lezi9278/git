import test from "node:test";
import assert from "node:assert/strict";
import { launchBrowser, startTestServer } from "./helpers/browser.mjs";

test("第三版护眼模式可在设置中开关并持久化", async (t) => {
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
  assert.equal(await page.evaluate(() => document.body.dataset.theme ?? ""), "");

  await page.locator('[data-view="mine"]').click();
  await page.locator('[data-action="mine-section"][data-section="settings"]').click();
  await page.locator('[data-testid="appearance-settings"]').waitFor();

  await page.locator('[data-action="theme-mode"][data-mode="eye"]').click();
  assert.equal(await page.evaluate(() => document.body.dataset.theme), "eye");
  await page.locator("#toast").waitFor();
  assert.match(await page.locator("#toast").textContent(), /护眼模式/);

  await page.reload();
  assert.equal(await page.evaluate(() => document.body.dataset.theme), "eye");
  await page.locator('[data-action="mine-section"][data-section="settings"]').click();
  await page.locator('[data-testid="appearance-settings"]').waitFor();
  assert.match(
    await page
      .locator('[data-action="theme-mode"][data-mode="eye"]')
      .getAttribute("class"),
    /is-active/,
  );

  await page.locator('[data-action="theme-mode"][data-mode="light"]').click();
  assert.equal(await page.evaluate(() => document.body.dataset.theme ?? ""), "");
  await page.reload();
  assert.equal(await page.evaluate(() => document.body.dataset.theme ?? ""), "");
});
