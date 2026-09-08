import { createRequire } from "node:module";
import { existsSync } from "node:fs";
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
  const candidates = [
    process.env.BROWSER_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  ].filter(Boolean);
  const executablePath = candidates.find((candidate) => existsSync(candidate));
  if (!executablePath) {
    throw new Error("未找到可用的 Chrome 或 Edge，请通过 BROWSER_PATH 指定浏览器路径");
  }
  return chromium.launch({
    headless: true,
    executablePath,
  });
}
