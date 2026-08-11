// Deadpan tone, ridiculous subject. Everyday vocabulary throughout, so the
// difficulty comes from the mangling rather than from unfamiliar words —
// otherwise the activity simulates a vocabulary gap, which is a different
// barrier and not one of the six.
//
// The comic payoff sits in the FINAL clause, so finishing is rewarded. An
// absurdity that lands in sentence one gives the reader no reason to reach the
// end, and reaching the end is the point.
//
// Nothing about children, schools, disability or assessment. Bureaucratic and
// domestic absurdity only.
//
// Tuning note: deadpan absurdity removes contextual prediction, which is a
// substantial part of fluent reading — you cannot guess the next word when
// unguessability is the joke. These passages are therefore already harder than
// ordinary prose before any mangling is applied. Calibrate against THESE, never
// against normal text.

import { rng } from "./random.js";

export const BANDS = { SHORT: "short", FULL: "full" };

export const PASSAGES = [
  // --- short band: Soup and Mudsound, where a wall of text punishes at length
  {
    id: "shelf",
    band: BANDS.SHORT,
    text: "Attach panel C to the long bracket using the six short screws. Do not use the medium screws. There are no medium screws. If you have medium screws, stop, and consider how they got into your house.",
  },
  {
    id: "parking",
    band: BANDS.SHORT,
    text: "Permit holders may park in bay eleven on alternate Tuesdays. Bay eleven does not exist. The council is aware of this and has asked that we all simply carry on as we were.",
  },
  {
    id: "lift",
    band: BANDS.SHORT,
    text: "The lift serves floors one to five, but stops at floor four only on Thursdays. On other days it will pause at floor four, open its doors, think better of it, and continue.",
  },
  {
    id: "glove",
    band: BANDS.SHORT,
    text: "Found: one glove, left hand, grey. Claimants must describe the glove before viewing it. Nobody has yet described it correctly. Two people have described a better glove and were sent away.",
  },
  {
    id: "lamp",
    band: BANDS.SHORT,
    text: "Your lamp has one switch. This manual has eleven pages. Pages two to ten concern the switch. Page eleven concerns what to do if the lamp has begun switching itself, and is not reassuring.",
  },
  {
    id: "bench",
    band: BANDS.SHORT,
    text: "The bench is provided for sitting. By sitting, you agree to the terms of sitting. The terms are printed on the underside of the bench and may only be read while lying beneath it.",
  },
  {
    id: "vending",
    band: BANDS.SHORT,
    text: "The machine accepts coins and notes. It gives change in stamps. Nobody has been able to explain where the stamps come from, and the company that made the machine has stopped answering.",
  },
  {
    id: "doorbell",
    band: BANDS.SHORT,
    text: "Your doorbell is covered by a five year warranty. The warranty ends the first time the doorbell rings. We recommend that you do not have visitors, and that you tell nobody where you live.",
  },
  {
    id: "gym",
    band: BANDS.SHORT,
    text: "Please wipe down the rowing machine after use. Please do not row for longer than twenty minutes. Please do not ask the rowing machine where it thinks it is going. It does not like the question.",
  },
  {
    id: "recipe",
    band: BANDS.SHORT,
    text: "Warm the sauce in the wide pan you already own. You do own it. Everyone owns one. If you cannot find it, it is behind the thing you moved last spring so you would remember where it was.",
  },

  // --- full band: the visual conditions, where length is survivable
  {
    id: "wombat",
    band: BANDS.FULL,
    text: "Any resident who observes a wombat crossing a public footpath between nine and five must log the encounter with the Parks Office within two working days, and must not, under any circumstances, attempt to wave at it first.",
  },
  {
    id: "kettle",
    band: BANDS.FULL,
    text: "Three stars. Boils water quickly and looks handsome on the counter. Two stars off because it switches itself on at four in the morning, and because it has recently begun addressing me by my full name and job title.",
  },
  {
    id: "library",
    band: BANDS.FULL,
    text: "The book you requested was returned last Tuesday by a member whose card was issued in nineteen sixty one and has never been renewed. The book is fine. We would very much like to speak to the member.",
  },
  {
    id: "bird",
    band: BANDS.FULL,
    text: "Staff are reminded that the bird outside the loading bay has learned the fire alarm. Please do not evacuate the building unless the alarm continues for longer than the bird can hold its breath, which is nine seconds.",
  },
  {
    id: "roundabout",
    band: BANDS.FULL,
    text: "The roundabout at the top of the hill has been moved forty metres east. Signs have not been updated, as the signs were also moved, and now point directly at the place where they themselves used to be.",
  },
  {
    id: "hotel",
    band: BANDS.FULL,
    text: "Four stars. Clean room, good breakfast, friendly staff. One star off because the corridor to the lifts is measurably longer on the way back than on the way there, and nobody at the front desk would discuss it with me.",
  },
  {
    id: "watch",
    band: BANDS.FULL,
    text: "Residents have reported a man in a green coat who helps with shopping, mends gates, and asks for nothing in return. He has been seen on every street in the area, on the same afternoon, at the same time.",
  },
  {
    id: "weather",
    band: BANDS.FULL,
    text: "Fog is scheduled for Tuesday between six and nine in the morning. The fog will begin at the river and move north at walking pace. Residents wishing to avoid the fog should walk slightly faster than the fog.",
  },
  {
    id: "museum",
    band: BANDS.FULL,
    text: "This exhibit is currently on loan to this museum. The paperwork was completed correctly and has been checked twice. We are as puzzled as you are, and would ask that you do not raise it with the front desk.",
  },
  {
    id: "bus",
    band: BANDS.FULL,
    text: "The eleven fifteen service does not run on the eleventh of the month, or on any day following a day on which it did not run. Passengers who understand this rule are asked not to explain it to other passengers.",
  },
];

// Butterfingers needs a different shape: short enough to type, long enough to
// be maddening once a fifth of the keystrokes stop arriving.
export const DICTATION = [
  { id: "d-permit", text: "The wombat requires a permit before it may cross." },
  { id: "d-kettle", text: "The kettle has begun using my full name at breakfast." },
  { id: "d-bay", text: "Bay eleven does not exist, so carry on as before." },
  { id: "d-screws", text: "There are no medium screws anywhere in this house." },
  { id: "d-lift", text: "The lift stops at floor four only on a Thursday." },
  { id: "d-bird", text: "Do not evacuate. The bird has learned the fire alarm." },
  { id: "d-bench", text: "The terms of sitting are printed under the bench itself." },
  { id: "d-doorbell", text: "Your warranty ends the first time the doorbell rings." },
  { id: "d-fog", text: "Walk slightly faster than the fog and you will be fine." },
  { id: "d-museum", text: "This exhibit is on loan to this very museum." },
];

// Where the discussion starts. Advanced by hand, one at a time, so the room
// finishes each one before the next appears.
//
// The third is the whole point of the activity and is deliberately last: the
// first two are about the people in the room, and only once they have said what
// it felt like does the question about a student land as recognition rather
// than as a lesson.
export const DEBRIEF = [
  "What did you do when you got stuck?",
  "What did you notice about the room while you were reading?",
  "Which student does this remind you of?",
];

// Seeded so sessions vary, filtered so nothing repeats within one.
function choose(pool, seed) {
  return pool[Math.floor(rng(seed)() * pool.length)];
}

export function pick(band, used = [], seed = 1) {
  const unused = PASSAGES.filter((p) => !used.includes(p.id));
  const pool = unused.length ? unused : PASSAGES;
  const banded = pool.filter((p) => p.band === band);
  return choose(banded.length ? banded : pool, seed);
}

export function pickDictation(used = [], seed = 1) {
  const unused = DICTATION.filter((d) => !used.includes(d.id));
  return choose(unused.length ? unused : DICTATION, seed);
}

export function byId(id) {
  return PASSAGES.find((p) => p.id === id) ?? DICTATION.find((d) => d.id === id);
}
