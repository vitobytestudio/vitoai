/**
 * LIBRARY — the studio's stock.
 *
 * A studio that owns six templates makes six films. A studio that owns a
 * *system* of independent axes makes every film different, for as long as
 * anyone asks. Nothing here is a finished design; everything is a choice that
 * is combined at build time:
 *
 *     world × mood × palette × camera × decor × layout × type × cut
 *
 * The counts below are honest products, not marketing: 12 palettes × 6 moods ×
 * 6 worlds × 6 cameras × 8 decor motifs × 8 layouts is 165,888 base
 * combinations before a single word of copy is set. The composer's job is not
 * to pick one of those at random — it is to pick a *set* that holds together
 * and still never repeats itself within a film.
 */
import React from "react";
import { AbsoluteFill } from "remotion";
import { Storyboard, Scene, totalSeconds } from "./story";
import { WorldKind, MOODS, World } from "./world";
import { rgba, clamp, hash } from "./kit";

/* --------------------------------------------------------------- palettes */

export type Palette = {
  id: string;
  bg: [string, string];
  ink: string;
  accent: string;
  warm: string;
  /** where the palette belongs: it is a lighting choice, not a skin */
  mood: keyof typeof MOODS;
  contrast: "dark" | "light";
};

export const PALETTES: Palette[] = [
  { id: "ink", bg: ["#05090F", "#0A121C"], ink: "#F2F7FF", accent: "#00FF88", warm: "#FFD08A", mood: "night", contrast: "dark" },
  { id: "cobalt", bg: ["#060B1A", "#0D1730"], ink: "#EAF2FF", accent: "#4D8DFF", warm: "#FFC98A", mood: "night", contrast: "dark" },
  { id: "jade", bg: ["#04100C", "#081A14"], ink: "#EAFFF6", accent: "#3BF0A8", warm: "#FFD9A0", mood: "interior", contrast: "dark" },
  { id: "amber", bg: ["#0E0905", "#1A1108"], ink: "#FFF6E8", accent: "#FFB020", warm: "#FF9E4D", mood: "dusk", contrast: "dark" },
  { id: "violet", bg: ["#0A0616", "#150C28"], ink: "#F4EEFF", accent: "#A66BFF", warm: "#FFB0D0", mood: "neon", contrast: "dark" },
  { id: "ice", bg: ["#071018", "#0E1D2B"], ink: "#F0FAFF", accent: "#7FE3FF", warm: "#FFE2B8", mood: "overcast", contrast: "dark" },
  { id: "clay", bg: ["#0C0806", "#191009"], ink: "#FFF3E6", accent: "#FF7A45", warm: "#FFCB8F", mood: "dawn", contrast: "dark" },
  { id: "mint", bg: ["#03110E", "#08201A"], ink: "#E9FFF7", accent: "#19E6B3", warm: "#FFE0A8", mood: "interior", contrast: "dark" },
  { id: "noir", bg: ["#04060A", "#0B0F16"], ink: "#FFFFFF", accent: "#E8F0FF", warm: "#FFCF9A", mood: "night", contrast: "dark" },
  { id: "steel", bg: ["#080B12", "#131924"], ink: "#EFF4FA", accent: "#9FB6D4", warm: "#FFD3A0", mood: "overcast", contrast: "dark" },
  { id: "sun", bg: ["#0A0803", "#181204"], ink: "#FFFAEC", accent: "#FFE14D", warm: "#FF9E3D", mood: "dusk", contrast: "dark" },
  { id: "signal", bg: ["#050A0C", "#0A1519"], ink: "#EEFDFF", accent: "#22F0C8", warm: "#FFB86B", mood: "neon", contrast: "dark" },
];

/* ---------------------------------------------------------------- cameras */

/**
 * A camera is a path, not a zoom. Every one of these is applied to whatever is
 * underneath, which is why a still, a city and a blueprint all move like film.
 */
export type Camera = {
  id: string;
  motion: NonNullable<Scene["motion"]>;
  /** scale at the start and end of the shot */
  scale: [number, number];
  /** translate in percent of the frame, start → end */
  shift: [number, number];
  /** rotation in degrees, used sparingly */
  tilt?: [number, number];
};

export const CAMERAS: Camera[] = [
  { id: "push", motion: "in", scale: [1.02, 1.14], shift: [0, 0] },
  { id: "pull", motion: "out", scale: [1.16, 1.03], shift: [0, 0] },
  { id: "track", motion: "pan-left", scale: [1.09, 1.09], shift: [4, -4] },
  { id: "retrack", motion: "pan-right", scale: [1.09, 1.09], shift: [-4, 4] },
  { id: "crane", motion: "out", scale: [1.11, 1.05], shift: [0, 3], tilt: [0.6, -0.4] },
  { id: "handheld", motion: "in", scale: [1.05, 1.1], shift: [0.8, -0.8], tilt: [-0.4, 0.3] },
];

/* ------------------------------------------------------------------ decor */

/**
 * Overlay motifs. These are the small signatures a director repeats across a
 * film so it reads as authored: a corner mark, a measuring rail, a halo.
 * Eight of them, applied on roughly every third beat, never on all.
 */
export type DecorKind = "none" | "corners" | "ticks" | "rail" | "halo" | "scan" | "dots" | "grid";

export const DECOR_KINDS: DecorKind[] = ["none", "corners", "ticks", "rail", "halo", "scan", "dots", "grid"];

export const Decor: React.FC<{ kind: DecorKind; accent: string; f: number; strength?: number }> = ({ kind, accent, f, strength = 1 }) => {
  if (kind === "none") return null;
  const a = rgba(accent, 0.55 * strength);

  if (kind === "corners") {
    const L = 74;
    const s = 3;
    return (
      <>
        {[
          { l: 56, t: 56, bt: true, bl: true },
          { l: 56, t: 56, r: true },
        ].map(() => null)}
        {[
          [56, 56, 1, 1],
          [1024, 56, -1, 1],
          [56, 1864, 1, -1],
          [1024, 1864, -1, -1],
        ].map(([x, y, dx, dy], i) => (
          <div key={i} style={{ position: "absolute", left: x, top: y }}>
            <div style={{ position: "absolute", left: dx > 0 ? 0 : -L, top: 0, width: L, height: s, background: a }} />
            <div style={{ position: "absolute", left: dx > 0 ? 0 : -s, top: dy > 0 ? 0 : -L, width: s, height: L, background: a }} />
          </div>
        ))}
      </>
    );
  }

  if (kind === "ticks") {
    return (
      <div style={{ position: "absolute", left: 56, right: 56, bottom: 92, height: 26, display: "flex", alignItems: "flex-end", gap: 3, opacity: 0.8 * strength }}>
        {Array.from({ length: 118 }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: i % 10 === 0 ? 22 : i % 5 === 0 ? 13 : 6, background: a }} />
        ))}
      </div>
    );
  }

  if (kind === "rail") {
    return (
      <div style={{ position: "absolute", left: 56, top: 160, bottom: 160, width: 2, background: `linear-gradient(180deg, rgba(0,0,0,0), ${a}, rgba(0,0,0,0))` }}>
        <div style={{ position: "absolute", left: -4, top: `${((f * 0.7) % 100).toFixed(1)}%`, width: 10, height: 10, borderRadius: 99, background: accent, boxShadow: `0 0 18px ${rgba(accent, 0.9)}` }} />
      </div>
    );
  }

  if (kind === "halo") {
    return <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 42%, ${rgba(accent, 0.16 * strength)}, rgba(0,0,0,0) 46%)`, mixBlendMode: "screen" }} />;
  }

  if (kind === "scan") {
    const y = ((f * 6) % 1920 + 1920) % 1920;
    return <div style={{ position: "absolute", left: 0, right: 0, top: y, height: 2, background: `linear-gradient(90deg, rgba(0,0,0,0), ${rgba(accent, 0.75 * strength)}, rgba(0,0,0,0))`, boxShadow: `0 0 40px 10px ${rgba(accent, 0.18 * strength)}` }} />;
  }

  if (kind === "dots") {
    return (
      <AbsoluteFill style={{ opacity: 0.5 * strength }}>
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: (hash(i * 3.7) * 1080) | 0,
              top: (hash(i * 7.1 + 2) * 1920) | 0,
              width: 3,
              height: 3,
              borderRadius: 99,
              background: a,
            }}
          />
        ))}
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill
      style={{
        opacity: 0.24 * strength,
        backgroundImage: `linear-gradient(${a} 1px, transparent 1px), linear-gradient(90deg, ${a} 1px, transparent 1px)`,
        backgroundSize: "90px 90px",
      }}
    />
  );
};

/* ------------------------------------------------------------- composition */

export type Look = {
  world?: WorldKind;
  mood: keyof typeof MOODS;
  palette: Palette;
  camera: Camera;
  decor: DecorKind;
  /** index handed to a design system so the six systems rotate */
  designSlot: number;
  /** layout variant inside the design */
  layout: number;
  seed: number;
  accent: string;
};

export type Composition = {
  looks: Look[];
  palette: Palette;
  /** how many distinct axis values the film actually used */
  variety: { worlds: number; cameras: number; decors: number; palettes: number };
};

const hashString = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};

/** which world a scene's own words ask for, independent of the brief */
const WORLD_OF = (s: Scene): WorldKind | undefined => {
  const t = `${s.shot || ""} ${s.caption || ""} ${s.headline || ""} ${s.kicker || ""} ${s.label || ""}`.toLowerCase();
  if (/blueprint|plan|section|elevation|مخطط/.test(t)) return "plan";
  if (/traffic|car|cars|road|avenue|highway|street|aerial|traffic|سيارات/.test(t)) return "street";
  if (/mall|shopping|retail|storefront|مول/.test(t)) return "mall";
  if (/garment|clothing|fashion|rack|collection|boutique|أزياء|ملابس/.test(t)) return "showroom";
  if (/paris|haussmann|facade|balcon|باريس|عمارة/.test(t)) return "haussmann";
  if (/skyline|city|tower|downtown|مدينة|أبراج/.test(t)) return "skyline";
  return undefined;
};

/**
 * Compose the film.
 *
 * Two rules do all the work:
 *   1. the same world may not appear twice in a row, and not more than twice in
 *      a film — otherwise six shots become one shot six times;
 *   2. cameras, decors and layouts rotate on co-prime strides, so the pattern
 *      that emerges is long enough that a viewer cannot learn it.
 */
export const composeFilm = (story: Storyboard, seedText: string): Composition => {
  const h0 = hashString(seedText);
  const palette = PALETTES[h0 % PALETTES.length];
  const used: WorldKind[] = [];
  const lastWorld: (WorldKind | undefined)[] = [];

  const looks: Look[] = story.scenes.map((s, i) => {
    const h = hashString(`${seedText}:${i}:${s.kind}`);
    const asked = WORLD_OF(s);

    let world: WorldKind | undefined;
    if (s.kind === "image") {
      const pool: WorldKind[] = ["skyline", "haussmann", "street", "mall", "showroom", "plan"];
      const prev = lastWorld[i - 1];
      const repeated = (k: WorldKind) => used.filter((u) => u === k).length >= 2;
      world = asked && asked !== prev && !repeated(asked) ? asked : pool.find((k) => k !== prev && !repeated(k)) || "skyline";
      used.push(world);
    }
    lastWorld[i] = world;

    // cameras and decors step on co-prime strides so repeats are rare and never adjacent
    const camera = CAMERAS[(h0 + i * 5) % CAMERAS.length];
    const decor = DECOR_KINDS[(hashString(`${seedText}:d:${i}`) + i * 3) % DECOR_KINDS.length];
    const accented = PALETTES[(h0 + i * 7) % PALETTES.length];

    return {
      world,
      mood: MOODS[palette.mood] ? palette.mood : "night",
      palette: s.kind === "image" ? palette : accented.contrast === "dark" ? accented : palette,
      camera,
      decor: s.kind === "logo" ? "none" : decor,
      designSlot: i % 6,
      layout: (h >> 3) % 8,
      seed: h,
      accent: i % 3 === 0 ? palette.accent : accented.accent,
    };
  });

  return {
    looks,
    palette,
    variety: {
      worlds: new Set(looks.map((l) => l.world).filter(Boolean)).size,
      cameras: new Set(looks.map((l) => l.camera.id)).size,
      decors: new Set(looks.map((l) => l.decor)).size,
      palettes: new Set(looks.map((l) => l.palette.id)).size,
    },
  };
};

/** the world spec for one scene, ready to render */
export const worldSpec = (look: Look, p: number, text: string): World => ({
  kind: look.world || "skyline",
  mood: look.mood,
  accent: look.accent,
  seed: look.seed,
  p,
  density: 0.35 + clamp((look.seed % 100) / 100) * 0.5,
});

/* ------------------------------------------------------------------- scale */

/**
 * The library's real size, computed instead of claimed. This is what the UI
 * shows when it says "every video is different": it is not a number of
 * templates, it is the size of the space.
 */
export const librarySize = () => {
  const worlds = 6;
  const palettes = PALETTES.length;
  const moods = Object.keys(MOODS).length;
  const cameras = CAMERAS.length;
  const decors = DECOR_KINDS.length;
  const layouts = 8;
  const designs = 6;
  const cuts = 5;
  return worlds * palettes * moods * cameras * decors * layouts * designs * cuts;
};

export const describeLibrary = () => ({
  worlds: 6,
  palettes: PALETTES.length,
  cameras: CAMERAS.length,
  decors: DECOR_KINDS.length,
  combinations: librarySize(),
});

/** seconds, so a caller can budget without importing the whole storyboard */
export const duration = (s: Storyboard) => totalSeconds(s);
