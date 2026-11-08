import React, { useEffect, useState } from "react";
import { continueRender, delayRender } from "remotion";
import { FONT_FACES, injectFontFaces } from "./fonts";

const AR_SAMPLE = "من الفكرة إلى فيديو خارق استوديو الحركة البرمجي بالكود";
const LAT_SAMPLE = "VitoAI MOTION STUDIO 0123456789";

/**
 * CRITICAL for this environment:
 * the machine has zero system fonts, so any text painted before the webfont
 * resolves is painted with a non-existent fallback and Chromium does NOT
 * repaint that text layer once the font swaps in — it silently stays blank.
 * Mounting the composition only AFTER fonts are ready avoids the swap entirely.
 */
export const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handle] = useState(() => delayRender("Loading VitoAI type system"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    injectFontFaces();
    const loads: Promise<unknown>[] = [];
    for (const f of FONT_FACES) {
      loads.push(document.fonts.load(f, AR_SAMPLE));
      loads.push(document.fonts.load(f, LAT_SAMPLE));
    }
    Promise.all(loads)
      .then(() => document.fonts.ready)
      .then(() => {
        if (!alive) return;
        // two ticks so the first paint with the real metrics is the one captured
        requestAnimationFrame(() => {
          if (!alive) return;
          setReady(true);
          requestAnimationFrame(() => continueRender(handle));
        });
      })
      .catch(() => {
        if (!alive) return;
        setReady(true);
        continueRender(handle);
      });
    return () => {
      alive = false;
    };
  }, [handle]);

  if (!ready) return null;
  return <>{children}</>;
};
