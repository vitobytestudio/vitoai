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
  // Arabic faces are deliberately kept off the currency block; the Latin faces
  // carry a real € glyph that the shipped range was silently excluding, which is
  // exactly how "€10,000" rendered as tofu on the first EDGE test render.
  const EXTRA: Record<string, string> = {
    "Space Grotesk": ", U+20A0-20CF",
    Sora: ", U+20A0-20CF",
    "JetBrains Mono": ", U+20A0-20CF",
  };
  style.textContent = FONT_DATA.map(
    (f) =>
      `@font-face{font-family:"${f.family}";font-style:normal;font-weight:${f.weight};font-display:block;` +
      `src:url(data:font/woff2;base64,${f.b64}) format("woff2");unicode-range:${f.range}${EXTRA[f.family] ?? ""};}`,
  ).join("\n");
  document.head.appendChild(style);
};

export const FONT_FACES = FONT_DATA.map((f) => `${f.weight} 100px "${f.family}"`);
