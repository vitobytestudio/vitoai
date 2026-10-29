/**
 * THE PREVIEW — instant, and the same frame the export produces.
 *
 * The old build shipped the whole video engine in the first request, so the
 * page looked frozen while 2.7 MB parsed. This renders the film with plain DOM
 * and its own clock: it appears the moment the plan does, on any connection,
 * and it is drawn by the very same component the encoder uses.
 *
 * The heavy encoder is only fetched when someone asks for the file.
 */
import React, { useEffect, useRef, useState } from "react";
import type { Decision } from "../src/studio/brain";
import { FilmFrame } from "../src/studio/art";

export const Preview: React.FC<{ plan: Decision; width: number; score?: string; sound?: boolean }> = ({ plan, width, score, sound = true }) => {
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(true);
  const raf = useRef<number | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const t0 = useRef<number>(0);
  const fps = 30;
  const total = Math.max(1, Math.round(plan.seconds * fps));

  useEffect(() => {
    setFrame(0);
    t0.current = performance.now();
    setPlaying(true);
  }, [plan]);

  useEffect(() => {
    if (!playing) return;
    const tick = (now: number) => {
      const elapsed = ((now - t0.current) / 1000) * fps;
      setFrame(Math.floor(elapsed) % total);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playing, total]);

  // the sound follows the picture: one clock, one film
  useEffect(() => {
    const a = audio.current;
    if (!a || !score) return;
    a.muted = !sound;
    if (playing) {
      a.play().catch(() => {
        /* the browser may refuse until a gesture; the control is right there */
      });
    } else {
      a.pause();
    }
  }, [playing, sound, score]);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const want = frame / fps;
    if (Math.abs(a.currentTime - want) > 0.28) a.currentTime = want;
  }, [frame]);

  const height = (width * 1920) / 1080;
  const progress = frame / total;

  return (
    <div className="pv">
      <div className="pv-frame" style={{ width, height }}>
        <FilmFrame plan={plan} frame={frame} w={width} h={height} />
      </div>

      {score ? <audio ref={audio} src={score} loop preload="auto" /> : null}

      <div className="pv-bar">
        <button
          className="pv-play"
          onClick={() => {
            if (!playing) t0.current = performance.now() - (frame / fps) * 1000;
            setPlaying((p) => !p);
          }}
          aria-label={playing ? "pause" : "play"}
        >
          {playing ? (
            <svg width="11" height="12" viewBox="0 0 11 12" fill="currentColor">
              <rect x="0" y="0" width="3.5" height="12" rx="1" />
              <rect x="7.5" y="0" width="3.5" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="12" height="13" viewBox="0 0 12 13" fill="currentColor">
              <path d="M0 0.6c0-.5.5-.8 1-.6l10 5.4c.5.3.5 1 0 1.2L1 12c-.5.2-1-.1-1-.6z" />
            </svg>
          )}
        </button>

        <div
          className="pv-track"
          onClick={(e) => {
            const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
            const p = (e.clientX - r.left) / r.width;
            setPlaying(false);
            setFrame(Math.max(0, Math.min(total - 1, Math.round(p * total))));
          }}
        >
          <i style={{ width: `${progress * 100}%` }} />
          {plan.beats.map((b, i) => {
            const before = plan.beats.slice(0, i).reduce((n, x) => n + x.seconds, 0);
            return <span key={i} className="pv-cut" style={{ left: `${(before / plan.seconds) * 100}%` }} />;
          })}
        </div>

        <span className="pv-time">
          {String(Math.floor(frame / fps)).padStart(2, "0")}s / {Math.round(plan.seconds)}s
        </span>
      </div>
    </div>
  );
};

/**
 * A film with no chrome: the loop that sits on the front page and shows what
 * the product makes before anyone has typed anything.
 */
export const MiniFilm: React.FC<{ plan: Decision; width: number; fps?: number }> = ({ plan, width, fps = 30 }) => {
  const [frame, setFrame] = useState(0);
  const raf = useRef<number | null>(null);
  const t0 = useRef<number>(performance.now());
  const total = Math.max(1, Math.round(plan.seconds * fps));

  useEffect(() => {
    const tick = (now: number) => {
      setFrame(Math.floor(((now - t0.current) / 1000) * fps) % total);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [total, fps]);

  return (
    <div style={{ width, height: (width * 1920) / 1080, position: "relative", overflow: "hidden" }}>
      <FilmFrame plan={plan} frame={frame} w={width} h={(width * 1920) / 1080} />
    </div>
  );
};
