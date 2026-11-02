// Reuse the existing CAMS artwork without changing its colors or proportions.
// Remove only transparent outer space, then center it on a padded clear canvas.
const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { PNG } = require("pngjs");

const assets = resolve(__dirname, "../assets");
const source = PNG.sync.read(readFileSync(resolve(assets, "cmms-logo-mark.png")));
let left = source.width, top = source.height, right = -1, bottom = -1;
for (let y = 0; y < source.height; y++) {
  for (let x = 0; x < source.width; x++) {
    if (source.data[(y * source.width + x) * 4 + 3] === 0) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x); bottom = Math.max(bottom, y);
  }
}
if (right < left) throw new Error("CAMS splash source contains no visible artwork");
const width = right - left + 1, height = bottom - top + 1;
const side = Math.ceil(Math.max(width, height) / .72 / 2) * 2;
const splash = new PNG({ width: side, height: side });
splash.data.fill(0);
PNG.bitblt(source, splash, left, top, width, height,
  Math.floor((side - width) / 2), Math.floor((side - height) / 2));
writeFileSync(resolve(assets, "cams-splash-mark.png"), PNG.sync.write(splash));
console.log(`Generated dedicated ${side}×${side} transparent CAMS splash with 14% minimum margins.`);
