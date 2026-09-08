import { createRequire } from "node:module";
import { createAppServer } from "../../server.mjs";

const require = createRequire(import.meta.url);
const modulePath = process.env.PLAYWRIGHT_MODULE || "playwright";
const playwright = require(modulePath);

export const chromium = playwright.chromium;

export async function startTestServer() {
  const server = createAppServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  return {
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

export async function launchBrowser() {
  const executablePath =
    process.env.BROWSER_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
  return chromium.launch({
    headless: true,
    executablePath,
  });
}
