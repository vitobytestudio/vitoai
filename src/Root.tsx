import React from "react";
import { Composition } from "remotion";
import { MainComposition } from "./Main";
import { CloudflareAd } from "./cloudflare/CloudflareAd";
import { CF_DURATION } from "./cloudflare/palette";
import { NexusAd } from "./nexus/NexusAd";
import { Reel } from "./nexus3d/Reel";
import { VitoFilm } from "./vito/VitoFilm";
import { Autonomy } from "./autonomy/Autonomy";
import { Film } from "./studio/Film";
import { DEFAULT_BRIEF } from "./studio/types";
import { ProductFilm, planProduct, planSeconds } from "./studio/premium";
import { StoryFilm } from "./studio/StoryFilm";
import { planStory, totalSeconds } from "./studio/story";
import { VitoFilm as AgentFilm, framesFor as agentFrames } from "./studio/VitoFilm";
import { Amaze } from "./studio/reel/Amaze";
import { Showreel, DURATION as REEL_DURATION } from "./studio/reel/Showreel";
import { Spot, DURATION as SPOT_DURATION } from "./studio/reel/Spot";
import { Talk, DURATION as TALK_DURATION } from "./studio/reel/Talk";
import { Specimen, DURATION as SPECIMEN_DURATION } from "./studio/reel/Specimen";
import { Edge, DURATION as EDGE_DURATION } from "./studio/reel/Edge";
import { Bone, DURATION as BONE_DURATION } from "./studio/reel/Bone";
import { Chase, DURATION as CHASE_DURATION } from "./studio/reel/Chase";
import { Naksab01, DURATION as NAKSAB_DURATION } from "./naksab/Ep01";
import { Naksab02, DURATION as NAKSAB2_DURATION } from "./naksab/Ep02";
import { Horror01, DURATION as HORROR_DURATION } from "./horror/Scene01";
import { LastFloor, DURATION as LASTFLOOR_DURATION } from "./lastfloor/Trailer";
import { Phone, DURATION as PHONE_DURATION } from "./phone/Phone";
import { think } from "./studio/brain";

const AGENT_BRIEF = "مونتاج بريميوم لمجموعة أزياء في مول كبير بباريس";
import { DURATION as AUTO_DUR, FPS as AUTO_FPS, W as AUTO_W, H as AUTO_H } from "./autonomy/space";
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
    {/* VITO BYTE STUDIO — 32s flat, 60fps */}
    {/* the parametric film the studio app renders, registered so it can be
        rendered and audited through the same pipeline as everything else */}
    <Composition
      id="StudioFilm"
      component={Film}
      durationInFrames={240}
      fps={30}
      width={720}
      height={1280}
      defaultProps={DEFAULT_BRIEF}
    />
    {/* multi-scene story film — the AI planning target */}
    <Composition
      id="StoryFilm"
      component={StoryFilm}
      durationInFrames={Math.round(
        totalSeconds(
          planStory(
            "A premium campaign in Paris, a full blueprint plan, a car montage, then the flagship clothing store inside a mall.",
          ),
        ) * 30,
      )}
      fps={30}
      width={720}
      height={1280}
      defaultProps={{ ...planStory("A premium campaign in Paris, a full blueprint plan, a car montage, then the flagship clothing store inside a mall.") }}
    />
    {/* 32 s, one continuous take — no cuts */}
    <Composition
      id="Autonomy"
      component={Autonomy}
      durationInFrames={AUTO_DUR}
      fps={AUTO_FPS}
      width={AUTO_W}
      height={AUTO_H}
    />
    <Composition id="VitoFilm" component={VitoFilm} durationInFrames={1920} fps={60} width={WIDTH} height={HEIGHT} />
    {/* the agent's film: brain → places → score, the same code the studio runs */}
    <Composition
      id="AgentFilm"
      component={AgentFilm}
      durationInFrames={agentFrames(think(AGENT_BRIEF, { seconds: 28 }))}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ decision: think(AGENT_BRIEF, { seconds: 28 }) }}
    />
    {/* «إطار» — a hand-authored 24s film. Every frame written by hand. */}
    <Composition
      id="Amaze"
      component={Amaze}
      durationInFrames={720}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{}}
    />
    {/* SPECIMEN — 18s of pure motion language, no footage */}
    <Composition id="Specimen" component={Specimen} durationInFrames={SPECIMEN_DURATION} fps={30} width={1080} height={1920} />
    {/* TALK — motion graphics over a talking-head clip */}
    <Composition id="Talk" component={Talk} durationInFrames={TALK_DURATION} fps={30} width={1080} height={1920} />
    {/* VITO BYTE STUDIO — 36s spot, cut to a 120 BPM score */}
    <Composition id="Spot" component={Spot} durationInFrames={SPOT_DURATION} fps={30} width={1080} height={1920} />
    {/* EDGE — 30s cinematic tech spot, two cuts */}
    <Composition id="Edge" component={Edge} durationInFrames={EDGE_DURATION} fps={30} width={1080} height={1920} defaultProps={{ mode: "cinema" }} />
    <Composition id="EdgeTechnical" component={Edge} durationInFrames={EDGE_DURATION} fps={30} width={1080} height={1920} defaultProps={{ mode: "technical" }} />
    {/* BONE — the same 30s script, cut as a printed spread. two colours. */}
    <Composition id="Bone" component={Bone} durationInFrames={BONE_DURATION} fps={30} width={1080} height={1920} />
    {/* CHASE — 18s, one continuous phone take over a night street race */}
    {/* NAKSAB Ep.01 — 24 s, the marketplace run once end to end */}
    <Composition id="Naksab01" component={Naksab01} durationInFrames={NAKSAB_DURATION} fps={30} width={1080} height={1920} />
    <Composition id="Naksab02" component={Naksab02} durationInFrames={NAKSAB2_DURATION} fps={30} width={1080} height={1920} />
    <Composition id="Chase" component={Chase} durationInFrames={CHASE_DURATION} fps={30} width={1080} height={1920} />
    {/* a generated horror beat — pre-rendered plate, 30 fps master */}
    <Composition id="Horror01" component={Horror01} durationInFrames={HORROR_DURATION} fps={30} width={1080} height={1920} />
    {/* THE LAST FLOOR — 30 s launch trailer for a Roblox horror game: Cycles toy plates inside the game's own screen */}
    <Composition id="LastFloor" component={LastFloor} durationInFrames={LASTFLOOR_DURATION} fps={30} width={1080} height={1920} />
    {/* المقطع الهاتفي: لقطة حقيقية قصّصناها على صمتٍ مقيس — 30.00s بالضبط */}
    <Composition id="Phone" component={Phone} durationInFrames={PHONE_DURATION} fps={30} width={1080} height={1920} />
    {/* NEXUS SHOWREEL — 30s, eight movements, the studio's own advertisement */}
    <Composition id="Showreel" component={Showreel} durationInFrames={REEL_DURATION} fps={30} width={1080} height={1920} />
    {/* NEXUS SIGNAL — 36s kinetic 3D film, 30fps */}
    <Composition id="NexusReel" component={Reel} durationInFrames={1080} fps={30} width={WIDTH} height={HEIGHT} />
    {/* enterprise product film — planned, then built from UI primitives */}
    <Composition
      id="ProductFilm"
      component={ProductFilm}
      durationInFrames={Math.round(planSeconds(planProduct("github")) * 30)}
      fps={30}
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
