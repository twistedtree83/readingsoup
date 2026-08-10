// The room state machine, as a reducer. Pure: reduce(state, event) -> {state, effects}
//
// Time is an input, never read here: every event carries `at`. That is what lets
// a twenty-person session run deterministically in a unit test. Effects are
// emitted as data and performed by the shell.

import { CONDITIONS, FIXES, IMPLEMENTED } from "./conditions.js";
import { pick } from "./passages.js";
import { resolve } from "./deck.js";
import { mangle } from "./mangle.js";
import { BANDS } from "./passages.js";

const SHORT_BAND_CONDITIONS = [CONDITIONS.SOUP, CONDITIONS.MUDSOUND];

export function initialState() {
  return { mode: null, phase: "landing", participants: {}, round: null, tour: null };
}

function bandFor(condition) {
  return SHORT_BAND_CONDITIONS.includes(condition) ? BANDS.SHORT : BANDS.FULL;
}

function beginRound(state, condition, config) {
  const passage = pick(bandFor(condition), state.tour.usedPassages);
  return {
    condition,
    fixedBy: FIXES[condition],
    passageId: passage.id,
    accommodated: false,
    rendered: mangle(passage.text, condition, config),
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
        participants: { [event.participantId]: { id: event.participantId, role: "participant" } },
        reader: event.participantId,
        tour,
      };
      next.round = beginRound(next, tour.order[0], config);
      next.tour = { ...tour, usedPassages: [next.round.passageId], seen: [tour.order[0]] };
      return { state: next, effects };
    }

    case "PLAY_CARD": {
      if (!state.round || state.round.accommodated) return { state, effects };
      if (!resolve(event.card, state.round.condition)) {
        // Wrong card does nothing. Unlimited attempts in solo, no penalty.
        return { state, effects };
      }
      const passage = state.round.passageId;
      const next = {
        ...state,
        round: {
          ...state.round,
          accommodated: true,
          rendered: mangle(
            lookupText(passage),
            state.round.condition,
            config,
            { accommodated: true }
          ),
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
