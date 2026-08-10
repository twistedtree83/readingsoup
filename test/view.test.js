import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor } from "../src/core/view.js";
import { CONFIG } from "../src/core/config.js";

const start = () =>
  reduce(initialState(), { type: "START_SOLO", participantId: "p1", at: 0, seed: 1 }, CONFIG).state;

describe("view", () => {
  test("the reader receives tokens", () => {
    const v = viewFor(start(), "p1");
    expect(Array.isArray(v.tokens)).toBe(true);
    expect(v.tokens.length).toBeGreaterThan(0);
  });

  test("the reader receives a full hand in solo", () => {
    const v = viewFor(start(), "p1");
    expect(v.hand.length).toBe(6);
  });

  test("the view never carries the condition's clean passage text", () => {
    const state = start();
    const v = viewFor(state, "p1");
    expect(v.passage).toBeUndefined();
    expect(v.sourceText).toBeUndefined();
  });

  test("the view exposes no score, timing or ranking field", () => {
    const v = viewFor(start(), "p1");
    const serialised = JSON.stringify(v).toLowerCase();
    for (const banned of ["score", "rank", "elapsed", "leaderboard"]) {
      expect(serialised).not.toContain(banned);
    }
  });
});
