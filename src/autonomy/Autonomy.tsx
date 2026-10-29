/**
 * AUTONOMY — 32 s, one continuous take.
 *
 * The camera starts outside the word and flies through all eight letters of
 * AUTONOMY, settling on the mark. There is no cut anywhere in the film; the
 * only structural device is the letter you happen to be passing.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { V } from "../vito/palette";
import { camRoll, W, H } from "./space";
import { World } from "./World";
import { Overlay } from "./Overlay";
import { AudioAutonomy } from "./AudioAutonomy";

export const Autonomy: React.FC = () => {
  const f = useCurrentFrame();

  return (
    <AbsoluteFill style={{ background: V.void }}>
      {/* one transform for geometry and type, so the room stays welded together */}
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: W,
          height: H,
          transform: `rotate(${camRoll(f)}deg)`,
        }}
      >
        <World />
        <Overlay />
      </div>

      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 46%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.42) 78%, rgba(0,0,0,0.72) 100%)",
        }}
      />

      <AudioAutonomy />
    </AbsoluteFill>
  );
};
