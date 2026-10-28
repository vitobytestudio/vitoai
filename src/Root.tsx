import React from "react";
import { Composition } from "remotion";
import { MainComposition } from "./Main";
import { CloudflareAd } from "./cloudflare/CloudflareAd";
import { CF_DURATION } from "./cloudflare/palette";
import { NexusAd } from "./nexus/NexusAd";
import { DURATION as NX_DURATION, FPS_AUTH as NX_FPS } from "./nexus/palette";
import { FontGate } from "./FontGate";
import { DURATION, FPS, HEIGHT, WIDTH } from "./theme";

export const RemotionRoot: React.FC = () => (
  <FontGate>
    <Composition
      id="MainComposition"
      component={MainComposition}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/* authored at 60fps — the reference render */}
    <Composition
      id="CloudflareAd"
      component={CloudflareAd}
      durationInFrames={CF_DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {/* same picture, half the frames: the fast delivery path (~2x) */}
    <Composition
      id="CloudflareAd30"
      component={CloudflareAd}
      durationInFrames={CF_DURATION / 2}
      fps={FPS / 2}
      width={WIDTH}
      height={HEIGHT}
    />
    {/* NEXUS — 60s, authored at 30fps */}
    <Composition
      id="NexusAd"
      component={NexusAd}
      durationInFrames={NX_DURATION}
      fps={NX_FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </FontGate>
);
