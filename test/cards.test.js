import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor } from "../src/core/view.js";
import { CONFIG } from "../src/core/config.js";
import { fullDeck, deal, resolve } from "../src/core/deck.js";
import { CARDS, CARD_LABELS, FIXES, CONDITIONS } from "../src/core/conditions.js";

// The diagnostic half of the activity. Card play requires no reading and
// carries no exposure, which is why everybody gets a hand — and why the
// attribution of a correct play is asymmetric with a wrong one.

const step = (s, event) => reduce(s, { at: 0, ...event }, CONFIG).state;

// Cards are locked for the watch window at the start of every round (S16), so
// a play in these tests is timestamped after it. What is being tested here is
// the dealing and the resolution, not the pacing.
const PLAYABLE = CONFIG.round.watchWindowMs;

function room(n, { observerEvery = 4, seed = 7 } = {}) {
  let s = step(initialState(), { type: "OPEN_ROOM", roomCode: "4417", token: "host", seed });
  for (let i = 0; i < n; i++) {
    s = step(s, {
      type: "JOIN",
      token: `p${i}`,
      name: `P${i}`,
      role: observerEvery && i % observerEvery === 1 ? "observer" : "participant",
    });
  }
  return s;
}

const others = (s) => Object.keys(s.participants).filter((t) => t !== "host" && t !== s.round?.reader);
const activeCount = (s) =>
  Object.values(s.participants).filter((p) => p.role === "participant").length;

// Start a spotlight without going through the silent round, so a test can name
// the reader and know nothing has been seen yet.
const spotlight = (s, reader = "p0") => step(s, { type: "START_ROUND", reader });

describe("dealing", () => {
  test("the full deck at two to five, three cards at six and above", () => {
    for (const [size, expected] of [[2, 6], [5, 6], [8, 3], [20, 3]]) {
      const s = spotlight(room(size, { observerEvery: 0 }));
      expect(activeCount(s)).toBe(size);
      for (const t of others(s)) {
        expect(s.participants[t].hand.length, `${size} active`).toBe(expected);
      }
    }
  });

  test("the boundary is where the PRD puts it, not one either side", () => {
    // Five active is a small room and gets the whole deck; six is a group and
    // gets scarcity. Asserted at the seam because that is where it goes wrong.
    const five = spotlight(room(5, { observerEvery: 0 }));
    const six = spotlight(room(6, { observerEvery: 0 }));
    expect(five.participants.p1.hand.length).toBe(6);
    expect(six.participants.p1.hand.length).toBe(3);
  });

  test("somebody always holds the card that lifts the barrier, at every size", () => {
    for (const size of [2, 3, 5, 6, 8, 12, 20]) {
      for (const seed of [1, 7, 23, 404, 91_357, 5, 88]) {
        const s = spotlight(room(size, { seed }));
        const fix = FIXES[s.round.condition];
        const holders = others(s).filter((t) => s.participants[t].hand.includes(fix));
        expect(holders.length, `${size}p seed ${seed}: nobody holds ${fix}`).toBeGreaterThan(0);
      }
    }
  });

  test("the guarantee holds directly, over every condition and a hundred deals", () => {
    for (const condition of Object.values(CONDITIONS)) {
      for (let seed = 1; seed <= 100; seed++) {
        const tokens = ["a", "b", "c", "d", "e", "f", "g"];
        const hands = deal(tokens, condition, { handSize: 3, seed });
        const holders = tokens.filter((t) => hands[t].includes(FIXES[condition]));
        expect(holders.length, `${condition} seed ${seed}`).toBeGreaterThan(0);
        for (const t of tokens) {
          expect(hands[t].length).toBe(3);
          expect(new Set(hands[t]).size, `${condition} seed ${seed}: duplicate in a hand`).toBe(3);
        }
      }
    }
  });

  test("observers are dealt in, on exactly the same terms", () => {
    const s = spotlight(room(8));
    const observers = others(s).filter((t) => s.participants[t].role === "observer");
    const players = others(s).filter((t) => s.participants[t].role === "participant");
    expect(observers.length).toBeGreaterThan(0);
    for (const t of observers) {
      expect(s.participants[t].hand.length).toBe(s.participants[players[0]].hand.length);
      expect(viewFor(s, t).hand.length).toBe(3);
    }
  });

  test("the reader holds nothing — they are the one being helped", () => {
    const s = spotlight(room(8));
    expect(s.participants[s.round.reader].hand ?? []).toEqual([]);
    expect(viewFor(s, s.round.reader).hand).toBeUndefined();
  });

  test("a hand is in canonical deck order, so position never tracks the barrier", () => {
    const s = spotlight(room(8));
    const order = fullDeck();
    for (const t of others(s)) {
      const hand = s.participants[t].hand;
      const positions = hand.map((c) => order.indexOf(c));
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  test("hands are cleared when the round ends and dealt fresh for the next", () => {
    let s = spotlight(room(8));
    const before = s.participants.p2.hand;
    expect(before.length).toBe(3);

    s = step(step(s, { type: "DONE", token: s.round.reader }), { type: "END_ROUND" });
    for (const t of Object.keys(s.participants)) {
      expect(s.participants[t].hand ?? []).toEqual([]);
      expect(s.participants[t].spent ?? []).toEqual([]);
    }
    expect(viewFor(s, "p2").hand).toBeUndefined();

    s = step(s, { type: "START_ROUND", reader: "p2" });
    expect(s.participants.p0.hand.length).toBe(3);
  });
});

describe("playing a card", () => {
  const holderOf = (s, card) => others(s).find((t) => s.participants[t].hand.includes(card));

  test("the correct card re-renders the reader's passage with the barrier gone", () => {
    let s = spotlight(room(8));
    const reader = s.round.reader;
    const fix = FIXES[s.round.condition];
    const before = viewFor(s, reader);

    s = step(s, { type: "PLAY_CARD", at: PLAYABLE, token: holderOf(s, fix), card: fix });
    const after = viewFor(s, reader);

    expect(after.accommodated).toBe(true);
    expect(after.render.wordGaps).toBe(true);
    expect(after.render.contrast).toBe(1);
    // A fresh token array from the server, not an instruction the client could
    // have followed itself.
    expect(after.tokens).not.toBe(before.tokens);
    expect(after.tokens.length).toBeGreaterThan(0);
  });

  test("a wrong card changes nothing on the reader's device, and is spent", () => {
    let s = spotlight(room(8));
    const reader = s.round.reader;
    const fix = FIXES[s.round.condition];
    const wrongCard = fullDeck().find((c) => c !== fix);
    const player = holderOf(s, wrongCard);
    const before = JSON.stringify(viewFor(s, reader));

    s = step(s, { type: "PLAY_CARD", at: PLAYABLE, token: player, card: wrongCard });

    expect(JSON.stringify(viewFor(s, reader))).toBe(before);
    expect(viewFor(s, player).spent).toContain(wrongCard);
    expect(viewFor(s, player).hand).toContain(wrongCard);
  });

  test("a spent card does not come back inside the round", () => {
    let s = spotlight(room(8));
    const fix = FIXES[s.round.condition];
    const wrongCard = fullDeck().find((c) => c !== fix);
    const player = holderOf(s, wrongCard);

    s = step(s, { type: "PLAY_CARD", at: PLAYABLE, token: player, card: wrongCard });
    const afterFirst = JSON.stringify(s.round);
    // Playing it again is not an error and not a second play — it is nothing.
    s = step(s, { type: "PLAY_CARD", at: PLAYABLE, token: player, card: wrongCard });
    expect(JSON.stringify(s.round)).toBe(afterFirst);
    expect(s.participants[player].spent.filter((c) => c === wrongCard).length).toBe(1);
  });

  test("a card you were not dealt cannot be played", () => {
    let s = spotlight(room(8));
    const fix = FIXES[s.round.condition];
    const withoutFix = others(s).find((t) => !s.participants[t].hand.includes(fix));
    expect(withoutFix).toBeTruthy();

    s = step(s, { type: "PLAY_CARD", at: PLAYABLE, token: withoutFix, card: fix });
    expect(viewFor(s, s.round.reader).accommodated).toBe(false);
    expect(s.participants[withoutFix].spent).toEqual([]);
  });

  test("the reader cannot play their own way out", () => {
    let s = spotlight(room(8));
    const reader = s.round.reader;
    const fix = FIXES[s.round.condition];
    s = step(s, { type: "PLAY_CARD", at: PLAYABLE, token: reader, card: fix });
    expect(viewFor(s, reader).accommodated).toBe(false);
  });

  test("once the barrier is lifted, nothing further lands on the reader", () => {
    let s = spotlight(room(8));
    const fix = FIXES[s.round.condition];
    s = step(s, { type: "PLAY_CARD", at: PLAYABLE, token: holderOf(s, fix), card: fix });
    const settled = JSON.stringify(viewFor(s, s.round.reader));

    const wrongCard = fullDeck().find((c) => c !== fix);
    const player = holderOf(s, wrongCard);
    if (player) s = step(s, { type: "PLAY_CARD", at: PLAYABLE, token: player, card: wrongCard });
    expect(JSON.stringify(viewFor(s, s.round.reader))).toBe(settled);
  });
});

describe("attribution is asymmetric", () => {
  const holderOf = (s, card) => others(s).find((t) => s.participants[t].hand.includes(card));

  test("a correct play is named on the projector, with the card", () => {
    let s = spotlight(room(8));
    const fix = FIXES[s.round.condition];
    const player = holderOf(s, fix);

    expect(viewFor(s, "host").helped).toBeUndefined();
    s = step(s, { type: "PLAY_CARD", at: PLAYABLE, token: player, card: fix });

    const v = viewFor(s, "host");
    expect(v.helped.name).toBe(s.participants[player].name);
    expect(v.helped.cardLabel).toBe(CARD_LABELS[fix]);
  });

  test("a wrong play is spent, and nowhere attributed", () => {
    let s = spotlight(room(8));
    const fix = FIXES[s.round.condition];
    const wrongCard = fullDeck().find((c) => c !== fix);
    const player = holderOf(s, wrongCard);
    const name = s.participants[player].name;

    s = step(s, { type: "PLAY_CARD", at: PLAYABLE, token: player, card: wrongCard });

    const v = viewFor(s, "host");
    expect(v.helped).toBeUndefined();
    expect(v.played).toBe(1);
    // Being generous and wrong about how to help a struggling colleague is not
    // something to put in projector-scale type at a staff meeting.
    expect(JSON.stringify(v)).not.toContain(name);
    for (const t of others(s)) {
      if (t === player) continue;
      expect(JSON.stringify(viewFor(s, t)), `${t} was told who played`).not.toContain(name);
    }
  });

  test("nobody is told which card is correct before somebody plays it", () => {
    const s = spotlight(room(8));
    const fix = FIXES[s.round.condition];
    for (const t of [...Object.keys(s.participants), "stranger"]) {
      const v = viewFor(s, t);
      // The correct card is necessarily in somebody's hand. What must never
      // travel is anything that singles it out.
      const keys = JSON.stringify(v).match(/"[a-zA-Z]+":/g) ?? [];
      for (const tell of ["fixedBy", "correct", "answer", "fixes", "solution", "helped"]) {
        expect(keys.some((k) => k.toLowerCase().includes(tell.toLowerCase())), `${t}: ${tell}`).toBe(false);
      }
      if (v.hand) expect(v.hand.filter((c) => resolve(c, s.round.condition)).length).toBeLessThan(2);
    }
    expect(fix).toBeTruthy();
  });

  test("a card played by an observer is named exactly like anyone else's", () => {
    // This is why observers are dealt in: the half of the activity that is
    // visible and creditable is the half that carries no exposure.
    let s = spotlight(room(8));
    const fix = FIXES[s.round.condition];
    const observer = others(s).find(
      (t) => s.participants[t].role === "observer" && s.participants[t].hand.includes(fix)
    );
    if (!observer) return; // this seed dealt it elsewhere; the rule is covered above

    s = step(s, { type: "PLAY_CARD", at: PLAYABLE, token: observer, card: fix });
    const v = viewFor(s, "host");
    expect(v.helped.name).toBe(s.participants[observer].name);
    expect(JSON.stringify(v)).not.toContain("observer");
  });
});

describe("the room can still see nothing it should not", () => {
  test("a hand carries card names, never anything about the passage", () => {
    const s = spotlight(room(20));
    for (const t of others(s)) {
      const v = viewFor(s, t);
      expect(v.tokens).toBeUndefined();
      expect(v.render).toBeUndefined();
      for (const card of v.hand) expect(fullDeck()).toContain(card);
    }
  });

  test("solo still holds the whole deck and plays the same way", () => {
    let s = step(initialState(), { type: "START_SOLO", participantId: "me", seed: 3 });
    expect(viewFor(s, "me").hand.length).toBe(6);
    s = step(s, { type: "PLAY_CARD", card: FIXES[s.round.condition] });
    expect(viewFor(s, "me").accommodated).toBe(true);
  });

  test("a wrong card in solo is not spent — unlimited attempts, no penalty", () => {
    let s = step(initialState(), { type: "START_SOLO", participantId: "me", seed: 3 });
    const wrongCard = fullDeck().find((c) => c !== FIXES[s.round.condition]);
    s = step(s, { type: "PLAY_CARD", card: wrongCard });
    expect(viewFor(s, "me").hand.length).toBe(6);
    expect(viewFor(s, "me").spent ?? []).toEqual([]);
    s = step(s, { type: "PLAY_CARD", card: FIXES[s.round.condition] });
    expect(viewFor(s, "me").accommodated).toBe(true);
  });
});

describe("the deck itself", () => {
  test("a small room is dealt the whole deck, in order", () => {
    const hands = deal(["a", "b"], CONDITIONS.SOUP, { handSize: 6, seed: 1 });
    expect(hands.a).toEqual(fullDeck());
    expect(hands.b).toEqual(fullDeck());
  });

  test("dealing to nobody is not an error", () => {
    expect(deal([], CONDITIONS.SOUP, { handSize: 3, seed: 1 })).toEqual({});
  });

  test("one hand at three cards still holds the fix", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const hands = deal(["solo"], CONDITIONS.FOG, { handSize: 3, seed });
      expect(hands.solo).toContain(CARDS.CHANGE_THE_COLOURS);
    }
  });
});
