/**
 * Static host for the studio. Nothing here renders anything — it only serves
 * files. Kept dependency-free so it can be swapped for any CDN unchanged.
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = Number(process.env.PORT || 8080);
const ROOT = new URL("../", import.meta.url).pathname;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".woff2": "font/woff2",
  ".mp4": "video/mp4",
  ".wav": "audio/wav",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const resolvePath = (url) => {
  const clean = normalize(decodeURIComponent(url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  if (clean === "/" || clean === "") return join(ROOT, "studio/dist/index.html");
  if (clean.startsWith("/public/")) return join(ROOT, clean);
  // app assets live in the built app; anything else may be a repo asset
  return [join(ROOT, "studio/dist", clean), join(ROOT, clean)];
};

createServer(async (req, res) => {
  try {
    const candidates = [].concat(resolvePath(req.url || "/"));
    let p = candidates[0];
    let s = null;
    for (const c of candidates) {
      try {
        s = await stat(c);
        p = c;
        break;
      } catch {
        /* try next */
      }
    }
    if (!s) {
      if (req.url && extname(req.url.split("?")[0])) {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("not found");
        return;
      }
      p = join(ROOT, "studio/dist/index.html");
      s = await stat(p);
    }
    if (s.isDirectory()) {
      p = join(p, "index.html");
      s = await stat(p);
    }
    const body = await readFile(p);
    res.writeHead(200, {
      "Content-Type": TYPES[extname(p)] || "application/octet-stream",
      "Content-Length": body.length,
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("not found");
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`nexus studio on http://0.0.0.0:${PORT}`);
});
