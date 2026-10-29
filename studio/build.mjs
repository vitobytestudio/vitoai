/**
 * Bundle the studio for the browser. esbuild only — no dev server, no Vite.
 */
import * as esbuild from "esbuild";
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("studio/dist", { recursive: true });

await esbuild.build({
  entryPoints: ["studio/app.tsx"],
  bundle: true,
  outfile: "studio/dist/app.js",
  format: "esm",
  target: ["chrome110", "safari16"],
  jsx: "automatic",
  minify: true,
  sourcemap: false,
  loader: { ".tsx": "tsx", ".ts": "ts" },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  logLevel: "info",
});

cpSync("studio/index.html", "studio/dist/index.html");
// fonts are fetched from /public/fonts by app.css; mirror them into the bundle
// so the Worker serves a single origin and no external requests are made
try {
  cpSync("public/fonts", "studio/dist/public/fonts", { recursive: true });
} catch {
  console.log("no public/fonts to mirror");
}
cpSync("studio/app.css", "studio/dist/app.css");
console.log("studio/dist ready");
