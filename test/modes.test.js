import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor } from "../src/core/view.js";
import { CONFIG } from "../src/core/config.js";
import { IMPLEMENTED } from "../src/core/conditions.js";

// Group size is a first-class variable. The hardest case is the smallest one:
// two people, one of whom chose to observe. Nothing may give that away.

const T0 = 10_000;
const step = (s, event, at = T0) => reduce(s, { at, ...event }, CONFIG).state;

// `observers` names the tokens that opt out, so a test can build the exact
// shape it cares about rather than a modulo pattern.
function room(n, { observers = [], seed = 7 } = {}) {
  let s = step(initialState(), { type: "OPEN_ROOM", roomCode: "4417", token: "host", seed }, 0);
  for (let i = 0; i < n; i++) {
    s = step(s, {
      type: "JOIN",
      token: `p${i}`,
      name: `P${i}`,
      role: observers.includes(`p${i}`) ? "observer" : "participant",
    }, 0);
  }
  return s;
}

const startSession = (s) => step(s, { type: "START_SESSION" });
const activeOf = (s) => Object.values(s.participants).filter((p) => p.role === "participant").length;

describe("the mode follows the room", () => {
  test("six or more runs the silent round, then spotlights", () => {
    for (const n of [6, 8, 20]) {
      const s = startSession(room(n));
      expect(s.mode, `${n} active`).toBe("group");
      expect(s.phase, `${n} active`).toBe("silent");
    }
  });

  test("two to five goes straight to rounds, with no silent round at all", () => {
    for (const n of [2, 3, 4, 5]) {
      const s = startSession(room(n));
      expect(s.mode, `${n} active`).toBe("small");
      expect(s.phase, `${n} active`).toBe("lobby");
      expect(s.silent ?? null).toBeNull();
    }
  });

  test("rounds per person is ceil(6 / n), capped at three", () => {
    for (const [n, each] of [[2, 3], [3, 2], [4, 2], [5, 2]]) {
      const s = startSession(room(n));
      const plan = viewFor(s, "host").spotlight;
      expect(plan.perPerson, `${n} active`).toBe(each);
      expect(plan.planned, `${n} active`).toBe(n * each);
      expect(plan.max, `${n} active`).toBe(n * each);
    }
  });

  test("the eight-round cap is a group rule, and small rooms are not held to it", () => {
    // Five people at two rounds each is ten, which is more than eight and
    // correct: the cap exists so a twenty-person session ends before the room
    // does, not to shorten a session of five.
    const s = startSession(room(5));
    expect(viewFor(s, "host").spotlight.max).toBe(10);
    const group = step(startSession(room(8)), { type: "END_SILENT" });
    expect(viewFor(group, "host").spotlight.max).toBe(CONFIG.spotlight.maxRounds);
  });

  test("a small room can actually run all its rounds", () => {
    let s = startSession(room(3));
    let ran = 0;
    for (let i = 0; i < 12; i++) {
      const before = s;
      s = step(s, { type: "START_ROUND", random: true }, T0 + i * 60_000);
      if (s.phase !== "round") { s = before; break; }
      ran++;
      s = step(s, { type: "DONE", token: s.round.reader }, T0 + i * 60_000 + 1000);
      s = step(s, { type: "END_ROUND" }, T0 + i * 60_000 + 2000);
    }
    expect(ran).toBe(6);
  });

  test("nobody repeats a barrier in a small room, and the room meets all six", () => {
    for (const seed of [1, 7, 23, 404]) {
      let s = startSession(room(2, { seed }));
      const had = { p0: [], p1: [] };
      for (let i = 0; i < 6; i++) {
        s = step(s, { type: "START_ROUND", random: true }, T0 + i * 60_000);
        if (s.phase !== "round") break;
        had[s.round.reader].push(s.round.condition);
        s = step(step(s, { type: "DONE", token: s.round.reader }, T0), { type: "END_ROUND" }, T0);
      }
      for (const [who, list] of Object.entries(had)) {
        expect(new Set(list).size, `seed ${seed}: ${who} repeated a barrier`).toBe(list.length);
        expect(list.length, `seed ${seed}: ${who} rounds`).toBe(3);
      }
      const between = new Set([...had.p0, ...had.p1]);
      expect([...between].sort(), `seed ${seed}: coverage`).toEqual([...IMPLEMENTED].sort());
    }
  });

  test("a small room holds the whole deck, a group holds three", () => {
    let small = step(startSession(room(4)), { type: "START_ROUND", reader: "p0" });
    expect(small.participants.p1.hand.length).toBe(6);
    let group = step(startSession(room(8)), { type: "END_SILENT" });
    group = step(group, { type: "START_ROUND", reader: "p0" });
    expect(group.participants.p1.hand.length).toBe(3);
  });
});

describe("one active participant falls back to solo, silently", () => {
  // The case that matters most: two people, one of whom chose to observe.
  const pair = () => room(2, { observers: ["p1"] });

  test("the tour starts for the person who is playing", () => {
    const s = startSession(pair());
    expect(activeOf(s)).toBe(1);
    expect(s.mode).toBe("solo");
    expect(s.phase).toBe("reading");

    const v = viewFor(s, "p0");
    expect(v.reader).toBe(true);
    expect(v.tokens.length).toBeGreaterThan(0);
    expect(v.hand.length).toBe(6);
    expect(v.position).toBe(`1 of ${IMPLEMENTED.length}`);
  });

  test("it is the whole tour, self-paced, and it ends in the catalogue", () => {
    let s = startSession(pair());
    for (let i = 0; i < IMPLEMENTED.length; i++) {
      s = step(s, { type: "DONE", token: "p0", participantId: "p0" }, T0 + i * 1000);
    }
    expect(s.phase).toBe("catalogue");
    expect(viewFor(s, "p0").catalogue.length).toBe(IMPLEMENTED.length);
  });

  test("nothing anywhere says why, or that anything fell back at all", () => {
    const s = startSession(pair());
    const everywhere = [
      ["p0", viewFor(s, "p0")],
      ["p1", viewFor(s, "p1")],
      ["host", viewFor(s, "host")],
      ["stranger", viewFor(s, "stranger")],
    ];
    for (const [who, v] of everywhere) {
      const text = JSON.stringify(v).toLowerCase();
      for (const tell of ["opted", "fallback", "fell back", "not enough", "waiting for", "only one", "too few", "solo mode"]) {
        expect(text.includes(tell), `${who} leaked "${tell}"`).toBe(false);
      }
      // Your own role is legitimately yours. Anybody ELSE's is not, and the
      // observer's is the one that must never appear on another screen.
      if (who === "p1") continue;
      expect(text.includes("observer"), `${who} leaked "observer"`).toBe(false);
    }
  });

  test("the projector says nothing that appears only because somebody opted out", () => {
    // The give-away would be a host screen that differs between "two players"
    // and "one player and one observer". It must not.
    const opted = viewFor(startSession(room(2, { observers: ["p1"] })), "host");
    const both = viewFor(startSession(room(1)), "host");
    expect(opted.phase).toBe(both.phase);
    expect(opted.mode).toBe(both.mode);
    expect(Object.keys(opted).sort()).toEqual(Object.keys(both).sort());
  });

  test("the headcount is still a single total, never split by role", () => {
    const v = viewFor(startSession(room(2, { observers: ["p1"] })), "host");
    expect(v.headcount ?? 2).toBe(2);
    expect(JSON.stringify(v)).not.toMatch(/observerCount|observers|active/i);
  });

  test("nobody but the person playing receives the passage", () => {
    const s = startSession(pair());
    for (const who of ["p1", "host", "stranger"]) {
      const v = viewFor(s, who);
      expect(v.tokens, `${who} received tokens`).toBeUndefined();
      expect(v.prompt, `${who} received a prompt`).toBeUndefined();
    }
  });

  test("one participant and no observer behaves identically", () => {
    const alone = startSession(room(1));
    expect(alone.mode).toBe("solo");
    expect(alone.phase).toBe("reading");
    expect(viewFor(alone, "p0").reader).toBe(true);
  });

  test("an empty room does not start anything", () => {
    const s = startSession(room(0));
    expect(s.phase).toBe("lobby");
    expect(s.round).toBeFalsy();
  });
});

describe("no effect at any size identifies who chose to observe", () => {
  test("across every group size, over a full round with a card played", () => {
    for (const [n, obs] of [[2, ["p1"]], [3, ["p1"]], [6, ["p1", "p2"]], [8, ["p1"]], [20, ["p1", "p5", "p9"]]]) {
      let s = room(n, { observers: obs });
      const names = obs.map((t) => s.participants[t].name);
      const all = [];
      const run = (event, at = T0) => {
        const { state, effects } = reduce(s, { at, ...event }, CONFIG);
        s = state;
        all.push(...effects);
      };

      run({ type: "START_SESSION" });
      if (s.phase === "silent") run({ type: "END_SILENT" });
      if (s.phase === "lobby") {
        run({ type: "START_ROUND", random: true });
        if (s.phase === "round") {
          const holder = Object.values(s.participants).find(
            (p) => p.token !== s.round.reader && (p.hand ?? []).length
          );
          if (holder) {
            for (const card of holder.hand) {
              run({ type: "PLAY_CARD", token: holder.token, card }, T0 + CONFIG.round.watchWindowMs);
            }
          }
          run({ type: "DONE", token: s.round.reader }, T0 + 90_000);
          run({ type: "END_ROUND" }, T0 + 91_000);
        }
      }

      const serialised = JSON.stringify(all);
      expect(serialised, `${n}p: an effect named a role`).not.toMatch(/observer|participant/);
      // A name in an effect is fine — an observer playing a card is named like
      // anyone else. What must never travel is anything saying which they are.
      expect(serialised).not.toMatch(/role/);
      expect(names.length).toBeGreaterThan(0);
    }
  });
});
