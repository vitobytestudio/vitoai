/**
 * THE STUDIO — where a sentence becomes a film.
 *
 * This file is the tool, not the site: no navigation, no marketing, no footer.
 * It is mounted on /studio by the shell, and everything here is about one loop:
 * write → watch → download → read what the agent decided.
 *
 * Performance rules that must not regress:
 *   · nothing heavy is imported at module level; the encoder is a dynamic import
 *   · the film appears the instant the plan does, before the director answers
 *   · the soundtrack is built while the browser is idle, never during a click
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { think, summarise, demoFilm, type Decision } from "../src/studio/brain";
import { buildScore } from "../src/studio/score";
import { Preview, BeatPoster } from "./preview";
import { direct } from "./director";
import { chooseArch } from "../src/studio/art";
import { type Lang } from "./i18n";
import { Link } from "./router";

const FREE = { renders: 3, seconds: 30 };
const KEY = "nexus.trial.v1";

const TOOL: Record<Lang, Record<string, string>> = {
  en: {
    thinking: "reading",
    writing: "directing",
    create: "Create",
    music: "music",
    narration: "narration",
    place: "Describe the film… e.g. a premium edit for a fashion collection in Paris, with the project plan and cars at night",
    examples: "Try one",
    download: "Download MP4",
    rendering: "rendering",
    limit: "Trial limit reached",
    soundOn: "sound on",
    soundOff: "sound off",
    directed: "directed",
    planned: "planned",
    direction: "Art direction",
    concept: "concept",
    beats: "beats · page architecture",
    refused: "refused",
    why: "why",
    fine: "1080 × 1920 · 30 fps · H.264 + AAC · encoded on this device",
    left: "of",
    films: "films left",
    written: "written by the planner · the director did not answer",
    ready: "Ready",
    secs: "s",
    withSound: "with sound",
  },
  fr: {
    thinking: "lecture",
    writing: "réalisation",
    create: "Créer",
    music: "musique",
    narration: "voix",
    place: "Décrivez le film… ex. un montage premium pour une collection à Paris, avec le plan du projet et des voitures la nuit",
    examples: "Essayez",
    download: "Télécharger le MP4",
    rendering: "rendu",
    limit: "Limite de l'essai atteinte",
    soundOn: "son actif",
    soundOff: "son coupé",
    directed: "réalisé",
    planned: "planifié",
    direction: "Direction artistique",
    concept: "concept",
    beats: "temps · architecture de page",
    refused: "refusé",
    why: "pourquoi",
    fine: "1080 × 1920 · 30 i/s · H.264 + AAC · encodé sur cet appareil",
    left: "sur",
    films: "films restants",
    written: "écrit par le planificateur · le réalisateur n'a pas répondu",
    ready: "Prêt",
    secs: "s",
    withSound: "avec son",
  },
  ar: {
    thinking: "يقرأ",
    writing: "يُخرج",
    create: "أنشئ",
    music: "موسيقى",
    narration: "تعليق صوتي",
    place: "صف الفيلم… مثال: مونتاج بريميوم لمجموعة أزياء في باريس، مع مخطط المشروع وسيارات في الليل",
    examples: "جرّب واحداً",
    download: "نزّل الفيلم MP4",
    rendering: "يُرمّز",
    limit: "انتهت حصة التجربة",
    soundOn: "الصوت مفتوح",
    soundOff: "الصوت مغلق",
    directed: "بإخراج",
    planned: "بتخطيط",
    direction: "الإدارة الفنية",
    concept: "الفكرة",
    beats: "النبضات · معمارية الصفحة",
    refused: "ما رُفض",
    why: "لماذا",
    fine: "1080 × 1920 · ٣٠ إطاراً · H.264 + AAC · الترميز على جهازك",
    left: "من",
    films: "أفلام متبقية",
    written: "بتخطيط المحرّك · المخرج لم يجب",
    ready: "جاهز",
    secs: "ث",
    withSound: "بالصوت",
  },
};

const EXAMPLES: Record<Lang, string[]> = {
  en: [
    "a premium edit for a fashion collection in Paris",
    "a residential tower on the seafront",
    "a developer platform: review, release, ship",
  ],
  fr: [
    "un montage premium pour une collection à Paris",
    "une tour résidentielle face à la mer",
    "une plateforme pour développeurs : relire, livrer, publier",
  ],
  ar: [
    "مونتاج بريميوم لمجموعة أزياء في باريس",
    "مشروع سكني ببرج على الواجهة البحرية",
    "منصة مطورين: مراجعة، إصدار، نشر",
  ],
};

/**
 * What the studio shows before anything has been typed: three real beats of a
 * real film, each drawn by a different page architecture. A blank page with a
 * textbox is a template; this is evidence.
 */
const Empty: React.FC<{ lang: Lang }> = ({ lang }) => {
  const demo = useMemo(() => {
    try {
      return demoFilm(lang);
    } catch {
      return null;
    }
  }, [lang]);
  if (!demo) return null;

  // take the first three beats that each get a different page, and label them
  // from the page they actually got — never from a guess
  const seen = new Set<string>();
  const picks: number[] = [];
  demo.beats.forEach((_, i) => {
    const a = chooseArch(demo, i);
    if (picks.length < 3 && !seen.has(a) && demo.beats[i].kind !== "end") {
      seen.add(a);
      picks.push(i);
    }
  });
  const NAMES: Record<Lang, Record<string, string>> = {
    en: { stack: "a declaration", poster: "a place, stated", silent: "silence, held", index: "a contents page", grid: "evidence, in four", marquee: "momentum", metric: "a figure", diptych: "a considered line", caption: "reportage", editorial: "the argument" },
    fr: { stack: "une déclaration", poster: "un lieu, posé", silent: "le silence, tenu", index: "une page de sommaire", grid: "la preuve, en quatre", marquee: "l'élan", metric: "un chiffre", diptych: "une phrase posée", caption: "le reportage", editorial: "l'argument" },
    ar: { stack: "إعلان", poster: "مكان، بوضوح", silent: "صمت، ممسوك", index: "صفحة محتويات", grid: "الدليل، أربعاً", marquee: "اندفاع", metric: "رقم", diptych: "سطر مدروس", caption: "تقرير", editorial: "الحجة" },
  };
  const words: Record<Lang, { h: string; p: string; a: string[] }> = {
    en: {
      h: "Eleven pages, not one layout.",
      p: "Every beat is given the architecture that earns it, and two consecutive beats are never the same page. These three are from one film.",
      a: [],
    },
    fr: {
      h: "Onze pages, pas une maquette.",
      p: "Chaque temps reçoit l'architecture qu'il mérite, et deux temps consécutifs ne partagent jamais la même page. Ces trois viennent d'un même film.",
      a: [],
    },
    ar: {
      h: "إحدى عشرة صفحة، لا تخطيط واحد.",
      p: "تأخذ كل نبضة المعمارية التي تستحقها، ولا تتكرّر صفحة في نبضتين متتاليتين. هذه الثلاث من فيلم واحد.",
      a: [],
    },
  };
  const w = words[lang];

  return (
    <section className="empty">
      <div className="empty-head">
        <h2>{w.h}</h2>
        <p>{w.p}</p>
      </div>
      <div className="empty-row">
        {picks.map((i, n) => {
          const a = chooseArch(demo, i);
          return (
            <figure key={i} className="empty-cell">
              <div className="empty-frame">
                <BeatPoster plan={demo} index={i} width={230} frame={Math.max(48, Math.round(demo.beats[i].seconds * 30 * 0.55))} />
              </div>
              <figcaption>
                <span>{String(n + 1).padStart(2, "0")}</span>
                {NAMES[lang][a] || a}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
};

export const Tool: React.FC<{ lang: Lang }> = ({ lang }) => {
  const t = TOOL[lang];
  const [prompt, setPrompt] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [score, setScore] = useState("");
  const [phase, setPhase] = useState<"idle" | "thinking" | "ready" | "rendering" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState("");
  const [renders, setRenders] = useState(0);
  const [music, setMusic] = useState(true);
  const [narrate, setNarrate] = useState(true);
  const [writing, setWriting] = useState(false);
  const [sound, setSound] = useState(true);
  const [fatal, setFatal] = useState("");
  const area = useRef<HTMLTextAreaElement | null>(null);
  const result = useRef<HTMLDivElement | null>(null);
  const work = useRef<number | null>(null);

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

  const demoSeconds = useMemo(() => {
    const n = Number(new URLSearchParams(location.search).get("s"));
    return Number.isFinite(n) && n >= 3 && n <= 30 ? n : 28;
  }, []);

  const buildBed = useCallback((d: Decision) => {
    const run = () => {
      try {
        setScore(buildScore(d).url);
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

      work.current = window.setTimeout(() => {
        try {
          const opts = { seconds: demoSeconds, music, maxSeconds: FREE.seconds };
          const base = think(brief, opts);
          base.narration = narrate;
          setDecision(base);
          setScore("");
          setPhase("ready");
          buildBed(base);
          requestAnimationFrame(() => result.current?.scrollIntoView({ behavior: "smooth", block: "start" }));

          setWriting(true);
          void direct(brief, opts).then(({ decision: d, note: n }) => {
            setDecision(d);
            buildBed(d);
            setWriting(false);
            setNote(n);
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
      a.download = `nexus-${decision.subject}-${Date.now()}.mp4`;
      a.click();
      const next = renders + 1;
      setRenders(next);
      try {
        localStorage.setItem(KEY, JSON.stringify({ renders: next }));
      } catch {
        /* ignore */
      }
      setNote(`${t.ready} · ${(blob.size / 1048576).toFixed(1)} MB · ${decision.seconds}${t.secs} · ${t.withSound}`);
      setPhase("done");
    } catch (e) {
      setNote(`The encoder stopped: ${(e as Error).message || "no answer"}. Try again, or a larger screen.`);
      setPhase("ready");
    }
  };

  const archs = decision ? decision.beats.map((_, i) => chooseArch(decision, i)) : [];

  return (
    <div className="t">
      <div className="t-head">
        <p className="s-eyebrow">
          <span />
          {lang === "ar" ? "استوديو · فيلم رأسي" : lang === "fr" ? "studio · film vertical" : "studio · vertical film"}
        </p>
        <div className={`t-trial ${writing ? "live" : ""}`}>
          {writing ? t.writing : `${left} ${t.left} ${FREE.renders} ${t.films}`}
        </div>
      </div>

      <div className="s-compose">
        <textarea
          ref={area}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 400))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) create();
          }}
          placeholder={t.place}
          rows={3}
          spellCheck={false}
        />
        <div className="s-tools">
          <label className="s-sw">
            <input type="checkbox" checked={music} onChange={(e) => setMusic(e.target.checked)} />
            <i />
            {t.music}
          </label>
          <label className="s-sw">
            <input type="checkbox" checked={narrate} onChange={(e) => setNarrate(e.target.checked)} />
            <i />
            {t.narration}
          </label>
          <span className="s-count">{prompt.length}</span>
          <button className="s-go" onClick={() => create()} disabled={!prompt.trim() || phase === "thinking" || phase === "rendering"}>
            {phase === "thinking" ? t.thinking : t.create}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M1 7h11M7.5 2.5 12 7l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="s-chips">
        {EXAMPLES[lang].map((e) => (
          <button key={e} onClick={() => create(e)}>
            {e}
          </button>
        ))}
      </div>

      {fatal ? <p className="s-fatal">{fatal}</p> : null}

      {!decision ? <Empty lang={lang} /> : null}

      {decision ? (
        <section className="s-work" ref={result}>
          <div className="s-stage">
            <Preview plan={decision} width={400} score={score} sound={sound} />
            <div className="s-actions">
              <div className="s-meta">
                <button className={`s-pill ${sound ? "on" : ""}`} onClick={() => setSound((v) => !v)}>
                  {sound ? t.soundOn : t.soundOff}
                </button>
                <span className={`s-pill ${decision.by === "director" ? "on" : ""}`}>
                  {decision.by === "director" ? t.directed : t.planned}
                </span>
              </div>
              <button className="s-go wide" onClick={download} disabled={phase === "rendering" || left <= 0}>
                {phase === "rendering" ? `${t.rendering} ${Math.round(progress * 100)}%` : left > 0 ? t.download : t.limit}
              </button>
              {phase === "rendering" ? (
                <div className="s-prog">
                  <i style={{ width: `${progress * 100}%` }} />
                </div>
              ) : null}
              {note ? <p className="s-note">{note}</p> : null}
              <p className="s-fine">{t.fine}</p>
            </div>
          </div>

          <div className="s-direction">
            <div className="s-dir-head">
              <h2>{t.direction}</h2>
              <span>{summarise(decision)}</span>
            </div>

            <div className="s-concept">
              <span className="s-label">{t.concept}</span>
              <p>{decision.concept || decision.headline.replace(/\n/g, " ")}</p>
              <small>{decision.concept ? decision.headline.replace(/\n/g, " ") : decision.sub}</small>
            </div>

            <span className="s-label">{t.beats}</span>
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
                <span className="s-label">{t.refused}</span>
                <ul className="s-refused">
                  {decision.refused.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </>
            ) : null}

            <span className="s-label">{t.why}</span>
            <ul className="s-why">
              {decision.reasons.map((r, i) => (
                <li key={i}>
                  <b>{r.call}</b>
                  <span>{r.because}</span>
                </li>
              ))}
            </ul>

            <p className="t-beta">
              {lang === "ar"
                ? "هذه نسخة تجريبية. إن خرج الفيلم ضعيفاً،"
                : lang === "fr"
                  ? "Ceci est une bêta. Si le film est faible,"
                  : "This is a beta. If the film is weak,"}{" "}
              <Link to="/feedback">
                {lang === "ar" ? "أخبرنا." : lang === "fr" ? "dites-le-nous." : "tell us."}
              </Link>
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
};
