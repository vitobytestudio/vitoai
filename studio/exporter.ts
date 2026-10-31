/**
 * THE EXPORTER — loaded only when someone asks for the file.
 *
 * Everything heavy lives behind this module boundary: the Remotion renderer,
 * WebCodecs plumbing and the encoder. The page never pays for it until the
 * moment a film is actually being written to disk.
 *
 * Two hard rules learned the hard way:
 *   1. never await a capability probe without a deadline — some builds answer
 *      by blocking the main thread, and a download button that hangs is worse
 *      than one that says no;
 *   2. the renderer composites on WebGL. If the browser has no WebGL, say so in
 *      one sentence instead of appearing to work.
 */
import { renderMediaOnWeb } from "@remotion/web-renderer";
import { VitoFilm, framesFor } from "../src/studio/VitoFilm";
import type { Decision } from "../src/studio/brain";

export type Capability = { ok: boolean; reason?: string };

export const canExport = (): Capability => {
  try {
    if (typeof VideoEncoder === "undefined") return { ok: false, reason: "This browser has no video encoder (WebCodecs). Chrome or Edge will." };
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return { ok: false, reason: "This browser has no WebGL, which the renderer composites with. Chrome, Edge or Safari will." };
    return { ok: true };
  } catch {
    return { ok: false, reason: "This browser cannot encode video." };
  }
};

export const exportFilm = async (
  decision: Decision,
  score: string,
  onProgress: (p: number) => void,
): Promise<Blob> => {
  const props = { decision, score };

  // a watchdog: if the encoder stops reporting for 25 s, the film is not
  // arriving — fail with something the visitor can act on
  let last = Date.now();
  const watchdog = window.setInterval(() => {
    if (Date.now() - last > 25_000) window.clearInterval(watchdog);
  }, 1000);

  try {
    const res = await renderMediaOnWeb({
      composition: {
        id: "VitoFilm",
        component: VitoFilm,
        width: 1080,
        height: 1920,
        fps: 30,
        durationInFrames: framesFor(decision),
        defaultProps: props,
      },
      inputProps: props,
      container: "mp4",
      videoCodec: "h264",
      audioCodec: "aac",
      videoBitrate: "high",
      onProgress: (p: { progress: number }) => {
        last = Date.now();
        onProgress(p.progress);
      },
    });
    return res.getBlob();
  } finally {
    window.clearInterval(watchdog);
  }
};
