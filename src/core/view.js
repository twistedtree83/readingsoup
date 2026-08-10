// The sole path by which any client obtains any data — and it takes a
// participant id. That is what makes the privacy boundary structural rather
// than a matter of discipline.
//
// Three rules this enforces:
//   1. Passage tokens go only to the current reader.
//   2. The client never learns which card is correct.
//   3. No timing, score or ranking field exists to leak.

import { fullDeck } from "./deck.js";
import {
  CARD_LABELS,
  CONDITION_LABELS,
  CONDITION_DESCRIPTIONS,
  FIXES,
  IMPLEMENTED,
} from "./conditions.js";

export function viewFor(state, participantId) {
  const base = {
    phase: state.phase,
    mode: state.mode,
    role: state.participants?.[participantId]?.role ?? "spectator",
  };

  if (state.phase === "catalogue") {
    // Every participant leaves knowing all six barriers exist. Only their own
    // are marked, and only on their own device — the app never publishes a
    // person-to-condition map.
    const mine = state.reader === participantId ? state.tour?.seen ?? [] : [];
    return {
      ...base,
      catalogue: IMPLEMENTED.map((condition) => ({
        condition,
        label: CONDITION_LABELS[condition],
        description: CONDITION_DESCRIPTIONS[condition],
        card: FIXES[condition],
        cardLabel: CARD_LABELS[FIXES[condition]],
        had: mine.includes(condition),
      })),
      cardLabels: CARD_LABELS,
    };
  }

  const position =
    state.tour && state.mode === "solo"
      ? `${state.tour.index + 1} of ${state.tour.order.length}`
      : "";

  const isReader = state.reader === participantId && Boolean(state.round);
  if (!isReader) {
    // Everyone who is not the reader: no tokens, no render mode, no passage.
    return { ...base, watching: true };
  }

  if (state.round.kind === "typing") {
    return {
      ...base,
      reader: true,
      kind: "typing",
      position,
      prompt: state.round.promptText,
      intended: state.round.intended,
      output: state.round.output,
      accommodated: state.round.accommodated,
      hand: fullDeck(),
      cardLabels: CARD_LABELS,
    };
  }

  return {
    ...base,
    reader: true,
    position,
    tokens: state.round.rendered.tokens,
    render: state.round.rendered.render,
    accommodated: state.round.accommodated,
    hand: fullDeck(),
    cardLabels: CARD_LABELS,
  };
}
