/**
 * The design library.
 *
 * Six independent systems. They do not share a layout, a type scale or a
 * motion grammar — only the plumbing in kit.tsx. Picking one per film is the
 * whole point: no two videos should look like the same template.
 */
import React from "react";
import { Brief, DesignId } from "./types";
import { Kinetic } from "./designs/kinetic";
import { Terminal } from "./designs/terminal";
import { Glass } from "./designs/glass";
import { Blueprint } from "./designs/blueprint";
import { Signal } from "./designs/signal";
import { Editorial } from "./designs/editorial";

export type DesignDef = {
  id: DesignId;
  name: string;
  /** what it looks like, in one line, so a person can choose */
  blurb: string;
  /** words in a prompt that should pull this design forward */
  cues: string[];
  Scene: React.FC<Brief>;
};

export const DESIGNS: DesignDef[] = [
  {
    id: "kinetic",
    name: "Kinetic",
    blurb: "Oversize words, masked reveals, a number that slams twice.",
    cues: ["launch", "bold", "loud", "hero", "announce", "new", "introducing", "finally", "debut"],
    Scene: Kinetic,
  },
  {
    id: "terminal",
    name: "Terminal",
    blurb: "Live ops feed, monospace grid, one number that owns the frame.",
    cues: ["server", "infra", "ops", "monitor", "log", "uptime", "latency", "database", "system", "cores", "cpu", "memory", "network", "endpoint"],
    Scene: Terminal,
  },
  {
    id: "glass",
    name: "Glass",
    blurb: "Soft light, layered translucent cards, premium product feel.",
    cues: ["product", "premium", "hardware", "app", "sleek", "apple", "design", "cloud", "beautiful", "simple", "subscription", "delivery", "team"],
    Scene: Glass,
  },
  {
    id: "blueprint",
    name: "Blueprint",
    blurb: "Technical drawing, dimension lines, measured and annotated.",
    cues: ["engineer", "engineering", "architecture", "spec", "technical", "diagram", "measure", "build", "infrastructure", "engine", "precision", "runtime"],
    Scene: Blueprint,
  },
  {
    id: "signal",
    name: "Signal",
    blurb: "Channel split, tearing, interference — then a clean lock-up.",
    cues: ["security", "hack", "breach", "alert", "glitch", "cyber", "threat", "attack", "real-time", "protect", "defend", "incident"],
    Scene: Signal,
  },
  {
    id: "editorial",
    name: "Editorial",
    blurb: "A printed spread: rules, columns, an index numeral, a colour block.",
    cues: ["report", "brand", "story", "editorial", "magazine", "annual", "case study", "studio", "year", "since", "founded", "history"],
    Scene: Editorial,
  },
];

export const designById = (id: DesignId): DesignDef =>
  DESIGNS.find((d) => d.id === id) || DESIGNS[0];

/**
 * Deterministic pick: score each design by cue hits in the prompt, and use the
 * prompt itself as the tie-break so the same prompt always yields the same
 * design while different prompts diverge.
 */
export const pickDesign = (prompt: string): DesignId => {
  const text = prompt.toLowerCase();
  let best = DESIGNS[0];
  let bestScore = -1;
  for (const d of DESIGNS) {
    let score = 0;
    for (const cue of d.cues) if (text.includes(cue)) score += 2;
    // stable jitter so unrelated prompts still spread across the library
    // jitter is deliberately smaller than one cue hit, so wording wins ties
    score += (hashOf(d.id + text) % 100) / 200;
    if (score > bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best.id;
};

const hashOf = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
};
