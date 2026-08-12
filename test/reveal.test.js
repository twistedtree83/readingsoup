import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor } from "../src/core/view.js";
import { CONFIG } from "../src/core/config.js";
import { IMPLEMENTED, CONDITION_LABELS, FIXES, CARD_LABELS } from "../src/core/conditions.js";
import { DEBRIEF } from "../src/core/passages.js";

// The payoff. Six things you can do on Monday on the projector, your own
// barriers on your own phone, and no person-to-condition map anywhere.

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

// A whole group session: silent round, a couple of spotlights, then the reveal.
function session(n, { spotlights = 2, observers = ["p1"], seed = 7 } = {}) {
  let s = step(room(n, { observers, seed }), { type: "START_SESSION" });
  s = step(s, { type: "END_SILENT" });
  for (let i = 0; i < spotlights; i++) {
    s = step(s, { type: "START_ROUND", random: true }, T0 + i * 60_000);
    if (s.phase !== "round") break;
    s = step(s, { type: "DONE", token: s.round.reader }, T0 + i * 60_000 + 1000);
    s = step(s, { type: "END_ROUND" }, T0 + i * 60_000 + 2000);
  }
  return step(s, { type: "START_REVEAL" }, T0 + 600_000);
}

describe("the projector shows six things you can do on Monday", () => {
  test("all six barriers, each with its description and the support that lifts it", () => {
    const v = viewFor(session(8), "host");
    expect(v.phase).toBe("catalogue");
    expect(v.catalogue.length).toBe(IMPLEMENTED.length);
    for (const item of v.catalogue) {
      expect(item.label).toBe(CONDITION_LABELS[item.condition]);
      expect(item.description.length).toBeGreaterThan(20);
      expect(item.card).toBe(FIXES[item.condition]);
      expect(item.cardLabel).toBe(CARD_LABELS[item.card]);
    }
  });

  test("no participant name appears on it, and nothing is marked as anyone's", () => {
    const s = session(8);
    const v = viewFor(s, "host");
    const serialised = JSON.stringify(v);
    for (const p of Object.values(s.participants)) {
      if (!p.name) continue;
      expect(serialised, `the projector named ${p.name}`).not.toContain(p.name);
    }
    // "had" is a per-phone mark. It has no business on a screen the whole room
    // can see, at any value.
    for (const item of v.catalogue) expect(item.had).toBeUndefined();
  });

  test("it is framed as actions, not diagnoses", () => {
    const v = viewFor(session(8), "host");
    const serialised = JSON.stringify(v).toLowerCase();
    for (const word of ["dyslexi", "disorder", "deficit", "impairment", "diagnos", "condition:"]) {
      expect(serialised, `the reveal used "${word}"`).not.toContain(word);
    }
    for (const item of v.catalogue) expect(item.cardLabel).toBeTruthy();
  });
});

describe("your barriers are yours", () => {
  test("a phone marks what that person actually had, and only that", () => {
    const s = session(8, { spotlights: 3 });
    for (const [token, p] of Object.entries(s.participants)) {
      if (token === "host") continue;
      const v = viewFor(s, token);
      const marked = v.catalogue.filter((c) => c.had).map((c) => c.condition).sort();
      expect(marked, `${token}`).toEqual([...(p.seen ?? [])].sort());
    }
  });

  test("no view sent to anybody contains somebody else's barrier", () => {
    const s = session(20, { spotlights: 4, observers: ["p1", "p5", "p9"] });
    const tokens = Object.keys(s.participants).filter((t) => t !== "host");

    for (const me of tokens) {
      const mine = new Set(s.participants[me].seen ?? []);
      const marked = new Set(
        viewFor(s, me).catalogue.filter((c) => c.had).map((c) => c.condition)
      );
      expect([...marked].sort(), `${me} was shown the wrong set`).toEqual([...mine].sort());

      // And nothing in the view ties any OTHER name to any barrier.
      const serialised = JSON.stringify(viewFor(s, me));
      for (const other of tokens) {
        if (other === me) continue;
        expect(serialised, `${me} can see ${other}`).not.toContain(s.participants[other].name);
        expect(serialised, `${me} holds ${other}'s token`).not.toContain(`"${other}"`);
      }
    }
  });

  test("an observer sees the catalogue with nothing marked", () => {
    const s = session(8, { observers: ["p1"] });
    const v = viewFor(s, "p1");
    expect(v.catalogue.length).toBe(IMPLEMENTED.length);
    expect(v.catalogue.every((c) => c.had === false)).toBe(true);
    // ...and it looks exactly like the catalogue of somebody who happened to
    // have nothing marked, which is the point.
    expect(Object.keys(v).sort()).toEqual(Object.keys(viewFor(s, "p0")).sort());
  });

  test("the app never publishes a person-to-condition map, on any screen", () => {
    const s = session(8, { spotlights: 3 });
    for (const who of [...Object.keys(s.participants), "stranger"]) {
      const serialised = JSON.stringify(viewFor(s, who));
      expect(serialised).not.toMatch(/"assigned"|"whoHad"|"byPerson"|"seen":/);
    }
  });
});

describe("the reveal is complete however the session went", () => {
  test("everybody active has something marked, after only two spotlights", () => {
    const s = session(20, { spotlights: 2, observers: ["p1"] });
    const active = Object.values(s.participants).filter((p) => p.role === "participant");
    expect(active.length).toBe(19);
    for (const p of active) {
      const marked = viewFor(s, p.token).catalogue.filter((c) => c.had);
      expect(marked.length, `${p.name} came up blank`).toBeGreaterThan(0);
    }
  });

  test("the same holds when the facilitator stops after none at all", () => {
    const s = session(20, { spotlights: 0 });
    for (const p of Object.values(s.participants).filter((p) => p.role === "participant")) {
      expect(viewFor(s, p.token).catalogue.some((c) => c.had), `${p.name}`).toBe(true);
    }
  });

  test("and when they run the full eight", () => {
    const s = session(20, { spotlights: 8 });
    for (const p of Object.values(s.participants).filter((p) => p.role === "participant")) {
      expect(viewFor(s, p.token).catalogue.some((c) => c.had), `${p.name}`).toBe(true);
    }
  });

  test("the solo tour still ends in its own catalogue", () => {
    let s = step(initialState(), { type: "START_SOLO", participantId: "me", seed: 3 }, 0);
    for (let i = 0; i < IMPLEMENTED.length; i++) s = step(s, { type: "DONE", participantId: "me" }, i);
    expect(s.phase).toBe("catalogue");
    expect(viewFor(s, "me").catalogue.every((c) => c.had)).toBe(true);
  });
});

describe("the debrief", () => {
  test("three prompts, one at a time, advanced by hand", () => {
    let s = session(8);
    expect(viewFor(s, "host").debrief).toBeUndefined();

    for (let i = 0; i < DEBRIEF.length; i++) {
      s = step(s, { type: "NEXT_PROMPT" }, T0 + 700_000 + i);
      const d = viewFor(s, "host").debrief;
      expect(d.index).toBe(i + 1);
      expect(d.total).toBe(DEBRIEF.length);
      expect(d.prompt).toBe(DEBRIEF[i]);
    }
  });

  test("it stops at the last one rather than falling off the end", () => {
    let s = session(8);
    for (let i = 0; i < 10; i++) s = step(s, { type: "NEXT_PROMPT" }, T0 + 700_000 + i);
    const d = viewFor(s, "host").debrief;
    expect(d.index).toBe(DEBRIEF.length);
    expect(d.prompt).toBe(DEBRIEF.at(-1));
  });

  test("the prompts are the facilitator's to say out loud, not a phone's", () => {
    let s = step(session(8), { type: "NEXT_PROMPT" }, T0 + 700_000);
    for (const token of Object.keys(s.participants)) {
      if (token === "host") continue;
      expect(viewFor(s, token).debrief, token).toBeUndefined();
    }
  });

  test("the catalogue stays up behind them", () => {
    const s = step(session(8), { type: "NEXT_PROMPT" }, T0 + 700_000);
    expect(viewFor(s, "host").catalogue.length).toBe(IMPLEMENTED.length);
    expect(viewFor(s, "p0").catalogue.length).toBe(IMPLEMENTED.length);
  });

  test("showing the six again rewinds the discussion", () => {
    // A facilitator who clicks one question too far, or who walks into a room
    // left on the last slide of somebody else's session, needs a way back.
    // This used to return early once the catalogue was up, which made the
    // discussion one-way and left the reveal with no working control at all.
    let s = session(8);
    for (let i = 0; i < 3; i++) s = step(s, { type: "NEXT_PROMPT" }, T0 + 700_000 + i);
    expect(viewFor(s, "host").debrief.index).toBe(3);

    s = step(s, { type: "START_REVEAL" }, T0 + 800_000);
    expect(viewFor(s, "host").debrief).toBeUndefined();
    expect(viewFor(s, "host").catalogue.length).toBe(IMPLEMENTED.length);
    // ...and the questions still run from the top afterwards.
    s = step(s, { type: "NEXT_PROMPT" }, T0 + 801_000);
    expect(viewFor(s, "host").debrief.prompt).toBe(DEBRIEF[0]);
  });

  test("a prompt outside the reveal is nothing", () => {
    const s = step(room(8), { type: "NEXT_PROMPT" });
    expect(s.phase).toBe("lobby");
    expect(viewFor(s, "host").debrief).toBeUndefined();
  });
});
