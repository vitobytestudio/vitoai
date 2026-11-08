/**
 * Dispatcher. The brief names a design; the design renders the film.
 * Every design is a full composition, not a variant of one.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { Brief } from "./types";
import { designById } from "./registry";

export const Film: React.FC<Brief> = (p) => {
  const Scene = designById(p.design).Scene;
  return (
    <AbsoluteFill>
      <Scene {...p} />
    </AbsoluteFill>
  );
};
