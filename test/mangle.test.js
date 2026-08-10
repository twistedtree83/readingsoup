import { test, expect, describe } from "bun:test";
import { mangle, renderedText } from "../src/core/mangle.js";
import { CONDITIONS, IMPLEMENTED, CONTENT_TRANSFORMING } from "../src/core/conditions.js";
import { PASSAGES } from "../src/core/passages.js";
import { CONFIG } from "../src/core/config.js";

describe("mangle", () => {
  test("Soup produces output distinguishable from its input", () => {
    for (const p of PASSAGES) {
      const out = mangle(p.text, CONDITIONS.SOUP, CONFIG);
      expect(renderedText(out)).not.toBe(p.text);
    }
  });

  test("Soup removes word gaps in the render mode", () => {
    const out = mangle(PASSAGES[0].text, CONDITIONS.SOUP, CONFIG);
    expect(out.render.wordGaps).toBe(false);
  });

  test("every token carries a stable id", () => {
    const out = mangle(PASSAGES[0].text, CONDITIONS.SOUP, CONFIG);
    const ids = out.tokens.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((i) => typeof i === "string" && i.length > 0)).toBe(true);
  });

  test("token text preserves the words, only presentation changes for Soup", () => {
    const out = mangle(PASSAGES[0].text, CONDITIONS.SOUP, CONFIG);
    expect(out.tokens.map((t) => t.text).join(" ")).toBe(PASSAGES[0].text);
  });

  test("accommodating a condition yields clean tokens", () => {
    const out = mangle(PASSAGES[0].text, CONDITIONS.SOUP, CONFIG, { accommodated: true });
    expect(renderedText(out)).toBe(PASSAGES[0].text);
    expect(out.render.wordGaps).toBe(true);
  });
});

describe("Fog", () => {
  test("renders at very low contrast without touching the words", () => {
    const out = mangle(PASSAGES[0].text, CONDITIONS.FOG, CONFIG);
    expect(out.render.contrast).toBeLessThan(0.2);
    expect(renderedText(out)).toBe(PASSAGES[0].text);
  });

  test("differs from a clean render", () => {
    const fogged = mangle(PASSAGES[0].text, CONDITIONS.FOG, CONFIG);
    const clean = mangle(PASSAGES[0].text, CONDITIONS.FOG, CONFIG, { accommodated: true });
    expect(fogged.render.contrast).not.toBe(clean.render.contrast);
  });

  test("Change the colours restores full contrast in one action", () => {
    const out = mangle(PASSAGES[0].text, CONDITIONS.FOG, CONFIG, { accommodated: true });
    expect(out.render.contrast).toBe(1);
  });

  test("contrast is a tuning constant, not hard-coded", () => {
    const dialled = structuredClone(CONFIG);
    dialled.fog.contrast = 0.5;
    expect(mangle(PASSAGES[0].text, CONDITIONS.FOG, dialled).render.contrast).toBe(0.5);
  });
});

describe("the content/presentation split", () => {
  test("content-transforming conditions never reconstruct the source", () => {
    for (const p of PASSAGES) {
      for (const c of IMPLEMENTED.filter((x) => CONTENT_TRANSFORMING.includes(x))) {
        expect(renderedText(mangle(p.text, c, CONFIG))).not.toBe(p.text);
      }
    }
  });

  test("every implemented condition produces output differing from clean", () => {
    // The barrier may live on the render mode (Fog, Soup) or on the tokens
    // (Slippery Floor, The Vanishing). Either counts; neither being different
    // would mean the condition does nothing.
    for (const c of IMPLEMENTED) {
      const barrier = mangle(PASSAGES[0].text, c, CONFIG, { seed: 5 });
      const clean = mangle(PASSAGES[0].text, c, CONFIG, { seed: 5, accommodated: true });
      expect(JSON.stringify(barrier)).not.toBe(JSON.stringify(clean));
    }
  });
});

describe("Slippery Floor", () => {
  const slip = (cfg = CONFIG, opts = {}) =>
    mangle(PASSAGES[0].text, CONDITIONS.SLIPPERY, cfg, { seed: 5, ...opts });

  test("displaces tokens vertically and rotates them slightly", () => {
    const out = slip();
    expect(out.tokens.every((t) => typeof t.offsetY === "number")).toBe(true);
    expect(out.tokens.some((t) => t.offsetY !== 0)).toBe(true);
    expect(out.tokens.every((t) => Math.abs(t.rotate) <= CONFIG.slippery.rotateDeg)).toBe(true);
  });

  test("offsets are banded, so text sits in displaced bands rather than jittering per word", () => {
    const out = slip();
    const band = CONFIG.slippery.tokensPerBand;
    expect(out.tokens[0].offsetY).toBe(out.tokens[band - 1].offsetY);
    const distinct = new Set(out.tokens.map((t) => t.offsetY));
    expect(distinct.size).toBeGreaterThan(1);
  });

  test("offsets are computed once and are deterministic for a seed", () => {
    expect(slip().tokens.map((t) => t.offsetY)).toEqual(slip().tokens.map((t) => t.offsetY));
  });

  test("no animation is emitted by default", () => {
    expect(slip().render.drift).toBe(false);
  });

  test("no animation is emitted under reduced motion, even if drift is configured on", () => {
    const drifting = structuredClone(CONFIG);
    drifting.slippery.drift = true;
    expect(slip(drifting).render.drift).toBe(true);
    expect(slip(drifting, { reducedMotion: true }).render.drift).toBe(false);
  });

  test("the words are untouched", () => {
    expect(renderedText(slip())).toBe(PASSAGES[0].text);
  });

  test("Line guide stabilises the baseline", () => {
    const out = mangle(PASSAGES[0].text, CONDITIONS.SLIPPERY, CONFIG, { seed: 5, accommodated: true });
    expect(out.tokens.every((t) => !t.offsetY && !t.rotate)).toBe(true);
  });

  test("amplitude and rotation are tuning constants", () => {
    const big = structuredClone(CONFIG);
    big.slippery.offsetPx = 40;
    expect(Math.max(...slip(big).tokens.map((t) => Math.abs(t.offsetY)))).toBeGreaterThan(
      Math.max(...slip().tokens.map((t) => Math.abs(t.offsetY)))
    );
  });
});

describe("The Vanishing", () => {
  const van = (cfg = CONFIG, opts = {}) =>
    mangle(PASSAGES[0].text, CONDITIONS.VANISHING, cfg, { seed: 3, ...opts });

  test("every token carries an expiry", () => {
    expect(van().tokens.every((t) => typeof t.expiresInMs === "number")).toBe(true);
  });

  test("expiry staggers forward, so the vanishing trails the reader", () => {
    const t = van().tokens;
    expect(t[5].expiresInMs).toBeGreaterThan(t[0].expiresInMs);
    expect(t[20].expiresInMs).toBeGreaterThan(t[5].expiresInMs);
  });

  test("the first word survives long enough to be read", () => {
    expect(van().tokens[0].expiresInMs).toBeGreaterThanOrEqual(CONFIG.vanishing.fadeAfterMs);
  });

  test("expiry is an instruction to remove, never an opacity", () => {
    const serialised = JSON.stringify(van());
    expect(serialised).not.toContain("opacity");
    expect(serialised).not.toContain("visibility");
  });

  test("fade delay and stagger are tuning constants", () => {
    const slow = structuredClone(CONFIG);
    slow.vanishing.fadeAfterMs = 9000;
    expect(van(slow).tokens[0].expiresInMs).toBe(9000);
  });

  test("Chunk it removes every expiry and groups the passage", () => {
    const out = van(CONFIG, { accommodated: true });
    expect(out.tokens.every((t) => t.expiresInMs === undefined)).toBe(true);
    expect(out.render.chunkSize).toBeGreaterThan(0);
  });

  test("the words themselves are untouched", () => {
    expect(renderedText(van())).toBe(PASSAGES[0].text);
  });
});
