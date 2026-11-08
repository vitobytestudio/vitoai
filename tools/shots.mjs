/**
 * Photograph the site, page by page and language by language.
 *
 *   node tools/shots.mjs            # the default set
 *   node tools/shots.mjs /privacy ar
 *
 * Uses the sandbox's headless Chromium over CDP. This is the only honest way to
 * judge a page: the DOM can be correct and the page still be unreadable.
 */
import WebSocket from "ws";
import { mkdirSync, writeFileSync } from "node:fs";

const HOST = process.env.CDP_HOST || "127.0.0.1:9222";
const BASE = process.env.APP || "http://127.0.0.1:8080";
const OUT = "studio/shots";
mkdirSync(OUT, { recursive: true });

let seq = 0;
const open = async () => {
  const t = await (await fetch(`http://${HOST}/json/new?about:blank`, { method: "PUT" })).json();
  const ws = new WebSocket(t.webSocketDebuggerUrl, { perMessageDeflate: false, maxPayload: 256 * 1024 * 1024 });
  await new Promise((r, j) => {
    ws.once("open", r);
    ws.once("error", j);
  });
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const id = ++seq;
      const on = (raw) => {
        const m = JSON.parse(raw.toString());
        if (m.id !== id) return;
        ws.off("message", on);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      };
      ws.on("message", on);
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evalJS = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "eval failed");
    return r.result.value;
  };
  await send("Page.enable");
  await send("Runtime.enable");
  return { ws, send, evalJS, id: t.id };
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const shoot = async (page, path, lang, width = 1440) => {
  const { send, evalJS } = page;
  await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
  await send("Page.navigate", { url: `${BASE}${path}?lang=${lang}` });
  await sleep(1600);
  const h = Math.min(await evalJS("document.documentElement.scrollHeight"), 4200);
  await send("Emulation.setDeviceMetricsOverride", { width, height: h, deviceScaleFactor: 1, mobile: width < 600 });
  await sleep(600);
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  const name = `${lang}${path.replace(/\//g, "_") || "_home"}${width < 600 ? "-m" : ""}.png`;
  writeFileSync(`${OUT}/${name}`, Buffer.from(data, "base64"));
  const title = await evalJS("document.title");
  const dir = await evalJS("document.documentElement.dir");
  console.log(`· ${name}  ${h}px  dir=${dir}  "${title}"`);
};

const main = async () => {
  const [path, lang] = process.argv.slice(2);
  const page = await open();
  const errors = [];
  page.ws.on("message", (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.method === "Runtime.exceptionThrown") errors.push(m.params.exceptionDetails.exception?.description || "exception");
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") errors.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  });

  if (path && lang) {
    await shoot(page, path, lang, Number(process.env.W || 1440));
  } else {
    for (const l of ["en", "fr", "ar"]) await shoot(page, "/", l);
    for (const l of ["en", "ar"]) {
      for (const p of ["/models", "/about", "/privacy", "/feedback"]) await shoot(page, p, l);
    }
    await shoot(page, "/privacy", "fr");
    await shoot(page, "/", "en", 390);
    await shoot(page, "/privacy", "ar", 390);
  }

  if (errors.length) console.log("· errors:\n" + errors.slice(0, 6).join("\n"));
  else console.log("· no console errors");
  page.ws.close();
  await fetch(`http://${HOST}/json/close/${page.id}`).catch(() => {});
};

main().catch((e) => {
  console.error("SHOTS FAILED:", e.message);
  process.exit(1);
});
