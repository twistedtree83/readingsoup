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
export const IMPLEMENTED = [CONDITIONS.SOUP, CONDITIONS.FOG, CONDITIONS.SLIPPERY];

// Conditions that alter the text content itself. For these the rendered text
// must never reconstruct the source. The rest are presentational: the words are
// genuinely there, and the barrier is how they are shown. That distinction is
// deliberate — the privacy boundary sits at the non-reader line, not between a
// reader and the passage they are supposed to be reading.
export const CONTENT_TRANSFORMING = [CONDITIONS.SOUP, CONDITIONS.MUDSOUND];
