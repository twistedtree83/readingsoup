import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor } from "../src/core/view.js";
import { CONFIG } from "../src/core/config.js";
import { IMPLEMENTED, FIXES, CONDITIONS } from "../src/core/conditions.js";
import { RESEARCH, THE_SPINE, ON_SIMULATIONS } from "../src/core/research.js";

// The explanation, and the two rules it must never break: it may not turn the
// activity into a diagnosis, and it may not reach a screen the whole room can
// see.

const T0 = 10_000;
const step = (s, event, at = T0) => reduce(s, { at, ...event }, CONFIG).state;

function room(n = 8, { seed = 7 } = {}) {
  let s = step(initialState(), { type: "OPEN_ROOM", roomCode: "4417", token: "host", seed }, 0);
  for (let i = 0; i < n; i++) {
    s = step(s, { type: "JOIN", token: `p${i}`, name: `P${i}`, role: i % 4 === 1 ? "observer" : "participant" }, 0);
  }
  return s;
}

const revealed = () => {
  let s = step(step(room(8), { type: "START_SESSION" }), { type: "END_SILENT" }, T0 + 100_000);
  return step(s, { type: "START_REVEAL" }, T0 + 200_000);
};

const allText = (entry) =>
  [entry.standsFor, entry.notice, entry.caution ?? "", ...(entry.sources ?? []).map((x) => `${x.cite} ${x.note ?? ""}`)]
    .join(" ");

describe("every barrier has an explanation, and it points somewhere", () => {
  test("all six are covered", () => {
    for (const condition of IMPLEMENTED) {
      const entry = RESEARCH[condition];
      expect(entry, condition).toBeTruthy();
      expect(entry.standsFor.length, condition).toBeGreaterThan(80);
      expect(entry.notice.length, condition).toBeGreaterThan(40);
    }
  });

  test("every claim carries a source somebody can go and check", () => {
    const entries = [...Object.values(RESEARCH), THE_SPINE, ON_SIMULATIONS];
    for (const entry of entries) {
      expect(entry.sources.length).toBeGreaterThan(0);
      for (const source of entry.sources) {
        expect(source.cite.length).toBeGreaterThan(30);
        expect(source.url).toMatch(/^https:\/\//);
      }
    }
  });

  test("the two entries the evidence contradicts say so", () => {
    // Coloured overlays and "tracking" training are the two things a teacher is
    // most likely to be sold on the back of an activity like this, and the
    // evidence does not support either. Silence would leave the app implying
    // them.
    expect(RESEARCH[CONDITIONS.FOG].caution).toBeTruthy();
    expect(RESEARCH[CONDITIONS.SLIPPERY].caution).toBeTruthy();
    expect(RESEARCH[CONDITIONS.FOG].caution.toLowerCase()).toContain("overlay");
    expect(RESEARCH[CONDITIONS.SLIPPERY].caution.toLowerCase()).toContain("tracking");
  });

  test("nothing claims this is what anybody sees", () => {
    // The whole framing is cost, not perception. "This is how a dyslexic person
    // sees the page" is the one sentence this app must never contain.
    const everything = [...Object.values(RESEARCH).map(allText), THE_SPINE.body, ON_SIMULATIONS.body]
      .join(" ")
      .toLowerCase();
    for (const phrase of ["what they see", "how they see", "sees the page", "looks like this", "letters move", "letters jump"]) {
      expect(everything, `research claims "${phrase}"`).not.toContain(phrase);
    }
  });

  test("it tells teachers to notice, never to diagnose", () => {
    const mudsound = RESEARCH[CONDITIONS.MUDSOUND];
    expect(mudsound.caution.toLowerCase()).toContain("diagnos");
    // ...and specifically that diagnosing is not their job.
    expect(mudsound.caution.toLowerCase()).toContain("not");
  });

  test("the activity's own evidence problem is included, not quietly dropped", () => {
    // Simulations can raise pity and lower perceived competence. Citing the
    // research that supports the activity while omitting the research that
    // complicates it would be the dishonest half of the job.
    expect(ON_SIMULATIONS.body.toLowerCase()).toContain("pity");
    expect(ON_SIMULATIONS.sources[0].url).toMatch(/pubmed/);
  });
});

describe("where it is allowed to appear", () => {
  test("on a phone at the reveal, against every barrier", () => {
    const s = revealed();
    const v = viewFor(s, "p0");
    expect(v.catalogue.length).toBe(IMPLEMENTED.length);
    for (const item of v.catalogue) {
      expect(item.research, item.condition).toBeTruthy();
      expect(item.research.notice.length).toBeGreaterThan(0);
    }
    expect(v.reading.map((r) => r.title)).toEqual([THE_SPINE.title, ON_SIMULATIONS.title]);
  });

  test("never on the projector", () => {
    // Six items in projector type, no names, and no essays. The room should be
    // talking at that point, not reading citations off a wall.
    const v = viewFor(revealed(), "host");
    expect(v.catalogue.length).toBe(IMPLEMENTED.length);
    for (const item of v.catalogue) expect(item.research, item.condition).toBeUndefined();
    expect(v.reading).toBeUndefined();
    expect(JSON.stringify(v)).not.toContain("pubmed");
  });

  test("an observer gets the same explanation as everybody else", () => {
    const s = revealed();
    const observer = viewFor(s, "p1");
    expect(observer.catalogue.map((c) => c.research?.notice)).toEqual(
      viewFor(s, "p0").catalogue.map((c) => c.research?.notice)
    );
  });
});

describe("the reader gets theirs only once the puzzle is solved", () => {
  const solo = () => step(initialState(), { type: "START_SOLO", participantId: "me", seed: 3 }, 0);

  test("nothing while the barrier is still unnamed", () => {
    const v = viewFor(solo(), "me");
    expect(v.accommodated).toBe(false);
    expect(v.research).toBeUndefined();
    expect(v.researchTitle).toBeUndefined();
    // Naming it here would hand over the answer to the card they are choosing.
    expect(JSON.stringify(v)).not.toContain("Soup");
  });

  test("and the barrier named, with its entry, the moment the card lands", () => {
    let s = solo();
    const condition = s.round.condition;
    s = step(s, { type: "PLAY_CARD", card: FIXES[condition] }, 1);
    const v = viewFor(s, "me");
    expect(v.research.standsFor).toBe(RESEARCH[condition].standsFor);
    expect(v.researchTitle).toBeTruthy();
  });

  test("through the whole tour, including the typed round", () => {
    let s = solo();
    const seen = [];
    for (let i = 0; i < IMPLEMENTED.length; i++) {
      s = step(s, { type: "PLAY_CARD", card: FIXES[s.round.condition] }, i * 10 + 1);
      const v = viewFor(s, "me");
      expect(v.research, s.round.condition).toBeTruthy();
      seen.push(s.round.condition);
      s = step(s, { type: "DONE", participantId: "me" }, i * 10 + 2);
    }
    expect(seen.sort()).toEqual([...IMPLEMENTED].sort());
  });

  test("nobody else in the room is handed the reader's barrier", () => {
    let s = step(room(8), { type: "START_ROUND", reader: "p0" }, T0);
    const condition = s.round.condition;
    const holder = Object.values(s.participants).find(
      (p) => p.token !== "p0" && (p.hand ?? []).includes(FIXES[condition])
    );
    s = step(s, { type: "PLAY_CARD", token: holder.token, card: FIXES[condition] },
      T0 + CONFIG.round.watchWindowMs);

    for (const token of Object.keys(s.participants)) {
      if (token === "p0") continue;
      const v = viewFor(s, token);
      expect(v.research, token).toBeUndefined();
      expect(JSON.stringify(v), token).not.toContain(RESEARCH[condition].standsFor.slice(0, 40));
    }
  });
});
