// Why each barrier is in here, and what to look for on Monday.
//
// The framing throughout is COST, never perception. "This is how a dyslexic
// student sees the page" would be the single most damaging sentence this app
// could put in front of a staff room: the dominant account of dyslexia is a
// language-level phonological difficulty, not a visual one, and letter-
// scrambling simulations are criticised precisely for teaching the opposite.
// None of these six claim to show anybody what anything looks like. They put a
// cost on a reader that is normally invisible, and the cost is the real thing.
//
// Two entries deliberately contradict the card that fixes them, because the
// evidence contradicts the popular explanation. Saying so is the point: a
// facilitator who repeats the tracking-disorder or coloured-overlay story has
// been made more confident and less correct, which is worse than silence.
//
// Every source here was read, not recalled. Where a detail could not be
// verified it is left out rather than guessed, and the link is always given so
// the claim can be checked rather than taken on trust.

import { CONDITIONS } from "./conditions.js";

// The idea the whole activity rests on. Worth stating once, plainly, because
// every entry below is a special case of it.
export const THE_SPINE = {
  title: "Reading has a budget",
  body:
    "Recognising words and understanding them draw on the same limited working " +
    "memory. When decoding is automatic it costs almost nothing and the whole " +
    "budget goes to meaning. When decoding is effortful it spends the budget " +
    "first, and comprehension gets whatever is left — which is why a student " +
    "can read a page accurately and take nothing from it, and why they can " +
    "understand the same page perfectly when somebody reads it to them.",
  sources: [
    {
      cite: "Perfetti's verbal efficiency theory — slow word identification consumes the working memory that inference and comprehension need.",
      url: "https://pubmed.ncbi.nlm.nih.gov/27833213/",
      note: "Word-decoding skill interacts with working memory capacity to influence inference generation during reading.",
    },
  ],
};

// The finding that shaped this activity more than any other, and the reason it
// is built the way it is rather than as "spend ten minutes being disabled".
export const ON_SIMULATIONS = {
  title: "Simulations can backfire, and this one is built around that",
  body:
    "The largest study of disability simulations found they raise warmth toward " +
    "disabled people while also raising pity, discomfort about interacting, and " +
    "the belief that disabled people are less capable. A few minutes of struggle " +
    "shows the difficulty and none of the expertise — the strategies a person " +
    "has spent years building — so participants come away underestimating them.\n\n" +
    "That is why nothing here is left as bare difficulty. Every barrier arrives " +
    "with the thing that removes it, the first encounter is private rather than " +
    "in front of colleagues, opting out costs nothing and tells nobody, and the " +
    "session ends on six things you can do rather than on how hard it must be. " +
    "If you run this and the room leaves feeling sorry for someone, it has done " +
    "the opposite of what it is for.",
  sources: [
    {
      cite: "Nario-Redmond, Gospodinov & Cobb (2017), Rehabilitation Psychology — “Crip for a day: The unintended negative consequences of disability simulations”.",
      url: "https://pubmed.ncbi.nlm.nih.gov/28287757/",
    },
  ],
};

export const RESEARCH = {
  [CONDITIONS.SOUP]: {
    standsFor:
      "The work of finding where words begin and end, before any of the work of " +
      "understanding them. For a fluent reader that segmenting is free and " +
      "invisible. When it is not free it is paid for out of the same budget " +
      "comprehension needs, and it is paid on every single line.",
    notice:
      "A student who reads a sentence correctly and then cannot tell you what it " +
      "said. The words went in; there was nothing left over to hold the meaning.",
    sources: [THE_SPINE.sources[0]],
  },

  [CONDITIONS.FOG]: {
    standsFor:
      "Effort, not eyesight. Every word is legible and every word costs " +
      "something to get, so the reader arrives at the end of the line having " +
      "spent everything on retrieval and having nothing left for sense.",
    notice:
      "Reading that is accurate but exhausting — a student who finishes and is " +
      "visibly done, or who reads well for two minutes and falls apart in the " +
      "tenth.",
    caution:
      "This is the barrier most likely to be misread. Poor contrast is a real " +
      "accessibility problem and fixing it is ordinary good practice. But the " +
      "popular next step — coloured overlays or tinted lenses for dyslexia — is " +
      "not supported: systematic reviews find no reliable evidence, and gains " +
      "are attributed to motivation or placebo. “Change the colours” here means " +
      "contrast and legibility, which is well founded. It is not a recommendation " +
      "to buy anybody a coloured sheet.",
    sources: [
      {
        cite: "Griffiths et al. (2016), Ophthalmic & Physiological Optics — systematic review of coloured overlays and lenses on reading.",
        url: "https://onlinelibrary.wiley.com/doi/abs/10.1111/opo.12316",
      },
      {
        cite: "College of Optometrists — clinical guidance on tinted lenses and coloured overlays.",
        url: "https://www.college-optometrists.org/clinical-guidance/guidance/knowledge,-skills-and-performance/examining-patients-with-specific-learning-difficul/tinted-lenses",
      },
    ],
  },

  [CONDITIONS.SLIPPERY]: {
    standsFor:
      "What it costs to lose your place. Not an eye problem — the attention that " +
      "would normally hold your position on the page has been spent on getting " +
      "the words, so the place goes.",
    notice:
      "Skipped lines, re-read lines, a finger under the text, losing the thread " +
      "on long paragraphs but not on short ones.",
    caution:
      "Eye-movement differences in struggling readers are largely a CONSEQUENCE " +
      "of reading difficulty rather than a cause: readers who look irregular on " +
      "text look typical on non-reading tasks, and people with actual oculomotor " +
      "disorders are no more likely to be dyslexic. There is a whole market in " +
      "“tracking” exercises built on the opposite assumption. A line guide helps " +
      "because it removes a job from a budget that is already spent — not " +
      "because the eyes needed training.",
    sources: [
      {
        cite: "RANZCO position statement — “The myth of a ‘tracking’ disorder in children with reading difficulties”.",
        url: "https://ranzco.edu/wp-content/uploads/2021/12/RANZCO-Position-Statement-The-Myth-of-a-Tracking-Disorder-in-Children-with-Reading-Difficulties.pdf",
      },
    ],
  },

  [CONDITIONS.VANISHING]: {
    standsFor:
      "Working memory doing the job on its own. Fluent readers re-read constantly " +
      "and barely notice; take that away and every word has to be carried " +
      "forward, so the sentence has to be held whole while it is still being " +
      "assembled.",
    notice:
      "Comprehension that collapses with length. Fine on a question, lost on a " +
      "paragraph. Also the student who answers well when a text is read aloud to " +
      "them and poorly when they read it themselves — same text, same person, " +
      "different budget.",
    sources: [THE_SPINE.sources[0]],
  },

  [CONDITIONS.MUDSOUND]: {
    standsFor:
      "The closest of the six to what the evidence actually describes. Nothing " +
      "can be recognised on sight, so every word has to be assembled from its " +
      "parts. This is decoding without automaticity, and it is a language-level " +
      "difficulty rather than a visual one.",
    notice:
      "The clearest signal there is: strong spoken vocabulary and listening " +
      "comprehension alongside weak decoding and spelling. A student who sounds " +
      "sharp in discussion and struggles on the page is the profile most often " +
      "missed, because the talking is taken as evidence the reading is fine.",
    caution:
      "Compensation hides this for years. Memorising, guessing from pictures and " +
      "context, staying quiet — it reads as laziness, inattention or " +
      "cheerfulness, and it is none of those. Noticing is a teacher's job; " +
      "diagnosing is not. What this is for is knowing when to ask somebody " +
      "qualified.",
    sources: [
      {
        cite: "Share (2021), Brain Sciences 11(11), 1510 — “Common misconceptions about the phonological deficit theory of dyslexia”.",
        url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8615585/",
        note:
          "Phonology here means far more than phonemic awareness, and accepting it " +
          "does not require rejecting every other contributing factor. Reading is " +
          "not one thing and neither is difficulty with it.",
      },
    ],
  },

  [CONDITIONS.BUTTERFINGERS]: {
    standsFor:
      "The gap between what somebody means and what arrives on the page. " +
      "Getting letters down has to be automatic before there is any capacity " +
      "left for choosing words or building an argument; when it is not, the " +
      "writing that comes out is not a measure of the thinking behind it.",
    notice:
      "Written work far below what the same student says out loud. Very short " +
      "pieces. Avoidance that looks like refusal. The intention was never the " +
      "problem, and it is the only part nobody else can see.",
    sources: [
      {
        cite: "Berninger (1999) — coordinating transcription and text generation in working memory during composing.",
        url: "https://journals.sagepub.com/doi/10.2307/1511269",
        note: "Transcription that is not automatic constrains composition, independently of how much the writer has to say.",
      },
    ],
  },
};

export const researchFor = (condition) => RESEARCH[condition] ?? null;
