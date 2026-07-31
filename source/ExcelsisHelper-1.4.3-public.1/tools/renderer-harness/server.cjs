"use strict";

const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const requestedPort = Number(process.argv[2] || 0);
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
]);

function safePath(pathname) {
  const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
  const resolved = path.resolve(root, relative || "automation.html");
  return resolved === root || resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (url.pathname === "/frame.html") {
      const width = Math.max(640, Math.min(1600, Number(url.searchParams.get("width")) || 920));
      const height = Math.max(480, Math.min(1200, Number(url.searchParams.get("height")) || 765));
      const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Excelsis Helper renderer frame</title>
  <style>html,body{margin:0;min-height:100%;background:#080b0f}iframe{display:block;width:${width}px;height:${height}px;border:0}</style>
</head>
<body><iframe id="rendererFrame" src="/automation.html" title="Excelsis Helper renderer"></iframe></body>
</html>`;
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": mimeTypes.get(".html"),
      });
      response.end(html);
      return;
    }
    const requested = safePath(url.pathname);
    if (!requested) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    let filePath = requested;
    if (url.pathname === "/" || url.pathname === "/automation.html") {
      filePath = path.join(root, "automation.html");
      const html = await fs.readFile(filePath, "utf8");
      const marker = '<script type="module" src="./automation.js"></script>';
      const injected = [
        '<script src="./tools/renderer-harness/mock-api.js"></script>',
        marker,
      ].join("\n  ");
      if (!html.includes(marker)) throw new Error("Renderer module marker was not found.");
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": mimeTypes.get(".html"),
      });
      response.end(html.replace(marker, injected));
      return;
    }
    const body = await fs.readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream",
    });
    response.end(body);
  } catch (error) {
    const status = error?.code === "ENOENT" ? 404 : 500;
    const publicMessage = status === 404 ? "Not Found" : "Internal Server Error";
    console.error(`Renderer harness request failed (${status}).`, error);
    response.writeHead(status, {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end(publicMessage);
  }
});

server.listen(requestedPort, "127.0.0.1", () => {
  const address = server.address();
  console.log(JSON.stringify({ ok: true, host: "127.0.0.1", port: address.port, root }));
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
