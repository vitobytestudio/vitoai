import React from "react";
import { Audio, Sequence, staticFile, useCurrentFrame } from "remotion";

/**
 * SOUND DESIGN
 * -----------------------------------------------------------------------------
 * Two layers, both frame-locked:
 *   1. the score bed, with an automated ducking envelope so every impact has
 *      room without the mix pumping
 *   2. a cue sheet of one-shots synthesised offline (scripts/make_audio_cf.py)
 *
 * Cue frames match the picture exactly — the ignition boom lands on the frame
 * the dot explodes (200), the mark hit on the frame the cloud starts to appear.
 */

type Cue = { f: number; src: string; v: number };

const CUES: Cue[] = [
  { f: 200, src: "cf_ignite.wav", v: 1.0 }, // dot → dust explosion
  { f: 202, src: "cf_whoosh.wav", v: 0.42 },
  { f: 336, src: "cf_rise.wav", v: 0.5 }, // sphere closes
  { f: 352, src: "cf_tick.wav", v: 0.4 },
  { f: 452, src: "cf_tick.wav", v: 0.34 },
  { f: 520, src: "cf_whoosh.wav", v: 0.3 },
  { f: 616, src: "cf_tick.wav", v: 0.36 },
  { f: 850, src: "cf_shield.wav", v: 0.6 }, // force field up
  { f: 866, src: "cf_whoosh.wav", v: 0.26 },
  { f: 1090, src: "cf_boom.wav", v: 0.55 }, // implosion
  { f: 1124, src: "cf_boom.wav", v: 0.95 }, // the mark
  { f: 1126, src: "cf_rise.wav", v: 0.42 },
  { f: 1250, src: "cf_shield.wav", v: 0.26 }, // end card bloom
];

/** threat hits — one per red impact on the globe */
const HITS = [878, 904, 926, 944, 962, 980, 1000, 1014, 1026, 1038];

/** arc departures — a quiet tick each time a route lights up */
const ARC_TICKS = [540, 556, 574, 592, 612, 630, 650, 668, 690, 710, 728, 748, 768, 788, 806, 824];

const BED = 0.62;

const duckAt = (f: number) => {
  let target = BED;
  const dip = (center: number, depth: number, width: number) => {
    const d = Math.abs(f - center) / width;
    if (d < 1) target = Math.min(target, BED * (1 - depth * (1 - d) * (1 - d)));
  };
  dip(206, 0.55, 34);
  dip(862, 0.5, 46);
  dip(1092, 0.45, 30);
  dip(1134, 0.62, 40);
  for (const h of HITS) dip(h + 8, 0.34, 16);
  return target;
};

export const AudioCF: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <Audio src={staticFile("audio/cf_bed.wav")} volume={duckAt(frame)} />
      {CUES.map((c) => (
        <Sequence key={`${c.src}-${c.f}`} from={c.f} durationInFrames={Math.ceil(3.2 * 60)}>
          <Audio src={staticFile(`audio/${c.src}`)} volume={c.v} />
        </Sequence>
      ))}
      {HITS.map((h, i) => (
        <Sequence key={`hit-${h}`} from={h} durationInFrames={40}>
          <Audio src={staticFile("audio/cf_impact.wav")} volume={0.42 - i * 0.012} />
        </Sequence>
      ))}
      {ARC_TICKS.map((a) => (
        <Sequence key={`arc-${a}`} from={a} durationInFrames={20}>
          <Audio src={staticFile("audio/cf_tick.wav")} volume={0.13} />
        </Sequence>
      ))}
    </>
  );
};
