import { Config } from "@remotion/cli/config";
Config.setBrowserExecutable("/home/user/bin/chromium");
Config.setConcurrency(1);
Config.setChromiumMultiProcessOnLinux(false);
Config.setChromiumOpenGlRenderer("swangle");
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setOverwriteOutput(true);
