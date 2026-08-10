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

describe("the catalogue", () => {
  const runTour = () => {
    let s = reduce(initialState(), { type: "START_SOLO", participantId: "p1", at: 0, seed: 9 }, CONFIG).state;
    const seen = [];
    for (let i = 0; i < 12 && s.phase !== "catalogue"; i++) {
      if (s.round) seen.push(s.round.condition);
      s = reduce(s, { type: "DONE", participantId: "p1", at: i }, CONFIG).state;
    }
    return { state: s, seen };
  };

  test("the tour covers all six conditions with no repeats", () => {
    const { seen } = runTour();
    expect(seen.length).toBe(6);
    expect(new Set(seen).size).toBe(6);
  });

  test("the tour ends on the catalogue", () => {
    expect(runTour().state.phase).toBe("catalogue");
  });

  test("the catalogue lists all six with a name, a description and the card that fixes it", () => {
    const v = viewFor(runTour().state, "p1");
    expect(v.catalogue.length).toBe(6);
    for (const item of v.catalogue) {
      expect(item.label.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.cardLabel.length).toBeGreaterThan(0);
    }
  });

  test("the conditions the participant experienced are marked", () => {
    const v = viewFor(runTour().state, "p1");
    expect(v.catalogue.every((c) => c.had)).toBe(true);
  });

  test("a participant who saw nothing has nothing marked, and still sees all six", () => {
    const fresh = reduce(initialState(), { type: "START_SOLO", participantId: "p1", at: 0, seed: 9 }, CONFIG).state;
    const v = viewFor({ ...fresh, phase: "catalogue", tour: { ...fresh.tour, seen: [] } }, "p1");
    expect(v.catalogue.length).toBe(6);
    expect(v.catalogue.some((c) => c.had)).toBe(false);
  });

  test("the catalogue never carries another participant's conditions", () => {
    const v = viewFor(runTour().state, "somebody-else");
    expect(JSON.stringify(v)).not.toContain("had\":true");
  });
});
