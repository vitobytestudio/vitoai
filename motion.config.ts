/**
 * =============================================================================
 *  motion.config.ts — THE ONLY FILE YOU EDIT FOR A NEW VIDEO
 * =============================================================================
 * The look, the timing engine and the traps are all fixed (and already solved).
 * Everything that changes per client lives here: brand, copy, numbers.
 *
 * After editing:
 *     ./make.sh <slug>
 * runs preflight → render → mobile cut → publish, and prints the links.
 *
 * HARD RULE behind the type weights you see below:
 *   the bundled Cairo Arabic subset contains NO '.' '—' '%' '·' or Latin digits.
 *   Those glyphs only exist in the Cairo Latin subset, which ships at weights
 *   800 and 900 ONLY. Paint Arabic copy containing them at any lighter weight
 *   and Chromium falls back to a system font that does not exist — the renderer
 *   tab dies with "Target closed" and no stack trace.
 *   => `weight: 900` below is a correctness requirement, not a style choice.
 * =============================================================================
 */

export type Config = {
  slug: string;
  brand: {
    wordmark: string;
    color: string;
    colorHot: string;
    colorDeep: string;
    ink: string;
    site: string;
  };
  copy: {
    kicker: string[];
    hookLine1: string;
    hookLine2: string;
    statPrimary: { value: number; label: string; sub: string };
    statSecondary: { value: number; label: string };
    latency: { lead: string; value: number; unit: string };
    reach: string;
    reachNote: string;
    threatLine1: string;
    threatLine2: string;
    threatLabel: string;
    endLine: string;
  };
  /** frame windows @ fps; every scene's audio cue is derived from these */
  timing: {
    fps: number;
    void: [number, number];
    ignite: [number, number];
    arcs: [number, number];
    guard: [number, number];
    logo: [number, number];
    cta: [number, number];
  };
};

export const PROJECT: Config = {
  slug: "cloudflare-one-network",
  brand: {
    wordmark: "cloudflare",
    color: "#F6821F",
    colorHot: "#FFA24B",
    colorDeep: "#B9480A",
    ink: "#050506",
    site: "CLOUDFLARE.COM",
  },
  copy: {
    kicker: ["CLOUDFLARE", "EDGE NETWORK", "ANYCAST 330 POPS", "SECURITY ALWAYS ON", "CLOUDFLARE"],
    hookLine1: "خُمس الإنترنت",
    hookLine2: "يمرّ من هنا",
    statPrimary: { value: 330, label: "مدينة", sub: "في أكثر من ١٢٥ دولة" },
    statSecondary: { value: 13000, label: "شبكة متصلة مباشرة" },
    latency: { lead: "على بُعد", value: 50, unit: "ms" },
    reach: "95% من سكان العالم",
    reachNote: "كل طلب يُخدَم من أقرب مدينة، لا رحلة إلى خادم بعيد.",
    threatLine1: "مليارات الهجمات",
    threatLine2: "تُوقَف قبل أن تصل",
    threatLabel: "THREATS BLOCKED · LIVE",
    endLine: "شبكة واحدة. لكل الإنترنت.",
  },
  timing: {
    fps: 30,
    void: [0, 100],
    ignite: [100, 260],
    arcs: [260, 425],
    guard: [425, 545],
    logo: [545, 625],
    cta: [625, 690],
  },
};

/** seconds → the total the render must match exactly, or the audio drifts */
export const TOTAL_FRAMES = PROJECT.timing.cta[1];
