// Deadpan tone, ridiculous subject. Everyday vocabulary throughout, so the
// difficulty comes from the mangling rather than from unfamiliar words.
// The comic payoff sits in the final clause, so finishing is rewarded.
// Nothing about children, schools, disability or assessment.
//
// The full library of 20 passages plus 10 dictation prompts arrives in S8.

export const BANDS = { SHORT: "short", FULL: "full" };

export const PASSAGES = [
  {
    id: "wombat",
    band: BANDS.FULL,
    text: "Any resident who observes a wombat crossing a public footpath between nine and five must log the encounter with the Parks Office within two working days, and must not, under any circumstances, wave.",
  },
  {
    id: "kettle",
    band: BANDS.FULL,
    text: "Three stars. Boils water quickly and looks handsome on the counter. Two stars off because it switches itself on at four in the morning and has begun addressing me by my full name.",
  },
  {
    id: "shelf",
    band: BANDS.SHORT,
    text: "Attach panel C to the long bracket using the six short screws. Do not use the medium screws. There are no medium screws. If you have medium screws, stop, and consider how they came to be in your house.",
  },
  {
    id: "parking",
    band: BANDS.SHORT,
    text: "Permit holders may park in bay eleven on alternate Tuesdays. Bay eleven does not exist. The council is aware of this and has asked that we all simply carry on as before.",
  },
];

// Butterfingers needs a different shape: short enough to type, long enough to
// be maddening.
export const DICTATION = [
  { id: "d-permit", text: "The wombat requires a permit before crossing." },
  { id: "d-kettle", text: "The kettle has begun using my full name." },
  { id: "d-bay", text: "Bay eleven does not exist. Carry on as before." },
  { id: "d-screws", text: "There are no medium screws in this house." },
];

export function pickDictation(used = []) {
  const unused = DICTATION.filter((d) => !used.includes(d.id));
  return (unused.length ? unused : DICTATION)[0];
}

export function pick(band, used = []) {
  const unused = PASSAGES.filter((p) => !used.includes(p.id));
  const pool = unused.length ? unused : PASSAGES;
  const banded = pool.filter((p) => p.band === band);
  return (banded.length ? banded : pool)[0];
}

export function byId(id) {
  return PASSAGES.find((p) => p.id === id);
}
