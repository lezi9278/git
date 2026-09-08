import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

export function createAppServer() {
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      let pathname = decodeURIComponent(url.pathname);
      if (pathname === "/") {
        pathname = "/index.html";
      }
      const relativePath = pathname.replace(/^[/\\]+/, "");
      const filePath = path.resolve(root, relativePath);
      if (!filePath.startsWith(root) && filePath !== root) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      const extension = path.extname(filePath).toLowerCase();
      const body = await readFile(filePath);
      response.writeHead(200, {
        "Content-Type": contentTypes[extension] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      });
      response.end(body);
    } catch (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500);
      response.end(error.code === "ENOENT" ? "Not found" : "Server error");
    }
  });
}

export function startServer(port = 0, host = "127.0.0.1") {
  const server = createAppServer();
  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const address = server.address();
      resolve({
        server,
        port: address.port,
        url: `http://${host}:${address.port}`,
      });
    });
  });
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const requestedPort = Number.parseInt(process.argv[2] ?? "4173", 10);
  const port = Number.isNaN(requestedPort) ? 4173 : requestedPort;
  const { url } = await startServer(port);
  console.log(`Notes app running at ${url}`);
}
