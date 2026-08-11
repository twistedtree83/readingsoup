import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor } from "../src/core/view.js";
import { CONFIG } from "../src/core/config.js";
import { fullDeck } from "../src/core/deck.js";
import { FIXES } from "../src/core/conditions.js";

// The two rules that make this a diagnostic exercise rather than a race, and
// the valve that stops either of them trapping a reader.

const WINDOW = CONFIG.round.watchWindowMs;
const CAP = CONFIG.round.playsPerRound;
const T0 = 10_000;

const step = (s, event, at = T0) => reduce(s, { at, ...event }, CONFIG).state;

function room(n, { seed = 7 } = {}) {
  let s = step(initialState(), { type: "OPEN_ROOM", roomCode: "4417", token: "host", seed }, 0);
  for (let i = 0; i < n; i++) {
    s = step(s, { type: "JOIN", token: `p${i}`, name: `P${i}`, role: i % 4 === 1 ? "observer" : "participant" }, 0);
  }
  return step(s, { type: "START_ROUND", reader: "p0" }, T0);
}

const table = (s) => Object.keys(s.participants).filter((t) => t !== "host" && t !== s.round.reader);
const holderOf = (s, card, skip = []) =>
  table(s).find((t) => !skip.includes(t) && s.participants[t].hand.includes(card));
const wrongCards = (s) => fullDeck().filter((c) => c !== FIXES[s.round.condition]);

// Everyone who could play, playing something wrong, one at a time.
function burn(s, n, at = T0 + WINDOW) {
  const used = [];
  for (let i = 0; i < n; i++) {
    const card = wrongCards(s)[i % wrongCards(s).length];
    const who = holderOf(s, card, used);
    if (!who) continue;
    used.push(who);
    s = step(s, { type: "PLAY_CARD", token: who, card }, at);
  }
  return { state: s, used };
}

describe("the watch window", () => {
  test("no card may be played until the window has elapsed", () => {
    const s = room(8);
    const fix = FIXES[s.round.condition];
    const player = holderOf(s, fix);

    const early = step(s, { type: "PLAY_CARD", token: player, card: fix }, T0 + WINDOW - 1);
    expect(early.round.accommodated).toBeFalsy();
    // Rejected, not spent. A card refused by the clock has not been used up.
    expect(early.participants[player].spent).toEqual([]);
    expect(early.round.plays ?? 0).toBe(0);

    const onTime = step(s, { type: "PLAY_CARD", token: player, card: fix }, T0 + WINDOW);
    expect(onTime.round.accommodated).toBe(true);
  });

  test("a phone is told how long is left, and that it is a wait, not a lockout", () => {
    const s = room(8);
    const watcher = table(s)[0];
    expect(viewFor(s, watcher).locked).toBe(true);
    expect(viewFor(s, watcher).unlocksInMs).toBe(WINDOW);

    const later = step(s, { type: "TICK" }, T0 + 10_000);
    expect(viewFor(later, watcher).unlocksInMs).toBe(WINDOW - 10_000);
    expect(viewFor(later, watcher).locked).toBe(true);

    const open = step(s, { type: "TICK" }, T0 + WINDOW);
    expect(viewFor(open, watcher).locked).toBe(false);
    expect(viewFor(open, watcher).unlocksInMs).toBe(0);
  });

  test("the window is per round, not per reader", () => {
    let s = room(8);
    s = step(s, { type: "TICK" }, T0 + WINDOW);
    expect(s.round.locked).toBe(false);

    s = step(step(s, { type: "DONE", token: "p0" }, T0 + 60_000), { type: "END_ROUND" }, T0 + 61_000);
    // A second round for somebody who has already watched one still waits.
    s = step(s, { type: "START_ROUND", reader: "p2" }, T0 + 62_000);
    expect(s.round.locked).toBe(true);
    expect(viewFor(s, "p0").unlocksInMs).toBe(WINDOW);
    const early = step(s, { type: "PLAY_CARD", token: "p0", card: s.participants.p0.hand[0] }, T0 + 62_000 + 5000);
    expect(early.round.plays ?? 0).toBe(0);
  });

  test("the reader can finish at any point, window or no window", () => {
    const s = room(8);
    expect(s.round.locked).toBe(true);
    const done = step(s, { type: "DONE", token: "p0" }, T0 + 3000);
    expect(done.round.finished).toBe(true);
  });

  test("solo has no window — it is self-paced and there is no room to watch", () => {
    let s = step(initialState(), { type: "START_SOLO", participantId: "me", seed: 3 }, 0);
    expect(viewFor(s, "me").locked).toBeFalsy();
    s = step(s, { type: "PLAY_CARD", card: FIXES[s.round.condition] }, 1);
    expect(viewFor(s, "me").accommodated).toBe(true);
  });
});

describe("three plays, room-wide", () => {
  test("the cap counts the room, not the person", () => {
    const s = room(20);
    const { state, used } = burn(s, CAP);
    expect(new Set(used).size).toBe(CAP);
    expect(state.round.plays).toBe(CAP);

    // A fourth person who has not played at all is still out of plays.
    const fresh = table(state).find((t) => !used.includes(t) && state.participants[t].spent.length === 0);
    const card = state.participants[fresh].hand[0];
    const after = step(state, { type: "PLAY_CARD", token: fresh, card }, T0 + WINDOW);
    expect(after.round.plays).toBe(CAP);
    expect(after.participants[fresh].spent).toEqual([]);
  });

  test("the correct card is refused too once the plays are gone", () => {
    const s = room(20);
    const fix = FIXES[s.round.condition];
    const { state } = burn(s, CAP);
    const holder = holderOf(state, fix, []);
    const after = step(state, { type: "PLAY_CARD", token: holder, card: fix }, T0 + WINDOW);
    expect(after.round.accommodated).toBeFalsy();
  });

  test("each play spends that card from that player's hand, and nobody else's", () => {
    const s = room(20);
    const card = wrongCards(s)[0];
    const player = holderOf(s, card);
    const after = step(s, { type: "PLAY_CARD", token: player, card }, T0 + WINDOW);

    expect(after.participants[player].spent).toEqual([card]);
    for (const t of table(after)) {
      if (t === player) continue;
      expect(after.participants[t].spent, `${t} lost a card to somebody else's play`).toEqual([]);
    }
  });

  test("a room is told how many plays are left", () => {
    const s = room(20);
    const watcher = table(s)[0];
    expect(viewFor(s, watcher).playsLeft).toBe(CAP);
    const { state } = burn(s, 2);
    expect(viewFor(state, watcher).playsLeft).toBe(CAP - 2);
    expect(viewFor(state, "host").playsLeft).toBe(CAP - 2);
  });

  test("the reader can still finish with every play burnt", () => {
    const { state } = burn(room(20), CAP);
    const done = step(state, { type: "DONE", token: "p0" }, T0 + 60_000);
    expect(done.round.finished).toBe(true);
  });

  test("solo is uncapped — unlimited attempts, no penalty", () => {
    let s = step(initialState(), { type: "START_SOLO", participantId: "me", seed: 3 }, 0);
    const wrong = fullDeck().filter((c) => c !== FIXES[s.round.condition]);
    for (const card of wrong) s = step(s, { type: "PLAY_CARD", card }, 1);
    expect(viewFor(s, "me").accommodated).toBe(false);
    s = step(s, { type: "PLAY_CARD", card: FIXES[s.round.condition] }, 1);
    expect(viewFor(s, "me").accommodated).toBe(true);
  });
});

describe("the facilitator override", () => {
  test("it grants the accommodation directly, and the barrier comes off", () => {
    const s = room(8);
    const after = step(s, { type: "OVERRIDE" }, T0 + 5000);
    expect(after.round.accommodated).toBe(true);
    const reader = viewFor(after, "p0");
    expect(reader.accommodated).toBe(true);
    expect(reader.render.wordGaps).toBe(true);
    expect(reader.render.contrast).toBe(1);
  });

  test("it works when the room has burnt every play and nobody found it", () => {
    // This is the case it exists for: a reader stuck in a barrier with no help
    // coming. It is the distress valve, not polish.
    const { state } = burn(room(20), CAP);
    expect(state.round.accommodated).toBeFalsy();
    const after = step(state, { type: "OVERRIDE" }, T0 + 90_000);
    expect(after.round.accommodated).toBe(true);
  });

  test("it works inside the watch window too — at any time means any time", () => {
    const after = step(room(8), { type: "OVERRIDE" }, T0 + 1);
    expect(after.round.accommodated).toBe(true);
  });

  test("the projector names the card, and blames nobody for not finding it", () => {
    const s = room(8);
    const fix = FIXES[s.round.condition];
    const after = step(s, { type: "OVERRIDE" }, T0 + 5000);

    const v = viewFor(after, "host");
    expect(v.helped.granted).toBe(true);
    expect(v.helped.name).toBeUndefined();
    expect(v.helped.cardLabel).toBeTruthy();
    // Nobody is named, and no participant's name appears anywhere on the slide.
    for (const t of table(after)) {
      expect(JSON.stringify(v)).not.toContain(after.participants[t].name);
    }
    expect(fix).toBeTruthy();
  });

  test("a typed round is granted its scribe the same way", () => {
    // Drive to the typing barrier, which takes a different path through play.
    let s = room(8);
    let guard = 0;
    while (s.round?.kind !== "typing" && guard++ < 8) {
      s = step(step(s, { type: "DONE", token: s.round.reader }, T0), { type: "END_ROUND" }, T0);
      s = step(s, { type: "START_ROUND", random: true }, T0);
    }
    expect(s.round.kind).toBe("typing");

    s = step(s, { type: "TYPE", token: s.round.reader, intended: "the wombat requires a permit" }, T0);
    expect(s.round.output).not.toBe(s.round.intended);
    s = step(s, { type: "OVERRIDE" }, T0 + 1000);
    expect(s.round.output).toBe("the wombat requires a permit");
  });

  test("an override on nothing is nothing", () => {
    const lobby = step(initialState(), { type: "OPEN_ROOM", roomCode: "1", token: "host", seed: 1 }, 0);
    expect(step(lobby, { type: "OVERRIDE" }, T0).round).toBeFalsy();
  });
});
