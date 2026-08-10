import { test, expect, describe } from "bun:test";
import { mangle, renderedText } from "../src/core/mangle.js";
import { CONDITIONS, IMPLEMENTED } from "../src/core/conditions.js";
import { PASSAGES } from "../src/core/passages.js";
import { CONFIG } from "../src/core/config.js";

describe("mangle", () => {
  test("Soup produces output distinguishable from its input", () => {
    for (const p of PASSAGES) {
      const out = mangle(p.text, CONDITIONS.SOUP, CONFIG);
      expect(renderedText(out)).not.toBe(p.text);
    }
  });

  test("mangled output never reconstructs the source passage", () => {
    for (const p of PASSAGES) {
      for (const c of IMPLEMENTED) {
        const out = mangle(p.text, c, CONFIG);
        expect(renderedText(out)).not.toBe(p.text);
      }
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
