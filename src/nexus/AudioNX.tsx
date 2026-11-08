import React from "react";
import { Audio, Sequence, staticFile } from "remotion";
import { MOVE } from "./palette";

/**
 * SOUND
 * -----------------------------------------------------------------------------
 * Bed + cue sheet, both frame-locked. Every cue frame below is a picture event,
 * so the sound can never arrive late: the ignition hits on the frame the lattice
 * starts to grow, the threat stab on the frame the mesh turns red, the heal
 * bloom on the frames the repair front expands.
 */

type Cue = { f: number; src: string; v: number; dur?: number };

const CUES: Cue[] = [
  // ignite
  { f: 4, src: "nx_ignite.wav", v: 0.85 },
  { f: 26, src: "nx_rise.wav", v: 0.42 },
  // to globe
  { f: MOVE.globe[0], src: "nx_whoosh.wav", v: 0.34 },
  { f: MOVE.globe[0] + 30, src: "nx_rise.wav", v: 0.5 },
  // services — one tick per card
  ...Array.from({ length: 6 }, (_, i) => ({ f: MOVE.services[0] + 56 + i * 11, src: "nx_tick.wav", v: 0.34 })),
  { f: MOVE.services[0], src: "nx_whoosh.wav", v: 0.26 },
  // workforce
  { f: MOVE.bots[0], src: "nx_whoosh.wav", v: 0.3 },
  { f: MOVE.bots[0] + 60, src: "nx_rise.wav", v: 0.4 },
  ...Array.from({ length: 5 }, (_, i) => ({ f: MOVE.bots[0] + 66 + i * 15, src: "nx_tick.wav", v: 0.22 })),
  // support wall
  { f: MOVE.support[0], src: "nx_whoosh.wav", v: 0.24 },
  { f: MOVE.support[0] + 50, src: "nx_rise.wav", v: 0.34 },
  // threat
  { f: MOVE.cyber[0], src: "nx_threat.wav", v: 0.9 },
  { f: MOVE.cyber[0] + 18, src: "nx_impact.wav", v: 0.5 },
  { f: MOVE.cyber[0] + 44, src: "nx_impact.wav", v: 0.42 },
  // heal
  { f: MOVE.heal[0] + 10, src: "nx_heal.wav", v: 0.85 },
  { f: MOVE.heal[0] + 60, src: "nx_rise.wav", v: 0.4 },
  // proof
  { f: MOVE.proof[0], src: "nx_boom.wav", v: 0.5 },
  ...Array.from({ length: 4 }, (_, i) => ({ f: MOVE.proof[0] + 26 + i * 12, src: "nx_tick.wav", v: 0.3 })),
  // cta
  { f: MOVE.cta[0], src: "nx_boom.wav", v: 0.9 },
  { f: MOVE.cta[0] + 26, src: "nx_rise.wav", v: 0.45 },
];

const BED = 0.66;

/** ducking envelope — the bed drops under every hit and recovers exponentially */
const duck = (f: number) => {
  let target = BED;
  const dip = (c: number, depth: number, w: number) => {
    const d = Math.abs(f - c) / w;
    if (d < 1) target = Math.min(target, BED * (1 - depth * (1 - d) * (1 - d)));
  };
  dip(20, 0.45, 40);
  dip(MOVE.globe[0], 0.4, 36);
  dip(MOVE.services[0], 0.35, 30);
  dip(MOVE.bots[0], 0.4, 36);
  dip(MOVE.cyber[0], 0.55, 44);
  dip(MOVE.heal[0] + 20, 0.45, 50);
  dip(MOVE.proof[0], 0.4, 34);
  dip(MOVE.cta[0], 0.6, 55);
  return target;
};

export const AudioNX: React.FC<{ frame: number }> = ({ frame }) => (
  <>
    <Audio src={staticFile("audio/nx_bed.wav")} volume={duck(frame)} />
    {CUES.map((c, i) => (
      <Sequence key={`${c.src}-${c.f}-${i}`} from={c.f} durationInFrames={Math.ceil(3.2 * 30)}>
        <Audio src={staticFile(`audio/${c.src}`)} volume={c.v} />
      </Sequence>
    ))}
  </>
);
