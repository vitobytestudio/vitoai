/**
 * The Remotion wrapper.
 *
 * Almost no logic lives here on purpose: the frame is drawn by art.tsx, which is
 * a pure function of time. This file only supplies the clock and the audio, so
 * the preview and the export cannot disagree about what the film looks like.
 */
import React from "react";
import { AbsoluteFill, Audio, useCurrentFrame } from "remotion";
import type { Decision } from "./brain";
import { FilmFrame } from "./art";

export type VitoProps = { decision: Decision; score?: string };

export const VitoFilm: React.FC<VitoProps> = ({ decision, score }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ background: "#05080c" }}>
      <FilmFrame plan={decision} frame={f} w={1080} h={1920} />
      {score && score.length > 32 ? <Audio src={score} /> : null}
    </AbsoluteFill>
  );
};

export const framesFor = (d: Decision, fps = 30) => Math.max(1, Math.round(d.seconds * fps));
