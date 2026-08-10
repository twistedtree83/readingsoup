// Dealing and match resolution. Pure.
// Hand-size scaling and the guaranteed-correct-holder invariant arrive in S15;
// solo mode always holds the full deck.

import { CARDS, FIXES } from "./conditions.js";

export function fullDeck() {
  return Object.values(CARDS);
}

export function resolve(card, condition) {
  return FIXES[condition] === card;
}
