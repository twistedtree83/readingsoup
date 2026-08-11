import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor } from "../src/core/view.js";
import { CONFIG } from "../src/core/config.js";
import { CARDS, CONDITIONS, FIXES } from "../src/core/conditions.js";
import { byId } from "../src/core/passages.js";

// The two cards that hand you a person rather than deleting a difficulty. Same
// machinery pointed in opposite directions: one moves the keyboard towards the
// helper, the other moves the words towards them.

const WINDOW = CONFIG.round.watchWindowMs;
const T0 = 10_000;
const PLAY = T0 + WINDOW;
const step = (s, event, at = T0) => reduce(s, { at, ...event }, CONFIG).state;

function room(n = 8, { seed = 7 } = {}) {
  let s = step(initialState(), { type: "OPEN_ROOM", roomCode: "4417", token: "host", seed }, 0);
  for (let i = 0; i < n; i++) {
    s = step(s, { type: "JOIN", token: `p${i}`, name: `P${i}`, role: i % 4 === 1 ? "observer" : "participant" }, 0);
  }
  return s;
}

// Force the round onto a named barrier: `seen` is a hard filter, so marking
// everything else as met leaves exactly one option.
function roundOf(condition, { n = 8, reader = "p0", seed = 7 } = {}) {
  let s = room(n, { seed });
  const others = Object.values(CONDITIONS).filter((c) => c !== condition);
  s = { ...s, participants: { ...s.participants, [reader]: { ...s.participants[reader], seen: others } } };
  s = step(s, { type: "START_ROUND", reader }, T0);
  expect(s.round.condition).toBe(condition);
  return s;
}

const table = (s) => Object.keys(s.participants).filter((t) => t !== "host" && t !== s.round.reader);
const holderOf = (s, card) => table(s).find((t) => (s.participants[t].hand ?? []).includes(card));
// Everyone holds the whole deck below six, which makes a named helper easy.
const smallRound = (condition) => roundOf(condition, { n: 4 });

describe("give them a scribe", () => {
  const scribed = () => {
    const s = smallRound(CONDITIONS.BUTTERFINGERS);
    const scribe = holderOf(s, CARDS.GIVE_THEM_A_SCRIBE);
    return { before: s, scribe, after: step(s, { type: "PLAY_CARD", token: scribe, card: CARDS.GIVE_THEM_A_SCRIBE }, PLAY) };
  };

  test("the keyboard genuinely moves", () => {
    const { after, scribe } = scribed();
    expect(after.round.helper.token).toBe(scribe);
    expect(after.round.helper.kind).toBe("scribe");

    const v = viewFor(after, scribe);
    expect(v.scribe).toBe(true);
    expect(v.kind).toBe("typing");
    expect(typeof v.intended).toBe("string");
  });

  test("the reader is told to say it out loud, and has no keyboard left", () => {
    const { after } = scribed();
    const v = viewFor(after, after.round.reader);
    expect(v.dictating).toBe(true);
    expect(v.prompt).toBe(after.round.promptText);
    expect(v.intended).toBeUndefined();
    expect(v.helperName).toBe(after.participants[after.round.helper.token].name);
  });

  test("what the scribe types comes out clean", () => {
    const { after, scribe } = scribed();
    const typed = step(after, { type: "TYPE", token: scribe, intended: "the kettle knows my name" }, PLAY + 1000);
    expect(typed.round.output).toBe("the kettle knows my name");
    expect(viewFor(typed, typed.round.reader).output).toBe("the kettle knows my name");
    expect(viewFor(typed, scribe).output).toBe("the kettle knows my name");
  });

  test("the reader's own keyboard is gone, not merely hidden", () => {
    const { after } = scribed();
    const meddled = step(after, { type: "TYPE", token: after.round.reader, intended: "still me" }, PLAY + 500);
    expect(meddled.round.intended).toBe("");
  });

  test("nobody else can type into it either", () => {
    const { after, scribe } = scribed();
    const intruder = table(after).find((t) => t !== scribe);
    const meddled = step(after, { type: "TYPE", token: intruder, intended: "not mine" }, PLAY + 500);
    expect(meddled.round.intended).toBe("");
  });

  test("the scribe starts from an empty box, however far the reader got", () => {
    let s = smallRound(CONDITIONS.BUTTERFINGERS);
    s = step(s, { type: "TYPE", token: s.round.reader, intended: "halfway" }, T0 + 100);
    expect(s.round.output).not.toBe("");
    const scribe = holderOf(s, CARDS.GIVE_THEM_A_SCRIBE);
    const after = step(s, { type: "PLAY_CARD", token: scribe, card: CARDS.GIVE_THEM_A_SCRIBE }, PLAY);
    expect(after.round.intended).toBe("");
    expect(after.round.output).toBe("");
  });

  test("the room watches it appear, at projector scale, uncorrected", () => {
    const { after, scribe } = scribed();
    const typed = step(after, { type: "TYPE", token: scribe, intended: "the wombat requires a permit" }, PLAY + 1);
    const v = viewFor(typed, "host");
    expect(v.typed).toBe("the wombat requires a permit");
    // The target stays hidden until the round is over, then appears beside it.
    expect(v.clean).toBeUndefined();
    const done = step(typed, { type: "DONE", token: typed.round.reader }, PLAY + 5000);
    expect(viewFor(done, "host").clean).toBe(byId(done.round.passageId).text);
    expect(viewFor(done, "host").typed).toBe("the wombat requires a permit");
  });

  test("the room sees the mangled output before anybody helps", () => {
    let s = smallRound(CONDITIONS.BUTTERFINGERS);
    s = step(s, { type: "TYPE", token: s.round.reader, intended: "the wombat requires a permit" }, T0 + 100);
    const v = viewFor(s, "host");
    expect(v.typed).toBe(s.round.output);
    expect(v.typed).not.toBe("the wombat requires a permit");
    expect(v.clean).toBeUndefined();
  });

  test("the round ends on the reader tapping done — no matching, no threshold", () => {
    const { after, scribe } = scribed();
    const typed = step(after, { type: "TYPE", token: scribe, intended: "nothing like the target" }, PLAY + 1);
    const done = step(typed, { type: "DONE", token: typed.round.reader }, PLAY + 9000);
    expect(done.round.finished).toBe(true);
    expect(JSON.stringify(done.round)).not.toMatch(/score|correct|matched|accuracy/i);
  });
});

describe("read it to them", () => {
  const handed = () => {
    const s = smallRound(CONDITIONS.MUDSOUND);
    const helper = holderOf(s, CARDS.READ_IT_TO_THEM);
    return { before: s, helper, after: step(s, { type: "PLAY_CARD", token: helper, card: CARDS.READ_IT_TO_THEM }, PLAY) };
  };

  test("the clean passage lands on the card player's phone", () => {
    const { after, helper } = handed();
    const v = viewFor(after, helper);
    expect(v.readingAloud).toBe(true);
    expect(v.render.wordGaps).toBe(true);
    expect(v.render.contrast).toBe(1);
    expect(v.tokens.map((t) => t.text).join(" ")).toBe(byId(after.round.passageId).text);
  });

  test("and on nobody else's, reader included", () => {
    const { after, helper } = handed();
    const clean = byId(after.round.passageId).text;
    const words = clean.split(/\s+/).filter((w) => w.length > 5);

    for (const token of [...Object.keys(after.participants), "stranger"]) {
      if (token === helper || token === after.round.reader) continue;
      const v = viewFor(after, token);
      expect(v.tokens, `${token} received tokens`).toBeUndefined();
      expect(v.readingAloud, `${token} was told to read aloud`).toBeUndefined();
      const serialised = JSON.stringify(v);
      for (const w of words) {
        if (serialised.includes(w)) throw new Error(`${token} leaked "${w}"`);
      }
    }
  });

  test("the reader keeps their own screen and is told to follow along", () => {
    const { before, after } = handed();
    const v = viewFor(after, after.round.reader);
    // The accommodation is a voice, not a re-render: the words on their screen
    // are the same unfamiliar spellings they were.
    expect(v.tokens.map((t) => t.text)).toEqual(
      viewFor(before, before.round.reader).tokens.map((t) => t.text)
    );
    expect(v.listening).toBe(true);
    expect(v.helperName).toBe(after.participants[after.round.helper.token].name);
  });

  test("it counts as the accommodation — no further cards land", () => {
    const { after } = handed();
    const other = table(after).find((t) => (after.participants[t].spent ?? []).length === 0);
    const again = step(after, { type: "PLAY_CARD", token: other, card: after.participants[other].hand[0] }, PLAY + 100);
    expect(again.round.plays).toBe(after.round.plays);
  });

  test("the projector names who is reading it, like any other correct play", () => {
    const { after, helper } = handed();
    const v = viewFor(after, "host");
    expect(v.helped.name).toBe(after.participants[helper].name);
    expect(v.helped.cardLabel).toBe("Read it to them");
  });
});

describe("when the helper's phone drops", () => {
  test("the scribe vanishing gives the reader a working keyboard back", () => {
    const s = smallRound(CONDITIONS.BUTTERFINGERS);
    const scribe = holderOf(s, CARDS.GIVE_THEM_A_SCRIBE);
    let after = step(s, { type: "PLAY_CARD", token: scribe, card: CARDS.GIVE_THEM_A_SCRIBE }, PLAY);
    after = step(after, { type: "DISCONNECT", token: scribe }, PLAY + 2000);

    expect(after.round.helper).toBeNull();
    // Nobody is punished for a dropped phone: the accommodation stays, it just
    // stops being a person.
    expect(after.round.accommodated).toBe(true);
    const typed = step(after, { type: "TYPE", token: after.round.reader, intended: "mine again" }, PLAY + 3000);
    expect(typed.round.output).toBe("mine again");
    expect(viewFor(typed, after.round.reader).dictating).toBeUndefined();
  });

  test("the aloud reader vanishing lifts the barrier instead", () => {
    const s = smallRound(CONDITIONS.MUDSOUND);
    const helper = holderOf(s, CARDS.READ_IT_TO_THEM);
    let after = step(s, { type: "PLAY_CARD", token: helper, card: CARDS.READ_IT_TO_THEM }, PLAY);
    const mangled = viewFor(after, after.round.reader).tokens.map((t) => t.text);

    after = step(after, { type: "DISCONNECT", token: helper }, PLAY + 2000);
    const v = viewFor(after, after.round.reader);
    expect(after.round.helper).toBeNull();
    expect(v.listening).toBeUndefined();
    expect(v.tokens.map((t) => t.text)).not.toEqual(mangled);
    expect(v.tokens.map((t) => t.text).join(" ")).toBe(byId(after.round.passageId).text);
  });

  test("a bystander dropping changes nothing", () => {
    const s = smallRound(CONDITIONS.MUDSOUND);
    const helper = holderOf(s, CARDS.READ_IT_TO_THEM);
    const after = step(s, { type: "PLAY_CARD", token: helper, card: CARDS.READ_IT_TO_THEM }, PLAY);
    const bystander = table(after).find((t) => t !== helper);
    const dropped = step(after, { type: "DISCONNECT", token: bystander }, PLAY + 2000);
    expect(dropped.round.helper.token).toBe(helper);
    expect(viewFor(dropped, helper).readingAloud).toBe(true);
  });

  test("the reader dropping does not strand the round", () => {
    const s = smallRound(CONDITIONS.BUTTERFINGERS);
    const scribe = holderOf(s, CARDS.GIVE_THEM_A_SCRIBE);
    let after = step(s, { type: "PLAY_CARD", token: scribe, card: CARDS.GIVE_THEM_A_SCRIBE }, PLAY);
    after = step(after, { type: "DISCONNECT", token: after.round.reader }, PLAY + 2000);
    expect(after.round.helper.token).toBe(scribe);
    expect(step(after, { type: "DONE", token: after.round.reader }, PLAY + 3000).round.finished).toBe(true);
  });
});

describe("solo hands you nothing, because there is nobody there", () => {
  test("the scribe card just stops the mangling", () => {
    let s = step(initialState(), { type: "START_SOLO", participantId: "me", seed: 3 }, 0);
    while (s.round.kind !== "typing") s = step(s, { type: "DONE", participantId: "me" }, 1);
    s = step(s, { type: "TYPE", intended: "wombat" }, 2);
    s = step(s, { type: "PLAY_CARD", card: FIXES[CONDITIONS.BUTTERFINGERS] }, 3);
    expect(s.round.helper).toBeFalsy();
    expect(viewFor(s, "me").output).toBe("wombat");
    expect(viewFor(s, "me").dictating).toBeUndefined();
  });

  test("read it to them just un-mangles", () => {
    let s = step(initialState(), { type: "START_SOLO", participantId: "me", seed: 3 }, 0);
    while (s.round.condition !== CONDITIONS.MUDSOUND) s = step(s, { type: "DONE", participantId: "me" }, 1);
    s = step(s, { type: "PLAY_CARD", card: FIXES[CONDITIONS.MUDSOUND] }, 2);
    expect(s.round.helper).toBeFalsy();
    const v = viewFor(s, "me");
    expect(v.tokens.map((t) => t.text).join(" ")).toBe(byId(s.round.passageId).text);
  });
});
