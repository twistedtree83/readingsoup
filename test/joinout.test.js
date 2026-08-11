import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor } from "../src/core/view.js";
import { CONFIG } from "../src/core/config.js";
import { SILENT_POOL } from "../src/core/conditions.js";

// Two doors: somebody walking in six minutes late, and somebody deciding in
// round two that this is landing harder than they expected. Neither may cost
// them anything in front of the room.

const T0 = 10_000;
const step = (s, event, at = T0) => reduce(s, { at, ...event }, CONFIG).state;

function room(n, { observers = [], seed = 7 } = {}) {
  let s = step(initialState(), { type: "OPEN_ROOM", roomCode: "4417", token: "host", seed }, 0);
  for (let i = 0; i < n; i++) {
    s = step(s, {
      type: "JOIN", token: `p${i}`, name: `P${i}`,
      role: observers.includes(`p${i}`) ? "observer" : "participant",
    }, 0);
  }
  return s;
}

// A group session already under way: silent round done, back in the lobby.
const underway = (n = 8, opts) =>
  step(step(room(n, opts), { type: "START_SESSION" }), { type: "END_SILENT" }, T0 + 100_000);

const arrive = (s, token, at = T0 + 200_000) =>
  step(s, { type: "JOIN", token, name: token.toUpperCase(), role: "participant" }, at);

describe("somebody walks in six minutes late", () => {
  test("they get the silent round privately, on arrival", () => {
    const s = arrive(underway(), "late");
    const v = viewFor(s, "late");
    expect(v.phase).toBe("silent");
    expect(v.catchUp).toBe(true);
    expect(v.tokens.length).toBeGreaterThan(0);
    expect(v.remainingMs).toBe(CONFIG.round.silentRoundMs);
  });

  test("it is the same forty words the room had", () => {
    let s = room(8);
    s = step(s, { type: "START_SESSION" });
    const roomPassage = s.silent.passageId;
    s = step(s, { type: "END_SILENT" }, T0 + 100_000);
    const late = arrive(s, "late");
    expect(late.participants.late.catchUp.passageId).toBe(roomPassage);
  });

  test("they meet a real barrier, and it counts as one they have had", () => {
    const s = arrive(underway(), "late");
    const condition = s.participants.late.catchUp.condition;
    expect(SILENT_POOL).toContain(condition);
    expect(s.participants.late.seen).toEqual([condition]);
  });

  test("the room carries on around them, and nobody is told", () => {
    const before = underway();
    const s = arrive(before, "late");
    expect(s.phase).toBe(before.phase);

    const hostBefore = JSON.stringify(viewFor(before, "host"));
    const hostAfter = JSON.stringify(viewFor(s, "host"));
    // The roster grows — that is a headcount, not a disclosure. Nothing else
    // on the projector moves, and nothing says anybody is catching up.
    expect(hostAfter).toContain("LATE");
    const withoutTheNewcomer = (s) =>
      s.replace(/,?\{"name":"LATE"[^}]*\}/, "").replace(/"headcount":\d+/, "");
    expect(withoutTheNewcomer(hostAfter)).toBe(withoutTheNewcomer(hostBefore));
    for (const t of ["p0", "p2", "host"]) {
      expect(JSON.stringify(viewFor(s, t)), `${t}`).not.toMatch(/catchUp|catching/i);
    }
  });

  test("their ninety seconds run down and hand them back to the room", () => {
    let s = arrive(underway(), "late");
    s = step(s, { type: "TICK" }, T0 + 200_000 + 30_000);
    expect(viewFor(s, "late").remainingMs).toBe(CONFIG.round.silentRoundMs - 30_000);

    s = step(s, { type: "TICK" }, T0 + 200_000 + CONFIG.round.silentRoundMs);
    expect(viewFor(s, "late").phase).toBe("lobby");
    expect(s.participants.late.catchUp.finished).toBe(true);
  });

  test("afterwards they are an ordinary participant, spotlights included", () => {
    let s = arrive(underway(), "late");
    s = step(s, { type: "TICK" }, T0 + 400_000);
    s = step(s, { type: "START_ROUND", reader: "late" }, T0 + 401_000);
    expect(s.round.reader).toBe("late");
    // ...and never handed the barrier they just met on their own.
    expect(s.round.condition).not.toBe(s.participants.late.catchUp.condition);
  });

  test("a catch-up runs alongside a spotlight without either noticing", () => {
    let s = underway();
    s = step(s, { type: "START_ROUND", reader: "p0" }, T0 + 150_000);
    s = arrive(s, "late", T0 + 160_000);

    expect(s.phase).toBe("round");
    expect(s.round.reader).toBe("p0");
    // The latecomer is reading their own passage, not watching somebody else's.
    expect(viewFor(s, "late").phase).toBe("silent");
    expect(viewFor(s, "late").watching).toBeUndefined();
    // And they are not dealt into a round that started before they arrived.
    expect(s.participants.late.hand ?? []).toEqual([]);
  });

  test("a phone coming back is not a new arrival", () => {
    let s = arrive(underway(), "late");
    s = step(s, { type: "TICK" }, T0 + 400_000);
    const finishedAt = s.participants.late.catchUp;

    s = step(s, { type: "DISCONNECT", token: "late" }, T0 + 410_000);
    s = step(s, { type: "RECONNECT", token: "late" }, T0 + 420_000);
    s = step(s, { type: "JOIN", token: "late", name: "LATE", role: "participant" }, T0 + 421_000);
    expect(s.participants.late.catchUp).toEqual(finishedAt);
    expect(s.participants.late.seen.length).toBe(1);
  });

  test("nobody joining before the session starts gets one", () => {
    const s = arrive(room(8), "early", T0);
    expect(s.participants.early.catchUp).toBeUndefined();
    expect(viewFor(s, "early").phase).toBe("lobby");
  });

  test("nor does somebody arriving into a small room, which never had one", () => {
    const small = step(room(3), { type: "START_SESSION" });
    const s = arrive(small, "late");
    expect(s.participants.late.catchUp).toBeUndefined();
  });
});

describe("deciding, in round two, that this is enough", () => {
  test("a quiet control converts you, and it is on every phone all the time", () => {
    const s = underway(8, { observers: ["p1"] });
    for (const t of ["p0", "p1", "p2"]) {
      expect(viewFor(s, t).canOptOut, t).toBe(true);
    }
    const after = step(s, { type: "OPT_OUT", token: "p0" });
    expect(after.participants.p0.role).toBe("observer");
    // Still there afterwards, unchanged: a control that appears or disappears
    // is a control that tells the next seat along what you just did.
    expect(viewFor(after, "p0").canOptOut).toBe(true);
  });

  test("it is permanent, and it emits nothing", () => {
    const s = underway();
    const { state, effects } = reduce(s, { type: "OPT_OUT", token: "p0", at: T0 });
    expect(effects).toEqual([]);
    expect(state.participants.p0.role).toBe("observer");
    // No route back, by design: a toggle would make it a decision to revisit
    // rather than a door out.
    const again = step(state, { type: "JOIN", token: "p0", name: "P0", role: "participant" });
    expect(again.participants.p0.role).toBe("observer");
  });

  test("the projector does not move", () => {
    const before = underway();
    const after = step(before, { type: "OPT_OUT", token: "p0" });
    expect(JSON.stringify(viewFor(after, "host"))).toBe(JSON.stringify(viewFor(before, "host")));
  });

  test("nobody else's phone moves either", () => {
    const before = underway();
    const after = step(before, { type: "OPT_OUT", token: "p0" });
    for (const t of Object.keys(before.participants)) {
      if (t === "p0") continue;
      expect(JSON.stringify(viewFor(after, t)), t).toBe(JSON.stringify(viewFor(before, t)));
    }
  });

  test("they keep their hand and go on playing", () => {
    let s = step(underway(), { type: "START_ROUND", reader: "p2" }, T0 + 150_000);
    const hand = s.participants.p0.hand;
    expect(hand.length).toBe(3);

    s = step(s, { type: "OPT_OUT", token: "p0" }, T0 + 160_000);
    expect(s.participants.p0.hand).toEqual(hand);
    expect(viewFor(s, "p0").hand).toEqual(hand);

    const played = step(s, { type: "PLAY_CARD", token: "p0", card: hand[0] },
      T0 + 150_000 + CONFIG.round.watchWindowMs);
    expect(played.round.plays).toBe(1);
  });

  test("they are never called on again", () => {
    let s = step(underway(), { type: "OPT_OUT", token: "p0" });
    expect(step(s, { type: "START_ROUND", reader: "p0" }, T0 + 150_000).phase).toBe("lobby");
    for (let i = 0; i < 12; i++) {
      s = step(s, { type: "START_ROUND", random: true }, T0 + 200_000 + i * 60_000);
      if (s.phase !== "round") break;
      expect(s.round.reader).not.toBe("p0");
      s = step(step(s, { type: "DONE", token: s.round.reader }, T0), { type: "END_ROUND" }, T0);
    }
  });

  test("their catalogue still marks what they actually met", () => {
    let s = underway();
    const seen = [...s.participants.p0.seen];
    expect(seen.length).toBe(1);
    s = step(step(s, { type: "OPT_OUT", token: "p0" }), { type: "START_REVEAL" });
    const marked = viewFor(s, "p0").catalogue.filter((c) => c.had).map((c) => c.condition);
    expect(marked).toEqual(seen);
  });
});

describe("the reader opting out looks exactly like finishing", () => {
  const midRound = () => step(underway(), { type: "START_ROUND", reader: "p0" }, T0 + 150_000);

  test("the round ends, the way it would have anyway", () => {
    const done = step(midRound(), { type: "DONE", token: "p0" }, T0 + 160_000);
    const out = step(midRound(), { type: "OPT_OUT", token: "p0" }, T0 + 160_000);
    expect(out.round.finished).toBe(true);
    expect(out.phase).toBe("round");
    // From the room's point of view the two are the same event.
    expect(JSON.stringify(viewFor(out, "host"))).toBe(JSON.stringify(viewFor(done, "host")));
    for (const t of ["p2", "p3", "p4"]) {
      expect(JSON.stringify(viewFor(out, t)), t).toBe(JSON.stringify(viewFor(done, t)));
    }
  });

  test("the conversion happens behind it, and emits nothing", () => {
    const { state, effects } = reduce(midRound(), { type: "OPT_OUT", token: "p0", at: T0 + 160_000 });
    expect(state.participants.p0.role).toBe("observer");
    expect(effects).toEqual([]);
  });

  test("the round still closes normally afterwards", () => {
    let s = step(midRound(), { type: "OPT_OUT", token: "p0" }, T0 + 160_000);
    s = step(s, { type: "END_ROUND" }, T0 + 170_000);
    expect(s.phase).toBe("lobby");
    expect(s.participants.p0.role).toBe("observer");
  });

  test("opting out mid silent round hands them the cover, not a barrier", () => {
    let s = step(room(8), { type: "START_SESSION" });
    expect(viewFor(s, "p0").observerCover).toBeUndefined();
    s = step(s, { type: "OPT_OUT", token: "p0" }, T0 + 1000);
    const v = viewFor(s, "p0");
    expect(v.observerCover).toBe(true);
    expect(v.render.wordGaps).toBe(true);
    expect(v.render.contrast).toBe(1);
  });

  test("the host cannot opt anybody out", () => {
    const s = underway();
    expect(step(s, { type: "OPT_OUT", token: "host" }).participants.host.role).toBe("host");
    expect(step(s, { type: "OPT_OUT", token: "nobody" }).participants.nobody).toBeUndefined();
  });
});

describe("the shape of the session does not shift under people", () => {
  test("an opt-out does not change the plan the facilitator was given", () => {
    const before = underway(6);
    const plan = viewFor(before, "host").spotlight;
    const after = step(before, { type: "OPT_OUT", token: "p0" });
    expect(viewFor(after, "host").spotlight).toEqual(plan);
  });

  test("nor does a late arrival", () => {
    const before = underway(8);
    const plan = viewFor(before, "host").spotlight;
    expect(viewFor(arrive(before, "late"), "host").spotlight).toEqual(plan);
  });
});
