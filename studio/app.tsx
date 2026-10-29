/**
 * NEXUS STUDIO — free public beta.
 *
 * Two products in one page:
 *   1. Generate  — a written description becomes a film in one of six design
 *                  systems. Encoded in the visitor's browser (WebCodecs).
 *   2. Overlay   — upload a clip you already shot; the studio composites motion
 *                  graphics onto it and hands back a file (MediaRecorder).
 *
 * No render server exists, which is what makes a genuinely free beta possible.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Player } from "@remotion/player";
import { canRenderMediaOnWeb, renderMediaOnWeb } from "@remotion/web-renderer";
import { Film } from "../src/studio/Film";
import { Brief, DesignId, DEFAULT_BRIEF } from "../src/studio/types";
import { DESIGNS, designById, pickDesign } from "../src/studio/registry";
import { compileBrief, EXAMPLES } from "../src/studio/brief";
import { renderOverlay, download, OverlayOptions } from "./overlay";
import { StoryFilm } from "../src/studio/StoryFilm";
import { planStory, totalSeconds, Storyboard } from "../src/studio/story";
import { planWithAI, shootAll, aiHealth, preview, Trace } from "./ai";

/* ------------------------------------------------------------------ config */

const FREE = {
  credits: 20,
  maxRenders: 2,
  seconds: 10,
  width: 720,
  height: 1280,
  fps: 30,
};

const creditCost = (seconds: number) => Math.max(1, Math.round(seconds));

/* ------------------------------------------------------------------- plans */

const PLANS = [
  { name: "Byte", model: "NEXUS LITE", price: 0, open: true, desc: "The public beta. Everything the free tier can do, with the limits stated plainly.", feats: ["2 films total", "≤ 10 s each", "720 × 1280 · 30 fps", "20 credits", "watermark"] },
  { name: "Kilo", model: "NEXUS CORE", price: 19, open: false, desc: "All six design systems, 1080p, 30 s per film. For a team shipping weekly.", feats: ["300 credits / mo", "≤ 30 s per film", "1080 × 1920 · 30 fps", "no watermark", "2 concurrent renders"] },
  { name: "Mega", model: "NEXUS PRO", price: 49, open: false, desc: "60 fps, voiceover, and your palette and typeface locked across every film.", feats: ["900 credits / mo", "≤ 60 s per film", "1080 × 1920 · 60 fps", "voiceover + brand lock", "4 concurrent renders"] },
  { name: "Tera", model: "NEXUS PRIME", price: 149, open: false, desc: "4K, every design, and one human review pass before the file is released.", feats: ["3,000 credits / mo", "≤ 120 s per film", "2160 × 3840 · 60 fps", "human review pass", "API access"] },
];

/* ------------------------------------------------------------------- state */

type Ledger = { used: number; renders: number };
const KEY = "nexus.beta.v2";

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

/* ------------------------------------------------------------------- atoms */

const Row: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ display: "flex", gap: 12, ...style }}>{children}</div>
);

const Field: React.FC<{ label: string; value: string; onChange: (v: string) => void; area?: boolean; max?: number }> = ({
  label,
  value,
  onChange,
  area,
  max,
}) => (
  <div className="field">
    <label>{label}</label>
    {area ? (
      <textarea value={value} onChange={(e) => onChange(e.target.value.slice(0, max ?? 200))} />
    ) : (
      <input value={value} onChange={(e) => onChange(e.target.value.slice(0, max ?? 60))} />
    )}
  </div>
);

/* --------------------------------------------------------------------- app */

const App: React.FC = () => {
  const [tab, setTab] = useState<"generate" | "story" | "overlay">("story");
  const [prompt, setPrompt] = useState(EXAMPLES[0].text);
  const [brief, setBrief] = useState<Brief>(() => compileBrief(EXAMPLES[0].text));
  const [seconds, setSeconds] = useState(8);
  const [ledger, setLedger] = useState<Ledger>({ used: 0, renders: 0 });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [msg, setMsg] = useState<{ kind: "ok" | "warn" | ""; text: string }>({ kind: "", text: "" });
  const [webOk, setWebOk] = useState<boolean | null>(null);

  /* story state */
  const [storyBrief, setStoryBrief] = useState(
    "A premium campaign for a Paris fashion house. Show the architecture of the city, a full blueprint of the flagship build, a montage of cars on a night boulevard, then the finished store inside a mall. End on the collection itself.",
  );
  const [story, setStory] = useState<Storyboard | null>(null);
  const [footage, setFootage] = useState<Record<string, string>>({});
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<string>("");
  const [shotP, setShotP] = useState({ done: 0, total: 0 });
  const [via, setVia] = useState<"ai" | "rules" | "">("");
  const [trace, setTrace] = useState<Trace[]>([]);
  const [reviewOn, setReviewOn] = useState(true);
  const stopRef = useRef(false);

  /* overlay state */
  const [clip, setClip] = useState<File | null>(null);
  const [ov, setOv] = useState<OverlayOptions>({
    kicker: "vito byte studio",
    headline: "Your own metal.",
    cta: "vitobyte.studio",
    accent: "#00FF88",
    brand: true,
    layout: "lower-third",
  });
  const [ovBusy, setOvBusy] = useState(false);
  const [ovP, setOvP] = useState(0);

  useEffect(() => {
    setLedger(loadLedger());
    canRenderMediaOnWeb({ videoCodecs: ["h264"], container: "mp4" })
      .then((r) => setWebOk(Boolean(r.canRender)))
      .catch(() => setWebOk(false));
    aiHealth().then((h) => setAiOn(h.ai));
  }, []);

  /* ---------------------------------------------------------------- story */
  const log = (t: Trace) => setTrace((x) => [...x, t]);

  const plan = async () => {
    setPhase("planning");
    setVia("");
    setStory(null);
    setFootage({});
    setTrace([]);
    setMsg({ kind: "", text: "" });
    const { story: s0, via: v } = await planWithAI(storyBrief, 30, log);
    setStory(s0);
    setVia(v);
    setPhase("planned");
    setShotP({ done: 0, total: s0.scenes.filter((x) => x.kind === "image").length });
  };

  const shoot = async () => {
    if (!story) return;
    stopRef.current = false;
    setPhase("shooting");
    setShotP({ done: 0, total: story.scenes.filter((x) => x.kind === "image").length });
    const { footage: f, shots, avg } = await shootAll(
      story,
      log,
      (done, total) => setShotP({ done, total }),
      { review: reviewOn, shouldStop: () => stopRef.current },
    );
    setFootage(f);
    setPhase("ready");
    if (shots === 0) {
      setMsg({
        kind: "warn",
        text: "The image model is unreachable, so scenes are rendered as generated fields. Bind Workers AI to shoot real stills.",
      });
    } else if (avg !== null) {
      setMsg({ kind: avg >= 70 ? "ok" : "warn", text: `Shot ${shots} scenes · mean critic score ${avg}/100.` });
    }
  };

  const regenerate = (text: string) => {
    setPrompt(text);
    setBrief(compileBrief(text));
    setMsg({ kind: "", text: "" });
  };

  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => setBrief((b) => ({ ...b, [k]: v }));

  const frames = Math.round(seconds * FREE.fps);
  const cost = creditCost(seconds);
  const creditsLeft = Math.max(0, FREE.credits - ledger.used);
  const rendersLeft = Math.max(0, FREE.maxRenders - ledger.renders);
  const blocked =
    creditsLeft < cost
      ? `Not enough credits — this film costs ${cost}, you have ${creditsLeft}.`
      : rendersLeft === 0
        ? "Trial finished: 2 of 2 films rendered."
        : "";
  const canExport = !busy && !blocked && webOk !== false;
  const design = designById(brief.design);

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
          id: "NexusFilm",
          component: Film,
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
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `nexus-${brief.design}-${Date.now()}.mp4`;
      a.click();
      const next = { used: ledger.used + cost, renders: ledger.renders + 1 };
      setLedger(next);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      setMsg({ kind: "ok", text: `Rendered · ${(blob.size / 1048576).toFixed(1)} MB · ${design.name} · ${cost} credits.` });
    } catch (e) {
      setMsg({ kind: "warn", text: `Render failed: ${(e as Error).message}. Credits were not charged.` });
    } finally {
      setBusy(false);
    }
  }, [canExport, frames, inputProps, cost, ledger, brief.design, design.name]);

  /* ------------------------------------------------------------- overlay */
  const runOverlay = async () => {
    if (!clip) return;
    setOvBusy(true);
    setOvP(0);
    setMsg({ kind: "", text: "" });
    try {
      const r = await renderOverlay(clip, ov, setOvP);
      const ext = r.mime.includes("mp4") ? "mp4" : "webm";
      download(r.blob, `vito-overlay-${Date.now()}.${ext}`);
      setMsg({
        kind: "ok",
        text: `Done · ${(r.blob.size / 1048576).toFixed(1)} MB · ${r.seconds.toFixed(1)} s · ${ext.toUpperCase()}.`,
      });
    } catch (e) {
      setMsg({ kind: "warn", text: `Overlay failed: ${(e as Error).message}` });
    } finally {
      setOvBusy(false);
    }
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
              Describe it. <em>Get the film.</em>
            </h1>
            <p>
              Say what it should contain — the city, the build, the cars, the store — and the studio plans
              the scenes, shoots the stills, and cuts them into one film. Six design systems, one arc.
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

        {/* ---------------------------------------------------------- tabs */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--edge)", marginBottom: 28 }}>
          {([
            ["story", "01 · describe a film"],
            ["generate", "02 · one layout"],
            ["overlay", "03 · upload & produce"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                background: tab === id ? "rgba(0,255,136,0.07)" : "transparent",
                border: "none",
                borderBottom: tab === id ? "2px solid var(--green)" : "2px solid transparent",
                color: tab === id ? "var(--green)" : "var(--muted)",
                fontFamily: "var(--mono)",
                fontSize: 11.5,
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                padding: "14px 22px",
                cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "story" ? (
          /* ---------------------------------------------------- story mode */
          <section className="grid">
            <div>
              <div className="panel">
                <div className="panel-head">
                  <h3>describe the film</h3>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", color: aiOn ? "var(--green)" : "var(--dim)" }}>
                    {aiOn === null ? "checking ai…" : aiOn ? "agent online" : "rules engine"}
                  </span>
                </div>
                <div className="panel-body">
                  <Field label="what is the film about?" value={storyBrief} onChange={setStoryBrief} area max={700} />
                  <Row>
                    <button className="btn" style={{ flex: 1 }} onClick={plan} disabled={phase === "planning" || phase === "shooting"}>
                      {phase === "planning" ? "thinking…" : "plan the film"}
                    </button>
                  </Row>
                  <div className="notice">
                    {aiOn
                      ? "The agent turns your description into a scene plan, then shoots one still per image scene. Everything is generated and encoded on this device."
                      : "No AI binding detected, so the built-in planner is used and shots render as generated fields. Films are still made, start to finish."}
                  </div>

                  {story ? (
                    <>
                      <div style={{ marginTop: 20, borderTop: "1px solid var(--edge2)", paddingTop: 16 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.2em", color: "var(--green)", textTransform: "uppercase" }}>
                            {via === "ai" ? "planned by model" : "planned by rules"}
                          </div>
                          <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)" }}>
                            {preview(story)}
                          </div>
                        </div>
                        <div style={{ fontFamily: "var(--display)", fontSize: 19, marginTop: 8, color: "var(--white)" }}>
                          {story.title}
                        </div>
                        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)", marginTop: 6, lineHeight: 1.6 }}>
                          {story.logline}
                        </div>
                      </div>

                      <div style={{ marginTop: 16 }}>
                        {story.scenes.map((sc, i) => (
                          <div
                            key={i}
                            style={{
                              display: "flex",
                              gap: 10,
                              alignItems: "baseline",
                              padding: "8px 0",
                              borderBottom: "1px solid var(--edge2)",
                            }}
                          >
                            <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--dim)", width: 18 }}>
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: 9.5,
                                letterSpacing: "0.14em",
                                textTransform: "uppercase",
                                color: sc.kind === "image" ? "#63B3FF" : sc.kind === "logo" ? "var(--green)" : "var(--muted)",
                                width: 44,
                              }}
                            >
                              {sc.kind}
                            </span>
                            <span style={{ flex: 1, fontFamily: "var(--mono)", fontSize: 10, color: "var(--muted)", lineHeight: 1.5 }}>
                              {sc.kind === "image" ? (sc.caption || "shot") : sc.kind === "type" ? (sc.headline || "").replace("\n", " ") : sc.kind === "stat" ? `${sc.hero} ${sc.unit || ""}` : "end card"}
                            </span>
                            <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--dim)" }}>{sc.seconds.toFixed(1)}s</span>
                          </div>
                        ))}
                      </div>

                      <button className="btn ghost" style={{ marginTop: 16 }} onClick={shoot} disabled={phase === "shooting"}>
                        {phase === "shooting" ? `shooting ${shotP.done}/${shotP.total}` : "shoot the scenes"}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </div>

            <div>
              <div className="stage">
                <div className="stage-bar">
                  <span>preview · 720 × 1280</span>
                  <span style={{ color: story ? "var(--green)" : "var(--dim)" }}>
                    {phase === "shooting" ? `shoot ${shotP.done}/${shotP.total}` : story ? `${story.scenes.length} scenes` : "no plan yet"}
                  </span>
                </div>

                <div className="stage-inner" style={{ width: 300, height: 533 }}>
                  {story ? (
                    <Player
                      key={`${story.title}-${Object.keys(footage).length}`}
                      component={StoryFilm}
                      inputProps={{ ...story, footage }}
                      durationInFrames={Math.max(1, Math.round(totalSeconds(story) * FREE.fps))}
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
                  ) : (
                    <div
                      style={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "var(--dim)",
                        fontFamily: "var(--mono)",
                        fontSize: 10,
                        letterSpacing: "0.2em",
                        textTransform: "uppercase",
                        padding: 24,
                        textAlign: "center",
                        lineHeight: 1.9,
                      }}
                    >
                      describe a film, then plan it
                    </div>
                  )}
                </div>

                <div style={{ width: 300, marginTop: 22 }}>
                  {story ? (
                    <button
                      className="btn"
                      onClick={() =>
                        exportStory(story, footage, setBusy, setProgress, setMsg, ledger, setLedger, null)
                      }
                      disabled={busy}
                    >
                      {busy ? "encoding…" : "render mp4"}
                    </button>
                  ) : null}
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
                  {phase === "shooting" ? (
                    <div className="progress">
                      <div className="progress-label">
                        <span>flux</span>
                        <span>{shotP.done}/{shotP.total} stills</span>
                      </div>
                      <div className="progress-track">
                        <i style={{ width: `${shotP.total ? (shotP.done / shotP.total) * 100 : 0}%` }} />
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* ------------------------------------------- the agent's work */}
              <div className="panel" style={{ marginTop: 18 }}>
                <div className="panel-head">
                  <h3>what the agent did</h3>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>
                    {trace.length ? `${trace.length} steps` : "idle"}
                  </span>
                </div>
                <div className="panel-body" style={{ padding: "14px 18px 18px" }}>
                  {trace.length === 0 ? (
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.12em", color: "var(--dim)", lineHeight: 1.9 }}>
                      It plans, shoots, looks at each frame, judges it, and reshoots what fails.
                      Press play on the plan to watch it work.
                    </div>
                  ) : (
                    <div style={{ maxHeight: 260, overflowY: "auto" }}>
                      {trace.map((t, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "flex-start",
                            padding: "6px 0",
                            borderBottom: "1px solid var(--edge2)",
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              marginTop: 5,
                              flex: "0 0 6px",
                              background: t.ok === false ? "#FFB020" : t.kind === "fix" ? "#FF3D6E" : "var(--green)",
                            }}
                          />
                          <span style={{ flex: 1, minWidth: 0 }}>
                            <span
                              style={{
                                fontFamily: "var(--mono)",
                                fontSize: 10,
                                letterSpacing: "0.1em",
                                color: t.ok === false ? "#FFB020" : "var(--white)",
                              }}
                            >
                              {t.label}
                            </span>
                            {t.detail ? (
                              <span
                                style={{
                                  display: "block",
                                  fontFamily: "var(--mono)",
                                  fontSize: 9.5,
                                  color: "var(--muted)",
                                  lineHeight: 1.55,
                                  marginTop: 2,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {t.detail}
                              </span>
                            ) : null}
                          </span>
                          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--dim)", flex: "0 0 auto" }}>
                            {t.ms ? `${t.ms}ms` : t.kind}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <label
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      fontFamily: "var(--mono)",
                      fontSize: 10,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                      marginTop: 14,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={reviewOn}
                      onChange={(e) => setReviewOn(e.target.checked)}
                      style={{ accentColor: "#00FF88" }}
                    />
                    critic reviews each shot
                  </label>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--dim)", lineHeight: 1.6, marginTop: 6 }}>
                    Reviewing costs an extra model call per shot and roughly doubles neurons.
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "generate" ? (
          <section className="grid">
            {/* --------------------------------------------------- controls */}
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
                    No card, no signup. Limits are enforced in the studio, not in the fine print.
                  </div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h3>describe the film</h3>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>
                    picks a design
                  </span>
                </div>
                <div className="panel-body">
                  <Field label="your brief" value={prompt} onChange={setPrompt} area max={400} />
                  <Row style={{ marginBottom: 14 }}>
                    <button className="btn" style={{ flex: 1 }} onClick={() => regenerate(prompt)}>
                      compile brief
                    </button>
                  </Row>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {EXAMPLES.map((e) => (
                      <button
                        key={e.label}
                        className="chip"
                        onClick={() => regenerate(e.text)}
                        style={{
                          background: "transparent",
                          border: "1px solid var(--edge)",
                          color: "var(--muted)",
                          fontFamily: "var(--mono)",
                          fontSize: 10,
                          letterSpacing: "0.14em",
                          textTransform: "uppercase",
                          padding: "7px 11px",
                          cursor: "pointer",
                        }}
                      >
                        {e.label}
                      </button>
                    ))}
                  </div>
                  <div className="notice">
                    The brief is parsed on your device: numbers, units, the headline, the accent. No key,
                    no network call, and the same words always give the same film.
                  </div>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------- preview */}
            <div>
              <div className="stage">
                <div className="stage-bar">
                  <span>preview · 720 × 1280 · 30 fps</span>
                  <span style={{ color: blocked ? "#FFB020" : "var(--green)" }}>
                    {busy ? `rendering ${Math.round(progress * 100)}%` : blocked ? "trial exhausted" : design.name}
                  </span>
                </div>

                <div className="stage-inner" style={{ width: 300, height: 533 }}>
                  <Player
                    key={`${brief.design}-${frames}`}
                    component={Film}
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

              {/* -------------------------------------------------- designs */}
              <div className="panel" style={{ marginTop: 18 }}>
                <div className="panel-head">
                  <h3>design system</h3>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>
                    {desigHint(prompt)}
                  </span>
                </div>
                <div className="panel-body">
                  <div className="models">
                    {DESIGNS.map((d) => (
                      <button
                        key={d.id}
                        className="model"
                        data-on={brief.design === d.id}
                        onClick={() => set("design", d.id as DesignId)}
                      >
                        <span style={{ maxWidth: "75%" }}>
                          <div className="model-name">{d.name}</div>
                          <div className="model-meta" style={{ lineHeight: 1.5, letterSpacing: "0.04em" }}>
                            {d.blurb}
                          </div>
                        </span>
                        <span className={`model-tag ${brief.design === d.id ? "open" : "lock"}`}>
                          {brief.design === d.id ? "live" : "use"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    className="btn ghost"
                    style={{ marginTop: 12 }}
                    onClick={() => set("design", pickDesign(prompt + Math.random().toString(36).slice(2, 6)))}
                  >
                    surprise me
                  </button>
                </div>
              </div>

              {/* ---------------------------------------------------- brief */}
              <div className="panel" style={{ marginTop: 18 }}>
                <div className="panel-head">
                  <h3>the film</h3>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>
                    edits apply live
                  </span>
                </div>
                <div className="panel-body">
                  <Row>
                    <Field label="kicker" value={brief.kicker} onChange={(v) => set("kicker", v)} max={32} />
                    <Field label="cta" value={brief.cta} onChange={(v) => set("cta", v)} max={32} />
                  </Row>
                  <Field label="headline (line break allowed)" value={brief.headline} onChange={(v) => set("headline", v)} area max={70} />
                  <Row>
                    <Field label="hero number" value={brief.hero} onChange={(v) => set("hero", v)} max={12} />
                    <Field label="unit" value={brief.unit} onChange={(v) => set("unit", v)} max={10} />
                  </Row>
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
                    {["#00FF88", "#2E7CFF", "#63B3FF", "#FF3D6E", "#FFB020", "#B48CFF"].map((c) => (
                      <button
                        key={c}
                        aria-label={c}
                        onClick={() => set("accent", c)}
                        style={{
                          width: 28,
                          height: 28,
                          background: c,
                          border: brief.accent === c ? `2px solid #fff` : "1px solid rgba(120,200,255,0.2)",
                          outline: brief.accent === c ? `2px solid ${c}` : "none",
                          outlineOffset: 2,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
          /* ------------------------------------------------------- overlay */
          <section className="grid">
            <div>
              <div className="panel">
                <div className="panel-head">
                  <h3>source clip</h3>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>
                    stays on your device
                  </span>
                </div>
                <div className="panel-body">
                  <label
                    style={{
                      display: "block",
                      border: "1px dashed rgba(120,200,255,0.3)",
                      padding: "38px 20px",
                      textAlign: "center",
                      cursor: "pointer",
                      background: clip ? "rgba(0,255,136,0.05)" : "transparent",
                      borderColor: clip ? "rgba(0,255,136,0.5)" : undefined,
                    }}
                  >
                    <input
                      type="file"
                      accept="video/*"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const f = e.target.files?.[0] || null;
                        setClip(f);
                        setMsg({ kind: "", text: "" });
                      }}
                    />
                    <div style={{ fontFamily: "var(--mono)", fontSize: 11, letterSpacing: "0.2em", textTransform: "uppercase", color: clip ? "var(--green)" : "var(--muted)" }}>
                      {clip ? clip.name : "choose a video file"}
                    </div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--dim)", marginTop: 10 }}>
                      {clip ? `${(clip.size / 1048576).toFixed(1)} MB` : "mp4 · mov · webm — nothing is uploaded"}
                    </div>
                  </label>

                  <div className="notice">
                    The clip plays in a hidden element, each frame is redrawn with the graphics composited
                    on top, and the browser records the result. It never leaves this machine.
                  </div>
                </div>
              </div>

              <div className="panel" style={{ marginTop: 18 }}>
                <div className="panel-head">
                  <h3>graphics</h3>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", color: "var(--dim)" }}>
                    composited over the clip
                  </span>
                </div>
                <div className="panel-body">
                  <div className="models">
                    {([
                      ["lower-third", "Lower third", "Name plate at 72% height, accent edge."],
                      ["title", "Title card", "Full-width band across the middle."],
                      ["hud", "HUD rail", "Corner marks, a data rail, progress bar."],
                    ] as const).map(([id, name, blurb]) => (
                      <button
                        key={id}
                        className="model"
                        data-on={ov.layout === id}
                        onClick={() => setOv({ ...ov, layout: id })}
                      >
                        <span style={{ maxWidth: "75%" }}>
                          <div className="model-name">{name}</div>
                          <div className="model-meta" style={{ lineHeight: 1.5, letterSpacing: "0.04em" }}>
                            {blurb}
                          </div>
                        </span>
                        <span className={`model-tag ${ov.layout === id ? "open" : "lock"}`}>
                          {ov.layout === id ? "live" : "use"}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div style={{ marginTop: 18 }}>
                    <Row>
                      <Field label="kicker" value={ov.kicker} onChange={(v) => setOv({ ...ov, kicker: v })} max={30} />
                      <Field label="cta" value={ov.cta} onChange={(v) => setOv({ ...ov, cta: v })} max={30} />
                    </Row>
                    <Field label="headline" value={ov.headline} onChange={(v) => setOv({ ...ov, headline: v })} max={40} area />
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14, justifyContent: "space-between" }}>
                      <div style={{ display: "flex", gap: 8 }}>
                        {["#00FF88", "#2E7CFF", "#FFB020", "#FF3D6E"].map((c) => (
                          <button
                            key={c}
                            aria-label={c}
                            onClick={() => setOv({ ...ov, accent: c })}
                            style={{
                              width: 26,
                              height: 26,
                              background: c,
                              border: ov.accent === c ? "2px solid #fff" : "1px solid rgba(120,200,255,0.2)",
                              cursor: "pointer",
                              padding: 0,
                            }}
                          />
                        ))}
                      </div>
                      <label style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--muted)", display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={ov.brand}
                          onChange={(e) => setOv({ ...ov, brand: e.target.checked })}
                          style={{ accentColor: "#00FF88" }}
                        />
                        corner mark
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="stage">
                <div className="stage-bar">
                  <span>{clip ? "ready" : "waiting for a clip"}</span>
                  <span style={{ color: ovBusy ? "var(--green)" : "var(--dim)" }}>
                    {ovBusy ? `writing ${Math.round(ovP * 100)}%` : "media recorder"}
                  </span>
                </div>

                <div
                  style={{
                    width: 300,
                    aspectRatio: "9 / 16",
                    border: "1px solid var(--edge)",
                    background: "#04080F",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--dim)",
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    letterSpacing: "0.2em",
                    textTransform: "uppercase",
                    textAlign: "center",
                    padding: 20,
                    lineHeight: 1.9,
                  }}
                >
                  {clip ? "processed in real time — a 30 s clip takes 30 s" : "no clip selected"}
                </div>

                <div style={{ width: 300, marginTop: 22 }}>
                  <button className="btn" onClick={runOverlay} disabled={!clip || ovBusy}>
                    {ovBusy ? "compositing…" : "produce file"}
                  </button>
                  {ovBusy ? (
                    <div className="progress">
                      <div className="progress-label">
                        <span>recording</span>
                        <span>{Math.round(ovP * 100)}%</span>
                      </div>
                      <div className="progress-track">
                        <i style={{ width: `${ovP * 100}%` }} />
                      </div>
                    </div>
                  ) : null}
                  {msg.text ? <div className={`notice ${msg.kind}`}>{msg.text}</div> : null}
                  <div className="notice">
                    Output is MP4 where the browser supports it, WebM otherwise. Playback is real time, so
                    keep the tab in front while it records.
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ---------------------------------------------------------- plans */}
        <section className="plans">
          <div className="plans-head">
            <h2>Plans</h2>
            <span>one engine · six designs · four models · paid tiers closed during beta</span>
          </div>
          <div className="plan-grid">
            {PLANS.map((p) => {
              const isFree = p.price === 0;
              return (
                <div key={p.name} className={`plan ${isFree ? "free" : "lock"}`}>
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

          <div className="notice" style={{ marginTop: 26, maxWidth: 860 }}>
            Every export is encoded on your own machine, which is why the beta can be free without a queue
            and without a card. Paid tiers are listed so you can see exactly where the limits will sit —
            none of them are purchasable yet.
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

/**
 * Story export. Credits are spent only when the encoder actually finishes, so a
 * failed render never charges the trial.
 */
const exportStory = async (
  story: Storyboard,
  footage: Record<string, string>,
  setBusy: (b: boolean) => void,
  setProgress: (p: number) => void,
  setMsg: (m: { kind: "ok" | "warn" | ""; text: string }) => void,
  ledger: Ledger,
  setLedger: (l: Ledger) => void,
  _core: unknown,
) => {
  setBusy(true);
  setProgress(0);
  setMsg({ kind: "", text: "" });
  try {
    const frames = Math.max(1, Math.round(totalSeconds(story) * FREE.fps));
    const res = await renderMediaOnWeb({
      composition: {
        id: "NexusStory",
        component: StoryFilm,
        width: FREE.width,
        height: FREE.height,
        fps: FREE.fps,
        durationInFrames: frames,
        defaultProps: { ...story, footage },
      },
      inputProps: { ...story, footage },
      container: "mp4",
      videoCodec: "h264",
      videoBitrate: "high",
      onProgress: (p) => setProgress(p.progress),
    });
    const blob = await res.getBlob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `nexus-story-${Date.now()}.mp4`;
    a.click();
    const next = { used: ledger.used + Math.round(totalSeconds(story)), renders: ledger.renders + 1 };
    setLedger(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    setMsg({ kind: "ok", text: `Rendered · ${(blob.size / 1048576).toFixed(1)} MB · ${story.scenes.length} scenes.` });
  } catch (e) {
    setMsg({ kind: "warn", text: `Render failed: ${(e as Error).message}` });
  } finally {
    setBusy(false);
  }
};

const desigHint = (prompt: string) => {
  const d = pickDesign(prompt);
  return `auto → ${designById(d).name.toLowerCase()}`;
};

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
