/* tools/stmt-icon.mjs: THE STATEMENTS SITE'S OWN HOME-SCREEN ICON (v693).
 *
 * WHY IT IS DRAWN HERE AND NOT COPIED. The desk's icons are the Salt plate, and nothing a customer
 * holds may name or show the business (CLAUDE.md, no brand on the customer's page): an icon on a
 * home screen is the most visible thing there is. So this draws a neutral tile, obsidian with a
 * brass ring, which says nothing about what the page is.
 *
 * WHY A GENERATOR AND NOT A FILE. The site serves no assets: `stmt/` is code only, and a Worker has
 * no filesystem. The icon therefore lives as bytes inside a module, `stmt/icons.js`, and this writes
 * it: a PNG encoded by hand, because nothing here draws on a canvas and pulling in an image library
 * for two circles would be a dependency for nothing.
 *
 * SALT ADMIN HAS ITS OWN (S9 9.7, his D13 of 24 Sep 2026): the same tile and ring with a keyhole at its
 * centre in place of the dot, so his two apps are told apart on one home screen and neither names anything.
 *
 *   node tools/stmt-icon.mjs --sync     write stmt/icons.js
 *   node tools/stmt-icon.mjs --check    exit 1 if it would differ (CI and the gate)
 */
import { deflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(REPO, "stmt", "icons.js");
const SIZE = 512;

/* the identity's own two colours, and nothing that spells anything */
const OBSIDIAN = [5, 8, 10], BRASS = [197, 160, 89], COPPER = [184, 115, 51];

/* the keyhole: a round head a little above the centre and a stem widening below it */
function keyhole(x, y, c, S = SIZE) {
  const head = S * 0.06, top = c - S * 0.035, bottom = c + S * 0.11;
  if (Math.hypot(x - c, y - top) <= head) return true;
  if (y < top || y > bottom) return false;
  const half = S * (0.025 + 0.025 * (y - top) / (bottom - top));
  return Math.abs(x - c) <= half;
}
function pixels(admin) {
  const px = Buffer.alloc(SIZE * SIZE * 3);
  const c = (SIZE - 1) / 2, rOuter = SIZE * 0.34, rInner = SIZE * 0.24, rDot = SIZE * 0.07;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const d = Math.hypot(x - c, y - c);
      let rgb = OBSIDIAN;
      if (admin ? keyhole(x, y, c) : d <= rDot) rgb = BRASS;
      else if (d >= rInner && d <= rOuter) {
        /* the ring fades from brass to copper across itself, the identity's one gradient */
        const t = (d - rInner) / (rOuter - rInner);
        rgb = [0, 1, 2].map((i) => Math.round(BRASS[i] + (COPPER[i] - BRASS[i]) * t));
      }
      const o = (y * SIZE + x) * 3;
      px[o] = rgb[0]; px[o + 1] = rgb[1]; px[o + 2] = rgb[2];
    }
  }
  return px;
}

const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
/* THE BROWSER TAB'S OWN ICON (24 Oct 2026, his word: no black background). The tile above is what a home screen
   draws, and iOS fills any clear corner with black, so it stays opaque. A tab has no such rule: this is the same ring
   and dot (Salt Admin's with the keyhole) on a clear ground, drawn larger in its canvas so it reads at 16 px, with
   coverage antialiasing from a 4 by 4 grid a pixel, so the edge is a soft alpha and never a black halo. */
const TAB_SIZE = 128, TAB_K = 1.35, TAB_GRID = 4;
function tabSample(x, y, admin) {
  const S = TAB_SIZE, c = (S - 1) / 2, k = TAB_K;
  const rOuter = S * 0.34 * k, rInner = S * 0.24 * k, rDot = S * 0.07 * k;
  const d = Math.hypot(x - c, y - c);
  if (admin ? keyhole((x - c) / k + c, (y - c) / k + c, c, S) : d <= rDot) return BRASS;
  if (d >= rInner && d <= rOuter) {
    const t = (d - rInner) / (rOuter - rInner);
    return [0, 1, 2].map((i) => BRASS[i] + (COPPER[i] - BRASS[i]) * t);
  }
  return null;
}
function tabPixels(admin) {
  const S = TAB_SIZE, n = TAB_GRID, px = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let hit = 0; const sum = [0, 0, 0];
      for (let sy = 0; sy < n; sy++) for (let sx = 0; sx < n; sx++) {
        const rgb = tabSample(x + (sx + 0.5) / n - 0.5, y + (sy + 0.5) / n - 0.5, admin);
        if (rgb) { hit++; sum[0] += rgb[0]; sum[1] += rgb[1]; sum[2] += rgb[2]; }
      }
      const o = (y * S + x) * 4;
      if (hit) {
        px[o] = Math.round(sum[0] / hit); px[o + 1] = Math.round(sum[1] / hit); px[o + 2] = Math.round(sum[2] / hit);
        px[o + 3] = Math.round(255 * hit / (n * n));
      }
    }
  }
  return px;
}
export function tabIconPng(admin) {
  const S = TAB_SIZE, px = tabPixels(admin), row = S * 4 + 1;
  const raw = Buffer.alloc(S * row);
  for (let y = 0; y < S; y++) { raw[y * row] = 0; px.copy(raw, y * row + 1, y * S * 4, (y + 1) * S * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(S, 0); ihdr.writeUInt32BE(S, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))
  ]);
}

export function iconPng(admin) {
  const px = pixels(admin);
  /* one filter byte a row, filter 0: the image is flat colour and the deflate does the work */
  const raw = Buffer.alloc(SIZE * (SIZE * 3 + 1));
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 3 + 1)] = 0;
    px.copy(raw, y * (SIZE * 3 + 1) + 1, y * SIZE * 3, (y + 1) * SIZE * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;   // 8-bit truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))
  ]);
}

export function moduleText() {
  const b64 = iconPng().toString("base64");
  return "/* stmt/icons.js: GENERATED by tools/stmt-icon.mjs --sync. Never edit it; the gate and CI\n"
    + "   check it against the generator. A neutral tile, obsidian with a brass ring: nothing a\n"
    + "   customer puts on a home screen may name the business. */\n"
    + "export const ICON_PNG_B64 = \"" + b64 + "\";\n"
    + "export const ICON_SIZE = " + SIZE + ";\n"
    + "/* Salt Admin's own (S9 9.7): the same ring with a keyhole at its centre */\n"
    + "export const ADMIN_ICON_PNG_B64 = \"" + iconPng(true).toString("base64") + "\";\n"
    + "/* the browser tab's two, on a clear ground (24 Oct 2026): " + TAB_SIZE + " px RGBA, the tile's ring and dot, and Salt Admin's with its keyhole */\n"
    + "export const TAB_ICON_SIZE = " + TAB_SIZE + ";\n"
    + "export const TAB_ICON_PNG_B64 = \"" + tabIconPng().toString("base64") + "\";\n"
    + "export const ADMIN_TAB_ICON_PNG_B64 = \"" + tabIconPng(true).toString("base64") + "\";\n";
}

function main() {
  const want = moduleText();
  const has = (() => { try { return readFileSync(OUT, "utf8"); } catch (e) { return ""; } })();
  if (process.argv.includes("--check")) {
    if (has === want) { console.log("  ok    stmt/icons.js is the generator's own bytes"); return; }
    console.error("stmt/icons.js differs from tools/stmt-icon.mjs; run: node tools/stmt-icon.mjs --sync");
    process.exit(1);
  }
  writeFileSync(OUT, want);
  console.log("  ok    stmt/icons.js written, " + Math.round(iconPng().length / 1024) + " KB of PNG");
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main();
