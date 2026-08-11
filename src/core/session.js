// The room state machine, as a reducer. Pure: reduce(state, event) -> {state, effects}
//
// Time is an input, never read here: every event carries `at`. That is what lets
// a twenty-person session run deterministically in a unit test. Effects are
// emitted as data and performed by the shell.

import { CONDITIONS, FIXES, IMPLEMENTED, isTyping, SILENT_POOL } from "./conditions.js";
import { rng } from "./random.js";
import { pick, pickDictation } from "./passages.js";
import { resolve } from "./deck.js";
import { mangle } from "./mangle.js";
import { mangleTyped } from "./butterfingers.js";
import { BANDS } from "./passages.js";

const SHORT_BAND_CONDITIONS = [CONDITIONS.SOUP, CONDITIONS.MUDSOUND];

export const ROLES = { HOST: "host", PARTICIPANT: "participant", OBSERVER: "observer" };

function shuffled(list, seed) {
  const next = rng(seed);
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function initialState() {
  return { mode: null, phase: "landing", participants: {}, round: null, tour: null };
}

function bandFor(condition) {
  return SHORT_BAND_CONDITIONS.includes(condition) ? BANDS.SHORT : BANDS.FULL;
}

// One round, whoever is reading it. Solo and spotlight differ only in who is
// in the seat and where the seed comes from — a round that forked on mode would
// be two implementations of the same thing, drifting apart.
//
// Seed varies per round so two rounds of the same condition do not land on an
// identical displacement, but stays derived from the session seed so the whole
// session replays deterministically in a test.
function makeRound(condition, config, { seed, usedPassages, reducedMotion }) {
  if (isTyping(condition)) {
    // A typed task: the participant is given a sentence and simply cannot get
    // it out. No target matching, no threshold, no score.
    const prompt = pickDictation(usedPassages, seed);
    return {
      condition,
      fixedBy: FIXES[condition],
      kind: "typing",
      passageId: prompt.id,
      promptText: prompt.text,
      seed,
      intended: "",
      output: "",
      accommodated: false,
      rendered: mangle("", condition, config, { seed }),
    };
  }

  const passage = pick(bandFor(condition), usedPassages, seed);
  return {
    condition,
    fixedBy: FIXES[condition],
    passageId: passage.id,
    seed,
    accommodated: false,
    rendered: mangle(passage.text, condition, config, { seed, reducedMotion }),
  };
}

function beginRound(state, condition, config) {
  return makeRound(condition, config, {
    seed: (state.seed ?? 1) + state.tour.index * 101,
    usedPassages: state.tour.usedPassages,
    reducedMotion: state.reducedMotion === true,
  });
}

// ------------------------------------------------------------ the spotlights

const SPOTLIGHT_ZERO = { planned: null, done: 0, counts: {}, ended: false };
const spotlightOf = (state) => state.spotlight ?? SPOTLIGHT_ZERO;

// The app owns pedagogical coverage: whichever barrier the room has watched
// least goes next, so nobody sits through low contrast three times and never
// sees the typing one. Skipping what this reader has already had is not a
// tie-break but a hard filter — the room must watch genuine first contact, not
// a practised performance, and the reader must learn something new.
//
// Ties fall to IMPLEMENTED order, so a session replays identically.
function conditionFor(counts, seen = []) {
  const options = IMPLEMENTED.filter((c) => !seen.includes(c));
  if (!options.length) return null;
  return options.reduce((best, c) => ((counts[c] ?? 0) < (counts[best] ?? 0) ? c : best), options[0]);
}

// Observers are never assigned a condition and never called on, so they are not
// in this list at all. Neither is anyone who has had all six.
function eligibleReaders(state) {
  const { counts } = spotlightOf(state);
  return Object.values(state.participants)
    .filter((p) => p.role === ROLES.PARTICIPANT)
    .filter((p) => conditionFor(counts, p.seen) !== null)
    .sort((a, b) => a.order - b.order);
}

function canSpotlight(state, config) {
  const { done, ended } = spotlightOf(state);
  return !ended && done < config.spotlight.maxRounds;
}

// Chance, but not the kind that calls the same person twice while somebody else
// never goes. Anyone yet to read is drawn from first.
function drawReader(state) {
  const eligible = eligibleReaders(state);
  if (!eligible.length) return null;
  const fresh = eligible.filter((p) => !p.spotlighted);
  const pool = fresh.length ? fresh : eligible;
  const { done } = spotlightOf(state);
  return pool[Math.floor(rng((state.seed ?? 1) + done * 331)() * pool.length)].token;
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
      // In a room the keyboard belongs to the person in the seat. Solo has no
      // reader token to check against, and no one else to check for.
      if (state.round.reader && event.token !== state.round.reader) return { state, effects };
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

    case "START_SILENT": {
      // Everyone at once, privately. No turn announcements, no audience, nobody
      // reading aloud — a participant's first encounter with their barrier is
      // not in front of nineteen colleagues.
      const seed = (state.seed ?? 1) + 7717;
      const passage = pick(BANDS.FULL, state.usedPassages ?? [], seed);

      // ONE passage for the entire room. Identical text, different reasons it
      // is hard: that is what isolates the variable.
      const active = Object.values(state.participants)
        .filter((p) => p.role === ROLES.PARTICIPANT)
        .sort((a, b) => a.order - b.order);

      const pool = shuffled(SILENT_POOL, seed);
      const assigned = {};
      const participants = { ...state.participants };
      active.forEach((p, i) => {
        // Round-robin over a shuffled pool, so the spread is even by
        // construction rather than by luck.
        const condition = pool[i % pool.length];
        assigned[p.token] = condition;
        participants[p.token] = { ...p, seen: [...(p.seen ?? []), condition] };
      });

      const durationMs = Number(event.durationMs ?? config.round.silentRoundMs);
      return {
        state: {
          ...state,
          phase: "silent",
          participants,
          usedPassages: [...(state.usedPassages ?? []), passage.id],
          silent: {
            passageId: passage.id,
            assigned,
            seed,
            startedAt: event.at,
            durationMs,
            remainingMs: durationMs,
            finished: false,
          },
        },
        effects,
      };
    }

    case "TICK": {
      if (state.phase !== "silent" || !state.silent) return { state, effects };
      // Time is an input. The shell ticks; the core only ever subtracts.
      const elapsed = Math.max(0, event.at - state.silent.startedAt);
      const remainingMs = Math.max(0, state.silent.durationMs - elapsed);
      if (remainingMs === state.silent.remainingMs && !remainingMs) return { state, effects };
      return {
        state: { ...state, silent: { ...state.silent, remainingMs, finished: remainingMs === 0 } },
        effects,
      };
    }

    case "END_SILENT": {
      if (state.phase !== "silent") return { state, effects };
      return { state: { ...state, phase: "lobby", silent: null }, effects };
    }

    case "SET_SPOTLIGHT_COUNT": {
      // A plan, not a cap: the cap is eight and lives in START_ROUND, because a
      // facilitator who talks past their own plan must not be blocked by it.
      const max = config.spotlight.maxRounds;
      const planned = Math.min(max, Math.max(1, Math.round(Number(event.count) || 0)));
      return { state: { ...state, spotlight: { ...spotlightOf(state), planned } }, effects };
    }

    case "VOLUNTEER": {
      const who = state.participants[event.token];
      if (!who) return { state, effects };
      // Recorded for everyone who taps it, including observers — their own
      // phone must confirm exactly like anybody else's, or the button itself
      // becomes the tell. Whose volunteering reaches the projector is decided
      // in `view`, where an observer's never does.
      return {
        state: {
          ...state,
          participants: { ...state.participants, [event.token]: { ...who, volunteered: true } },
        },
        effects,
      };
    }

    case "END_SPOTLIGHTS": {
      return { state: { ...state, spotlight: { ...spotlightOf(state), ended: true } }, effects };
    }

    case "START_ROUND": {
      if (!canSpotlight(state, config)) return { state, effects };

      // The human owns who reads — named from the roster, or handed to chance.
      const reader = event.random ? drawReader(state) : event.reader;
      const who = state.participants[reader];
      // Observers are never eligible: they are never assigned a condition and
      // never called on. Neither is anyone who has already had all six.
      if (!who || who.role !== ROLES.PARTICIPANT) return { state, effects };

      const spotlight = spotlightOf(state);
      const condition = conditionFor(spotlight.counts, who.seen);
      if (!condition) return { state, effects };

      const used = state.usedPassages ?? [];
      const round = makeRound(condition, config, {
        seed: (state.seed ?? 1) + used.length * 101,
        usedPassages: used,
        reducedMotion: state.reducedMotion === true,
      });

      return {
        state: {
          ...state,
          phase: "round",
          usedPassages: [...used, round.passageId],
          participants: {
            ...state.participants,
            [reader]: { ...who, seen: [...(who.seen ?? []), condition], spotlighted: true },
          },
          spotlight: {
            ...spotlight,
            counts: { ...spotlight.counts, [condition]: (spotlight.counts[condition] ?? 0) + 1 },
          },
          round: { ...round, reader, finished: false },
        },
        effects,
      };
    }

    case "END_ROUND": {
      // Back to the roster so the facilitator can pick the next reader. Without
      // this the clean-passage slide is terminal and the loop is a single turn.
      if (state.phase !== "round") return { state, effects };
      const spotlight = spotlightOf(state);
      const reader = state.participants[state.round.reader];
      return {
        state: {
          ...state,
          phase: "lobby",
          round: null,
          // Having read, they are no longer waiting to — leaving them pinned to
          // the top of the roster would crowd out the next willing person.
          participants: reader
            ? { ...state.participants, [reader.token]: { ...reader, volunteered: false } }
            : state.participants,
          spotlight: { ...spotlight, done: spotlight.done + 1 },
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
      if (state.phase === "round" && state.round) {
        // Always available, no conditions attached. Tagging in and the
        // facilitator override land later; finishing never gets harder.
        if (event.token && event.token !== state.round.reader) return { state, effects };
        return { state: { ...state, round: { ...state.round, finished: true } }, effects };
      }
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
