// The sole path by which any client obtains any data — and it takes a
// participant id. That is what makes the privacy boundary structural rather
// than a matter of discipline.
//
// Three rules this enforces:
//   1. Passage tokens go only to the current reader.
//   2. The client never learns which card is correct.
//   3. No timing, score or ranking field exists to leak.

import { fullDeck } from "./deck.js";
import { byId } from "./passages.js";
import { mangle, plain } from "./mangle.js";
import { CONFIG } from "./config.js";
import { ROLES } from "./session.js";
import {
  CARD_LABELS,
  CONDITION_LABELS,
  CONDITION_DESCRIPTIONS,
  FIXES,
  IMPLEMENTED,
} from "./conditions.js";

export function viewFor(state, participantId, config) {
  const me = state.participants?.[participantId];

  if (me?.role === ROLES.HOST) return hostView(state, config);
  if (state.phase === "silent") {
    const passage = byId(state.silent.passageId);
    const condition = state.silent.assigned[participantId];

    // An observer gets the SAME passage rendered clean, with a prompt to read it
    // and then watch the room. Head down over a phone, physically
    // indistinguishable from everyone else — an observer sitting with nothing
    // to do discloses through body language what the app keeps private. It is
    // also useful: they get the baseline at normal difficulty.
    if (!condition) {
      const clean = plain(passage.text);
      return {
        phase: "silent",
        mode: state.mode,
        role: me?.role ?? "spectator",
        passageId: passage.id,
        observerCover: true,
        tokens: clean.tokens,
        render: clean.render,
        remainingMs: state.silent.remainingMs,
      };
    }

    const rendered = mangle(passage.text, condition, config ?? CONFIG, {
      seed: state.silent.seed,
      reducedMotion: state.reducedMotion === true,
    });
    return {
      phase: "silent",
      mode: state.mode,
      role: me?.role ?? "participant",
      passageId: passage.id,
      tokens: rendered.tokens,
      render: rendered.render,
      remainingMs: state.silent.remainingMs,
    };
  }

  if (state.phase === "round") {
    const readerName = state.participants[state.round.reader]?.name;

    if (state.reader === participantId || state.round.reader === participantId) {
      const seat = {
        phase: "round",
        mode: state.mode,
        role: me?.role ?? "participant",
        reader: true,
        readerName,
        finished: state.round.finished,
      };
      // The barrier itself is never named to the reader. Knowing you have
      // Mudsound is knowing which card lifts it, and the diagnosis is the
      // game — for them at the reveal, and for the room right now.
      if (state.round.kind === "typing") {
        return {
          ...seat,
          kind: "typing",
          prompt: state.round.promptText,
          intended: state.round.intended,
          output: state.round.output,
          accommodated: state.round.accommodated,
        };
      }
      return {
        ...seat,
        tokens: state.round.rendered.tokens,
        render: state.round.rendered.render,
        accommodated: state.round.accommodated,
      };
    }

    // Everyone else: no tokens, no render mode, no passage. Just who to watch.
    return {
      phase: "round",
      mode: state.mode,
      role: me?.role ?? "spectator",
      watching: true,
      readerName,
      finished: state.round.finished,
    };
  }

  if (state.phase === "lobby") {
    return {
      phase: "lobby",
      mode: state.mode,
      role: me?.role ?? "spectator",
      name: me?.name,
      roomCode: state.roomCode,
      joined: Boolean(me),
      // Offered to everyone in the room, observers included. A button only some
      // phones carry is readable from the next seat, and choosing to observe is
      // nobody else's business. Tapping it confirms the same way for everyone;
      // only a participant's willingness ever reaches the projector.
      canVolunteer: Boolean(me) && !(state.spotlight?.ended === true),
      volunteered: me?.volunteered === true,
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
// Willing readers first, then join order, so the facilitator can pick someone
// who wants it at a glance.
//
// An observer's "I'll go" is deliberately dropped here rather than in the
// reducer. Surfacing it would put an ineligible name at the top of the list —
// precisely the name the facilitator would then tap — and a tap that visibly
// does nothing discloses to the whole room what the role exists to keep
// private. Their own phone still confirms; this list simply never hears of it.
function rosterOrder(state) {
  return Object.values(state.participants ?? {})
    .filter((p) => p.role !== ROLES.HOST)
    .map((p) => ({ ...p, willing: p.volunteered === true && p.role === ROLES.PARTICIPANT }))
    .sort((a, b) => Number(b.willing) - Number(a.willing) || a.order - b.order);
}

// The roster's order, as tokens. The host addresses participants by POSITION,
// never by token: a token is an auth credential, and handing one to the
// projector would let the facilitator act as that participant. Both orderings
// come from one place, because a projector and a token list that disagree hand
// the round to the wrong person.
export function rosterTokens(state) {
  return rosterOrder(state).map((p) => p.token);
}

// What the facilitator plans the slot against. The estimate is the whole cost
// of a spotlight — announce, read, clean passage, the beat of talk after it —
// so eight rounds reads as the twenty minutes it actually is.
function spotlightPlan(state, config) {
  const { maxRounds, roundEstimateMs } = (config ?? CONFIG).spotlight;
  const s = state.spotlight ?? {};
  return {
    planned: s.planned ?? null,
    done: s.done ?? 0,
    max: maxRounds,
    ended: s.ended === true,
    estimateMs: (s.planned ?? 0) * roundEstimateMs,
    options: Array.from({ length: maxRounds }, (_, i) => ({
      count: i + 1,
      estimateMs: (i + 1) * roundEstimateMs,
    })),
  };
}

function hostView(state, config) {
  if (state.phase === "silent") {
    // A countdown and nothing else. No roster, no names, no progress per person.
    return {
      phase: "silent",
      mode: state.mode,
      role: ROLES.HOST,
      remainingMs: state.silent.remainingMs,
      finished: state.silent.finished,
    };
  }

  if (state.phase === "round") {
    const plan = spotlightPlan(state, config);
    return {
      phase: "round",
      mode: state.mode,
      role: ROLES.HOST,
      roomCode: state.roomCode,
      readerName: state.participants[state.round.reader]?.name,
      finished: state.round.finished,
      // The clean passage exists client-side in exactly one place: here, and
      // only once the round is over.
      clean: state.round.finished ? byId(state.round.passageId)?.text : undefined,
      canAdvance: state.round.finished,
      spotlight: { ...plan, index: plan.done + 1 },
    };
  }

  const roster = rosterOrder(state).map((p) => ({
    name: p.name,
    connected: p.connected,
    volunteered: p.willing,
  }));

  return {
    phase: state.phase,
    mode: state.mode,
    role: ROLES.HOST,
    roomCode: state.roomCode,
    roster,
    spotlight: spotlightPlan(state, config),
    // Who is actually here, not who has ever been. This is the number the
    // facilitator reads when deciding to start, and the number PRD mode
    // selection keys off — someone who left permanently must not inflate a
    // small session into group mode. Still a single total, never split by role.
    headcount: roster.filter((r) => r.connected).length,
  };
}
