/**
 * NEXUS STUDIO — free public beta.
 *
 * There is no render server. The film is encoded inside the visitor's own
 * browser with WebCodecs (@remotion/web-renderer). That is what makes a
 * genuinely free beta possible: zero marginal cost per export.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Player } from "@remotion/player";
import { canRenderMediaOnWeb, renderMediaOnWeb } from "@remotion/web-renderer";
import { StudioFilm, Brief, Tier, DEFAULT_BRIEF, modelOf } from "../src/studio/StudioFilm";

/* ------------------------------------------------------------------ config */

const FREE = {
  credits: 20,
  maxRenders: 2,
  seconds: 10,
  width: 720,
  height: 1280,
  fps: 30,
};

type PlanDef = {
  id: string;
  name: string;
  tier: Tier;
  price: number;
  model: string;
  desc: string;
  feats: string[];
  open: boolean;
};

const PLANS: PlanDef[] = [
  {
    id: "byte",
    name: "Byte",
    tier: "lite",
    price: 0,
    model: "NEXUS LITE",
    desc: "The public beta. Everything the free tier can do, with the limits stated plainly.",
    feats: ["2 films total", "≤ 10 s each", "720 × 1280 · 30 fps", "20 credits", "watermark"],
    open: true,
  },
  {
    id: "kilo",
    name: "Kilo",
    tier: "core",
    price: 19,
    model: "NEXUS CORE",
    desc: "24 layouts, 1080p, 30 s per film. For a team shipping weekly.",
    feats: ["300 credits / mo", "≤ 30 s per film", "1080 × 1920 · 30 fps", "no watermark", "2 concurrent renders"],
    open: false,
  },
  {
    id: "mega",
    name: "Mega",
    tier: "pro",
    price: 49,
    model: "NEXUS PRO",
    desc: "48 layouts, 60 fps, voiceover, and your palette locked across every film.",
    feats: ["900 credits / mo", "≤ 60 s per film", "1080 × 1920 · 60 fps", "voiceover + brand lock", "4 concurrent renders"],
    open: false,
  },
  {
    id: "tera",
    name: "Tera",
    tier: "prime",
    price: 149,
    model: "NEXUS PRIME",
    desc: "90 layouts, 4K, and one human review pass before the file is released.",
    feats: ["3,000 credits / mo", "≤ 120 s per film", "2160 × 3840 · 60 fps", "human review pass", "API access"],
    open: false,
  },
];

/** 1 credit = 1 second of CORE output. Modifiers stack. */
const creditCost = (tier: Tier, seconds: number) => {
  const fps = tier === "lite" ? 1 : tier === "core" ? 1 : tier === "pro" ? 1.6 : 2.5;
  return Math.max(1, Math.round(seconds * fps));
};

/* ------------------------------------------------------------------- state */

type Ledger = { used: number; renders: number };

const KEY = "nexus.beta.v1";

const loadLedger = (): Ledger => {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw) as Ledger;
      if (typeof p.used === "number" && typeof p.renders === "number") return p;
    }
  } catch {
    /* private mode */
  }
  return { used: 0, renders: 0 };
};

const saveLedger = (l: Ledger) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(l));
  } catch {
    /* ignore */
  }
};

/* ------------------------------------------------------------------- atoms */

const Field: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  max?: number;
}> = ({ label, value, onChange, textarea, max }) => (
  <div className="field">
    <label>{label}</label>
    {textarea ? (
      <textarea value={value} onChange={(e) => onChange(e.target.value.slice(0, max ?? 140))} />
    ) : (
      <input value={value} onChange={(e) => onChange(e.target.value.slice(0, max ?? 60))} />
    )}
  </div>
);

const Swatch: React.FC<{ c: string; on: boolean; pick: () => void }> = ({ c, on, pick }) => (
  <button
    onClick={pick}
    aria-label={c}
    style={{
      width: 30,
      height: 30,
      border: on ? `2px solid ${c}` : "1px solid rgba(120,200,255,0.2)",
      background: c,
      cursor: "pointer",
      padding: 0,
      outline: on ? "2px solid rgba(255,255,255,0.16)" : "none",
      outlineOffset: 2,
    }}
  />
);

/* --------------------------------------------------------------------- app */

const App: React.FC = () => {
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);
  const [seconds, setSeconds] = useState(8);
  const [ledger, setLedger] = useState<Ledger>({ used: 0, renders: 0 });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | ""; text: string }>({ kind: "", text: "" });
  const [webOk, setWebOk] = useState<boolean | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    setLedger(loadLedger());
    canRenderMediaOnWeb({ videoCodecs: ["h264"], container: "mp4" })
      .then((r) => setWebOk(Boolean(r.canRender)))
      .catch(() => setWebOk(false));
  }, []);

  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => setBrief((b) => ({ ...b, [k]: v }));

  const frames = Math.round(seconds * FREE.fps);
  const cost = creditCost("lite", seconds);
  const creditsLeft = Math.max(0, FREE.credits - ledger.used);
  const rendersLeft = Math.max(0, FREE.maxRenders - ledger.renders);
  const blocked =
    creditsLeft < cost ? `Not enough credits — this film costs ${cost}, you have ${creditsLeft}.` : rendersLeft === 0 ? "Trial finished: 2 of 2 films rendered." : "";
  const canExport = !busy && !blocked && webOk !== false;

  const inputProps = useMemo<Brief>(() => ({ ...brief, tier: "lite" }), [brief]);

  /* -------------------------------------------------------------- export */
  const exportFilm = useCallback(async () => {
    if (!canExport) return;
    setBusy(true);
    setProgress(0);
    setMsg({ kind: "", text: "" });
    try {
      const res = await renderMediaOnWeb({
        composition: {
          id: "NexusStudioFilm",
          component: StudioFilm,
          width: FREE.width,
          height: FREE.height,
          fps: FREE.fps,
          durationInFrames: frames,
          defaultProps: inputProps,
        },
        inputProps,
        container: "mp4",
        videoCodec: "h264",
        videoBitrate: "high",
        onProgress: (p) => setProgress(p.progress),
      });
      const blob = await res.getBlob();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const a = document.createElement("a");
      a.href = url;
      a.download = `nexus-lite-${Date.now()}.mp4`;
      a.click();

      const next = { used: ledger.used + cost, renders: ledger.renders + 1 };
      setLedger(next);
      saveLedger(next);
      setMsg({ kind: "ok", text: `Rendered. ${(blob.size / 1048576).toFixed(1)} MB · ${cost} credits used.` });
    } catch (e) {
      setMsg({ kind: "warn", text: `Render failed: ${(e as Error).message}. Your credits were not charged.` });
    } finally {
      setBusy(false);
      setProgress(0);
    }
  }, [canExport, frames, inputProps, cost, ledger]);

  const reset = () => {
    const l = { used: 0, renders: 0 };
    setLedger(l);
    saveLedger(l);
    setMsg({ kind: "", text: "" });
  };

  /* -------------------------------------------------------------- render */
  return (
    <>
      <header>
        <div className="wrap head">
          <div className="brand">
            <svg width={26} height={26} viewBox="0 0 100 100" aria-hidden>
              <path d="M10 10 L50 88 L90 10" fill="none" stroke="#00FF88" strokeWidth={11} strokeLinejoin="round" />
            </svg>
            <div>
              <div className="brand-name">VITO BYTE</div>
              <div className="brand-sub">nexus studio</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div className="badge on">free public beta</div>
            <div className="badge">{creditsLeft} cr</div>
          </div>
        </div>
      </header>

      <div className="wrap">
        <section className="hero">
          <div>
            <h1>
              Your engineering, <em>filmed.</em>
            </h1>
            <p>
              Write the brief. Get a finished vertical film. No editor, no revision loop — the studio
              renders it in your browser while you watch.
            </p>
          </div>
          <div className="hero-note">
            public beta · everything open is free
            <br />
            <b>2 films</b> · <b>10 s</b> each · <b>720p</b> · watermark
            <br />
            paid models are listed and closed until we leave beta
          </div>
        </section>

        <section className="grid">
          {/* ------------------------------------------------------- controls */}
          <div>
            <div className="panel" style={{ marginBottom: 18 }}>
              <div className="panel-head">
                <h3>trial allowance</h3>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.18em", color: "var(--green)" }}>
                  {rendersLeft} / {FREE.maxRenders} left
                </span>
              </div>
              <div className="panel-body">
                <div className="credits">
                  <div>
                    <div className="k">credits</div>
                    <div className="v green">{creditsLeft}</div>
                  </div>
                  <div>
                    <div className="k">this film</div>
                    <div className="v">{cost}</div>
                  </div>
                  <div>
                    <div className="k">length</div>
                    <div className="v">{seconds}s</div>
                  </div>
                </div>
                <div className="bar">
                  <i style={{ width: `${(creditsLeft / FREE.credits) * 100}%` }} />
                </div>
                <div className="notice">
                  The trial does not renew and needs no card. Limits are enforced in the studio, not in
                  the fine print.
                </div>
                {ledger.renders > 0 ? (
                  <button className="btn ghost" style={{ marginTop: 14 }} onClick={reset}>
                    reset local trial
                  </button>
                ) : null}
              </div>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h3>model</h3>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>
                  plan → model
                </span>
              </div>
              <div className="panel-body">
                <div className="models">
                  {PLANS.map((p) => (
                    <button
                      key={p.id}
                      className="model"
                      data-on={p.open}
                      disabled={!p.open}
                      title={p.open ? "" : "Opens when the beta ends"}
                    >
                      <span>
                        <div className="model-name">{p.model}</div>
                        <div className="model-meta">
                          {p.name} · {p.price === 0 ? "free" : `$${p.price}/mo`}
                        </div>
                      </span>
                      <span className={`model-tag ${p.open ? "open" : "lock"}`}>
                        {p.open ? "open" : "locked"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* -------------------------------------------------------- preview */}
          <div>
            <div className="stage">
              <div className="stage-bar">
                <span>preview · 720 × 1280 · 30 fps</span>
                <span style={{ color: blocked ? "#FFB020" : "var(--green)" }}>
                  {busy ? `rendering ${Math.round(progress * 100)}%` : blocked ? "trial exhausted" : "ready"}
                </span>
              </div>

              <div className="stage-inner" style={{ width: 300, height: 533 }}>
                <Player
                  component={StudioFilm}
                  inputProps={inputProps}
                  durationInFrames={frames}
                  fps={FREE.fps}
                  compositionWidth={FREE.width}
                  compositionHeight={FREE.height}
                  style={{ width: "100%", height: "100%" }}
                  controls
                  loop
                  autoPlay
                  clickToPlay
                  doubleClickToFullscreen
                />
              </div>

              <div style={{ width: 300, marginTop: 22 }}>
                <button className="btn" onClick={exportFilm} disabled={!canExport}>
                  {busy ? "encoding…" : blocked ? "trial finished" : `render mp4 · ${cost} cr`}
                </button>

                {busy ? (
                  <div className="progress">
                    <div className="progress-label">
                      <span>webcodecs</span>
                      <span>{Math.round(progress * 100)}%</span>
                    </div>
                    <div className="progress-track">
                      <i style={{ width: `${progress * 100}%` }} />
                    </div>
                  </div>
                ) : null}

                {msg.text ? <div className={`notice ${msg.kind}`}>{msg.text}</div> : null}
                {blocked && !busy ? <div className="notice warn">{blocked}</div> : null}
                {webOk === false ? (
                  <div className="notice warn">
                    This browser cannot encode H.264 locally. Use Chrome, Edge or Safari 17+ on desktop.
                  </div>
                ) : null}
              </div>
            </div>

            {/* ------------------------------------------------------- brief */}
            <div className="panel" style={{ marginTop: 18 }}>
              <div className="panel-head">
                <h3>brief</h3>
                <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>
                  edits apply live
                </span>
              </div>
              <div className="panel-body">
                <div className="row2">
                  <Field label="kicker" value={brief.kicker} onChange={(v) => set("kicker", v)} max={32} />
                  <Field label="cta" value={brief.cta} onChange={(v) => set("cta", v)} max={32} />
                </div>
                <Field label="headline (line break allowed)" value={brief.headline} onChange={(v) => set("headline", v)} textarea max={70} />
                <div className="row2">
                  <Field label="hero number" value={brief.hero} onChange={(v) => set("hero", v)} max={12} />
                  <Field label="unit" value={brief.unit} onChange={(v) => set("unit", v)} max={10} />
                </div>
                <Field label="sub line" value={brief.sub} onChange={(v) => set("sub", v)} max={70} />

                <div className="field" style={{ marginBottom: 0 }}>
                  <label>length · {seconds}s</label>
                  <input
                    type="range"
                    min={4}
                    max={FREE.seconds}
                    step={1}
                    value={seconds}
                    onChange={(e) => setSeconds(Number(e.target.value))}
                    style={{ padding: 0, background: "transparent", accentColor: "#00FF88" }}
                  />
                </div>

                <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 18 }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.2em", color: "var(--dim)", textTransform: "uppercase" }}>
                    accent
                  </span>
                  {["#00FF88", "#2E7CFF", "#63B3FF", "#FF3D6E", "#FFB020", "#E8F4FF"].map((c) => (
                    <Swatch key={c} c={c} on={brief.accent === c} pick={() => set("accent", c)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- plans */}
        <section className="plans">
          <div className="plans-head">
            <h2>Plans</h2>
            <span>one engine · four models · paid tiers closed during beta</span>
          </div>

          <div className="plan-grid">
            {PLANS.map((p) => {
              const isFree = p.price === 0;
              return (
                <div key={p.id} className={`plan ${isFree ? "free" : "lock"}`}>
                  <div className="plan-name">{p.name}</div>
                  <div className="plan-model">{p.model}</div>
                  <div className="plan-price">
                    {isFree ? "Free" : `$${p.price}`}
                    {isFree ? <small> forever</small> : <small> /mo</small>}
                  </div>
                  <p className="plan-desc">{p.desc}</p>
                  <ul>
                    {p.feats.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <div className="plan-cta">{isFree ? "you are on this plan" : "opens after beta"}</div>
                </div>
              );
            })}
          </div>

          <div className="notice" style={{ marginTop: 26, maxWidth: 820 }}>
            Every export is encoded on your own machine with WebCodecs, which is why the beta can be free
            without a queue and without a card. Paid tiers are listed so you can see exactly where the
            limits will sit — none of them are purchasable yet.
          </div>
        </section>
      </div>

      <footer>
        <div className="wrap foot">
          <span>vito byte studio · nexus engine</span>
          <span>where engineering meets autonomy</span>
        </div>
      </footer>
    </>
  );
};

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
