/**
 * DROP — a one-page inbox for the studio.
 *
 * The sandbox cannot be reached from the phone directly, but the preview proxy
 * can. So this is a single-file HTTP server with no dependencies:
 *
 *   GET  /                 the page (Arabic, RTL, works on a phone)
 *   PUT  /up?name=...      raw bytes of a file, streamed straight to disk
 *   GET  /api              what is sitting in inbox/ and deliverables/
 *   GET  /f/in/<name>      the uploaded file back (Range-aware, so it plays)
 *   GET  /f/out/<name>     a finished film, as a download
 *
 * Nothing else is exposed: no shell, no directory listing outside two folders,
 * no way to write anywhere but inbox/.
 */
import { createReadStream, createWriteStream, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import http from "node:http";

const ROOT = resolve(".");
const INBOX = join(ROOT, "inbox");
const OUT = join(ROOT, "outbox");
const PORT = Number(process.env.DROP_PORT || 4173);
const LIMIT = 300 * 1024 * 1024;

for (const d of [INBOX, OUT]) if (!existsSync(d)) mkdirSync(d, { recursive: true });

const MIME = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".m4v": "video/x-m4v",
  ".mkv": "video/x-matroska",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".m4a": "audio/mp4",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".heic": "image/heic",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
};

const safe = (raw) => {
  const base = String(raw || "upload").split(/[\\/]/).pop() || "upload";
  const clean = base.replace(/[^\w.\-\u0600-\u06FF]+/g, "_").slice(-120);
  return clean.replace(/^\.+/, "_") || "upload";
};

const uniq = (dir, name) => {
  let out = name;
  const stem = name.replace(/\.[^.]+$/, "");
  const ext = extname(name);
  let i = 1;
  while (existsSync(join(dir, out))) out = `${stem}-${i++}${ext}`;
  return out;
};

const list = (dir) => {
  try {
    return readdirSync(dir)
      .filter((n) => !n.startsWith("."))
      .map((n) => {
        const s = statSync(join(dir, n));
        return { name: n, size: s.size, at: s.mtimeMs };
      })
      .sort((a, b) => b.at - a.at);
  } catch {
    return [];
  }
};

const json = (res, code, body) => {
  const b = Buffer.from(JSON.stringify(body));
  res.writeHead(code, { "content-type": "application/json; charset=utf-8", "content-length": b.length, "cache-control": "no-store" });
  res.end(b);
};

const serveFile = (req, res, path, download) => {
  if (!existsSync(path)) return json(res, 404, { error: "not found" });
  const size = statSync(path).size;
  const type = MIME[extname(path).toLowerCase()] || "application/octet-stream";
  const headers = {
    "content-type": type,
    "accept-ranges": "bytes",
    "cache-control": "no-store",
  };
  if (download) headers["content-disposition"] = `attachment; filename="${encodeURIComponent(path.split("/").pop())}"`;

  const range = req.headers.range;
  if (range && /^bytes=/.test(range)) {
    const [startRaw, endRaw] = range.replace("bytes=", "").split("-");
    const start = Math.max(0, Number(startRaw) || 0);
    const end = endRaw ? Math.min(size - 1, Number(endRaw)) : size - 1;
    if (start > end) {
      res.writeHead(416, { "content-range": `bytes */${size}` });
      return res.end();
    }
    res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": end - start + 1 });
    return createReadStream(path, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, "content-length": size });
  createReadStream(path).pipe(res);
};

const PAGE = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>VITO BYTE · INBOX</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet">
<style>
  :root { --ink:#04060B; --paper:#F4F6FA; --mint:#4FE3B0; --blue:#7EA2FF; }
  * { box-sizing:border-box; -webkit-tap-highlight-color:transparent; }
  body {
    margin:0; min-height:100dvh; background:
      radial-gradient(70% 46% at 24% 18%, rgba(79,227,176,0.16), transparent 62%),
      radial-gradient(60% 40% at 80% 62%, rgba(126,162,255,0.18), transparent 64%),
      linear-gradient(178deg, #0A1020, #04060B 46%, #02040A);
    color:var(--paper); font-family:"Cairo", system-ui, sans-serif;
    padding:calc(env(safe-area-inset-top) + 26px) 20px calc(env(safe-area-inset-bottom) + 40px);
  }
  .wrap { max-width:560px; margin:0 auto; }
  .brand { display:flex; align-items:center; gap:10px; font-family:"Space Grotesk",sans-serif; letter-spacing:.34em; font-size:13px; color:rgba(244,246,250,.72); }
  .dot { width:8px; height:8px; border-radius:9px; background:var(--mint); box-shadow:0 0 14px var(--mint); }
  h1 { font-size:32px; line-height:1.24; margin:22px 0 6px; font-weight:800; letter-spacing:-.01em; }
  h1 span { color:var(--mint); }
  p.sub { margin:0 0 26px; color:rgba(244,246,250,.58); font-size:15px; line-height:1.7; }
  .drop {
    border:1.5px dashed rgba(244,246,250,.26); border-radius:22px; padding:34px 20px;
    text-align:center; background:rgba(244,246,250,.03); transition:.18s;
  }
  .drop.hot { border-color:var(--mint); background:rgba(79,227,176,.09); }
  .drop b { display:block; font-size:19px; margin-bottom:8px; }
  .drop small { color:rgba(244,246,250,.5); font-size:13px; display:block; line-height:1.7; }
  label.btn, button.btn {
    display:inline-block; margin-top:18px; padding:14px 30px; border-radius:999px; border:0;
    background:var(--mint); color:#04060B; font-family:inherit; font-weight:800; font-size:16px;
    text-decoration:none; cursor:pointer;
  }
  input[type=file] { display:none; }
  .bar { height:6px; border-radius:6px; background:rgba(244,246,250,.12); overflow:hidden; margin-top:20px; display:none; }
  .bar.on { display:block; }
  .bar i { display:block; height:100%; width:0%; background:linear-gradient(90deg,var(--mint),var(--blue)); transition:width .18s; }
  .status { margin-top:12px; font-size:13.5px; color:rgba(244,246,250,.66); min-height:22px; font-family:"Space Grotesk",sans-serif; letter-spacing:.04em; }
  .status.ok { color:var(--mint); }
  h2 { font-size:13px; letter-spacing:.28em; font-weight:700; color:rgba(244,246,250,.44); margin:34px 0 12px; font-family:"Space Grotesk",sans-serif; }
  .row {
    display:flex; align-items:center; gap:12px; padding:13px 15px; border-radius:14px;
    background:rgba(244,246,250,.05); border:1px solid rgba(244,246,250,.08); margin-bottom:9px;
    text-decoration:none; color:var(--paper);
  }
  .row .nm { flex:1; font-size:13.5px; word-break:break-all; line-height:1.5; }
  .row .sz { font-family:"Space Grotesk",sans-serif; font-size:11.5px; color:rgba(244,246,250,.5); letter-spacing:.06em; }
  .row .dl { font-size:12px; color:var(--mint); font-weight:700; white-space:nowrap; }
  .empty { color:rgba(244,246,250,.35); font-size:13px; padding:8px 2px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="brand"><span class="dot"></span>VITO BYTE · INBOX</div>
  <h1>ارفع المقطع،<br><span>وسأعيده معدّلاً.</span></h1>
  <p class="sub">الفيديو يذهب مباشرة إلى مساحة عمل الاستوديو. أعالجه، وأترك لك النسخة الجاهزة أسفل الصفحة — تُحمَّل من الهاتف بضغطة.</p>

  <div class="drop" id="drop">
    <b>اختر الفيديو</b>
    <small>MP4 · MOV · حتى 300 ميغابايت<br>من الكاميرا أو من ملفات الهاتف</small>
    <label class="btn" for="f">فتح الملفات</label>
    <input id="f" type="file" accept="video/*,audio/*,image/*,.mp4,.mov,.webm,.mkv" />
  </div>
  <div class="bar" id="bar"><i></i></div>
  <div class="status" id="st"></div>

  <h2>وصل</h2>
  <div id="inbox"><div class="empty">لا شيء بعد.</div></div>

  <h2>جاهز للتحميل</h2>
  <div id="out"><div class="empty">لا شيء بعد.</div></div>
</div>
<script>
const f = document.getElementById('f');
const drop = document.getElementById('drop');
const bar = document.getElementById('bar');
const fill = bar.querySelector('i');
const st = document.getElementById('st');
const mb = (n) => (n / 1048576).toFixed(n > 10485760 ? 0 : 1) + ' MB';

async function refresh() {
  try {
    const r = await fetch('/api', { cache: 'no-store' });
    const j = await r.json();
    const inbox = document.getElementById('inbox');
    const out = document.getElementById('out');
    inbox.innerHTML = j.inbox.length
      ? j.inbox.map((x) => '<a class="row" href="/f/in/' + encodeURIComponent(x.name) + '" target="_blank">' +
          '<span class="nm">' + x.name + '</span><span class="sz">' + mb(x.size) + '</span><span class="dl">عرض</span></a>').join('')
      : '<div class="empty">لا شيء بعد.</div>';
    out.innerHTML = j.out.length
      ? j.out.map((x) => '<a class="row" href="/f/out/' + encodeURIComponent(x.name) + '?dl=1">' +
          '<span class="nm">' + x.name + '</span><span class="sz">' + mb(x.size) + '</span><span class="dl">تحميل</span></a>').join('')
      : '<div class="empty">لا شيء بعد.</div>';
  } catch {}
}

function send(file) {
  if (!file) return;
  const url = '/up?name=' + encodeURIComponent(file.name || 'upload.mp4');
  const xhr = new XMLHttpRequest();
  xhr.open('PUT', url, true);
  xhr.upload.onprogress = (e) => {
    if (!e.lengthComputable) return;
    const p = (e.loaded / e.total) * 100;
    bar.classList.add('on');
    fill.style.width = p.toFixed(1) + '%';
    st.className = 'status';
    st.textContent = 'يرفع… ' + p.toFixed(0) + '%  ·  ' + mb(e.loaded) + ' من ' + mb(e.total);
  };
  xhr.onload = () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      let j = {};
      try { j = JSON.parse(xhr.responseText); } catch {}
      bar.classList.remove('on');
      fill.style.width = '0%';
      st.className = 'status ok';
      st.textContent = 'تم ✓  ' + (j.name || file.name) + '  ·  ' + mb(file.size || 0) + ' — أبلغني في المحادثة';
      refresh();
    } else {
      st.className = 'status';
      st.textContent = 'فشل الرفع (' + xhr.status + '). جرّب مقطعاً أصغر أو شبكة أخرى.';
    }
  };
  xhr.onerror = () => { st.className = 'status'; st.textContent = 'انقطع الاتصال أثناء الرفع.'; };
  xhr.send(file);
}

f.addEventListener('change', () => send(f.files[0]));
for (const ev of ['dragenter', 'dragover']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('hot'); });
for (const ev of ['dragleave', 'drop']) drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('hot'); });
drop.addEventListener('drop', (e) => send(e.dataTransfer.files[0]));
refresh();
setInterval(refresh, 4000);
</script>
</body>
</html>`;

const server = http.createServer((req, res) => {
  const url = new URL(req.url || "/", "http://x");

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    const b = Buffer.from(PAGE);
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "content-length": b.length, "cache-control": "no-store" });
    return res.end(b);
  }

  if (req.method === "GET" && url.pathname === "/api") {
    return json(res, 200, {
      inbox: list(INBOX),
      out: list(OUT).filter((f) => /\.(mp4|mov|webm|jpg|png)$/i.test(f.name)),
    });
  }

  if (req.method === "PUT" && url.pathname === "/up") {
    const name = uniq(INBOX, safe(url.searchParams.get("name")));
    const path = join(INBOX, name);
    const ws = createWriteStream(path);
    let got = 0;
    let dead = false;
    req.on("data", (chunk) => {
      got += chunk.length;
      if (got > LIMIT) {
        dead = true;
        ws.destroy();
        try { unlinkSync(path); } catch {}
        return json(res, 413, { error: "too large" });
      }
      if (!ws.write(chunk)) {
        req.pause();
        ws.once("drain", () => req.resume());
      }
    });
    req.on("end", () => {
      if (dead) return;
      ws.end(() => {
        console.log(`[drop] ${name} · ${(got / 1048576).toFixed(1)} MB`);
        json(res, 200, { ok: true, name, size: got });
      });
    });
    req.on("aborted", () => { ws.destroy(); try { unlinkSync(path); } catch {} });
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/f/in/")) {
    const name = decodeURIComponent(url.pathname.slice(6));
    return serveFile(req, res, join(INBOX, safe(name)), false);
  }
  if (req.method === "GET" && url.pathname.startsWith("/f/out/")) {
    const name = decodeURIComponent(url.pathname.slice(7));
    return serveFile(req, res, join(OUT, safe(name)), url.searchParams.get("dl") === "1");
  }

  json(res, 404, { error: "not found" });
});

server.requestTimeout = 0;
server.headersTimeout = 0;
server.timeout = 0;
server.listen(PORT, "0.0.0.0", () => console.log(`drop: listening on 0.0.0.0:${PORT} · inbox ${INBOX}`));
