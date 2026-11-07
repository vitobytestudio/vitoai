import { planProduct, cueSheet } from "../src/studio/productplan";

/**
 * Cue sheet printer — the bridge between the picture and the score.
 *
 * Runs in Node, reads the brief from the environment (so a brief can contain
 * any quote or accent without escaping trouble) and prints the same cue sheet
 * the renderer uses.
 */
const brief = process.env.BRIEF || "a premium launch film for a developer platform";
const plan = planProduct(brief);
process.stdout.write(
  JSON.stringify({
    brief,
    accent: plan.accent,
    headline: plan.headline,
    beats: cueSheet(plan),
  }),
);
