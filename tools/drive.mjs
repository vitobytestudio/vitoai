/**
 * A tiny CDP driver — enough to open the studio in the real browser, type into
 * it, press the button and photograph the result.
 *
 * The point is not testing for its own sake: the studio's whole promise is that
 * it responds the moment you touch it. That claim can only be checked in a
 * browser, so this drives the sandbox's headless Chromium over the DevTools
 * protocol and saves PNGs we can actually look at.
 *
 *   node tools/drive.mjs home
 *   node tools/drive.mjs create "مونتاج بريميوم لمجموعة أزياء في باريس"
 */
import WebSocket from "ws";
import { writeFileSync, mkdirSync } from "node:fs";

const HOST = process.env.CDP_HOST || "127.0.0.1:9222";
const URL_APP = process.env.APP || "http://127.0.0.1:8080/";
const OUT = "studio/shots";
mkdirSync(OUT, { recursive: true });

const http = async (path, method = "GET") => {
  const r = await fetch(`http://${HOST}${path}`, { method });
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};

let seq = 0;
const cdp = (ws, method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    const onMsg = (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.id !== id) return;
      ws.off("message", onMsg);
      if (m.error) reject(new Error(`${method}: ${m.error.message}`));
      else resolve(m.result);
    };
    ws.on("message", onMsg);
    ws.send(JSON.stringify({ id, method, params }));
  });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const shot = async (ws, name, opts = {}) => {
  const { data } = await cdp(ws, "Page.captureScreenshot", { format: "png", captureBeyondViewport: false, ...opts });
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, "base64"));
  console.log("· shot", `${OUT}/${name}.png`);
};

const evaluate = async (ws, expression) => {
  const r = await cdp(ws, "Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed");
  return r.result.value;
};

const main = async () => {
  const [mode = "home", text = "مونتاج بريميوم لمجموعة أزياء في باريس"] = process.argv.slice(2);

  const target = await http(`/json/new?${encodeURIComponent(URL_APP)}`, "PUT");
  const ws = new WebSocket(target.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  await new Promise((r, j) => {
    ws.once("open", r);
    ws.once("error", j);
  });

  await cdp(ws, "Page.enable");
  await cdp(ws, "Runtime.enable");
  await cdp(ws, "Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });

  const errors = [];
  ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") {
      errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
    }
    if (m.method === "Runtime.exceptionThrown") {
      errors.push(m.params.exceptionDetails.exception?.description || "exception");
    }
  });

  await cdp(ws, "Page.navigate", { url: URL_APP });
  await sleep(2600);

  const t0 = Date.now();
  const interactive = await evaluate(
    ws,
    `(async () => {
       const el = document.querySelector('textarea');
       if (!el) return -1;
       el.focus();
       el.value = 'x';
       el.dispatchEvent(new Event('input', { bubbles: true }));
       const ok = document.activeElement === el;
       el.value = '';
       el.dispatchEvent(new Event('input', { bubbles: true }));
       return ok ? 1 : 0;
     })()`,
  );
  console.log("· field focusable:", interactive === 1, "at", Date.now() - t0, "ms");

  if (mode === "home") {
    await shot(ws, "home");
    const box = await evaluate(ws, `JSON.stringify(document.querySelector('.s')?.getBoundingClientRect())`);
    console.log("· page box", box);
    const h = await evaluate(ws, `document.documentElement.scrollHeight`);
    await cdp(ws, "Emulation.setDeviceMetricsOverride", { width: 1440, height: h, deviceScaleFactor: 1, mobile: false });
    await sleep(400);
    await shot(ws, "home-full");
  }

  if (mode === "create" || mode === "full" || mode === "download") {
    await evaluate(
      ws,
      `(() => {
         const el = document.querySelector('textarea');
         el.focus();
         const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
         setter.call(el, ${JSON.stringify(text)});
         el.dispatchEvent(new Event('input', { bubbles: true }));
         return el.value.length;
       })()`,
    );
    await sleep(200);
    const clicked = Date.now();
    await evaluate(ws, `document.querySelector('.s-go').click()`);
    // how long until a frame exists
    let ready = -1;
    for (let i = 0; i < 80; i++) {
      const n = await evaluate(ws, `document.querySelectorAll('.pv-frame > *').length`);
      if (n > 0) {
        ready = Date.now() - clicked;
        break;
      }
      await sleep(100);
    }
    console.log("· first frame after", ready, "ms");
    await sleep(2500);
    const h = await evaluate(ws, `document.documentElement.scrollHeight`);
    await cdp(ws, "Emulation.setDeviceMetricsOverride", { width: 1440, height: Math.min(h, 4000), deviceScaleFactor: 1, mobile: false });
    await sleep(500);
    await shot(ws, "work");
    const status = await evaluate(ws, `JSON.stringify({ by: document.querySelectorAll('.s-pill')[1]?.textContent, note: document.querySelector('.s-note')?.textContent, credit: document.querySelector('.s-credit')?.textContent })`);
    console.log("· status", status);
  }

  if (mode === "download") {
    await sleep(600);
    const t = Date.now();
    console.log("· clicking download");
    await evaluate(ws, `document.querySelectorAll('.s-go.wide')[0].click()`);
    let done = "";
    let last = "";
    for (let i = 0; i < 300; i++) {
      done = await evaluate(ws, `(document.querySelector('.s-note')?.textContent || '') + '|' + (document.querySelector('.s-go.wide')?.textContent || '')`).catch((e) => "eval-timeout");
      if (done !== last) {
        console.log("  ·", ((Date.now() - t) / 1000).toFixed(0) + "s", done);
        last = done;
      }
      if (/MB|failed|cannot|eval-timeout/i.test(done) && /MB|failed|cannot|eval-timeout/i.test(done)) {
        if (!/rendering/i.test(done)) break;
      }
      await sleep(2000);
    }
    console.log("· download after", ((Date.now() - t) / 1000).toFixed(0), "s →", done);
    await shot(ws, "download");
  }

  if (errors.length) console.log("· console errors:\n" + errors.slice(0, 8).join("\n"));
  else console.log("· no console errors");

  ws.close();
  await http(`/json/close/${target.id}`);
};

main().catch((e) => {
  console.error("DRIVE FAILED:", e.message);
  process.exit(1);
});
