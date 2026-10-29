/**
 * VITO STUDIO — the door.
 *
 * Design intent, stated so it can be held to:
 *   · nothing heavy is imported here; the page is interactive on first paint
 *   · the film appears the instant the plan does — the encoder is fetched only
 *     when someone asks for the file
 *   · the interface shows the decision, not just the result: which page
 *     architecture every beat uses, and what the director refused to do
 *
 * The visual language is Swiss: one type scale with real jumps, a 12-column
 * grid, hairlines instead of boxes, and one accent used once per view.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { think, summarise, type Decision } from "../src/studio/brain";
import { buildScore } from "../src/studio/score";
import { Preview, MiniFilm } from "./preview";
import { direct } from "./director";
import { chooseArch } from "../src/studio/art";

/* ------------------------------------------------------------------ models */

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
    tag: "open",
    open: true,
    accent: "#00FF88",
    blurb: "Reads the brief, decides the film, draws every place from code, scores it, and hands you the file.",
    strong: ["decides the page for every beat", "eleven architectures, never repeating", "sound design and music, −14 LUFS", "encodes in your browser"],
    limits: ["3 films", "30 s", "1080 × 1920"],
  },
  {
    id: "x1",
    name: "VITO X1 AUTO",
    tag: "closed",
    open: false,
    accent: "#4D8DFF",
    blurb: "Works alone. A whole campaign in, a set of films that share one grammar out.",
    strong: ["a series, not a single film", "voice artist, three languages", "60 s and 90 s cuts"],
    limits: ["closed"],
  },
  {
    id: "ultra",
    name: "VITO ULTRA V8",
    tag: "closed",
    open: false,
    accent: "#A66BFF",
    blurb: "For a launch. Deeper worlds, more passes, a director's cut you can show a board.",
    strong: ["4K, both orientations", "three review passes", "bespoke score, stems included"],
    limits: ["closed"],
  },
];

const FREE = { renders: 3, seconds: 30 };
const KEY = "vito.studio.v2";

/* -------------------------------------------------------------------- app */

const App: React.FC = () => {
  const [prompt, setPrompt] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [score, setScore] = useState("");
  const [phase, setPhase] = useState<"idle" | "thinking" | "ready" | "rendering" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState("");
  const [renders, setRenders] = useState(0);
  const [music, setMusic] = useState(true);
  const [narrate, setNarrate] = useState(true);
  const [showModels, setShowModels] = useState(false);
  const [fatal, setFatal] = useState("");
  const [writing, setWriting] = useState(false);
  const [sound, setSound] = useState(true);
  const area = useRef<HTMLTextAreaElement | null>(null);
  const result = useRef<HTMLDivElement | null>(null);
  const work = useRef<number | null>(null);
  const scoreFor = useRef<string>("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setRenders(Math.max(0, Number(JSON.parse(raw).renders) || 0));
    } catch {
      /* private mode */
    }
    return () => {
      if (work.current) window.clearTimeout(work.current);
    };
  }, []);

  // a debug handle: ?s=6 makes a six-second film, so the encoder can be timed
  const demoSeconds = useMemo(() => {
    const n = Number(new URLSearchParams(location.search).get("s"));
    return Number.isFinite(n) && n >= 3 && n <= 30 ? n : 28;
  }, []);

  const buildBed = useCallback((d: Decision) => {
    scoreFor.current = "";
    const run = () => {
      try {
        const s = buildScore(d);
        scoreFor.current = s.url;
        setScore(s.url);
      } catch {
        /* silence is allowed */
      }
    };
    const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
    if (idle) idle(run, { timeout: 1200 });
    else window.setTimeout(run, 260);
  }, []);

  const left = Math.max(0, FREE.renders - renders);

  const create = useCallback(
    (text?: string) => {
      const brief = (text ?? prompt).trim();
      if (!brief) {
        area.current?.focus();
        return;
      }
      if (text) setPrompt(text);
      setPhase("thinking");
      setNote("");
      setFatal("");
      setWriting(false);
      if (work.current) window.clearTimeout(work.current);

      // two frames of painting before the work, so the button responds visibly
      work.current = window.setTimeout(() => {
        try {
          const opts = { seconds: demoSeconds, music, maxSeconds: FREE.seconds };
          // 1. the structure: instant, deterministic, cannot fail
          const base = think(brief, opts);
          base.narration = narrate;
          setDecision(base);
          setScore("");
          setPhase("ready");
          buildBed(base);
          requestAnimationFrame(() => result.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

          // 2. the writing: the director, when it answers
          setWriting(true);
          void direct(brief, opts).then(({ decision, note }) => {
            setDecision(decision);
            buildBed(decision);
            setWriting(false);
            setNote(note);
          });
        } catch (e) {
          setFatal(`The planner failed: ${(e as Error).message}`);
          setPhase("idle");
        }
      }, 240);
    },
    [prompt, music, narrate, demoSeconds, buildBed],
  );

  const download = async () => {
    if (!decision || left <= 0) return;
    setPhase("rendering");
    setProgress(0);
    setNote("");
    try {
      const mod = await import("./exporter");
      const cap = mod.canExport();
      if (!cap.ok) {
        setNote(cap.reason || "This browser cannot encode MP4.");
        setPhase("ready");
        return;
      }
      const blob = await mod.exportFilm(decision, score, setProgress);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vito-${decision.subject}-${Date.now()}.mp4`;
      a.click();
      const next = renders + 1;
      setRenders(next);
      try {
        localStorage.setItem(KEY, JSON.stringify({ renders: next }));
      } catch {
        /* ignore */
      }
      setNote(`Ready · ${(blob.size / 1048576).toFixed(1)} MB · ${decision.seconds}s · with sound`);
      setPhase("done");
    } catch (e) {
      setNote(`The encoder stopped: ${(e as Error).message || "no answer"}. Try again, or a larger screen.`);
      setPhase("ready");
    }
  };

  // the front page shows a real film, made by the same engine, before anyone types
  const demo = useMemo(() => {
    try {
      return think("حملة عطر جديدة، إطلاق عالمي، ليل باريس", { seconds: 18 });
    } catch {
      return null;
    }
  }, []);

  const examples = useMemo(
    () => [
      "مونتاج بريميوم لمجموعة أزياء في باريس",
      "مشروع سكني ببرج على الواجهة البحرية",
      "منصة مطورين: مراجعة، إصدار، نشر",
      "عطر جديد، حملة عالمية",
    ].slice(0, 3),
    [],
  );

  const archs = decision ? decision.beats.map((_, i) => chooseArch(decision, i)) : [];

  return (
    <div className="s">
      {/* ------------------------------------------------------------- bar */}
      <header className="s-bar">
        <a className="s-mark" href="#top">
          <span className="s-dot" />
          <b>VITO</b>
          <span>BYTE</span>
        </a>
        <nav className="s-nav">
          <button className={showModels ? "on" : ""} onClick={() => setShowModels((v) => !v)}>
            models
          </button>
          <span className="s-credit">{left} of {FREE.renders}</span>
        </nav>
      </header>

      {/* ------------------------------------------------------------ hero */}
      <section className="s-hero" id="top">
        <div className="s-hero-grid">
        <div className="s-hero-copy">
        <p className="s-eyebrow">
          <span />
          agent studio · vertical film
        </p>
        <h1>
          Say it once.
          <br />
          <span>Get the film.</span>
        </h1>
        <p className="s-sub">
          One sentence in. The agent decides the concept, the places, the page for every beat, the score — then renders
          it in your browser and hands you the file.
        </p>

        <div className="s-compose">
          <textarea
            ref={area}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 400))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) create();
            }}
            placeholder="صف الفيلم… مثال: مونتاج بريميوم لمجموعة أزياء في باريس، مع مخطط المشروع وسيارات في الليل"
            rows={3}
            spellCheck={false}
          />
          <div className="s-tools">
            <label className="s-sw">
              <input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} />
              <i />
              music
            </label>
            <label className="s-sw">
              <input type="checkbox" checked={narrate} onChange={(e) => setNarrate(e.target.checked)} />
              <i />
              narration
            </label>
            <span className="s-count">{prompt.length}</span>
            <button className="s-go" onClick={() => create()} disabled={!prompt.trim() || phase === "thinking" || phase === "rendering"}>
              {phase === "thinking" ? "thinking" : "Create"}
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M1 7h11M7.5 2.5 12 7l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>

        <div className="s-chips">
          {examples.map((e) => (
            <button key={e} onClick={() => create(e)}>
              {e}
            </button>
          ))}
        </div>
        </div>

        {demo ? (
          <aside className="s-demo">
            <div className="s-phone">
              <MiniFilm plan={demo} width={310} />
              <span className="s-phone-glare" />
            </div>
            <p className="s-demo-note">
              <b>made by the agent</b>
              18 s · one brief · no footage, no stock
            </p>
          </aside>
        ) : null}
        </div>
      </section>

      {/* ------------------------------------------------------------ proof */}
      <section className="s-steps-wrap">
        <p className="s-eyebrow small"><span />how it works</p>
        <div className="s-steps">
        {[
          ["01", "read", "The brief is read for what it is: a fashion house, a tower, a compiler, a perfume. Language, subject and appetite are settled before anything is drawn."],
          ["02", "decide", "Six beats are cast — a claim, the places, the proof, the record, the signature — and each one is given the page architecture that earns it. Consecutive beats are never the same page."],
          ["03", "render", "Every place is drawn from geometry, not photographed. The score is synthesised. The film is encoded in your browser, so nothing is uploaded and nothing is queued."],
        ].map(([n, t, d]) => (
          <article key={n} className="s-step">
            <span className="s-step-n">{n}</span>
            <h3>{t}</h3>
            <p>{d}</p>
          </article>
        ))}
        </div>
      </section>

      {/* ---------------------------------------------------------- models */}
      {showModels ? (
        <section className="s-models">
          {MODELS.map((m) => (
            <article key={m.id} className={`s-model ${m.open ? "open" : ""}`} style={{ ["--a" as string]: m.accent }}>
              <div className="s-model-top">
                <span className="s-model-dot" />
                <b>{m.name}</b>
                <em>{m.tag}</em>
              </div>
              <p>{m.blurb}</p>
              <ul>
                {m.strong.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
              <div className="s-limits">
                {m.limits.map((l) => (
                  <span key={l}>{l}</span>
                ))}
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {fatal ? <p className="s-fatal">{fatal}</p> : null}

      {/* ------------------------------------------------------------ work */}
      {decision ? (
        <section className="s-work" ref={result}>
          <div className="s-stage">
            <Preview plan={decision} width={420} score={score} sound={sound} />
            <div className="s-actions">
              <div className="s-meta">
                <button className={`s-pill ${sound ? "on" : ""}`} onClick={() => setSound((v) => !v)}>
                  {sound ? "sound on" : "sound off"}
                </button>
                <span className={`s-pill ${decision.by === "director" ? "on" : ""}`}>
                  {decision.by === "director" ? "directed" : "planned"}
                </span>
              </div>
              <button className="s-go wide" onClick={download} disabled={phase === "rendering" || left <= 0}>
                {phase === "rendering" ? `rendering ${Math.round(progress * 100)}%` : left > 0 ? "Download MP4" : "Limit reached"}
              </button>
              {phase === "rendering" ? (
                <div className="s-prog">
                  <i style={{ width: `${progress * 100}%` }} />
                </div>
              ) : null}
              {note ? <p className="s-note">{note}</p> : null}
              <p className="s-fine">1080 × 1920 · 30 fps · H.264 + AAC · encoded on this device</p>
            </div>
          </div>

          <div className="s-direction">
            <div className="s-dir-head">
              <h2>Art direction</h2>
              <span>{summarise(decision)}</span>
            </div>

            <div className="s-concept">
              <span className="s-label">concept</span>
              <p>{decision.concept || decision.headline.replace(/\n/g, " ")}</p>
              <small>{decision.concept ? decision.headline.replace(/\n/g, " ") : decision.sub}</small>
            </div>

            <span className="s-label">beats · page architecture</span>
            <ol className="s-beats">
              {decision.beats.map((b, i) => (
                <li key={i} className="s-beat">
                  <span className="s-n">{String(i + 1).padStart(2, "0")}</span>
                  <span className="s-kind">{b.kind}</span>
                  <span className="s-arch">{archs[i]}</span>
                  <span className="s-world">{b.world || "—"}</span>
                  <span className="s-sec">{b.seconds.toFixed(1)}s</span>
                </li>
              ))}
            </ol>

            {decision.refused.length ? (
              <>
                <span className="s-label">refused</span>
                <ul className="s-refused">
                  {decision.refused.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            ) : null}

            <span className="s-label">why</span>
            <ul className="s-why">
              {decision.reasons.map((r, i) => (
                <li key={i}>
                  <b>{r.call}</b>
                  <span>{r.because}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <footer className="s-foot">
        <span>VITO BYTE · agent studio</span>
        <span>{renders} rendered here</span>
      </footer>
    </div>
  );
};

/* a handle for the render-timing probe: nothing is loaded unless ?probe is set */
if (new URLSearchParams(location.search).has("probe")) {
  void import("./exporter").then((m) => {
    (window as unknown as { __x: unknown }).__x = m;
  });
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
