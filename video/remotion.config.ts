import { Config } from "@remotion/cli/config";

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setCodec("h264");
// GIF は CRF を渡すと怒られるので、それ以外のときだけ設定する
if (!process.argv.some((a) => a.includes("gif"))) {
  Config.setCrf(18);
}
Config.setDelayRenderTimeoutInMilliseconds(180000);
Config.setConcurrency(4);
