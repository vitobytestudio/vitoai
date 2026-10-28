import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PORT = Number(process.env.PORT || 8080);

const FILES = {
  "/lite": { file: path.join(HERE, "vitoai_motion_1080p.mp4"), name: "vitoai-motion-1080p.mp4", label: "1080×1920 · 60fps · 9.3 MB" },
  "/master": { file: path.join(HERE, "master_video.mp4"), name: "vitoai-motion-master.mp4", label: "1080×1920 · 60fps · master 32 MB" },
};

const mb = (bytes) => (bytes / 1048576).toFixed(1);
const exists = (p) => { try { return fs.statSync(p).size; } catch { return 0; } };

const page = () => {
  const lite = exists(FILES["/lite"].file);
  const master = exists(FILES["/master"].file);
  return `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VitoAI — تحميل الفيديو</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;padding:26px 18px 44px;
       background:radial-gradient(circle at 50% -10%,#1a1040,#04050c 62%);
       color:#f8fafc;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;
       display:flex;flex-direction:column;align-items:center;gap:18px}
  h1{margin:0;font-size:15px;letter-spacing:.26em;color:#67e8f9;font-weight:800}
  .sub{color:#8b93a7;font-size:11px;letter-spacing:.18em}
  video{width:min(86vw,330px);border-radius:20px;background:#000;
        box-shadow:0 26px 80px -26px #7c5cff,0 0 0 1px rgba(255,255,255,.1)}
  .btns{display:flex;flex-direction:column;gap:10px;width:min(86vw,330px)}
  a{display:flex;align-items:center;justify-content:center;gap:8px;padding:15px 20px;border-radius:999px;
    text-decoration:none;font-weight:800;font-size:15px}
  .primary{background:linear-gradient(135deg,#7c5cff,#22d3ee);color:#07080f;
           box-shadow:0 16px 44px -14px rgba(124,92,255,.9)}
  .ghost{background:rgba(255,255,255,.06);color:#e6e9f2;border:1px solid rgba(255,255,255,.14);font-weight:600;font-size:13px}
  .meta{color:#6b7280;font-size:11px;letter-spacing:.1em;text-align:center;line-height:1.9}
  .dot{display:inline-block;width:7px;height:7px;border-radius:50%;margin-left:5px}
</style>
<h1>VITOAI MOTION STUDIO</h1>
<div class="sub">1080 × 1920 · 60 FPS · 22.2s</div>

${lite ? `<video src="/lite" controls playsinline preload="metadata"></video>` : `<div class="meta">الفيديو غير جاهز</div>`}

<div class="btns">
  ${lite ? `<a class="primary" href="/lite" download="${FILES["/lite"].name}">⬇ تحميل الفيديو (9.3 MB)</a>` : ""}
  ${master ? `<a class="ghost" href="/master" download="${FILES["/master"].name}">نسخة الماستر عالية الجودة (32 MB)</a>` : ""}
</div>

<div class="meta">
  H.264 · AAC · −14 LUFS · جاهز للهاتف<br>
  ${lite ? `<span class="dot" style="background:#22c55e"></span>` : `<span class="dot" style="background:#ef4444"></span>`} 1080p &nbsp;·&nbsp;
  ${master ? `<span class="dot" style="background:#22c55e"></span>` : `<span class="dot" style="background:#ef4444"></span>`} Master
</div>
</html>`;
};

const serveFile = (req, res, entry, forceDownload) => {
  const size = exists(entry.file);
  if (!size) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    return res.end("file not built");
  }
  const range = req.headers.range;
  if (range) {
    const [s, e] = String(range).replace(/bytes=/, "").split("-");
    const start = parseInt(s, 10) || 0;
    const end = e ? Math.min(parseInt(e, 10), size - 1) : size - 1;
    res.writeHead(206, {
      "content-range": `bytes ${start}-${end}/${size}`,
      "accept-ranges": "bytes",
      "content-length": end - start + 1,
      "content-type": "video/mp4",
      "cache-control": "public, max-age=3600",
    });
    if (req.method === "HEAD") return res.end();
    return fs.createReadStream(entry.file, { start, end }).pipe(res);
  }
  const headers = {
    "content-length": size,
    "content-type": "video/mp4",
    "accept-ranges": "bytes",
    "cache-control": "public, max-age=3600",
  };
  if (forceDownload) headers["content-disposition"] = `attachment; filename="${entry.name}"`;
  res.writeHead(200, headers);
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(entry.file).pipe(res);
};

http
  .createServer((req, res) => {
    const url = (req.url || "/").split("?")[0].replace(/\/+$/, "") || "/";

    if (url === "/ping") {
      res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
      return res.end(`ok · lite=${mb(exists(FILES["/lite"].file))}MB · master=${mb(exists(FILES["/master"].file))}MB`);
    }
    if (url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: true, lite: exists(FILES["/lite"].file), master: exists(FILES["/master"].file) }));
    }
    if (url === "/lite") return serveFile(req, res, FILES["/lite"], false);
    if (url === "/master") return serveFile(req, res, FILES["/master"], false);
    if (url === "/master_video.mp4") return serveFile(req, res, FILES["/master"], true);

    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    if (req.method === "HEAD") return res.end();
    res.end(page());
  })
  .listen(PORT, "0.0.0.0", () => {
    console.log(`VitoAI delivery → http://0.0.0.0:${PORT}/  lite=${mb(exists(FILES["/lite"].file))}MB master=${mb(exists(FILES["/master"].file))}MB`);
  });
