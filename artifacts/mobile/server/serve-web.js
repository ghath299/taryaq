/**
 * Static web server for Expo web export (dist/ folder).
 * Serves all routes with SPA fallback to index.html.
 */
const http = require("http");
const fs = require("fs");
const path = require("path");

const DIST = path.resolve(__dirname, "..", "dist");
const PORT = parseInt(process.env.PORT || "3000", 10);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "application/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif":  "image/gif",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".woff": "font/woff",
  ".woff2":"font/woff2",
  ".ttf":  "font/ttf",
  ".map":  "application/json",
};

const server = http.createServer((req, res) => {
  let pathname = new URL(req.url || "/", `http://localhost`).pathname;

  // Strip base path if any
  const base = (process.env.BASE_PATH || "").replace(/\/+$/, "");
  if (base && pathname.startsWith(base)) pathname = pathname.slice(base.length) || "/";

  let filePath = path.join(DIST, pathname);

  // Security: prevent path traversal
  if (!filePath.startsWith(DIST)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }

  // Try exact file, then index.html (SPA fallback)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, "index.html");
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404); res.end("Not found"); return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);

  res.writeHead(200, {
    "Content-Type": mime,
    "Cache-Control": ext === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
  });
  res.end(content);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`ترياق web app running on port ${PORT}`);
});
