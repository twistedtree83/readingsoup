import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor, rosterTokens } from "../src/core/view.js";
import { CONFIG } from "../src/core/config.js";
import { CARD_LABELS, IMPLEMENTED } from "../src/core/conditions.js";
import { PASSAGES, DICTATION } from "../src/core/passages.js";
import { fullDeck } from "../src/core/deck.js";

// The split this slice encodes: the human owns who reads, the app owns which
// barrier they get. Everything below is asserted through the reducer and the
// views — never against internal shape — so it survives a rewrite of either.

const step = (s, event) => reduce(s, { at: 0, ...event }, CONFIG).state;

function room(n, { observerEvery = 4, seed = 7 } = {}) {
  let s = step(initialState(), { type: "OPEN_ROOM", roomCode: "4417", token: "host", seed });
  for (let i = 0; i < n; i++) {
    s = step(s, {
      type: "JOIN",
      token: `p${i}`,
      name: `P${i}`,
      role: i % observerEvery === 1 ? "observer" : "participant",
    });
  }
  return s;
}

// Everyone meets a barrier privately first. Spotlight selection has to work
// around what the silent round already handed out, so tests start from there.
const afterSilent = (s) => step(step(s, { type: "START_SILENT" }), { type: "END_SILENT" });

const tokensOf = (s, role) =>
  Object.values(s.participants).filter((p) => p.role === role).map((p) => p.token);

// Run `rounds` spotlights, recording who read and what they got. `choose`
// returns the START_ROUND event, so a test can pick by name or draw at random.
function spotlights(s, rounds, choose = () => ({ type: "START_ROUND", random: true })) {
  const log = [];
  for (let i = 0; i < rounds; i++) {
    const before = s;
    s = step(s, choose(s, i));
    if (s.phase !== "round") {
      s = before;
      break;
    }
    log.push({ reader: s.round.reader, condition: s.round.condition, kind: s.round.kind });
    s = step(s, { type: "DONE", token: s.round.reader });
    s = step(s, { type: "END_ROUND" });
  }
  return { state: s, log };
}

describe("the app owns the condition", () => {
  for (const size of [8, 20]) {
    test(`at ${size} participants, eight spotlights cover all six barriers`, () => {
      for (const seed of [1, 7, 23, 404, 91_357]) {
        const { log } = spotlights(afterSilent(room(size, { seed })), 8);
        const seen = new Set(log.map((r) => r.condition));
        expect(log.length, `seed ${seed}: rounds ran`).toBe(8);
        expect([...seen].sort(), `seed ${seed}: coverage`).toEqual([...IMPLEMENTED].sort());
      }
    });
  }

  test("the typing barrier is spotlighted — it is the only place it can appear", () => {
    const { log } = spotlights(afterSilent(room(8)), 8);
    const typed = log.filter((r) => r.kind === "typing");
    expect(typed.length).toBeGreaterThan(0);
    expect(typed[0].condition).toBe("butterfingers");
  });

  test("the least-spotlighted barrier goes next, so nothing is shown twice before everything is shown once", () => {
    const { log } = spotlights(afterSilent(room(20)), 6);
    const counts = {};
    for (const r of log) counts[r.condition] = (counts[r.condition] ?? 0) + 1;
    expect(Object.values(counts).every((n) => n === 1)).toBe(true);
  });

  test("nobody is ever handed a barrier they have already had", () => {
    for (const seed of [1, 7, 23, 404, 91_357]) {
      let s = afterSilent(room(8, { seed }));
      const had = {};
      for (const t of Object.keys(s.participants)) had[t] = [...(s.participants[t].seen ?? [])];

      for (let i = 0; i < 8; i++) {
        const before = s;
        s = step(s, { type: "START_ROUND", random: true });
        if (s.phase !== "round") {
          s = before;
          break;
        }
        const { reader, condition } = s.round;
        expect(had[reader], `seed ${seed}: ${reader} repeated ${condition}`).not.toContain(condition);
        had[reader].push(condition);
        s = step(step(s, { type: "DONE", token: reader }), { type: "END_ROUND" });
      }

      for (const [token, list] of Object.entries(had)) {
        expect(new Set(list).size, `seed ${seed}: ${token} has a duplicate`).toBe(list.length);
      }
    }
  });

  test("a participant who has had all six is never put in the reader seat again", () => {
    let s = afterSilent(room(8));
    // Exhaust one person by hand, then ask for them again.
    s = { ...s, participants: { ...s.participants, p0: { ...s.participants.p0, seen: [...IMPLEMENTED] } } };
    const attempted = step(s, { type: "START_ROUND", reader: "p0" });
    expect(attempted.phase).toBe("lobby");

    const { log } = spotlights(s, 8);
    expect(log.some((r) => r.reader === "p0")).toBe(false);
  });
});

describe("an observer is never eligible to read", () => {
  test("a random draw never lands on one, at any size", () => {
    for (const size of [2, 5, 8, 20]) {
      for (const seed of [1, 7, 23, 404, 91_357]) {
        const s = afterSilent(room(size, { seed }));
        const observers = tokensOf(s, "observer");
        const { log } = spotlights(s, 8);
        for (const r of log) {
          expect(observers, `${size}p seed ${seed}: drew an observer`).not.toContain(r.reader);
        }
      }
    }
  });

  test("naming one directly does nothing at all", () => {
    const s = afterSilent(room(8));
    const observer = tokensOf(s, "observer")[0];
    expect(observer).toBeTruthy();
    const attempted = step(s, { type: "START_ROUND", reader: observer });
    expect(attempted.phase).toBe("lobby");
    expect(attempted.round).toBeFalsy();
    expect(attempted.participants[observer].seen ?? []).toEqual([]);
  });
});

describe("volunteers", () => {
  test("a volunteer surfaces at the top of the roster", () => {
    let s = afterSilent(room(8));
    const late = "p6";
    expect(s.participants[late].role).toBe("participant");
    s = step(s, { type: "VOLUNTEER", token: late });

    const roster = viewFor(s, "host").roster;
    expect(roster[0].name).toBe("P6");
    expect(roster[0].volunteered).toBe(true);
    expect(roster.length).toBe(8);
  });

  test("the roster the facilitator taps and the tokens it resolves to stay in step", () => {
    let s = afterSilent(room(8));
    s = step(s, { type: "VOLUNTEER", token: "p6" });
    s = step(s, { type: "VOLUNTEER", token: "p4" });

    const names = viewFor(s, "host").roster.map((r) => r.name);
    const tokens = rosterTokens(s);
    expect(tokens.length).toBe(names.length);
    tokens.forEach((t, i) => expect(s.participants[t].name).toBe(names[i]));
  });

  test("a volunteer stops being one once they have read", () => {
    let s = afterSilent(room(8));
    s = step(s, { type: "VOLUNTEER", token: "p6" });
    s = step(s, { type: "START_ROUND", reader: "p6" });
    s = step(step(s, { type: "DONE", token: "p6" }), { type: "END_ROUND" });
    expect(viewFor(s, "host").roster.find((r) => r.name === "P6").volunteered).toBe(false);
  });

  test("a phone knows it has volunteered, and offers the option in the first place", () => {
    let s = afterSilent(room(8));
    expect(viewFor(s, "p6").canVolunteer).toBe(true);
    expect(viewFor(s, "p6").volunteered).toBe(false);
    s = step(s, { type: "VOLUNTEER", token: "p6" });
    expect(viewFor(s, "p6").volunteered).toBe(true);
  });

  // An "I'll go" button that only participants can see is a phone-shaped tell:
  // the person beside you can read your screen. So observers get the same
  // button and the same confirmed state — and it reaches the projector for
  // nobody, because an observer must never be surfaced as a willing reader.
  test("an observer sees the same button and the same result on their own phone", () => {
    let s = afterSilent(room(8));
    const observer = tokensOf(s, "observer")[0];
    expect(viewFor(s, observer).canVolunteer).toBe(true);
    s = step(s, { type: "VOLUNTEER", token: observer });
    expect(viewFor(s, observer).volunteered).toBe(true);
  });

  test("an observer's volunteering never reaches the projector", () => {
    let s = afterSilent(room(8));
    const observer = tokensOf(s, "observer")[0];
    s = step(s, { type: "VOLUNTEER", token: observer });

    const roster = viewFor(s, "host").roster;
    expect(roster.every((r) => r.volunteered === false)).toBe(true);
    // ...and the order is untouched, which is the part that would give it away.
    expect(roster.map((r) => r.name)).toEqual(viewFor(afterSilent(room(8)), "host").roster.map((r) => r.name));
  });

  test("a volunteer is not thereby chosen — the human still picks", () => {
    let s = afterSilent(room(8));
    s = step(s, { type: "VOLUNTEER", token: "p6" });
    expect(s.phase).toBe("lobby");
    expect(s.round).toBeFalsy();
  });
});

describe("the facilitator plans the spotlights, and can stop early", () => {
  test("a count is set up front against a live time estimate", () => {
    let s = room(8);
    const options = viewFor(s, "host").spotlight.options;
    expect(options.length).toBe(CONFIG.spotlight.maxRounds);
    expect(options[0].count).toBe(1);
    expect(options.at(-1).count).toBe(CONFIG.spotlight.maxRounds);
    // The estimate is what the facilitator plans the slot against, so it has to
    // move with the count rather than being decoration.
    expect(options.at(-1).estimateMs).toBeGreaterThan(options[0].estimateMs);

    s = step(s, { type: "SET_SPOTLIGHT_COUNT", count: 5 });
    const plan = viewFor(s, "host").spotlight;
    expect(plan.planned).toBe(5);
    expect(plan.estimateMs).toBe(5 * CONFIG.spotlight.roundEstimateMs);
  });

  test("the count is capped at eight however it is asked for", () => {
    for (const asked of [9, 20, 1000]) {
      const s = step(room(8), { type: "SET_SPOTLIGHT_COUNT", count: asked });
      expect(viewFor(s, "host").spotlight.planned).toBe(CONFIG.spotlight.maxRounds);
    }
    const none = step(room(8), { type: "SET_SPOTLIGHT_COUNT", count: -3 });
    expect(viewFor(none, "host").spotlight.planned).toBe(1);
  });

  test("no ninth spotlight can start, whatever the plan said", () => {
    const { state, log } = spotlights(afterSilent(room(20)), 12);
    expect(log.length).toBe(CONFIG.spotlight.maxRounds);
    expect(viewFor(state, "host").spotlight.done).toBe(CONFIG.spotlight.maxRounds);
    expect(step(state, { type: "START_ROUND", random: true }).phase).toBe("lobby");
  });

  test("the facilitator can end spotlights at any point, and no round starts after", () => {
    let s = afterSilent(room(8));
    s = step(s, { type: "SET_SPOTLIGHT_COUNT", count: 6 });
    s = spotlights(s, 2).state;
    expect(viewFor(s, "host").spotlight.done).toBe(2);

    s = step(s, { type: "END_SPOTLIGHTS" });
    expect(viewFor(s, "host").spotlight.ended).toBe(true);
    expect(step(s, { type: "START_ROUND", random: true }).phase).toBe("lobby");
    expect(step(s, { type: "START_ROUND", reader: "p0" }).phase).toBe("lobby");
  });

  test("progress is on the projector while a spotlight runs", () => {
    let s = step(afterSilent(room(8)), { type: "SET_SPOTLIGHT_COUNT", count: 4 });
    s = step(s, { type: "START_ROUND", random: true });
    const v = viewFor(s, "host");
    expect(v.spotlight.index).toBe(1);
    expect(v.spotlight.planned).toBe(4);
  });
});

describe("a spotlight round still tells the room nothing", () => {
  const CONTENT = [...PASSAGES, ...DICTATION].flatMap((p) =>
    p.text.split(/\s+/).filter((w) => w.replace(/[^A-Za-z]/g, "").length > 4)
  );
  // Card names legitimately reach every phone, and one of them contains a word
  // the passages also use. Removing them first keeps the scan honest in both
  // directions: no false alarm, no weakened rule.
  const withoutCards = (s) =>
    [...fullDeck(), ...Object.values(CARD_LABELS)].reduce((acc, w) => acc.split(w).join(""), s);

  test("the reader gets a task and everybody else gets a person to watch", () => {
    for (const size of [2, 5, 8, 20]) {
      let s = afterSilent(room(size));
      for (let i = 0; i < 6; i++) {
        const before = s;
        s = step(s, { type: "START_ROUND", random: true });
        if (s.phase !== "round") {
          s = before;
          break;
        }
        const reader = s.round.reader;
        const rv = viewFor(s, reader);
        expect(rv.reader, `${size}p: the reader got no task`).toBe(true);
        expect(Array.isArray(rv.tokens) || typeof rv.prompt === "string").toBe(true);

        for (const token of Object.keys(s.participants)) {
          if (token === reader || token === "host") continue;
          const v = viewFor(s, token);
          expect(v.tokens, `${size}p: ${token} received tokens`).toBeUndefined();
          expect(v.prompt, `${size}p: ${token} received a prompt`).toBeUndefined();
          expect(v.watching).toBe(true);
          const serialised = withoutCards(JSON.stringify(v));
          for (const word of CONTENT) {
            if (serialised.includes(word)) throw new Error(`${size}p: ${token} leaked "${word}"`);
          }
        }
        s = step(step(s, { type: "DONE", token: reader }), { type: "END_ROUND" });
      }
    }
  });

  test("nothing in any view names the barrier the reader is under", () => {
    let s = afterSilent(room(8));
    s = step(s, { type: "START_ROUND", random: true });
    const condition = s.round.condition;
    for (const token of [...Object.keys(s.participants), "stranger"]) {
      const serialised = JSON.stringify(viewFor(s, token));
      expect(serialised, `${token} was told the barrier`).not.toContain(condition);
    }
  });

  test("only the reader can type, and only into their own round", () => {
    let s = afterSilent(room(8));
    // Drive to a typing spotlight: butterfingers is the last of the six to come up.
    let guard = 0;
    while (s.round?.kind !== "typing" && guard++ < 8) {
      if (s.phase === "round") s = step(step(s, { type: "DONE", token: s.round.reader }), { type: "END_ROUND" });
      s = step(s, { type: "START_ROUND", random: true });
    }
    expect(s.round?.kind).toBe("typing");

    const reader = s.round.reader;
    const intruder = Object.keys(s.participants).find((t) => t !== reader && t !== "host");
    const meddled = step(s, { type: "TYPE", token: intruder, intended: "not mine to type" });
    expect(meddled.round.intended).toBe("");

    const typed = step(s, { type: "TYPE", token: reader, intended: "wombat" });
    expect(typed.round.intended).toBe("wombat");
    expect(viewFor(typed, intruder).output).toBeUndefined();
  });
});
