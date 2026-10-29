/**
 * STORY FILM — a sequence of scenes with its own arc.
 *
 * Each scene has one job. Image scenes carry a generated still with camera
 * movement (Ken Burns), type scenes hand over to one of the six design systems,
 * stat scenes hold a single number, and the logo closes.
 *
 * The footage is passed in as a map of scene index → image URL. If a still is
 * missing the scene still renders — as a generated gradient field — so a failed
 * generation never produces a broken film.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Storyboard, Scene as SceneT, totalSeconds } from "./story";
import { designById } from "./registry";
import { Grain, Mark, MONO, DISP, DW, DH, rgba, clamp, win, hash, PAD, mix } from "./kit";
import { Grade, cutState, incoming, display, EASE } from "./craft";

export type StoryProps = Storyboard & {
  /** scene index → image url (data: or remote) */
  footage?: Record<string, string>;
  probe?: string;
};

/* -------------------------------------------------------------------------- */

/** slow camera move over a still — the thing that makes a photo feel shot */
const KenBurns: React.FC<{
  src?: string;
  motion: NonNullable<SceneT["motion"]>;
  p: number;
  accent: string;
  seed: number;
}> = ({ src, motion, p, accent, seed }) => {
  const s = 1.06 + 0.1 * p;
  const tx = motion === "pan-left" ? -3.4 * p * 100 : motion === "pan-right" ? 3.4 * p * 100 : 0;
  const ty = motion === "in" ? 1.6 * p * 100 : motion === "out" ? -1.6 * p * 100 : 0;
  const scale = motion === "out" ? 1.16 - 0.1 * p : s;

  return (
    <AbsoluteFill style={{ overflow: "hidden", background: "#05080D" }}>
      {src ? (
        <img
          src={src}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${scale}) translate(${tx / 10}%, ${ty / 10}%)`,
            transformOrigin: "50% 50%",
            filter: "saturate(0.92) contrast(1.06)",
          }}
        />
      ) : (
        /* no still yet: a field in the accent, so the cut still works */
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `radial-gradient(ellipse 90% 70% at ${20 + (seed % 5) * 15}% ${30 + (seed % 3) * 12}%, ${rgba(
              accent,
              0.34,
            )} 0%, rgba(5,8,13,0) 62%), linear-gradient(160deg, #071019, #04070C 70%)`,
          }}
        />
      )}
      {/* grade: a vignette and a faint accent wash keep every shot in the same film */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 34%, rgba(0,0,0,0.52) 82%),
                       linear-gradient(180deg, ${rgba(accent, 0.06)}, rgba(0,0,0,0) 40%, rgba(0,0,0,0.34))`,
        }}
      />
    </AbsoluteFill>
  );
};

const Caption: React.FC<{ text: string; on: number; accent: string }> = ({ text, on, accent }) => (
  <div
    style={{
      position: "absolute",
      left: PAD,
      bottom: 150,
      display: "flex",
      alignItems: "center",
      gap: 14,
      opacity: on,
      transform: `translateY(${(1 - on) * 14}px)`,
    }}
  >
    <div style={{ width: 34, height: 1, background: accent, opacity: 0.8 }} />
    <div
      style={{
        fontFamily: MONO,
        fontSize: 20,
        letterSpacing: "0.3em",
        color: "#FFFFFF",
        textTransform: "uppercase",
        textShadow: "0 2px 18px rgba(0,0,0,0.8)",
      }}
    >
      {text}
    </div>
  </div>
);

/* -------------------------------------------------------------------------- */

const SceneBody: React.FC<{
  scene: SceneT;
  index: number;
  progress: number;
  accent: string;
  cta: string;
  footage?: Record<string, string>;
}> = ({ scene, index, progress, accent, cta, footage }) => {
  if (scene.kind === "image") {
    return (
      <>
        <KenBurns src={footage?.[String(index)]} motion={scene.motion || "in"} p={progress} accent={accent} seed={index} />
        {scene.caption ? <Caption text={scene.caption} on={win(progress * 100, 12, 34)} accent={accent} /> : null}
      </>
    );
  }

  if (scene.kind === "type") {
    /* hand this beat to a real design system, fed the scene's own copy */
    const Design = designById(scene.design || "kinetic").Scene;
    return (
      <AbsoluteFill style={{ background: "#050B14" }}>
        <Design
          kicker={scene.kicker || ""}
          headline={scene.headline || ""}
          hero={scene.hero || ""}
          unit={scene.unit || ""}
          sub={scene.sub || ""}
          cta={cta}
          accent={accent}
          tier="core"
          design={scene.design || "kinetic"}
        />
      </AbsoluteFill>
    );
  }

  if (scene.kind === "stat") {
    const on = win(progress * 100, 8, 26);
    return (
      <AbsoluteFill
        style={{
          background: `linear-gradient(160deg, #071019, #04070C 68%), radial-gradient(ellipse 70% 50% at 30% 40%, ${rgba(accent, 0.16)}, transparent 62%)`,
          display: "flex",
          justifyContent: "center",
          paddingLeft: PAD,
          paddingRight: PAD,
          flexDirection: "column",
        }}
      >
        <div
          style={{
            fontFamily: DISP,
            ...display(300, 0.9),
            fontWeight: 700,
            color: accent,
            fontVariantNumeric: "tabular-nums",
            opacity: on,
            transform: `translateY(${(1 - on) * 30}px)`,
          }}
        >
          {scene.hero}
          <span style={{ fontSize: 62, marginLeft: 18, letterSpacing: "0.06em", opacity: 0.8 }}>{scene.unit}</span>
        </div>
        <div
          style={{
            marginTop: 34,
            height: 1,
            background: rgba(accent, 0.5),
            opacity: on,
          }}
        />
        <div
          style={{
            marginTop: 26,
            fontFamily: MONO,
            fontSize: 24,
            letterSpacing: "0.12em",
            color: "#9FB2C6",
            maxWidth: 760,
            lineHeight: 1.5,
            opacity: win(progress * 100, 20, 40),
          }}
        >
          {scene.label}
        </div>
      </AbsoluteFill>
    );
  }

  /* logo */
  const on = win(progress * 100, 4, 20);
  return (
    <AbsoluteFill
      style={{
        background: "#04070C",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 28,
      }}
    >
      <div style={{ opacity: on }}>
        <Mark size={132} color={accent} stroke={11} />
      </div>
      <div
        style={{
          fontFamily: DISP,
          fontSize: 84,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: "#FFFFFF",
          opacity: win(progress * 100, 10, 26),
        }}
      >
        VITO BYTE
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 18,
          letterSpacing: "0.6em",
          color: rgba("#FFFFFF", 0.35),
          textTransform: "uppercase",
          marginTop: -14,
          opacity: win(progress * 100, 16, 32),
        }}
      >
        studio
      </div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 25,
          letterSpacing: "0.2em",
          color: "#04120A",
          background: accent,
          padding: "17px 38px",
          marginTop: 18,
          opacity: win(progress * 100, 24, 40),
        }}
      >
        {cta}
      </div>
    </AbsoluteFill>
  );
};

/* -------------------------------------------------------------------------- */

export const StoryFilm: React.FC<StoryProps> = ({ scenes, accent, cta, footage }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();

  /* scene boundaries in frames */
  let acc = 0;
  const marks = scenes.map((s) => {
    const start = acc;
    const len = Math.max(1, Math.round(s.seconds * fps));
    acc += len;
    return { start, len };
  });

  const idx = Math.min(
    scenes.length - 1,
    Math.max(0, marks.findIndex((m) => f >= m.start && f < m.start + m.len)),
  );
  const cur = scenes[idx] || scenes[0];
  const m = marks[idx] || { start: 0, len: 1 };
  const progress = clamp((f - m.start) / m.len);

  /* the cut: the outgoing scene is transformed away by the incoming one */
  const into = f - m.start;
  const prevIdx = idx - 1;
  const outState = prevIdx >= 0 ? cutState(scenes[prevIdx].transition, into, m.len) : null;
  const inAmount = prevIdx >= 0 ? incoming(scenes[prevIdx].transition, into, m.len) : 1;

  return (
    <AbsoluteFill style={{ background: "#04070C" }}>
      {/* outgoing frame, still moving, thrown by the cut */}
      {outState ? (
        <AbsoluteFill
          style={{
            opacity: outState.opacity,
            transform: outState.transform,
            filter: outState.filter,
          }}
        >
          <SceneBody
            scene={scenes[prevIdx]}
            index={prevIdx}
            progress={1}
            accent={accent}
            cta={cta}
            footage={footage}
          />
        </AbsoluteFill>
      ) : null}

      {/* incoming frame */}
      <AbsoluteFill
        style={{
          opacity: inAmount,
          transform: inAmount < 1 ? `scale(${1.04 - 0.04 * inAmount})` : undefined,
        }}
      >
        <SceneBody scene={cur} index={idx} progress={progress} accent={accent} cta={cta} footage={footage} />
      </AbsoluteFill>

      <Grade f={f} accent={accent} amount={0.9} vignette={0.5} />
    </AbsoluteFill>
  );
};

export const storyFrames = (s: Storyboard, fps: number) => Math.round(totalSeconds(s) * fps);
