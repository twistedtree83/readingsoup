// The room state machine, as a reducer. Pure: reduce(state, event) -> {state, effects}
//
// Time is an input, never read here: every event carries `at`. That is what lets
// a twenty-person session run deterministically in a unit test. Effects are
// emitted as data and performed by the shell.

import { CONDITIONS, FIXES, IMPLEMENTED, isTyping, SILENT_POOL } from "./conditions.js";
import { rng } from "./random.js";
import { pick, pickDictation, DEBRIEF } from "./passages.js";
import { deal, fullDeck, resolve } from "./deck.js";
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

// Who the reader may hand the passage to. Observers are never called on, and
// nobody meets the same barrier twice — the room would be watching a practised
// performance, and the tagged colleague would learn nothing new.
export function eligibleForTag(state) {
  if (!state.round?.reader) return [];
  return Object.values(state.participants ?? {})
    .filter((p) => p.role === ROLES.PARTICIPANT)
    .filter((p) => p.token !== state.round.reader)
    .filter((p) => !(p.seen ?? []).includes(state.round.condition))
    .sort((a, b) => a.order - b.order)
    .map((p) => p.token);
}

// Take the barrier off. One path, whether a player found the card or the
// facilitator handed it over — the reader's experience of being helped must not
// depend on which.
function lift(round, state, config, helped) {
  if (round.kind === "typing") {
    // The scribe: a colleague types for you, so the input comes out clean.
    return { ...round, accommodated: true, output: round.intended, helped };
  }
  return {
    ...round,
    accommodated: true,
    helped,
    rendered: mangle(lookupText(round.passageId), round.condition, config, {
      seed: round.seed,
      reducedMotion: state.reducedMotion === true,
      accommodated: true,
    }),
  };
}

// How long the room still has to just watch. Solo has no window: it is
// self-paced, and there is nobody to watch.
function watchRemaining(state, at, config) {
  if (typeof state.round?.startedAt !== "number") return 0;
  const length = state.round.watchWindowMs ?? config.round.watchWindowMs;
  return Math.max(0, length - Math.max(0, at - state.round.startedAt));
}

// Group size is a first-class variable, so the shape of the session is derived
// from it rather than chosen. One active participant is not an error state: it
// is solo, and it must arrive there without anybody being told why.
export function activeParticipants(state) {
  return Object.values(state.participants ?? {}).filter((p) => p.role === ROLES.PARTICIPANT);
}

export function modeFor(state, config) {
  const n = activeParticipants(state).length;
  if (n >= config.cards.groupFrom) return "group";
  return n <= 1 ? "solo" : "small";
}

// How many rounds this room has in it. Eight is the GROUP cap — it exists so a
// twenty-person session ends before the room does, not to shorten a session of
// five. A small room instead runs ceil(6 / n) each, capped at three, so the
// people in it still meet every barrier between them.
// Fixed when the facilitator starts, and never recomputed. If this were live,
// somebody quietly becoming an observer would move the plan on the projector at
// the exact moment they did it — a five-person room turning into a six-round
// one in front of everybody is the disclosure the role exists to prevent. It is
// also simply right: the session's shape was decided when it began.
export function roundBudget(state, config) {
  if (typeof state.plan?.budget === "number") return state.plan.budget;
  const n = activeParticipants(state).length;
  if (n >= config.cards.groupFrom) return config.spotlight.maxRounds;
  return n * roundsPerPerson(n, config);
}

export function roundsPerPerson(n, config) {
  if (n < 1) return 0;
  return Math.min(config.small.maxRoundsPerPerson, Math.ceil(IMPLEMENTED.length / n));
}

// The barrier a latecomer meets: whichever of the silent pool the room has
// handed out least, so a late arrival widens the room's coverage rather than
// piling onto whatever was already common.
function catchUpCondition(state, seen = []) {
  const counts = {};
  for (const p of Object.values(state.participants ?? {})) {
    for (const c of p.seen ?? []) counts[c] = (counts[c] ?? 0) + 1;
  }
  const options = SILENT_POOL.filter((c) => !seen.includes(c));
  const pool = options.length ? options : SILENT_POOL;
  return pool.reduce((best, c) => ((counts[c] ?? 0) < (counts[best] ?? 0) ? c : best), pool[0]);
}

function withoutKey(map, key) {
  const { [key]: _gone, ...rest } = map ?? {};
  return rest;
}

function canSpotlight(state, config) {
  const { done, ended } = spotlightOf(state);
  return !ended && done < roundBudget(state, config);
}

// Chance, but not the kind that calls the same person three times while
// somebody else never goes. The draw is taken from whoever has read least so
// far, which is also what makes "three rounds each" true in a small room rather
// than merely intended.
function drawReader(state) {
  const eligible = eligibleReaders(state);
  if (!eligible.length) return null;
  const fewest = Math.min(...eligible.map((p) => p.rounds ?? 0));
  const pool = eligible.filter((p) => (p.rounds ?? 0) === fewest);
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
      // Opting out is permanent. A phone that reconnects, or one whose owner
      // taps through the join screen again, does not undo it.
      const role =
        existing?.role === ROLES.OBSERVER || event.role === ROLES.OBSERVER
          ? ROLES.OBSERVER
          : ROLES.PARTICIPANT;
      const joined = {
        ...existing,
        token: event.token,
        name: String(event.name ?? "").trim() || existing?.name || "Someone",
        role,
        connected: true,
        order: existing?.order ?? Object.keys(state.participants).length,
      };

      // Somebody always walks in six minutes late. That is a certainty in a
      // staff meeting, not an edge case — and they have missed the round that
      // carries the actual learning. Run it for them privately, right now: it
      // is a per-phone experience anyway, so there is nothing to synchronise.
      const late =
        !existing && role === ROLES.PARTICIPANT && state.silentPassageId && !joined.catchUp;
      if (late) {
        const condition = catchUpCondition(state, joined.seen);
        joined.seen = [...(joined.seen ?? []), condition];
        joined.catchUp = {
          passageId: state.silentPassageId,
          condition,
          seed: (state.seed ?? 1) + joined.order * 137,
          startedAt: event.at,
          durationMs: config.round.silentRoundMs,
          remainingMs: config.round.silentRoundMs,
          finished: false,
        };
      }

      return {
        state: { ...state, participants: { ...state.participants, [event.token]: joined } },
        effects,
      };
    }

    case "OPT_OUT": {
      // Someone will discover in round two that this is landing much harder
      // than they expected. Silent, permanent, and it emits NOTHING: a visible
      // withdrawal mid-round is precisely the public moment the observer role
      // exists to prevent.
      const who = state.participants[event.token];
      if (!who || who.role !== ROLES.PARTICIPANT) return { state, effects };

      // They keep their hand and go on playing. Card play carries no exposure,
      // and taking it away would turn a quiet exit into a demotion.
      const participants = {
        ...state.participants,
        [event.token]: { ...who, role: ROLES.OBSERVER },
      };

      // Mid silent round, their barrier becomes the cover everybody else's
      // observer already has: the same passage, rendered clean.
      const silent = state.silent
        ? { ...state.silent, assigned: withoutKey(state.silent.assigned, event.token) }
        : state.silent;

      // If they are the reader, this is DONE and nothing else. From the room's
      // point of view they simply finished.
      const round =
        state.phase === "round" && state.round?.reader === event.token
          ? { ...state.round, finished: true }
          : state.round;

      return { state: { ...state, participants, silent, round }, effects };
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

    case "START_SESSION": {
      // The facilitator presses one button. What happens is decided by how many
      // people are actually playing — never by the facilitator having to notice
      // and choose, which is the moment a small room gets it wrong.
      const active = activeParticipants(state);
      if (!active.length) return { state, effects };

      // Frozen here, so nothing about the session's shape can move later when
      // somebody joins late or quietly steps out.
      const plan = {
        mode: modeFor(state, config),
        budget: roundBudget({ ...state, plan: null }, config),
        perPerson: roundsPerPerson(active.length, config),
      };

      if (active.length >= config.cards.groupFrom) {
        return reduce({ ...state, mode: "group", plan }, { ...event, type: "START_SILENT" }, config);
      }

      if (active.length === 1) {
        // Solo, silently. There is exactly one tour and one round, so this uses
        // the same fields the standalone tour does — the same core behind a
        // different transport, never a second implementation.
        //
        // Nothing is surfaced about WHY. A two-person session with one observer
        // must be indistinguishable from a one-person session, on every screen,
        // or the fallback becomes the disclosure the observer role exists to
        // prevent.
        const tour = { order: [...IMPLEMENTED], index: 0, usedPassages: [], seen: [] };
        const next = { ...state, mode: "solo", plan, phase: "reading", reader: active[0].token, tour };
        next.round = beginRound(next, tour.order[0], config);
        next.tour = { ...tour, usedPassages: [next.round.passageId], seen: [tour.order[0]] };
        return { state: next, effects };
      }

      // Small: straight to rounds, no silent round. The plan is the structure
      // rather than a facilitator's choice.
      const planned = roundBudget(state, config);
      return {
        state: { ...state, mode: "small", plan, spotlight: { ...spotlightOf(state), planned } },
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
          // Kept so a latecomer's private catch-up is the SAME forty words the
          // room had. "We all read the same passage" is the facilitator's best
          // line, and it should still be true for the person who walked in late.
          silentPassageId: passage.id,
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
      // Time is an input. The shell ticks; the core only ever subtracts.
      //
      // Private catch-ups run on their own clocks, alongside whatever the room
      // is doing, so they are ticked first and independently of the phase.
      if (Object.values(state.participants ?? {}).some((p) => p.catchUp && !p.catchUp.finished)) {
        const participants = {};
        for (const [token, p] of Object.entries(state.participants)) {
          if (!p.catchUp || p.catchUp.finished) { participants[token] = p; continue; }
          const elapsed = Math.max(0, event.at - p.catchUp.startedAt);
          const remainingMs = Math.max(0, p.catchUp.durationMs - elapsed);
          participants[token] = {
            ...p,
            catchUp: { ...p.catchUp, remainingMs, finished: remainingMs === 0 },
          };
        }
        state = { ...state, participants };
      }

      if (state.phase === "round" && state.round?.locked) {
        // The tick drives the DISPLAY. Whether a card may actually be played is
        // decided against the play's own timestamp, so a dropped tick can slow
        // a countdown but can never open the window early.
        const unlocksInMs = watchRemaining(state, event.at, config);
        return {
          state: { ...state, round: { ...state.round, unlocksInMs, locked: unlocksInMs > 0 } },
          effects,
        };
      }
      if (state.phase !== "silent" || !state.silent) return { state, effects };
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
      // A plan, not a cap: the cap lives in START_ROUND, because a facilitator
      // who talks past their own plan must not be blocked by it. But the plan
      // is clamped to what this room can actually run — a number of rounds the
      // session cannot reach is a promise to the facilitator that it breaks.
      const max = roundBudget(state, config);
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

    case "START_REVEAL": {
      // Six things you can do on Monday, and on each phone the ones that person
      // actually met. The room's own attribution happens by show of hands,
      // which keeps disclosure voluntary — the app publishes no map.
      if (state.phase === "catalogue") return { state, effects };
      return {
        state: { ...state, phase: "catalogue", round: null, silent: null, debrief: 0 },
        effects,
      };
    }

    case "NEXT_PROMPT": {
      // One at a time, by hand, so the room finishes each before the next
      // appears. It stops on the last rather than falling off the end.
      if (state.phase !== "catalogue") return { state, effects };
      return {
        state: { ...state, debrief: Math.min(DEBRIEF.length, (state.debrief ?? 0) + 1) },
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

      // Everyone but the reader gets a hand — observers included. Card play
      // requires no reading and carries no exposure, so it is the half of this
      // activity that is safe for everybody, and a large session that dealt
      // observers out would leave a dozen people watching a projector with
      // nothing to do.
      const table = Object.values(state.participants)
        .filter((p) => p.role !== ROLES.HOST && p.token !== reader)
        .sort((a, b) => a.order - b.order)
        .map((p) => p.token);
      const active = Object.values(state.participants).filter((p) => p.role === ROLES.PARTICIPANT);
      const handSize =
        active.length >= config.cards.groupFrom ? config.cards.handAtGroup : fullDeck().length;
      const hands = deal(table, condition, { handSize, seed: (state.seed ?? 1) + used.length * 13 });

      const participants = {
        ...state.participants,
        [reader]: {
          ...who,
          seen: [...(who.seen ?? []), condition],
          spotlighted: true,
          rounds: (who.rounds ?? 0) + 1,
          hand: [],
          spent: [],
        },
      };
      for (const token of table) {
        participants[token] = { ...participants[token], hand: hands[token], spent: [] };
      }

      return {
        state: {
          ...state,
          phase: "round",
          usedPassages: [...used, round.passageId],
          participants,
          spotlight: {
            ...spotlight,
            counts: { ...spotlight.counts, [condition]: (spotlight.counts[condition] ?? 0) + 1 },
          },
          // The watch window starts now, and it is per ROUND: somebody who has
          // already sat through one still waits through the next. You cannot
          // accommodate what you have not noticed, and that noticing is the
          // most transferable thing in the session.
          // The window length travels on the round the way the silent round's
          // duration does, so the harness can run a real one in a second
          // without the core learning anything about being under test.
          round: {
            ...round,
            reader,
            finished: false,
            startedAt: event.at,
            watchWindowMs: Number(event.watchWindowMs ?? config.round.watchWindowMs),
            locked: Number(event.watchWindowMs ?? config.round.watchWindowMs) > 0,
            unlocksInMs: Number(event.watchWindowMs ?? config.round.watchWindowMs),
            plays: 0,
          },
        },
        effects,
      };
    }

    case "END_ROUND": {
      // Back to the roster so the facilitator can pick the next reader. Without
      // this the clean-passage slide is terminal and the loop is a single turn.
      if (state.phase !== "round") return { state, effects };
      const spotlight = spotlightOf(state);
      const participants = {};
      for (const [token, p] of Object.entries(state.participants)) {
        // Hands are per round: the next reader has a different barrier, and a
        // hand carried over would be a hand already half spent against it.
        // Having read, the reader is no longer waiting to — leaving them pinned
        // to the top of the roster would crowd out the next willing person.
        participants[token] = {
          ...p,
          hand: [],
          spent: [],
          volunteered: token === state.round.reader ? false : p.volunteered,
        };
      }
      return {
        state: {
          ...state,
          phase: "lobby",
          round: null,
          participants,
          spotlight: { ...spotlight, done: spotlight.done + 1 },
        },
        effects,
      };
    }

    case "PLAY_CARD": {
      if (!state.round || state.round.accommodated) return { state, effects };

      // In a room a card has to be one you were dealt and have not already
      // spent, and the reader has no hand at all — they are the one being
      // helped. Solo has no table: one person holds the whole deck and may try
      // as often as they like, with no penalty and nothing spent.
      const player = state.round.reader ? state.participants[event.token] : null;
      if (state.round.reader) {
        if (!player || event.token === state.round.reader) return { state, effects };
        if (!(player.hand ?? []).includes(event.card)) return { state, effects };
        if ((player.spent ?? []).includes(event.card)) return { state, effects };
        // Watch first. Without this a room of nineteen card-holders brute-forces
        // the answer in seconds and the barrier dissolves before it has
        // registered on anyone — including the reader, who then loses the
        // experience the whole activity exists to create. A card refused by the
        // clock is not spent; the player simply has not been allowed to act yet.
        if (watchRemaining(state, event.at, config) > 0) return { state, effects };
        // Three plays across the ROOM, not three each. One rule stops both the
        // large-group stampede and a small-group player working through the
        // whole deck — and it is what makes somebody say "wait, don't waste it".
        if ((state.round.plays ?? 0) >= config.round.playsPerRound) return { state, effects };
      }

      const correct = resolve(event.card, state.round.condition);
      // Spent either way. The wrong card changing nothing is the good part: the
      // reader says so out loud, and the room finds out that guessing at what
      // somebody needs costs something.
      const played = {
        ...state,
        participants: player
          ? {
              ...state.participants,
              [event.token]: { ...player, spent: [...(player.spent ?? []), event.card] },
            }
          : state.participants,
        round: { ...state.round, plays: (state.round.plays ?? 0) + 1 },
      };
      if (!correct) return { state: played, effects };

      effects.push({
        type: "ACCOMMODATED",
        condition: state.round.condition,
        card: event.card,
        by: player?.name,
      });

      // Named, because the correct play is a generous act done in public. The
      // wrong ones stay unattributed — see `view`.
      const helped = player ? { name: player.name, card: event.card } : undefined;
      return { state: { ...played, round: lift(played.round, played, config, helped) }, effects };
    }

    case "TAG_IN": {
      // A move in the game, never giving up — and there is no accept step. An
      // accept prompt is slow, and a decline would be a public refusal to help
      // a struggling colleague, which is the exact opposite of the framing this
      // activity needs. The reader taps a name and that phone is the reader.
      if (!state.round?.reader || state.round.finished) return { state, effects };
      if (event.token !== state.round.reader) return { state, effects };
      if (!eligibleForTag(state).includes(event.to)) return { state, effects };

      const from = state.participants[state.round.reader];
      const to = state.participants[event.to];

      // The seats swap and so do the hands. The table keeps exactly the same
      // cards on it, which is what stops tagging in the one person holding the
      // correct card from stranding the room with a barrier it cannot lift.
      const participants = {
        ...state.participants,
        [from.token]: { ...from, hand: to.hand ?? [], spent: to.spent ?? [] },
        [to.token]: {
          ...to,
          hand: [],
          spent: [],
          seen: [...(to.seen ?? []), state.round.condition],
          spotlighted: true,
          rounds: (to.rounds ?? 0) + 1,
        },
      };

      // Same passage, same barrier, from the START. Not a mid-passage handoff:
      // fiddly to reason about and unreadable on a projector.
      const round = {
        ...state.round,
        reader: event.to,
        tagged: true,
        ...(state.round.kind === "typing"
          ? { intended: "", output: "" }
          : {
              rendered: mangle(lookupText(state.round.passageId), state.round.condition, config, {
                seed: state.round.seed,
                reducedMotion: state.reducedMotion === true,
                accommodated: state.round.accommodated === true,
              }),
            }),
      };

      // startedAt, locked, plays and helped are all deliberately untouched: the
      // watch window belongs to the round, not the reader, so cards stay live
      // across the handover and the room does not get its three plays back.
      return { state: { ...state, participants, round }, effects };
    }

    case "OVERRIDE": {
      // The distress valve, and it is required rather than polish: three plays
      // gone and none of them right leaves a reader stuck inside a barrier with
      // no help coming. Available at any moment — inside the watch window, past
      // the cap, whenever the facilitator judges it.
      if (!state.round || state.round.accommodated) return { state, effects };
      const card = FIXES[state.round.condition];
      effects.push({ type: "ACCOMMODATED", condition: state.round.condition, card, granted: true });
      // No name. Nobody found it, and the projector says what the card was
      // rather than who failed to play it.
      return {
        state: { ...state, round: lift(state.round, state, config, { card, granted: true }) },
        effects,
      };
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
