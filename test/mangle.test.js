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

  test("every implemented condition renders differently from clean", () => {
    for (const c of IMPLEMENTED) {
      const barrier = mangle(PASSAGES[0].text, c, CONFIG);
      const clean = mangle(PASSAGES[0].text, c, CONFIG, { accommodated: true });
      expect(JSON.stringify(barrier.render)).not.toBe(JSON.stringify(clean.render));
    }
  });
});
