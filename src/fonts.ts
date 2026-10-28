/**
 * Font injection at runtime.
 * This sandbox has ZERO system fonts (fc-list = 0), so nothing can fall back:
 * every face ships as a base64 data-URI inside the bundle, each with an explicit
 * unicode-range so the Arabic and Latin subsets of a family coexist.
 */
import { FONT_DATA } from "./fontData";

let injected = false;

export const injectFontFaces = () => {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const style = document.createElement("style");
  style.setAttribute("data-vitoai-fonts", "true");
  style.textContent = FONT_DATA.map(
    (f) =>
      `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:block;` +
      `src:url(data:font/woff2;base64,${f.b64}) format("woff2");unicode-range:${f.range};}`,
  ).join("\n");
  document.head.appendChild(style);
};

export const FONT_FACES = FONT_DATA.map((f) => `${f.weight} 100px "${f.family}"`);
