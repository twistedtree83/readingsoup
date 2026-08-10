# Soup

A live accessibility simulation for staff professional development.

Everyone joins on their phone. A facilitator screen goes on the projector. Each
participant is privately given a simulated reading or writing barrier — their
passage renders with the word gaps removed, or at very low contrast, or with each
word deleting itself shortly after it appears.

The twist: while one person struggles, **everyone else holds accommodation
cards**. They cannot see the reader's screen, so they have to infer the barrier
from how the person is struggling and play the card they think will help. The
right card visibly transforms the reader's text. The wrong one does nothing.

Nobody learns what condition anyone had until the end — and even then the app
never publishes a person-to-condition map.

**Try it on your own: [soup-readingsoup.fly.dev](https://soup-readingsoup.fly.dev)**
No sign-in, nothing saved, nothing timed.

---

## The six barriers

| Name | What it does | The card that lifts it |
|---|---|---|
| **Soup** | Word gaps removed, letter spacing collapsed | Give it room |
| **Fog** | Very low contrast | Change the colours |
| **Slippery Floor** | Lines displaced, so the return sweep loses your place | Line guide |
| **The Vanishing** | Words removed from the page shortly after you read them | Chunk it |
| **Mudsound** | Common spellings swapped for rarer legal ones — `fish` → `phici` | Read it to them |
| **Butterfingers** | A typed task; keystrokes dropped and transposed | Give them a scribe |

Four cards remove a difficulty from the environment. Two hand you **a person** —
which is what scribing and reading-aloud actually are.

## Run it

```bash
bun install
bun run dev          # http://localhost:8787  ·  /host for the projector
```

```bash
bun run verify       # tests + purity gate + privacy gate
bun run sim          # headless sessions at 1, 2, 5, 8 and 20 participants
bun run build        # assemble dist/ for the static host
```

The sim harness spawns its own server. `bun run sim -- --sizes 2,20` narrows it,
`--url http://…` points it at a running instance, `--keep` leaves the room up.

## How it is built

**Pure core, thin shell.** Everything with logic in it is a pure function;
sockets, files and the DOM are transport details at the edge.

```
src/core/     mangle · graphemes · deck · passages · session · view   (pure)
src/server/   Bun + Socket.IO wiring, QR                              (no game logic)
src/client/   renderer + two transports                               (no game state)
```

Three properties fall out of that, and each is enforced rather than hoped for:

- **Time is an input, never read inside the core.** Every event carries `at`;
  randomness arrives as a seed. A full six-condition session runs
  deterministically in about 30ms. `bun run check:purity` fails the build on
  `Date.now`, `Math.random`, DOM access, I/O or `console` anywhere in `src/core`.
- **`view.viewFor(state, participantId)` is the only path by which any client
  obtains any data**, and it takes a participant id. That makes the privacy
  boundary structural: one test proves no non-reader ever receives passage
  content, in any phase, at any group size.
- **Solo is the same core, not a second implementation.** It runs behind a
  loopback transport in the browser; multiplayer sends identical events to a
  server running identical code. The renderer cannot tell which.

## Deployment

Two halves, deliberately independent:

- **Static site + solo mode → Netlify.** No bundler, no transpiler — plain ES
  modules served as authored. Needs no server at all.
- **Realtime server → Fly.** Sleeps when idle, wakes on demand. Single machine
  only: room state is in memory and there is exactly one room, so a second
  machine would split the room in half.

If the game server is asleep, down, or never deployed, **the site still works
completely** — which matters, because almost everyone who opens the link arrives
alone.

| Variable | Where | Purpose |
|---|---|---|
| `PUBLIC_URL` | server | What the QR encodes. The server cannot discover it. |
| `PORT` | server | Defaults to 8787 locally, 8080 in the container. |
| `CORS_ORIGIN` | server | Allows the static site to connect cross-origin. |
| `SOUP_SERVER_URL` | static build | Where the client looks for the server. |

## Design notes

The application's own chrome is deliberately high-contrast. The barriers are
simulated as *deviation from a baseline*, so a soft or low-contrast resting state
would leave Fog nowhere to go and make every condition read as a broken app
rather than as something done on purpose.

Passages are deadpan and absurd — municipal wombat regulations, a haunted kettle,
a bench with terms and conditions printed on its underside — with the payoff in
the final clause, so finishing is rewarded. Vocabulary stays everyday throughout:
if the words were hard the activity would simulate a vocabulary gap, which is a
different barrier and not one of the six.

One consequence worth knowing: absurdity removes contextual prediction, which is
a substantial part of fluent reading. These passages are therefore already harder
than ordinary prose *before* any mangling is applied, so difficulty is calibrated
against them and never against normal text.

## What it will not do

No accounts. No persistence between sessions. No analytics. **No scoring, no
ranking, and no comparison of read times** — not in the interface, not in state,
not in logs. Nothing participant-identifying is written anywhere.

The observer role exists so that staff who genuinely have dyslexia can opt out
invisibly: observers hold a full hand of cards and take part in the whole
diagnostic half of the activity, are never assigned a condition, and are never
called on. The roster carries **names only** — the projector is shown to the
entire room at once, so anything role-shaped on it would disclose an opt-out to
everybody simultaneously.
