import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { BEAT } from "./palette";

/**
 * Cue sheet. Every `f` below is the same constant Reel/VitoFilm cuts on, so a
 * sound can never arrive a beat late.
 */

type Cue = { f: number; src: string; v: number; dur?: number };

const CUES: Cue[] = [
  // boot
  { f: 0, src: "vt_boot.wav", v: 0.55 },
  { f: 26, src: "vt_type.wav", v: 0.22, dur: 110 },
  { f: 128, src: "vt_lock.wav", v: 0.5 },
  // servers
  { f: BEAT.servers[0], src: "vt_hit.wav", v: 0.7 },
  { f: BEAT.servers[0] + 48, src: "vt_rack.wav", v: 0.35, dur: 90 },
  { f: 330, src: "vt_blip.wav", v: 0.3 },
  // agents
  { f: BEAT.agents[0], src: "vt_hit.wav", v: 0.65 },
  { f: BEAT.agents[0] + 40, src: "vt_type.wav", v: 0.26, dur: 120 },
  { f: 620, src: "vt_lock.wav", v: 0.4 },
  // edge
  { f: BEAT.edge[0], src: "vt_hit.wav", v: 0.6 },
  { f: 806, src: "vt_scan.wav", v: 0.4, dur: 120 },
  { f: 850, src: "vt_lock.wav", v: 0.55 },
  // cicd
  { f: BEAT.cicd[0], src: "vt_hit.wav", v: 0.7 },
  ...Array.from({ length: 6 }, (_, i) => ({ f: 1066 + i * 26 + 14, src: "vt_blip.wav", v: 0.3 })),
  { f: 1180, src: "vt_lock.wav", v: 0.45 },
  // systems
  { f: BEAT.systems[0], src: "vt_hit.wav", v: 0.65 },
  ...Array.from({ length: 3 }, (_, i) => ({ f: 1300 + i * 16 + 16, src: "vt_blip.wav", v: 0.26 })),
  // cta
  { f: BEAT.cta[0], src: "vt_boom.wav", v: 0.72 },
  { f: 1596, src: "vt_shimmer.wav", v: 0.5 },
  { f: 1650, src: "vt_lock.wav", v: 0.42 },
];

const BED = 0.6;

const duck = (f: number) => {
  let t = BED;
  const dip = (c: number, d: number, w: number) => {
    const x = Math.abs(f - c) / w;
    if (x < 1) t = Math.min(t, BED * (1 - d * (1 - x) * (1 - x)));
  };
  dip(4, 0.45, 30);
  dip(210, 0.4, 34);
  dip(480, 0.36, 30);
  dip(750, 0.34, 30);
  dip(1020, 0.4, 34);
  dip(1260, 0.34, 30);
  dip(1530, 0.6, 50);
  dip(1600, 0.4, 40);
  return t;
};

export const AudioVito: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    <Audio src={staticFile("audio/vt_bed.wav")} volume={duck(frame)} />
    {CUES.map((c, i) => (
      <Sequence key={`${c.src}-${c.f}-${i}`} from={c.f} durationInFrames={c.dur ?? 90}>
        <Audio src={staticFile(`audio/${c.src}`)} volume={c.v} />
      </Sequence>
    ))}
  </>
);
