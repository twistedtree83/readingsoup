// Domain vocabulary. Names are deliberate: participants will still be saying
// "I had Soup" weeks later, so the names are the memorable objects.

export const CONDITIONS = {
  SOUP: "soup",
  VANISHING: "vanishing",
  SLIPPERY: "slippery",
  MUDSOUND: "mudsound",
  FOG: "fog",
  BUTTERFINGERS: "butterfingers",
};

export const CARDS = {
  GIVE_IT_ROOM: "give-it-room",
  CHUNK_IT: "chunk-it",
  LINE_GUIDE: "line-guide",
  READ_IT_TO_THEM: "read-it-to-them",
  CHANGE_THE_COLOURS: "change-the-colours",
  GIVE_THEM_A_SCRIBE: "give-them-a-scribe",
};

// Every barrier is only ever shown alongside the fact that it is removable.
export const FIXES = {
  [CONDITIONS.SOUP]: CARDS.GIVE_IT_ROOM,
  [CONDITIONS.VANISHING]: CARDS.CHUNK_IT,
  [CONDITIONS.SLIPPERY]: CARDS.LINE_GUIDE,
  [CONDITIONS.MUDSOUND]: CARDS.READ_IT_TO_THEM,
  [CONDITIONS.FOG]: CARDS.CHANGE_THE_COLOURS,
  [CONDITIONS.BUTTERFINGERS]: CARDS.GIVE_THEM_A_SCRIBE,
};

// What each barrier feels like from the inside. Written for the catalogue,
// which is framed as things you can do on Monday rather than as diagnoses.
export const CONDITION_LABELS = {
  [CONDITIONS.SOUP]: "Soup",
  [CONDITIONS.FOG]: "Fog",
  [CONDITIONS.SLIPPERY]: "Slippery Floor",
  [CONDITIONS.VANISHING]: "The Vanishing",
  [CONDITIONS.MUDSOUND]: "Mudsound",
  [CONDITIONS.BUTTERFINGERS]: "Butterfingers",
};

export const CONDITION_DESCRIPTIONS = {
  [CONDITIONS.SOUP]:
    "The gaps between words disappear. Everything arrives as one long shape and you have to cut it up yourself before you can start.",
  [CONDITIONS.FOG]:
    "The words are all there. You just have to strain for every single one, and by the end of the line you have spent everything you had.",
  [CONDITIONS.SLIPPERY]:
    "The lines will not sit still. You get to the end of one, sweep back to the left, and land somewhere you have already been.",
  [CONDITIONS.VANISHING]:
    "What you have read stops being there. You cannot go back and check, so you carry every word forward or lose it.",
  [CONDITIONS.MUDSOUND]:
    "The spellings are legal but unfamiliar, so nothing can be recognised on sight. Every word has to be sounded out from scratch.",
  [CONDITIONS.BUTTERFINGERS]:
    "You know exactly what you want to say. It is getting out of your hands wrong, and everyone can see the result but not the intention.",
};

export const CARD_LABELS = {
  [CARDS.GIVE_IT_ROOM]: "Give it room",
  [CARDS.CHUNK_IT]: "Chunk it",
  [CARDS.LINE_GUIDE]: "Line guide",
  [CARDS.READ_IT_TO_THEM]: "Read it to them",
  [CARDS.CHANGE_THE_COLOURS]: "Change the colours",
  [CARDS.GIVE_THEM_A_SCRIBE]: "Give them a scribe",
};

// Conditions with a working mangle implementation. Later slices extend this;
// the tour and the tests both read from it, so adding a condition is one edit.
export const IMPLEMENTED = [
  CONDITIONS.SOUP,
  CONDITIONS.FOG,
  CONDITIONS.SLIPPERY,
  CONDITIONS.VANISHING,
  CONDITIONS.MUDSOUND,
  CONDITIONS.BUTTERFINGERS,
];

// Butterfingers is a typed task, not a rendered passage. Its barrier lives in
// the input pipeline rather than in the render, so it takes a different path
// through the reducer and is exempt from the render-differs-from-clean rule.
export const TYPING = [CONDITIONS.BUTTERFINGERS];

// The silent round draws from these only. Butterfingers is a typed task whose
// contrast lands solely when the room watches it happen — done silently and
// privately it is just a person typing badly at nobody.
export const SILENT_POOL = IMPLEMENTED.filter((c) => !TYPING.includes(c));
export const isTyping = (condition) => TYPING.includes(condition);

// Conditions that alter the text content itself. For these the rendered text
// must never reconstruct the source. The rest are presentational: the words are
// genuinely there, and the barrier is how they are shown. That distinction is
// deliberate — the privacy boundary sits at the non-reader line, not between a
// reader and the passage they are supposed to be reading.
export const CONTENT_TRANSFORMING = [CONDITIONS.SOUP, CONDITIONS.MUDSOUND];
