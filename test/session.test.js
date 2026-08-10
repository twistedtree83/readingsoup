import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { CONDITIONS, CARDS } from "../src/core/conditions.js";
import { CONFIG } from "../src/core/config.js";

const start = () =>
  reduce(initialState(), { type: "START_SOLO", participantId: "p1", at: 0, seed: 1 }, CONFIG);

describe("session reducer — solo", () => {
  test("starting solo puts the participant in a reading phase with a condition", () => {
    const { state } = start();
    expect(state.mode).toBe("solo");
    expect(state.phase).toBe("reading");
    expect(Object.values(CONDITIONS)).toContain(state.round.condition);
  });

  test("a wrong card does not accommodate and is not penalised", () => {
    const { state } = start();
    const cond = state.round.condition;
    const wrong = Object.values(CARDS).find((c) => c !== state.round.fixedBy);
    const next = reduce(state, { type: "PLAY_CARD", participantId: "p1", card: wrong, at: 1 }, CONFIG);
    expect(next.state.round.accommodated).toBe(false);
    expect(next.state.round.condition).toBe(cond);
    expect(next.state.phase).toBe("reading");
  });

  test("the correct card accommodates the round", () => {
    const { state } = start();
    const next = reduce(state, { type: "PLAY_CARD", participantId: "p1", card: state.round.fixedBy, at: 1 }, CONFIG);
    expect(next.state.round.accommodated).toBe(true);
  });

  test("solo allows unlimited attempts", () => {
    let { state } = start();
    const wrong = Object.values(CARDS).filter((c) => c !== state.round.fixedBy);
    for (const w of [...wrong, ...wrong, ...wrong]) {
      state = reduce(state, { type: "PLAY_CARD", participantId: "p1", card: w, at: 1 }, CONFIG).state;
    }
    expect(state.phase).toBe("reading");
    const ok = reduce(state, { type: "PLAY_CARD", participantId: "p1", card: state.round.fixedBy, at: 2 }, CONFIG);
    expect(ok.state.round.accommodated).toBe(true);
  });

  test("no timing, score or ranking is ever recorded in state", () => {
    const { state } = start();
    const serialised = JSON.stringify(state);
    for (const banned of ["score", "rank", "elapsed", "duration", "readTime", "leaderboard"]) {
      expect(serialised.toLowerCase()).not.toContain(banned.toLowerCase());
    }
  });

  test("finishing a round moves the tour forward", () => {
    const { state } = start();
    const next = reduce(state, { type: "DONE", participantId: "p1", at: 5 }, CONFIG);
    expect(["reading", "catalogue"]).toContain(next.state.phase);
  });
});
