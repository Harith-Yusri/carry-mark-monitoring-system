// Preserve every source RGBA pixel: only add transparent space around the
// existing artwork. Android's 66dp safe circle sits within its 108dp layer.
const { readFileSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { PNG } = require("pngjs");

const assets = resolve(__dirname, "../assets");
const source = PNG.sync.read(readFileSync(resolve(assets, "cmms-favicon.png")));
const side = Math.ceil(Math.hypot(source.width, source.height) / (66 / 108) / 2) * 2 + 32;
const foreground = new PNG({ width: side, height: side });
foreground.data.fill(0);
const left = Math.floor((side - source.width) / 2);
const top = Math.floor((side - source.height) / 2);
PNG.bitblt(source, foreground, 0, 0, source.width, source.height, left, top);
writeFileSync(resolve(assets, "cams-adaptive-foreground.png"), PNG.sync.write(foreground));
console.log(`Generated ${side}×${side} adaptive foreground; artwork unchanged and centered inside Android's safe circle.`);
