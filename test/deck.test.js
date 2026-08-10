import { test, expect, describe } from "bun:test";
import { fullDeck, resolve } from "../src/core/deck.js";
import { CONDITIONS, CARDS, FIXES } from "../src/core/conditions.js";

describe("deck", () => {
  test("the full deck is six cards", () => {
    expect(fullDeck().length).toBe(6);
    expect(new Set(fullDeck()).size).toBe(6);
  });

  test("every condition has exactly one card that fixes it", () => {
    for (const c of Object.values(CONDITIONS)) {
      const fixes = fullDeck().filter((card) => resolve(card, c));
      expect(fixes.length).toBe(1);
      expect(fixes[0]).toBe(FIXES[c]);
    }
  });

  test("only the correct card resolves", () => {
    expect(resolve(CARDS.GIVE_IT_ROOM, CONDITIONS.SOUP)).toBe(true);
    expect(resolve(CARDS.CHUNK_IT, CONDITIONS.SOUP)).toBe(false);
    expect(resolve(CARDS.LINE_GUIDE, CONDITIONS.SOUP)).toBe(false);
  });

  test("every card fixes exactly one condition", () => {
    for (const card of fullDeck()) {
      const fixed = Object.values(CONDITIONS).filter((c) => resolve(card, c));
      expect(fixed.length).toBe(1);
    }
  });
});
