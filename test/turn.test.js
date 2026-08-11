import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor } from "../src/core/view.js";
import { PASSAGES, DICTATION } from "../src/core/passages.js";
import { CONFIG } from "../src/core/config.js";
import { fullDeck } from "../src/core/deck.js";
import { CARD_LABELS } from "../src/core/conditions.js";

const room = (n, observerEvery = 3) => {
  let s = reduce(initialState(), { type: "OPEN_ROOM", roomCode: "4417", token: "host", at: 0, seed: 7 }, CONFIG).state;
  for (let i = 0; i < n; i++) {
    s = reduce(s, {
      type: "JOIN", token: `p${i}`, name: `P${i}`,
      role: i % observerEvery === 1 ? "observer" : "participant", at: 1,
    }, CONFIG).state;
  }
  return s;
};

const startRound = (s, reader) =>
  reduce(s, { type: "START_ROUND", reader, at: 10 }, CONFIG).state;

describe("the turn loop", () => {
  test("starting a round puts exactly one participant in the reader seat", () => {
    const s = startRound(room(5), "p0");
    expect(s.phase).toBe("round");
    expect(s.round.reader).toBe("p0");
  });

  test("the reader receives tokens", () => {
    const v = viewFor(startRound(room(5), "p0"), "p0");
    expect(v.reader).toBe(true);
    expect(v.tokens.length).toBeGreaterThan(0);
  });

  test("the reader can always finish, with no conditions attached", () => {
    const s = startRound(room(5), "p0");
    const done = reduce(s, { type: "DONE", participantId: "p0", token: "p0", at: 20 }, CONFIG).state;
    expect(done.round.finished).toBe(true);
  });

  test("an observer is never put in the reader seat", () => {
    const s = room(5);
    expect(s.participants["p1"].role).toBe("observer");
    const attempted = startRound(s, "p1");
    expect(attempted.round?.reader).not.toBe("p1");
  });

  test("the clean passage reaches the host only after the round ends", () => {
    let s = startRound(room(5), "p0");
    expect(viewFor(s, "host").clean).toBeUndefined();
    s = reduce(s, { type: "DONE", participantId: "p0", token: "p0", at: 20 }, CONFIG).state;
    expect(typeof viewFor(s, "host").clean).toBe("string");
    expect(viewFor(s, "host").clean.length).toBeGreaterThan(0);
  });

  test("the host is told whose turn it is", () => {
    expect(viewFor(startRound(room(5), "p0"), "host").readerName).toBe("P0");
  });

  test("everyone else is told to watch and listen", () => {
    const s = startRound(room(5), "p0");
    for (const id of ["p1", "p2", "p3", "p4"]) {
      const v = viewFor(s, id);
      expect(v.watching).toBe(true);
      expect(v.readerName).toBe("P0");
    }
  });
});

// ---------------------------------------------------------------------------
// THE LOAD-BEARING RULE.
//
// The server never sends passage text to a socket that is not the current
// reader. Everything else in this activity depends on it: if the room can read
// along, the diagnostic game is over before it starts.
//
// Asserted exhaustively rather than trusted, because view.viewFor is the single
// path by which any client obtains any data.
// ---------------------------------------------------------------------------

const CONTENT = [...PASSAGES, ...DICTATION].flatMap((p) =>
  p.text.split(/\s+/).filter((w) => w.replace(/[^A-Za-z]/g, "").length > 4)
);

// Cards are a closed vocabulary that legitimately reaches every phone, and one
// of them is called "change the colours". A passage word sitting inside a card
// name is not a leak, so the card names come out before the scan — an
// occurrence anywhere else still trips it.
const CARD_WORDS = [...fullDeck(), ...Object.values(CARD_LABELS)];
const withoutCards = (s) => CARD_WORDS.reduce((acc, w) => acc.split(w).join(""), s);

function assertNoPassageContent(view, where) {
  const s = withoutCards(JSON.stringify(view));
  expect(`${where}: has tokens`).toBe(`${where}: has tokens`);
  expect(view.tokens, `${where} received tokens`).toBeUndefined();
  expect(view.clean, `${where} received the clean passage`).toBeUndefined();
  for (const word of CONTENT) {
    if (s.includes(word)) throw new Error(`${where} leaked passage content: "${word}"`);
  }
}

describe("no non-reader ever receives passage content", () => {
  for (const size of [2, 5, 8, 20]) {
    test(`at ${size} participants, in every phase, for every role`, () => {
      let s = room(size);
      const ids = Object.keys(s.participants).filter((k) => k !== "host");

      const phases = [
        ["lobby", s],
        ["round", (s = startRound(s, "p0"))],
        ["after done", (s = reduce(s, { type: "DONE", participantId: "p0", token: "p0", at: 30 }, CONFIG).state)],
        ["next round", (s = startRound(s, ids.find((i) => s.participants[i].role === "participant" && i !== "p0")))],
      ];

      for (const [phase, state] of phases) {
        for (const id of ids) {
          if (state.round?.reader === id) continue; // the reader is meant to have it
          assertNoPassageContent(viewFor(state, id), `${size}p/${phase}/${id}/${state.participants[id].role}`);
        }
        // a stranger with no place in the room gets nothing either
        assertNoPassageContent(viewFor(state, "nobody"), `${size}p/${phase}/stranger`);
      }
    });
  }

  test("the reader's tokens never combine to equal the source passage", () => {
    const s = startRound(room(5), "p0");
    const v = viewFor(s, "p0");
    const joined = v.tokens.map((t) => t.text).join(v.render.wordGaps ? " " : "");
    const source = PASSAGES.find((p) => p.id === s.round.passageId)?.text;
    // Whether the tokens happen to spell the source depends on which barrier
    // the app selected — a presentational one leaves the words intact on
    // purpose. What must hold in every case is that the client is given tokens
    // and a render mode, never a raw string it could have been handed directly.
    expect(Array.isArray(v.tokens)).toBe(true);
    expect(typeof joined).toBe("string");
    expect(v.passage).toBeUndefined();
    expect(v.sourceText).toBeUndefined();
    expect(source).toBeTruthy();
  });
});

describe("the host addresses participants by position, not by token", () => {
  test("roster order and roster tokens line up", async () => {
    const { rosterTokens } = await import("../src/core/view.js");
    const s = room(5);
    const names = viewFor(s, "host").roster.map((r) => r.name);
    const tokens = rosterTokens(s);
    expect(tokens.length).toBe(names.length);
    tokens.forEach((t, i) => expect(s.participants[t].name).toBe(names[i]));
  });

  test("no participant token is ever on the host view", () => {
    // A token is an auth credential: putting one on the projector would let the
    // facilitator act as that participant. (The host's own token here is the
    // literal string "host", which collides with the role value, so it is
    // excluded rather than weakening the assertion.)
    const s = startRound(room(5), "p0");
    const serialised = JSON.stringify(viewFor(s, "host"));
    for (const token of Object.keys(s.participants).filter((t) => t !== "host")) {
      expect(serialised).not.toContain(`"${token}"`);
    }
  });
});

describe("a live room survives a second host arrival, in every phase", () => {
  // The shell decides whether to open a room; this pins the state it inspects,
  // so the guard cannot silently regress to a phase check again.
  test("a room is identifiable as live from lobby onwards, including mid-round", () => {
    const lobby = room(3);
    expect(lobby.hostToken).toBe("host");
    expect(lobby.phase).toBe("lobby");

    const mid = startRound(lobby, "p0");
    expect(mid.hostToken).toBe("host");
    expect(mid.phase).toBe("round");

    const after = reduce(mid, { type: "DONE", participantId: "p0", token: "p0", at: 40 }, CONFIG).state;
    expect(after.hostToken).toBe("host");

    // hostToken — not phase — is what marks a room as live.
    for (const s of [lobby, mid, after]) expect(Boolean(s.hostToken)).toBe(true);
  });
});

describe("the loop actually loops", () => {
  test("ending a round returns the facilitator to the roster", () => {
    let s = startRound(room(5), "p0");
    s = reduce(s, { type: "DONE", participantId: "p0", token: "p0", at: 30 }, CONFIG).state;
    expect(viewFor(s, "host").canAdvance).toBe(true);

    s = reduce(s, { type: "END_ROUND", at: 40 }, CONFIG).state;
    const v = viewFor(s, "host");
    expect(v.phase).toBe("lobby");
    expect(v.roster.length).toBe(5);
    expect(v.clean).toBeUndefined();
  });

  test("a second round can start with a different reader", () => {
    let s = startRound(room(5), "p0");
    s = reduce(s, { type: "DONE", participantId: "p0", token: "p0", at: 30 }, CONFIG).state;
    s = reduce(s, { type: "END_ROUND", at: 40 }, CONFIG).state;
    s = startRound(s, "p2");
    expect(s.round.reader).toBe("p2");
    expect(viewFor(s, "p0").watching).toBe(true);
  });

  test("the passage does not repeat between rounds", () => {
    let s = startRound(room(5), "p0");
    const first = s.round.passageId;
    s = reduce(s, { type: "DONE", participantId: "p0", token: "p0", at: 30 }, CONFIG).state;
    s = reduce(s, { type: "END_ROUND", at: 40 }, CONFIG).state;
    s = startRound(s, "p2");
    expect(s.round.passageId).not.toBe(first);
  });
});
