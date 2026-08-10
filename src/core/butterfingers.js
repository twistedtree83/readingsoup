// Butterfingers. Not a reading task — the frustration of not being able to get
// words OUT, which feels nothing like not being able to get them in. That
// contrast is the pedagogical point.
//
// Each keystroke's fate depends only on its index and the seed, so backspacing
// never retroactively rewrites what came before. Pure and replayable.

import { rng } from "./random.js";

export function mangleTyped(intended, config, seed) {
  const { dropRate, transposeRate } = config.butterfingers;
  const out = [];

  for (let i = 0; i < intended.length; i++) {
    const next = rng(seed + i);
    if (next() < dropRate) continue;
    out.push(intended[i]);
    if (next() < transposeRate && out.length >= 2) {
      const last = out.length - 1;
      [out[last - 1], out[last]] = [out[last], out[last - 1]];
    }
  }

  return out.join("");
}
