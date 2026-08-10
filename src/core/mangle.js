// The barrier engine. Pure: no I/O, no DOM, no clock reads.
//
// Returns render instructions, never a directive the client could use to
// reconstruct anything. The client is dumb: it renders what it is given.

import { CONDITIONS, IMPLEMENTED } from "./conditions.js";

const CLEAN_RENDER = { wordGaps: true, letterSpacing: "normal" };

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
          wordGaps: config.soup.wordGaps,
          letterSpacing: config.soup.letterSpacing,
        },
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
