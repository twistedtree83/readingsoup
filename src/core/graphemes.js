// Mudsound's substitution engine.
//
// Common graphemes are swapped for RARER BUT ENTIRELY LEGITIMATE English
// spellings of the same sound. `fish` becomes `phici`, not `þiʃ`. The output
// must stay pronounceable English orthography that simply is not the variant
// the reader has automated — you *can* sound it out, you just cannot recognise
// it on sight. That is the whole difference between a decoder and a reader.
//
// A symbol cipher would be undecodable and would teach the wrong lesson: a
// reading difficulty is not a code.
//
// English already does this to children. The same sound has half a dozen legal
// spellings, and a child who has not automated them is doing this on every page,
// in every subject, all day. We have not invented a barrier — only changed which
// variant you happen to know.

import { rng } from "./random.js";

// Each rule is context-safe: the replacement preserves the sound.
export const RULES = [
  { id: "qu", from: /qu/g, to: "kw" },
  { id: "ck", from: /ck/g, to: "k" },
  { id: "x", from: /x/g, to: "ks" },
  { id: "tion", from: /tion/g, to: "shun" },
  { id: "ee", from: /ee/g, to: "ea" },
  { id: "ai", from: /ai/g, to: "ay" },
  { id: "oo", from: /oo/g, to: "ou" },
  { id: "ph", from: /ph/g, to: "f" },
  { id: "f", from: /f(?!f)/g, to: "ph" },
  { id: "y-end", from: /y\b/g, to: "ie" },
  { id: "er-end", from: /er\b/g, to: "ur" },
  { id: "c-hard", from: /c(?=[aou])/g, to: "k" },
  { id: "wh", from: /wh/g, to: "w" },
  { id: "s-end", from: /([aeioulmnrgdvbw])s\b/g, to: "$1z" },
];

// `f` and `ph` invert each other; applying both would round-trip. Never pick both.
const CONFLICTS = [["f", "ph"]];

export function chooseRules(seed, config) {
  const next = rng(seed);
  const count = Math.max(1, Math.round(RULES.length * config.mudsound.density));
  const pool = [...RULES];
  const chosen = [];
  while (chosen.length < count && pool.length) {
    const pick = pool.splice(Math.floor(next() * pool.length), 1)[0];
    const blocked = CONFLICTS.some(
      ([a, b]) =>
        (pick.id === a && chosen.some((c) => c.id === b)) ||
        (pick.id === b && chosen.some((c) => c.id === a))
    );
    if (!blocked) chosen.push(pick);
  }
  // Stable order, so the same rule set always applies in the same sequence.
  return chosen.sort((a, b) => RULES.indexOf(a) - RULES.indexOf(b));
}

export function applyRules(word, rules) {
  let out = word;
  for (const r of rules) out = out.replace(r.from, r.to);
  return out;
}

// Proper nouns keep their spelling, and the closing clause is left alone so the
// comic payoff survives contact.
export function substitute(tokens, seed, config) {
  const rules = chooseRules(seed, config);
  const keepFrom = closingClauseStart(tokens);

  let sentenceStart = true;
  return tokens.map((t, i) => {
    const opensSentence = sentenceStart;
    sentenceStart = /[.!?]["')]?$/.test(t.text);

    if (i >= keepFrom) return t;
    if (isProperNoun(t.text, opensSentence)) return t;

    const lead = t.text.match(/^[^A-Za-z]*/)[0];
    const tail = t.text.match(/[^A-Za-z]*$/)[0];
    const core = t.text.slice(lead.length, t.text.length - tail.length);
    if (!core) return t;

    const swapped = applyRules(core.toLowerCase(), rules);
    const cased = core[0] === core[0].toUpperCase()
      ? swapped[0].toUpperCase() + swapped.slice(1)
      : swapped;
    return { ...t, text: lead + cased + tail };
  });
}

function isProperNoun(text, opensSentence) {
  const first = text.match(/[A-Za-z]/)?.[0];
  if (!first) return false;
  return first === first.toUpperCase() && !opensSentence;
}

function closingClauseStart(tokens) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (/,$/.test(tokens[i].text) && tokens.length - i <= 8) return i + 1;
  }
  return Math.max(0, tokens.length - 4);
}
