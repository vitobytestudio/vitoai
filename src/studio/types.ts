export type Tier = "lite" | "core" | "pro" | "prime";

export type DesignId =
  | "kinetic"
  | "terminal"
  | "glass"
  | "blueprint"
  | "signal"
  | "editorial";

export type Brief = {
  /** small label above everything, e.g. "private servers" */
  kicker: string;
  /** the statement, one line break allowed */
  headline: string;
  /** the number that carries the film */
  hero: string;
  unit: string;
  /** one supporting line */
  sub: string;
  cta: string;
  accent: string;
  tier: Tier;
  /** which design system renders this film */
  design: DesignId;
};

export const DEFAULT_BRIEF: Brief = {
  kicker: "private servers",
  headline: "Your own metal.\nNot a shared slice.",
  hero: "192",
  unit: "cores",
  sub: "dedicated · 768 GB · 99.99% uptime",
  cta: "vitobyte.studio",
  accent: "#00FF88",
  tier: "lite",
  design: "kinetic",
};
