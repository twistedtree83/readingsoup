// The sole path by which any client obtains any data — and it takes a
// participant id. That is what makes the privacy boundary structural rather
// than a matter of discipline.
//
// Three rules this enforces:
//   1. Passage tokens go only to the current reader.
//   2. The client never learns which card is correct.
//   3. No timing, score or ranking field exists to leak.

import { fullDeck } from "./deck.js";
import { CARD_LABELS } from "./conditions.js";

export function viewFor(state, participantId) {
  const base = {
    phase: state.phase,
    mode: state.mode,
    role: state.participants?.[participantId]?.role ?? "spectator",
  };

  if (state.phase === "catalogue") {
    return { ...base, seen: state.tour?.seen ?? [], cardLabels: CARD_LABELS };
  }

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
    tokens: state.round.rendered.tokens,
    render: state.round.rendered.render,
    accommodated: state.round.accommodated,
    hand: fullDeck(),
    cardLabels: CARD_LABELS,
  };
}
