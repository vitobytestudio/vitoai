import { Config } from "@remotion/cli/config";

/**
 * Toolchain paths come from `.toolenv` (written by setup.sh), never hardcoded.
 * This sandbox resets between sessions, so any absolute path baked into this
 * file becomes a landmine — the env contract is the only stable source.
 */
const chrome = process.env.CHROME_BIN;
if (chrome) {
  Config.setBrowserExecutable(chrome);
}

Config.setConcurrency(Number(process.env.REMOTION_CONCURRENCY ?? 1));

// No GPU here: ANGLE cannot initialise (Vulkan unavailable), so the renderer
// runs on software rasterisation. "swangle" is the only backend that works.
Config.setChromiumOpenGlRenderer("swangle");

Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(88);
Config.setOverwriteOutput(true);
