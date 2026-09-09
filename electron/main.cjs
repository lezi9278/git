const { app, BrowserWindow, Menu, protocol, net } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..");
const APP_ORIGIN = "app://bundle";

// 数据目录与应用显示名解耦：以后再改名也不会丢数据
function pinUserData() {
  const userDataPath = path.join(app.getPath("appData"), "乐乐笔记");
  const legacyPath = path.join(app.getPath("appData"), "本地笔记与待办");
  try {
    if (!fs.existsSync(userDataPath) && fs.existsSync(legacyPath)) {
      fs.cpSync(legacyPath, userDataPath, { recursive: true });
    }
  } catch {
    // 迁移失败不阻塞启动，旧目录数据仍保留
  }
  app.setPath("userData", userDataPath);
}

pinUserData();

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

function serveFromBundle(request) {
  const requestedPath = decodeURIComponent(new URL(request.url).pathname)
    .replace(/^\/+/, "");
  const target = path.normalize(path.join(ROOT, requestedPath));
  if (!target.startsWith(ROOT)) {
    return new Response("forbidden", { status: 403 });
  }
  return net.fetch(pathToFileURL(target).toString());
}

function createWindow() {
  const win = new BrowserWindow({
    width: 480,
    height: 800,
    minWidth: 380,
    minHeight: 600,
    title: "乐乐笔记",
    backgroundColor: "#ececec",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.once("ready-to-show", () => win.show());
  win.loadURL(`${APP_ORIGIN}/index.html`);
  return win;
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  protocol.handle("app", serveFromBundle);
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
