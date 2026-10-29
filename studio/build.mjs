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
cpSync("studio/app.css", "studio/dist/app.css");
console.log("studio/dist ready");
