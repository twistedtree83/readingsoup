// Dealing and match resolution. Pure.

import { CARDS, FIXES } from "./conditions.js";
import { rng } from "./random.js";

export function fullDeck() {
  return Object.values(CARDS);
}

export function resolve(card, condition) {
  return FIXES[condition] === card;
}

// Deal one hand per token.
//
// Scarcity is what makes cards interesting in a large room and what makes a
// small one fail, so the hand size is decided by the caller from the group
// size, not here.
//
// The correct card is **guaranteed** into somebody's hand rather than left to
// chance. At three cards from six, the odds of nobody holding it are one in
// two per hand — small at twenty people, and a coin flip at six, where the
// round would simply have no way out. A barrier that cannot be lifted is the
// one outcome this activity must never produce.
export function deal(tokens, condition, { handSize, seed = 1 } = {}) {
  const deck = fullDeck();
  if (!tokens.length) return {};
  if (handSize >= deck.length) {
    return Object.fromEntries(tokens.map((t) => [t, [...deck]]));
  }

  const hands = {};
  tokens.forEach((token, i) => {
    hands[token] = canonical(take(deck, handSize, seed + i * 17));
  });

  const fix = FIXES[condition];
  if (fix && !tokens.some((t) => hands[t].includes(fix))) {
    const next = rng(seed + 9001);
    const lucky = tokens[Math.floor(next() * tokens.length)];
    const hand = hands[lucky];
    // Displacing a card it does not hold cannot duplicate one it does.
    hand[Math.floor(next() * hand.length)] = fix;
    hands[lucky] = canonical(hand);
  }

  return hands;
}

function take(deck, n, seed) {
  const next = rng(seed);
  const pool = [...deck];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, n);
}

// Always the same order, whatever was drawn. A hand sorted by anything else —
// draw order, when the guaranteed card was slotted in — would let a player read
// something off the arrangement of their own cards.
function canonical(hand) {
  const order = fullDeck();
  return [...hand].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
