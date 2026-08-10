// The room state machine, as a reducer. Pure: reduce(state, event) -> {state, effects}
//
// Time is an input, never read here: every event carries `at`. That is what lets
// a twenty-person session run deterministically in a unit test. Effects are
// emitted as data and performed by the shell.

import { CONDITIONS, FIXES, IMPLEMENTED, isTyping } from "./conditions.js";
import { pick, pickDictation } from "./passages.js";
import { resolve } from "./deck.js";
import { mangle } from "./mangle.js";
import { mangleTyped } from "./butterfingers.js";
import { BANDS } from "./passages.js";

const SHORT_BAND_CONDITIONS = [CONDITIONS.SOUP, CONDITIONS.MUDSOUND];

export const ROLES = { HOST: "host", PARTICIPANT: "participant", OBSERVER: "observer" };

export function initialState() {
  return { mode: null, phase: "landing", participants: {}, round: null, tour: null };
}

function bandFor(condition) {
  return SHORT_BAND_CONDITIONS.includes(condition) ? BANDS.SHORT : BANDS.FULL;
}

function beginRound(state, condition, config) {
  const seedBase = (state.seed ?? 1) + state.tour.index * 101;

  if (isTyping(condition)) {
    // A typed task: the participant is given a sentence and simply cannot get
    // it out. No target matching, no threshold, no score.
    const prompt = pickDictation(state.tour.usedPassages, seedBase);
    return {
      condition,
      fixedBy: FIXES[condition],
      kind: "typing",
      passageId: prompt.id,
      promptText: prompt.text,
      seed: seedBase,
      intended: "",
      output: "",
      accommodated: false,
      rendered: mangle("", condition, config, { seed: seedBase }),
    };
  }

  const passage = pick(bandFor(condition), state.tour.usedPassages, seedBase);
  // Seed varies per round so two rounds of the same condition do not land on an
  // identical displacement, but stays derived from the session seed so the whole
  // session replays deterministically in a test.
  const seed = seedBase;
  return {
    condition,
    fixedBy: FIXES[condition],
    passageId: passage.id,
    seed,
    accommodated: false,
    rendered: mangle(passage.text, condition, config, {
      seed,
      reducedMotion: state.reducedMotion === true,
    }),
  };
}

export function reduce(state, event, config) {
  const effects = [];

  switch (event.type) {
    case "START_SOLO": {
      // Self-paced tour. No turn announcements, no pressure, no timing.
      const tour = { order: [...IMPLEMENTED], index: 0, usedPassages: [], seen: [] };
      const next = {
        ...state,
        mode: "solo",
        phase: "reading",
        seed: event.seed ?? 1,
        reducedMotion: event.reducedMotion === true,
        participants: { [event.participantId]: { id: event.participantId, role: "participant" } },
        reader: event.participantId,
        tour,
      };
      next.round = beginRound(next, tour.order[0], config);
      next.tour = { ...tour, usedPassages: [next.round.passageId], seen: [tour.order[0]] };
      return { state: next, effects };
    }

    case "TYPE": {
      if (!state.round || state.round.kind !== "typing") return { state, effects };
      const intended = String(event.intended ?? "");
      // Give them a scribe: a colleague types for you, so the input comes out
      // clean. In solo that is simply the mangling stopping.
      const output = state.round.accommodated
        ? intended
        : mangleTyped(intended, config, state.round.seed);
      return { state: { ...state, round: { ...state.round, intended, output } }, effects };
    }

    case "OPEN_ROOM": {
      // One room at a time. The host is a participant with the host role, so
      // identity works the same way for everyone — including across a refresh.
      return {
        state: {
          ...state,
          phase: "lobby",
          mode: null,
          roomCode: String(event.roomCode),
          hostToken: event.token,
          seed: event.seed ?? 1,
          participants: {
            [event.token]: { token: event.token, role: ROLES.HOST, connected: true, order: 0 },
          },
        },
        effects,
      };
    }

    case "JOIN": {
      if (!event.token) return { state, effects };
      const existing = state.participants[event.token];
      const role = event.role === ROLES.OBSERVER ? ROLES.OBSERVER : ROLES.PARTICIPANT;
      return {
        state: {
          ...state,
          participants: {
            ...state.participants,
            [event.token]: {
              token: event.token,
              name: String(event.name ?? "").trim() || "Someone",
              role,
              connected: true,
              order: existing?.order ?? Object.keys(state.participants).length,
            },
          },
        },
        effects,
      };
    }

    case "RECONNECT": {
      const who = state.participants[event.token];
      if (!who) return { state, effects };
      return {
        state: {
          ...state,
          participants: { ...state.participants, [event.token]: { ...who, connected: true } },
        },
        effects,
      };
    }

    case "DISCONNECT": {
      const who = state.participants[event.token];
      if (!who) return { state, effects };
      // Never removed. Phones lock during every round; the participant is still
      // in the room even when their socket is not.
      return {
        state: {
          ...state,
          participants: { ...state.participants, [event.token]: { ...who, connected: false } },
        },
        effects,
      };
    }

    case "PLAY_CARD": {
      if (!state.round || state.round.accommodated) return { state, effects };
      if (!resolve(event.card, state.round.condition)) {
        // Wrong card does nothing. Unlimited attempts in solo, no penalty.
        return { state, effects };
      }
      if (state.round.kind === "typing") {
        effects.push({ type: "ACCOMMODATED", condition: state.round.condition, card: event.card });
        return {
          state: {
            ...state,
            round: { ...state.round, accommodated: true, output: state.round.intended },
          },
          effects,
        };
      }
      const passage = state.round.passageId;
      const next = {
        ...state,
        round: {
          ...state.round,
          accommodated: true,
          rendered: mangle(lookupText(passage), state.round.condition, config, {
            seed: state.round.seed,
            reducedMotion: state.reducedMotion === true,
            accommodated: true,
          }),
        },
      };
      effects.push({ type: "ACCOMMODATED", condition: state.round.condition, card: event.card });
      return { state: next, effects };
    }

    case "DONE": {
      if (!state.tour) return { state, effects };
      const index = state.tour.index + 1;
      if (index >= state.tour.order.length) {
        return { state: { ...state, phase: "catalogue", round: null }, effects };
      }
      const condition = state.tour.order[index];
      const tour = { ...state.tour, index };
      const staged = { ...state, tour };
      const round = beginRound(staged, condition, config);
      return {
        state: {
          ...staged,
          phase: "reading",
          round,
          tour: {
            ...tour,
            usedPassages: [...tour.usedPassages, round.passageId],
            seen: [...tour.seen, condition],
          },
        },
        effects,
      };
    }

    default:
      return { state, effects };
  }
}

// Kept local so the clean passage never travels through state.
import { byId } from "./passages.js";
function lookupText(passageId) {
  return byId(passageId).text;
}
