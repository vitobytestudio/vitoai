import React from "react";
import { Audio, staticFile } from "remotion";

/**
 * Two stems, both 32.00 s, both starting at frame 0 — the score is continuous
 * because the picture is. Nothing here is cut on a beat boundary.
 */
export const AudioAutonomy: React.FC = () => (
  <>
    <Audio src={staticFile("audio/auto_bed.wav")} volume={0.92} />
    <Audio src={staticFile("audio/auto_hits.wav")} volume={0.8} />
  </>
);
