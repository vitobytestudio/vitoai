import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const FILE = path.join(HERE, "master_video.mp4");
const PORT = Number(process.env.PORT || 8080);

const page = (mb) => `<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VitoAI — Motion Studio</title>
<style>
  :root{color-scheme:dark}
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(circle at 50% 0%,#120b2e,#04050c 60%);color:#f8fafc;
       font-family:"Segoe UI",system-ui,-apple-system,sans-serif;display:grid;place-items:center;min-height:100vh;padding:28px}
  .card{text-align:center;max-width:460px}
  h1{margin:0 0 4px;font-size:20px;letter-spacing:.22em;color:#67e8f9;font-weight:800}
  .sub{color:#8b93a7;font-size:12px;letter-spacing:.16em;margin-bottom:22px}
  video{width:min(88vw,360px);border-radius:22px;display:block;margin:0 auto;
        box-shadow:0 30px 90px -24px #7c5cff,0 0 0 1px rgba(255,255,255,.09)}
  a.btn{display:inline-flex;align-items:center;gap:10px;margin-top:26px;padding:16px 34px;border-radius:999px;
        background:linear-gradient(135deg,#7c5cff,#22d3ee);color:#07080f;font-weight:800;text-decoration:none;
        font-size:17px;box-shadow:0 18px 50px -14px rgba(124,92,255,.9)}
  .meta{margin-top:16px;color:#8b93a7;font-size:12px;letter-spacing:.1em}
</style>
<div class="card">
  <h1>VITOAI MOTION STUDIO</h1>
  <div class="sub">1080 × 1920 · 60 FPS · 22.2s</div>
  <video src="/master_video.mp4" controls playsinline preload="metadata"></video>
  <a class="btn" href="/master_video.mp4" download="vitoai-motion.mp4">⬇ تحميل MP4</a>
  <div class="meta">${mb} MB · H.264 · −14 LUFS</div>
</div></html>`;

http
  .createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: true, file: fs.existsSync(FILE) }));
    }
    let stat;
    try {
      stat = fs.statSync(FILE);
    } catch {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      return res.end("master_video.mp4 not built yet");
    }
    const mb = (stat.size / 1048576).toFixed(1);
    if (req.url === "/" || req.url.startsWith("/?")) {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(page(mb));
    }
    const range = req.headers.range;
    if (range) {
      const [s, e] = String(range).replace(/bytes=/, "").split("-");
      const start = parseInt(s, 10);
      const end = e ? parseInt(e, 10) : stat.size - 1;
      res.writeHead(206, {
        "content-range": `bytes ${start}-${end}/${stat.size}`,
        "accept-ranges": "bytes",
        "content-length": end - start + 1,
        "content-type": "video/mp4",
      });
      return fs.createReadStream(FILE, { start, end }).pipe(res);
    }
    res.writeHead(200, {
      "content-length": stat.size,
      "content-type": "video/mp4",
      "accept-ranges": "bytes",
      "content-disposition": 'attachment; filename="vitoai-motion.mp4"',
    });
    fs.createReadStream(FILE).pipe(res);
  })
  .listen(PORT, "0.0.0.0", () => {
    console.log(`VitoAI delivery server → http://0.0.0.0:${PORT}/  (${(fs.statSync(FILE).size / 1048576).toFixed(1)} MB)`);
  });
