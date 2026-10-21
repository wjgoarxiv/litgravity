// Loopback file server for the interface probe. The driver blocks on each synchronous browser
// command, so the page must be served from a separate process. It binds 127.0.0.1 on a free port,
// serves only files under the given root, and prints `LISTENING <port>` once ready.
import { createReadStream, realpathSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const root = realpathSync(resolve(process.argv[2] ?? "."));
const server = createServer((request, response) => {
  let path;
  try {
    path = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  let file;
  try {
    file = realpathSync(resolve(join(root, path)));
    if (statSync(file).isDirectory()) file = realpathSync(join(file, "index.html"));
  } catch {
    response.writeHead(404).end();
    return;
  }
  // Checked after symlinks resolve, so a link inside the root cannot serve a file outside it.
  if (file !== root && !file.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  response.writeHead(200, { "content-type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", "cache-control": "no-store" });
  createReadStream(file).pipe(response);
});
server.listen(0, "127.0.0.1", () => process.stdout.write(`LISTENING ${server.address().port}\n`));
process.on("SIGTERM", () => server.close(() => process.exit(0)));
