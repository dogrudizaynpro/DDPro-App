import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const moduleSource = await readFile(new URL("../src/modules/AIModule.jsx", import.meta.url), "utf8");
const stylesSource = await readFile(new URL("../src/styles.css", import.meta.url), "utf8");
const compositionStart = moduleSource.indexOf("        <AudioWaveform");
const compositionEnd = moduleSource.indexOf("        </AudioWaveform>", compositionStart);
const compositionSource = moduleSource.slice(compositionStart, compositionEnd);

const getRule = (selector) => {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return stylesSource.match(new RegExp(`${escapedSelector}\\s*\\{([^}]+)\\}`))?.[1] || "";
};

test("AI live composition renders the original reference once without character overlays", () => {
  assert.match(moduleSource, /import aiTradeDesignReference from ["']\.\.\/assets\/DDPro-AI-Trade-Referans\.png["']/);
  assert.equal((compositionSource.match(/<img\b/g) || []).length, 1);
  assert.match(compositionSource, /src=\{aiTradeDesignReference\}/);
  assert.doesNotMatch(moduleSource, /aiCharacter(?:Front|Back)|ddpro-ai-character-(?:front|back)\.png/);
});

test("AI reference uses its native aspect ratio and is contained inside an external audio frame", () => {
  const artworkRule = getRule(".ai-trade-master-reference");
  const imageRule = getRule(".ai-trade-master-image");
  const frameRule = getRule(".ai-audio-frame");
  const horizontalRailRule = stylesSource.match(
    /\.ai-audio-frame-edge\.is-top,\s*\.ai-audio-frame-edge\.is-bottom\s*\{([^}]+)\}/
  )?.[1] || "";

  assert.match(artworkRule, /aspect-ratio:\s*1402\s*\/\s*1122/);
  assert.match(artworkRule, /height:\s*auto/);
  assert.match(imageRule, /object-fit:\s*contain/);
  assert.match(imageRule, /width:\s*100%/);
  assert.match(imageRule, /height:\s*100%/);
  assert.match(frameRule, /width:\s*min\(100%,\s*900px\)/);
  assert.match(frameRule, /padding:\s*34px\s+15px/);
  assert.match(horizontalRailRule, /height:\s*32px/);
});

test("audio frame animation reads assistant output level, independently of microphone state", () => {
  const waveformStart = moduleSource.indexOf("function AudioWaveform");
  const waveformEnd = moduleSource.indexOf("\nfunction AIModule", waveformStart);
  const waveformSource = moduleSource.slice(waveformStart, waveformEnd);
  const animationSource = waveformSource.slice(0, waveformSource.indexOf("  let barOffset"));

  assert.match(animationSource, /sessionRef\.current\?\.getOutputLevel\(\)/);
  assert.match(animationSource, /scale\$\{bar\.dataset\.axis\.toUpperCase\(\)\}/);
  assert.doesNotMatch(animationSource.slice(animationSource.indexOf("  useEffect")), /microphoneActive/);
});
