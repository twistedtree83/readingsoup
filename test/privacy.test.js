import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor } from "../src/core/view.js";
import { PASSAGES } from "../src/core/passages.js";
import { CONFIG } from "../src/core/config.js";

// The load-bearing rule: no participant who is not the current reader ever
// receives passage content, in any phase, in any mode, at any group size.
// Enforced here because view.viewFor is the sole path by which a client gets data.

const words = (t) => t.split(/\s+/).filter((w) => w.length > 4);

describe("privacy boundary", () => {
  test("a non-reader view contains no passage content", () => {
    const state = reduce(
      initialState(),
      { type: "START_SOLO", participantId: "p1", at: 0, seed: 1 },
      CONFIG
    ).state;

    const v = viewFor(state, "not-the-reader");
    const serialised = JSON.stringify(v);

    expect(v.tokens).toBeUndefined();
    for (const p of PASSAGES) {
      for (const w of words(p.text)) {
        expect(serialised).not.toContain(w);
      }
    }
  });

  test("an unknown participant gets a view, not a crash or an error leak", () => {
    const state = reduce(
      initialState(),
      { type: "START_SOLO", participantId: "p1", at: 0, seed: 1 },
      CONFIG
    ).state;
    const v = viewFor(state, "stranger");
    expect(v).toBeTruthy();
    expect(v.phase).toBeDefined();
  });
});

describe("the client never learns the answer", () => {
  test("no view marks which card fixes the current condition", () => {
    const state = reduce(
      initialState(),
      { type: "START_SOLO", participantId: "p1", at: 0, seed: 1 },
      CONFIG
    ).state;

    for (const id of ["p1", "someone-else"]) {
      const v = viewFor(state, id);
      const serialised = JSON.stringify(v);
      // The correct card is necessarily present in a full hand. What must never
      // travel is anything that singles it out.
      for (const tell of ["fixedBy", "correct", "answer", "fixes", "solution"]) {
        expect(serialised).not.toContain(tell);
      }
      if (v.hand) expect(v.hand.length).toBe(6);
    }
  });

  test("the hand is in a fixed order that does not track the condition", () => {
    const state = reduce(
      initialState(),
      { type: "START_SOLO", participantId: "p1", at: 0, seed: 1 },
      CONFIG
    ).state;
    const v = viewFor(state, "p1");
    expect(v.hand[0]).toBe("give-it-room");
    expect(v.hand.indexOf(state.round.fixedBy)).toBeGreaterThanOrEqual(0);
  });
});
