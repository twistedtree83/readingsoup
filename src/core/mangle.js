// The barrier engine. Pure: no I/O, no DOM, no clock reads.
//
// Returns render instructions, never a directive the client could use to
// reconstruct anything. The client is dumb: it renders what it is given.

import { CONDITIONS, IMPLEMENTED } from "./conditions.js";
import { rng } from "./random.js";

const CLEAN_RENDER = { wordGaps: true, letterSpacing: "normal", contrast: 1, drift: false };

function tokenise(passage) {
  return passage.split(/\s+/).filter(Boolean).map((text, i) => ({
    id: `t${i}`,
    text,
  }));
}

export function mangle(passage, condition, config, opts = {}) {
  if (!IMPLEMENTED.includes(condition)) {
    throw new Error(`mangle: condition "${condition}" is not implemented yet`);
  }

  const tokens = tokenise(passage);

  if (opts.accommodated) {
    return { condition, render: { ...CLEAN_RENDER }, tokens };
  }

  switch (condition) {
    case CONDITIONS.SOUP:
      // Letter spacing collapsed, word gaps removed entirely.
      return {
        condition,
        render: {
          ...CLEAN_RENDER,
          wordGaps: config.soup.wordGaps,
          letterSpacing: config.soup.letterSpacing,
        },
        tokens,
      };

    case CONDITIONS.SLIPPERY: {
      // Banded displacement: text sits in bands at different heights, so the
      // return sweep to the left margin lands on the wrong line. Computed once,
      // never animated unless drift is configured on and motion is allowed.
      const { offsetPx, rotateDeg, tokensPerBand, drift } = config.slippery;
      const next = rng(opts.seed ?? 1);
      const bands = [];
      for (let b = 0; b <= Math.floor(tokens.length / tokensPerBand); b++) {
        bands.push({
          offsetY: (next() * 2 - 1) * offsetPx,
          rotate: (next() * 2 - 1) * rotateDeg,
        });
      }
      return {
        condition,
        render: { ...CLEAN_RENDER, drift: Boolean(drift) && !opts.reducedMotion },
        tokens: tokens.map((t, i) => ({ ...t, ...bands[Math.floor(i / tokensPerBand)] })),
      };
    }

    case CONDITIONS.FOG:
      // The words are all there. You just cannot see them.
      return {
        condition,
        render: { ...CLEAN_RENDER, contrast: config.fog.contrast },
        tokens,
      };
    default:
      throw new Error(`mangle: unhandled condition "${condition}"`);
  }
}

// What the participant actually reads off the screen, given the render mode.
export function renderedText(result) {
  return result.tokens.map((t) => t.text).join(result.render.wordGaps ? " " : "");
}
