// 場面（scenes/*.mjs）を撮って public/clips/<id>/{take.mp4,events.json} を作る。
//   node capture.mjs            # 全部の場面
//   node capture.mjs top,posts  # 指定した場面だけ
//   node capture.mjs --list     # 場面の一覧
// 動画にするのは render.mjs（Remotion の Clip）。
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { openPage, makeKit } from "./kit.mjs";
import config from "./video.config.mjs";

const SCENES_DIR = path.resolve("scenes");
const CATALOG = [];
for (const f of fs.readdirSync(SCENES_DIR).filter((f) => f.endsWith(".mjs")).sort()) {
  const mod = await import(pathToFileURL(path.join(SCENES_DIR, f)).href);
  for (const c of mod.default) CATALOG.push({ ...c, file: f });
}
const dup = CATALOG.map((c) => c.id).filter((id, i, a) => a.indexOf(id) !== i);
if (dup.length) { console.error("場面の id が重なっている:", [...new Set(dup)].join(" ")); process.exit(1); }

const args = process.argv.slice(2);
if (args.includes("--list")) {
  for (const c of CATALOG) console.log(`${c.id.padEnd(20)} ${c.phone ? "スマホ" : "PC    "} ${c.file}  ${c.what || ""}`);
  process.exit(0);
}
const only = args.find((a) => !a.startsWith("--")) ?? "all";
const ids = new Set(only.split(","));
const picked = CATALOG.filter((c) => only === "all" || ids.has(c.id));
const unknown = [...ids].filter((i) => i !== "all" && !CATALOG.some((c) => c.id === i));
if (unknown.length) console.warn("場面に無い:", unknown.join(" "));
const OUT = path.resolve("public/clips");

// 縦の動画の見出し（場面の title）をまとめて書く。Remotion が読む
const titles = Object.fromEntries(CATALOG.filter((c) => c.title).map((c) => [c.id, c.title]));
fs.mkdirSync("public", { recursive: true });
fs.writeFileSync("public/titles.json", JSON.stringify({ brand: config.brand, windowLabel: config.windowLabel, titles }, null, 1));

const browser = await chromium.launch();
const failed = [];
for (const c of picked) {
  // 場面ごとに新しいページで撮る。前の場面の状態（スクロール・開いたメニュー）を持ち越さないため
  const ctx = { ...(c.phone ? config.phone : config.pc), ...(c.ctx || {}) };
  const url = c.url === null ? null : new URL(c.url || "/", config.baseUrl).href;
  const page = await openPage(browser, { url, ready: config.ready, css: config.css, ctx });
  const k = makeKit(page, config);
  const dir = path.join(OUT, c.id);
  try {
    if (c.setup) await c.setup(k);
    k.start(dir);
    await c.run(k);
    const n = await k.finish(dir, { id: c.id, what: c.what });
    console.log(c.id, n, "コマ", (n / 30).toFixed(1), "秒");
  } catch (e) {
    failed.push(c.id);
    console.error(c.id, "失敗:", e.message.split("\n")[0]);
  } finally {
    await page.context().close();
  }
}
await browser.close();
if (failed.length) { console.error("失敗した場面:", failed.join(" ")); process.exitCode = 1; }
