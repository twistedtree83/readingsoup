import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor, tagTokens } from "../src/core/view.js";
import { CONFIG } from "../src/core/config.js";
import { FIXES } from "../src/core/conditions.js";

// Handing the passage over is a move in the game, never giving up. The wording
// matters as much as the mechanic, and so does what does NOT happen: no accept
// step, no reset of the clock, no second chance for the room.

const WINDOW = CONFIG.round.watchWindowMs;
const T0 = 10_000;
const step = (s, event, at = T0) => reduce(s, { at, ...event }, CONFIG).state;

function room(n, { seed = 7 } = {}) {
  let s = step(initialState(), { type: "OPEN_ROOM", roomCode: "4417", token: "host", seed }, 0);
  for (let i = 0; i < n; i++) {
    s = step(s, { type: "JOIN", token: `p${i}`, name: `P${i}`, role: i % 4 === 1 ? "observer" : "participant" }, 0);
  }
  return step(s, { type: "START_ROUND", reader: "p0" }, T0);
}

const tagTo = (s, token, at = T0 + 5000) =>
  step(s, { type: "TAG_IN", token: s.round.reader, to: token }, at);

describe("handing it over", () => {
  test("the tagged colleague is the reader immediately, with no accept step", () => {
    const s = room(8);
    const after = tagTo(s, "p2");
    expect(after.round.reader).toBe("p2");
    expect(viewFor(after, "p2").reader).toBe(true);
    expect(viewFor(after, "p0").watching).toBe(true);
    // Nothing anywhere is waiting on an answer.
    expect(after.round.pendingTag).toBeUndefined();
  });

  test("they get the same barrier and the same passage, from the start", () => {
    const s = room(8);
    const { condition, passageId } = s.round;
    const after = tagTo(s, "p2");

    expect(after.round.condition).toBe(condition);
    expect(after.round.passageId).toBe(passageId);
    const v = viewFor(after, "p2");
    expect(v.tokens.length).toBe(viewFor(s, "p0").tokens.length);
    expect(v.render).toEqual(viewFor(s, "p0").render);
  });

  test("the clock does not restart and the room does not get its plays back", () => {
    let s = room(8);
    s = step(s, { type: "TICK" }, T0 + WINDOW);
    const card = s.participants.p2.hand[0];
    s = step(s, { type: "PLAY_CARD", token: "p2", card }, T0 + WINDOW);
    expect(s.round.plays).toBe(1);

    const after = tagTo(s, "p3", T0 + WINDOW + 1000);
    // The window belongs to the round, not the reader: cards stay live through
    // the handover, and the plays already spent stay spent.
    expect(after.round.startedAt).toBe(T0);
    expect(after.round.locked).toBe(false);
    expect(after.round.plays).toBe(1);
    expect(viewFor(after, "p4").playsLeft).toBe(CONFIG.round.playsPerRound - 1);
  });

  test("the seats swap, and so do the hands", () => {
    const s = room(8);
    const readerHandBefore = s.participants.p0.hand ?? [];
    const taggedHand = s.participants.p2.hand;
    expect(readerHandBefore).toEqual([]);

    const after = tagTo(s, "p2");
    // The new reader puts their cards down; the old one picks them up. The table
    // keeps exactly the same cards on it, which is what keeps the guarantee that
    // somebody holds the one that lifts this barrier.
    expect(after.participants.p2.hand).toEqual([]);
    expect(after.participants.p0.hand).toEqual(taggedHand);
    expect(viewFor(after, "p0").hand).toEqual(taggedHand);
    expect(viewFor(after, "p2").hand).toBeUndefined();
  });

  test("the card that lifts the barrier is still on the table afterwards", () => {
    for (const seed of [1, 7, 23, 404, 91_357]) {
      const s = room(8, { seed });
      const fix = FIXES[s.round.condition];
      const holder = Object.keys(s.participants).find(
        (t) => t !== "host" && (s.participants[t].hand ?? []).includes(fix)
      );
      // Tag in the very person holding it — the case that would strand the room.
      const after = tagTo(s, holder);
      const stillHeld = Object.keys(after.participants).some(
        (t) => t !== "host" && t !== after.round.reader && (after.participants[t].hand ?? []).includes(fix)
      );
      expect(stillHeld, `seed ${seed}: tagging in the holder stranded the room`).toBe(true);
    }
  });

  test("a spent card stays spent when the hand changes hands", () => {
    let s = room(8);
    s = step(s, { type: "TICK" }, T0 + WINDOW);
    const card = s.participants.p2.hand[0];
    s = step(s, { type: "PLAY_CARD", token: "p2", card }, T0 + WINDOW);
    const after = tagTo(s, "p2", T0 + WINDOW + 500);

    expect(after.participants.p0.spent).toContain(card);
    const replay = step(after, { type: "PLAY_CARD", token: "p0", card }, T0 + WINDOW + 1000);
    expect(replay.round.plays).toBe(1);
  });

  test("it chains as many times as the room needs", () => {
    let s = room(20);
    const chain = ["p2", "p3", "p4", "p6", "p7"];
    for (const to of chain) {
      s = tagTo(s, to, T0 + 5000);
      expect(s.round.reader).toBe(to);
    }
    expect(s.round.startedAt).toBe(T0);
    expect(viewFor(s, "p7").reader).toBe(true);
    expect(viewFor(s, "p2").watching).toBe(true);
  });

  test("a typed round hands over a clean keyboard, not half a sentence", () => {
    let s = room(8);
    let guard = 0;
    while (s.round?.kind !== "typing" && guard++ < 8) {
      s = step(step(s, { type: "DONE", token: s.round.reader }, T0), { type: "END_ROUND" }, T0);
      s = step(s, { type: "START_ROUND", random: true }, T0);
    }
    expect(s.round.kind).toBe("typing");
    s = step(s, { type: "TYPE", token: s.round.reader, intended: "halfway through" }, T0);

    const to = Object.keys(s.participants).find(
      (t) => t !== "host" && t !== s.round.reader && s.participants[t].role === "participant" &&
        !(s.participants[t].seen ?? []).includes(s.round.condition)
    );
    const after = tagTo(s, to);
    expect(after.round.reader).toBe(to);
    expect(after.round.intended).toBe("");
    expect(after.round.output).toBe("");
    expect(viewFor(after, to).prompt).toBe(s.round.promptText);
  });
});

describe("who can be tagged", () => {
  test("an observer never can — they are never called on", () => {
    const s = room(8);
    expect(s.participants.p1.role).toBe("observer");
    const after = tagTo(s, "p1");
    expect(after.round.reader).toBe("p0");
    expect(after.participants.p1.seen ?? []).toEqual([]);
  });

  test("nor can somebody who has already had this barrier", () => {
    let s = room(8);
    const condition = s.round.condition;
    s = { ...s, participants: { ...s.participants, p2: { ...s.participants.p2, seen: [condition] } } };
    const after = tagTo(s, "p2");
    expect(after.round.reader).toBe("p0");
  });

  test("the reader cannot tag themselves, and a stranger cannot tag anybody", () => {
    const s = room(8);
    expect(tagTo(s, "p0").round.reader).toBe("p0");
    expect(step(s, { type: "TAG_IN", token: "p3", to: "p4" }).round.reader).toBe("p0");
  });

  test("the reader is offered names, and the same list resolves to the same people", () => {
    const s = room(8);
    const v = viewFor(s, "p0");
    expect(v.canTagIn).toBe(true);
    expect(v.tagList.length).toBeGreaterThan(0);

    const tokens = tagTokens(s);
    expect(tokens.length).toBe(v.tagList.length);
    tokens.forEach((t, i) => expect(s.participants[t].name).toBe(v.tagList[i].name));
    // Names travel; tokens never do. A token on somebody else's phone would let
    // them act as that person.
    const serialised = JSON.stringify(v);
    for (const t of tokens) expect(serialised).not.toContain(`"${t}"`);
  });

  test("the list holds no observers and nobody who has had this barrier", () => {
    let s = room(20);
    const condition = s.round.condition;
    s = { ...s, participants: { ...s.participants, p4: { ...s.participants.p4, seen: [condition] } } };

    const eligible = tagTokens(s);
    for (const t of eligible) {
      expect(s.participants[t].role).toBe("participant");
      expect(s.participants[t].seen ?? []).not.toContain(condition);
    }
    expect(eligible).not.toContain("p4");
    expect(eligible).not.toContain("p1");
    expect(eligible).not.toContain(s.round.reader);
  });

  test("nobody but the reader is offered the control", () => {
    const s = room(8);
    for (const t of ["p1", "p2", "p3", "host"]) {
      expect(viewFor(s, t).canTagIn, t).toBeFalsy();
      expect(viewFor(s, t).tagList, t).toBeUndefined();
    }
  });

  test("solo has nobody to tag", () => {
    const s = step(initialState(), { type: "START_SOLO", participantId: "me", seed: 3 }, 0);
    expect(viewFor(s, "me").canTagIn).toBeFalsy();
  });
});

describe("it reads as a move, not a failure", () => {
  test("the projector announces the handover rather than the person who stopped", () => {
    const s = room(8);
    const after = tagTo(s, "p2");
    const v = viewFor(after, "host");
    expect(v.tagged).toBe(true);
    expect(v.readerName).toBe("P2");
    // The person who handed it over is not named on the slide at all.
    expect(JSON.stringify(v)).not.toContain("P0");
  });

  test("the barrier already lifted travels with the passage", () => {
    let s = room(8);
    s = step(s, { type: "OVERRIDE" }, T0 + 1000);
    expect(s.round.accommodated).toBe(true);

    const after = tagTo(s, "p2", T0 + 2000);
    const v = viewFor(after, "p2");
    expect(v.accommodated).toBe(true);
    expect(v.render.contrast).toBe(1);
    expect(v.render.wordGaps).toBe(true);
  });

  test("finishing is still there for whoever holds it", () => {
    const after = tagTo(room(8), "p2");
    expect(after.round.finished).toBe(false);
    const done = step(after, { type: "DONE", token: "p2" }, T0 + 30_000);
    expect(done.round.finished).toBe(true);
    // ...and the person who handed it over cannot end somebody else's turn.
    const notThem = step(after, { type: "DONE", token: "p0" }, T0 + 30_000);
    expect(notThem.round.finished).toBe(false);
  });
});
