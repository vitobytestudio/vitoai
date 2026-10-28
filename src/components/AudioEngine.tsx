import React from "react";
import { Audio, Sequence, staticFile, useCurrentFrame } from "remotion";
import { SFX_CUES } from "../data/captions";

/**
 * DYNAMIC SOUND DESIGN
 * -------------------------------------------------------------------
 * SFX are synthesized offline (see scripts/make_audio.mjs) and fired by
 * frame — never by wall clock — so every whoosh/impact is locked to the
 * exact frame a visual transition happens on.
 *
 * Ducking: the music bed carries an automated volume curve. It drops to
 * -18 dB (0.126x) while any speech/SFX transient is present, and recovers
 * with an exponential release — the same envelope a mixer would draw in AE.
 */

type DuckWindow = { from: number; to: number };

const SPEECH_WINDOWS: DuckWindow[] = [
  { from: 8, to: 175 },
  { from: 214, to: 418 },
  { from: 566, to: 648 },
  { from: 704, to: 900 },
  { from: 972, to: 1178 },
  { from: 1224, to: 1300 },
];

const BED_LEVEL = 0.30;
const DUCK_LEVEL = BED_LEVEL * Math.pow(10, -18 / 20); // -18dB

/** sample the ducking envelope at a frame (exponential attack/release) */
const duckAt = (frame: number) => {
  let target = BED_LEVEL;
  for (const w of SPEECH_WINDOWS) {
    const attack = 8;
    const release = 26;
    if (frame >= w.from - attack && frame <= w.to + release) {
      const inRamp = Math.min(1, (frame - (w.from - attack)) / attack);
      const outRamp = Math.min(1, (w.to + release - frame) / release);
      const env = Math.min(inRamp, outRamp);
      const eased = Math.pow(env, 0.6);
      target = Math.min(target, BED_LEVEL + (DUCK_LEVEL - BED_LEVEL) * eased);
    }
  }
  return target;
};

export const AudioEngine: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <>
      <Audio src={staticFile("audio/bed.wav")} volume={() => duckAt(frame)} />
      <Audio src={staticFile("audio/ambience.wav")} volume={0.16} />
      {SFX_CUES.map((cue, i) => (
        <Sequence key={`${cue.file}-${cue.frame}-${i}`} from={cue.frame} durationInFrames={90} layout="none">
          <Audio src={staticFile(`audio/${cue.file}`)} volume={cue.volume} />
        </Sequence>
      ))}
    </>
  );
};
