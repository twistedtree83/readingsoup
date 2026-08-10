// The sole path by which any client obtains any data — and it takes a
// participant id. That is what makes the privacy boundary structural rather
// than a matter of discipline.
//
// Three rules this enforces:
//   1. Passage tokens go only to the current reader.
//   2. The client never learns which card is correct.
//   3. No timing, score or ranking field exists to leak.

import { fullDeck } from "./deck.js";
import { ROLES } from "./session.js";
import {
  CARD_LABELS,
  CONDITION_LABELS,
  CONDITION_DESCRIPTIONS,
  FIXES,
  IMPLEMENTED,
} from "./conditions.js";

export function viewFor(state, participantId) {
  const me = state.participants?.[participantId];

  if (me?.role === ROLES.HOST) return hostView(state, me);
  if (state.phase === "lobby") {
    return {
      phase: "lobby",
      mode: state.mode,
      role: me?.role ?? "spectator",
      name: me?.name,
      roomCode: state.roomCode,
      joined: Boolean(me),
    };
  }

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

// The projector view. Deliberately thin: a room code, a headcount, and names.
//
// THE ROSTER CARRIES NAMES ONLY. No roles, no counts split by role, nothing
// derived from who chose to observe. This screen is shown to the entire room at
// once, so anything role-shaped on it would disclose an opt-out to everybody
// simultaneously — the exact thing the observer role exists to prevent.
function hostView(state) {
  const roster = Object.values(state.participants)
    .filter((p) => p.role !== ROLES.HOST)
    .sort((a, b) => a.order - b.order)
    .map((p) => ({ name: p.name, connected: p.connected }));

  return {
    phase: state.phase,
    mode: state.mode,
    role: ROLES.HOST,
    roomCode: state.roomCode,
    roster,
    headcount: roster.length,
  };
}
