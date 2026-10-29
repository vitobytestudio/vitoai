/**
 * VITO STUDIO — the door.
 *
 * One field. You describe what you want; the agent reads it, decides what the
 * film is made of and what it refuses, then renders it in your browser — with
 * its score — and hands you a file.
 *
 * Three models are on the shelf. One is open; two are closed, and say so
 * plainly on the card rather than at the paywall.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Player } from "@remotion/player";
import { canRenderMediaOnWeb, renderMediaOnWeb } from "@remotion/web-renderer";
import { think, summarise, Decision } from "../src/studio/brain";
import { buildScore } from "../src/studio/score";
import { VitoFilm } from "../src/studio/VitoFilm";

/* ----------------------------------------------------------------- models */

type ModelCard = {
  id: string;
  name: string;
  tag: string;
  open: boolean;
  accent: string;
  blurb: string;
  strong: string[];
  limits: string[];
};

const MODELS: ModelCard[] = [
  {
    id: "lite",
    name: "VITO LITE V2",
    tag: "free · open",
    open: true,
    accent: "#00FF88",
    blurb: "The one that is open today. Reads a brief, decides the film, builds every place from scratch, scores it, and hands you the file.",
    strong: [
      "decides what to show — and what to refuse",
      "six procedural places, no stock, no photos",
      "sound design + music, mixed to −14 LUFS",
      "picture, narration and score from one plan",
      "renders in your browser, nothing uploaded",
    ],
    limits: ["3 films", "≤ 30 s", "1080 × 1920", "light mark"],
  },
  {
    id: "x1",
    name: "VITO X1 AUTO",
    tag: "paid · closed",
    open: false,
    accent: "#4D8DFF",
    blurb: "The one that works alone. Hand it a whole campaign and it returns a set of films that share one grammar.",
    strong: [
      "builds a series, not a single film",
      "voice artist in three languages",
      "long-form: 60 s and 90 s cuts",
      "every cut re-graded to one look",
    ],
    limits: ["closed"],
  },
  {
    id: "ultra",
    name: "VITO ULTRA V8",
    tag: "paid · closed",
    open: false,
    accent: "#A66BFF",
    blurb: "The one for a launch. Deeper worlds, more passes, and a director's cut you can actually show to a board.",
    strong: [
      "4K vertical and landscape masters",
      "three review passes before release",
      "bespoke music, stems included",
      "brand lock: palette, type, mark",
    ],
    limits: ["closed"],
  },
];

const FREE = { renders: 3, seconds: 30, width: 1080, height: 1920, fps: 30 };
const KEY = "vito.studio.v1";

type Ledger = { renders: number; createdAt: number };
const loadLedger = (): Ledger => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Ledger;
      if (typeof p.renders === "number") return p;
    }
  } catch {
    /* private mode */
  }
  return { renders: 0, createdAt: Date.now() };
};

/* ------------------------------------------------------------------ atoms */

const Dot: React.FC<{ c: string; on?: boolean }> = ({ c, on }) => (
  <span style={{ width: 7, height: 7, borderRadius: 99, background: c, boxShadow: on ? `0 0 14px ${c}` : undefined, opacity: on ? 1 : 0.5, display: "inline-block" }} />
);

const Check: React.FC<{ c: string }> = ({ c }) => (
  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth={3.4} style={{ flex: "0 0 11px", marginTop: 6 }}>
    <path d="M4 12.5 L9 17.5 L20 6.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/* -------------------------------------------------------------------- app */

const App: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [score, setScore] = useState<string>("");
  const [phase, setPhase] = useState<"idle" | "thinking" | "ready" | "rendering" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState("");
  const [ledger, setLedger] = useState<Ledger>({ renders: 0, createdAt: Date.now() });
  const [music, setMusic] = useState(true);
  const [canRender, setCanRender] = useState(true);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    setLedger(loadLedger());
    canRenderMediaOnWeb({ container: "mp4", videoCodec: "h264" })
      .then((r) => setCanRender(r.canRender))
      .catch(() => setCanRender(false));
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, []);

  const left = Math.max(0, FREE.renders - ledger.renders);
  const save = (next: Ledger) => {
    setLedger(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  /* the agent thinking: a beat of silence, then the plan appears */
  const create = (text?: string) => {
    const brief = (text ?? prompt).trim();
    if (!brief) return;
    if (text) setPrompt(text);
    setPhase("thinking");
    setNote("");
    setDecision(null);
    setScore("");
    timer.current = window.setTimeout(() => {
      const d = think(brief, { seconds: 28, music, maxSeconds: FREE.seconds });
      setDecision(d);
      try {
        const s = buildScore(d);
        setScore(s.url);
      } catch {
        setScore("");
      }
      setPhase("ready");
    }, 620);
  };

  const render = async () => {
    if (!decision || left <= 0 || !canRender) return;
    setPhase("rendering");
    setProgress(0);
    setNote("");
    try {
      const res = await renderMediaOnWeb({
        composition: {
          id: "VitoFilm",
          component: VitoFilm,
          width: FREE.width,
          height: FREE.height,
          fps: FREE.fps,
          durationInFrames: Math.max(1, Math.round(decision.seconds * FREE.fps)),
          defaultProps: { decision, score },
        },
        inputProps: { decision, score },
        container: "mp4",
        videoCodec: "h264",
        audioCodec: "aac",
        videoBitrate: "high",
        onProgress: (p: { progress: number }) => setProgress(p.progress),
      });
      const blob = await res.getBlob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vito-${decision.subject}-${Date.now()}.mp4`;
      a.click();
      save({ renders: ledger.renders + 1, createdAt: ledger.createdAt });
      setNote(`Ready · ${(blob.size / 1048576).toFixed(1)} MB · ${decision.seconds}s · with sound`);
      setPhase("done");
    } catch (e) {
      setNote(`The browser refused this render: ${(e as Error).message}`);
      setPhase("ready");
    }
  };

  const examples = useMemo(
    () => [
      "مجموعة أزياء فاخرة تصوَّر في مول كبير في باريس",
      "مشروع سكني ببرج على الواجهة البحرية",
      "منصة مطورين: مراجعة، إصدار، ونشر بلا توقف",
      "سيارة كهربائية على طريق ليلي في المدينة",
    ],
    [],
  );

  return (
    <div className="v-root">
      {/* ------------------------------------------------------------ head */}
      <header className="v-head">
        <div className="v-mark">
          <span className="v-dot" />
          <span className="v-word">VITO</span>
          <span className="v-sub">BYTE</span>
        </div>
        <div className="v-head-right">
          <span className="v-pill">{left} of {FREE.renders} films left</span>
          <span className="v-pill dim">free</span>
        </div>
      </header>

      {/* ------------------------------------------------------------ hero */}
      <section className="v-hero">
        <h1>
          Describe it.
          <br />
          <em>Get the film.</em>
        </h1>
        <p className="v-lede">
          An agent that reads a brief, decides what the film is made of — and what it refuses — then builds every frame
          in code and scores it. Nothing is generated by a model you would need to see.
        </p>

        <div className="v-field">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 400))}
            placeholder="اكتب ما تريده… مثال: مونتاج بريميوم لمجموعة ملابس في باريس، مع مخطط المشروع وسيارات في الليل"
            rows={3}
          />
          <div className="v-field-foot">
            <label className="v-toggle">
              <input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} />
              music
            </label>
            <span className="v-count">{prompt.length}/400</span>
            <button className="v-go" onClick={() => create()} disabled={!prompt.trim() || phase === "rendering"}>
              {phase === "thinking" ? "thinking…" : "Create film"}
            </button>
          </div>
        </div>

        <div className="v-examples">
          {examples.map((e) => (
            <button key={e} onClick={() => create(e)} className="v-chip">
              {e}
            </button>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- models */}
      <section className="v-models">
        {MODELS.map((m) => (
          <article key={m.id} className={`v-card ${m.open ? "open" : "locked"}`} style={{ ["--acc" as string]: m.accent }}>
            <div className="v-card-top">
              <Dot c={m.accent} on={m.open} />
              <span className="v-card-name">{m.name}</span>
              <span className="v-card-tag">{m.tag}</span>
            </div>
            <p className="v-card-blurb">{m.blurb}</p>
            <ul>
              {m.strong.map((s) => (
                <li key={s}>
                  <Check c={m.accent} />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
            <div className="v-card-foot">
              {m.limits.map((l) => (
                <span key={l} className="v-limit">
                  {l}
                </span>
              ))}
            </div>
            {m.open ? null : <button className="v-locked" disabled>closed</button>}
          </article>
        ))}
      </section>

      {/* --------------------------------------------------------- decision */}
      {decision ? (
        <section className="v-work">
          <div className="v-work-main">
            <div className="v-screen">
              <Player
                component={VitoFilm}
                inputProps={{ decision, score }}
                durationInFrames={Math.max(1, Math.round(decision.seconds * FREE.fps))}
                fps={FREE.fps}
                compositionWidth={FREE.width}
                compositionHeight={FREE.height}
                style={{ width: "100%", height: "auto", aspectRatio: "9 / 16" }}
                controls
                loop
              />
            </div>
            <div className="v-actions">
              <button className="v-go wide" onClick={render} disabled={phase === "rendering" || left <= 0 || !canRender}>
                {phase === "rendering" ? `rendering ${Math.round(progress * 100)}%` : left > 0 ? "Download the film" : "Limit reached"}
              </button>
              {phase === "rendering" ? (
                <div className="v-bar">
                  <i style={{ width: `${progress * 100}%` }} />
                </div>
              ) : null}
              {note ? <p className="v-note">{note}</p> : null}
              {!canRender ? <p className="v-note warn">This browser cannot encode MP4 — try Chrome or Edge.</p> : null}
            </div>
          </div>

          <aside className="v-brain">
            <h3>what the agent decided</h3>
            <p className="v-sum">{summarise(decision)}</p>

            <ol className="v-reasons">
              {decision.reasons.map((r, i) => (
                <li key={i}>
                  <span className="v-call">{r.call}</span>
                  <span className="v-because">{r.because}</span>
                </li>
              ))}
            </ol>

            {decision.refused.length ? (
              <>
                <h4>refused</h4>
                <ul className="v-refused">
                  {decision.refused.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            ) : null}

            <h4>beats</h4>
            <div className="v-beats">
              {decision.beats.map((b, i) => (
                <div key={i} className="v-beat">
                  <span className="v-beat-i">{String(i + 1).padStart(2, "0")}</span>
                  <span className="v-beat-k">{b.kind}</span>
                  <span className="v-beat-w">{b.world || "—"}</span>
                  <span className="v-beat-s">{b.seconds}s</span>
                </div>
              ))}
            </div>
          </aside>
        </section>
      ) : null}

      <footer className="v-foot">
        <span>VITO BYTE — agent studio</span>
        <span>{ledger.renders} rendered on this device</span>
      </footer>
    </div>
  );
};

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
