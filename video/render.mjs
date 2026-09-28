// 撮った素材（public/clips/<id>/）を動画にする（Remotion の Clip）。
//   node render.mjs [id,id,…|all] [--gif] [--tall]
// 出力は out/wide/<id>.mp4（1280x720、30 コマ/秒、音なし）。--gif を付けると 10 コマ/秒の GIF も書く。
// --tall は縦 9:16（1080x1920）で out/tall/<id>.mp4。頭に場面の title を出す。
// 束ね（bundle）は 1 回だけ作り、1 本ずつ render を呼ぶ。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const gif = args.includes("--gif");
const tall = args.includes("--tall");
const comp = tall ? "ClipTall" : "Clip", dir = tall ? "out/tall" : "out/wide";
const only = args.find((a) => !a.startsWith("--")) ?? "all";
const have = fs.existsSync("public/clips") ? fs.readdirSync("public/clips").filter((d) => fs.existsSync(`public/clips/${d}/events.json`)) : [];
const ids = only === "all" ? have : only.split(",");
const missing = ids.filter((i) => !have.includes(i));
if (missing.length) { console.error("素材が無い（先に capture.mjs で撮る）:", missing.join(" ")); process.exit(1); }
if (!ids.length) { console.error("素材が 1 本も無い（先に capture.mjs で撮る）"); process.exit(1); }

fs.mkdirSync(dir, { recursive: true });
const bundle = fs.mkdtempSync(path.join(os.tmpdir(), "clip-"));
execFileSync("npx", ["remotion", "bundle", "src/index.ts", "--out-dir", bundle, "--log=error"], { stdio: "inherit", shell: true });
const props = (id) => JSON.stringify(JSON.stringify({ id }));   // シェルを通すので二重に包む
for (const id of ids) {
  const t0 = Date.now();
  execFileSync("npx", ["remotion", "render", bundle, comp, `${dir}/${id}.mp4`, `--props=${props(id)}`,
    "--codec=h264", "--crf=18", "--log=error"], { stdio: "inherit", shell: true });
  if (gif) {
    execFileSync("npx", ["remotion", "render", bundle, comp, `${dir}/${id}.gif`, `--props=${props(id)}`,
      "--codec=gif", "--every-nth-frame=3", "--log=error"], { stdio: "inherit", shell: true });
  }
  const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + " KB";
  console.log(`${id}  mp4 ${kb(`${dir}/${id}.mp4`)}${gif ? `  gif ${kb(`${dir}/${id}.gif`)}` : ""}  ${((Date.now() - t0) / 1000).toFixed(0)} 秒`);
}
fs.rmSync(bundle, { recursive: true, force: true });
