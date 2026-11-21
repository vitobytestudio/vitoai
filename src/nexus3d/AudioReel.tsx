import React from "react";
import { Audio, Sequence, staticFile } from "remotion";

/**
 * Cue sheet. Frames are the same constants Reel.tsx cuts on, so picture and
 * sound cannot drift apart: a whip and its whoosh are the same frame number.
 */

type Cue = { f: number; src: string; v: number; dur?: number };

const CUES: Cue[] = [
  // 01 warp
  { f: 0, src: "rl_boom.wav", v: 0.5 },
  { f: 2, src: "rl_riser.wav", v: 0.6, dur: 70 },
  // 02 title
  { f: 66, src: "rl_impact.wav", v: 0.8 },
  { f: 68, src: "rl_whoosh.wav", v: 0.35 },
  { f: 92, src: "rl_tick.wav", v: 0.3 },
  // 03 wall
  { f: 168, src: "rl_whoosh.wav", v: 0.5 },
  { f: 176, src: "rl_impact.wav", v: 0.45 },
  { f: 196, src: "rl_tick.wav", v: 0.28 },
  { f: 232, src: "rl_tick.wav", v: 0.24 },
  // 04 orbit
  { f: 288, src: "rl_whoosh.wav", v: 0.45 },
  { f: 300, src: "rl_riser.wav", v: 0.4, dur: 60 },
  // 05 swarm
  { f: 408, src: "rl_impact.wav", v: 0.6 },
  { f: 420, src: "rl_riser.wav", v: 0.35, dur: 60 },
  { f: 452, src: "rl_tick.wav", v: 0.3 },
  // 06 breach
  { f: 528, src: "rl_impact.wav", v: 0.95 },
  { f: 530, src: "rl_glitch.wav", v: 0.7 },
  { f: 566, src: "rl_boom.wav", v: 0.85 },
  { f: 600, src: "rl_glitch.wav", v: 0.4 },
  // 07 heal
  { f: 648, src: "rl_shimmer.wav", v: 0.85 },
  { f: 656, src: "rl_whoosh.wav", v: 0.3 },
  // 08 scale
  { f: 756, src: "rl_impact.wav", v: 0.55 },
  ...Array.from({ length: 3 }, (_, i) => ({ f: 768 + i * 22, src: "rl_tick.wav", v: 0.33 })),
  // 09 resolve
  { f: 900, src: "rl_boom.wav", v: 1.0 },
  { f: 948, src: "rl_shimmer.wav", v: 0.5 },
  { f: 986, src: "rl_tick.wav", v: 0.3 },
];

const BED = 0.62;

const duck = (f: number) => {
  let target = BED;
  const dip = (c: number, d: number, w: number) => {
    const x = Math.abs(f - c) / w;
    if (x < 1) target = Math.min(target, BED * (1 - d * (1 - x) * (1 - x)));
  };
  dip(4, 0.5, 34);
  dip(68, 0.5, 30);
  dip(172, 0.35, 26);
  dip(292, 0.3, 24);
  dip(412, 0.4, 28);
  dip(532, 0.62, 40);
  dip(570, 0.45, 30);
  dip(652, 0.42, 34);
  dip(760, 0.32, 26);
  dip(904, 0.62, 46);
  return target;
};

export const AudioReel: React.FC<{ frame: number; fps: number }> = ({ frame }) => (
  <>
    <Audio src={staticFile("audio/rl_bed.wav")} volume={duck(frame)} />
    {CUES.map((c, i) => (
      <Sequence key={`${c.src}-${c.f}-${i}`} from={c.f} durationInFrames={c.dur ?? Math.ceil(2.8 * 30)}>
        <Audio src={staticFile(`audio/${c.src}`)} volume={c.v} />
      </Sequence>
    ))}
  </>
);
