# PRD — Soup: a live accessibility simulation for staff PD

## Problem Statement

Teachers know, abstractly, that some students find reading and writing hard. That
knowledge sits in the wrong part of the brain. It is a fact they have been told,
not an experience they have had, and facts do not change what a person does at
2:40pm on a Wednesday when a child has not started the worksheet.

Professional learning on accessibility usually makes this worse rather than
better. It is delivered as a slide deck about barriers, it positions the audience
as the competent party being informed about the incompetent one, and it ends with
a list of strategies that nobody uses because nothing in the session created a
reason to. Staff leave having been *told* about difficulty. Nothing has happened
to them.

There is a second problem underneath the first, and it is the reason most
attempts at fixing this go wrong. Simulating a disability in front of colleagues
is genuinely risky. It can humiliate the person doing it. It can trivialise the
condition being simulated. And in any staff group of reasonable size, some people
are not simulating — they have the real thing, undisclosed, and an activity that
compels public struggle will land on them very differently than it lands on
everyone else. An activity that produces a bad ten minutes for one member of
staff has done more harm than the learning is worth.

So the problem is: **create the experience of a reading barrier, in a room, for a
group of colleagues, without it costing anybody anything.**

## Solution

A real-time web app that runs a group activity for 1–20 people. Everyone joins on
their phone. A facilitator screen is projected. Each participant is privately
given a simulated reading or writing barrier — their passage renders with the word
gaps removed, or at very low contrast, or with each word deleting itself shortly
after it appears.

The activity has two halves, and they are deliberately separated.

**The silent round.** Everyone in the room gets *the same forty words* at the same
time, privately, on their own phone — and six different reasons it is hard. No
audience, no turns, no performance. Ninety seconds later the room has a shared
reference point and a genuinely funny problem: identical text, wildly different
experiences of it.

**Spotlight rounds.** Now one person reads aloud while everybody else holds
**accommodation cards**. They cannot see the reader's screen, so they must infer
the barrier from how the person is struggling and play the card they think will
help. The correct card visibly transforms the reader's text and they finish
easily. The wrong card does nothing, the reader says so out loud, and that is the
good part.

Cards are locked for the first 25 seconds of every round. You cannot accommodate
what you have not noticed, and making a room sit in that gap and *observe* before
they are allowed to act is the most transferable moment the activity produces.

Nobody learns what condition anyone had until the end, and even then the app never
publishes a person-to-condition map. The projector shows the six barriers and the
six supports; each phone privately shows its own; and attribution happens by show
of hands, voluntarily, in the room.

Passages are deadpan absurd — municipal wombat regulations, a review of a haunted
kettle — so that finishing one has a comic payoff. The target is "that was funny
and I learned something," never "that was awful."

The same app runs solo, in a browser, with no room and no server, so anyone can
take the whole tour alone at their desk.

## User Stories

### Joining and roles

1. As a participant, I want to join by scanning a QR code on the projector, so that I do not have to type a URL on a phone keyboard in a room full of people.
2. As a participant, I want to join by typing a short room code instead, so that I can still get in if my camera is slow, the projector glares, or I am at the back.
3. As a participant, I want to enter just a first name, so that joining takes three seconds and no account exists.
4. As a participant, I want to see myself appear on the projected roster, so that I know my phone is actually connected before the activity starts.
5. As a staff member who genuinely has dyslexia, I want an "observe instead" option presented as an equal choice on the join screen, so that I can opt out of being given a barrier without disclosing anything to anyone.
6. As an observer, I want the option to look unremarkable — same size, same weight, same position in the stack as the join button — so that choosing it is not visibly an accessibility setting.
7. As an observer, I want to receive a full hand of accommodation cards, so that I participate fully in the diagnostic half of the activity and am not sidelined into watching.
8. As an observer, I want to never be assigned a condition and never be called on to read, so that the activity carries no risk of exposure for me.
9. As an observer, I want no other participant to be able to tell I chose it, so that my reason for choosing it stays mine.
10. As an observer during the silent round, I want a task on my phone that looks identical to everyone else's from across the room, so that my body language does not disclose what the app is keeping private.
11. As a participant who is finding the activity harder than expected, I want a quiet way to become an observer mid-session, so that I can withdraw without announcing it.
12. As a participant who withdraws while reading, I want it to behave exactly like finishing, so that the room sees me complete a turn rather than abandon one.
13. As a facilitator, I want to see a live roster with a headcount, so that I know when everyone is in and can start.
14. As a participant arriving late, I want to still join mid-session, so that being six minutes late does not exclude me from a staff meeting activity.
15. As a late-arriving participant, I want a private catch-up run of the silent round on arrival, so that I still experience a barrier rather than only watching others have one.

### The silent round

16. As a participant, I want everyone to receive their barrier at the same moment, so that nobody is performing and nobody is being watched.
17. As a participant, I want the whole room to get the same passage, so that when we compare afterwards the only variable is the barrier.
18. As a participant, I want no turn announcement and no timing of me, so that the experience is mine rather than an assessment.
19. As a facilitator, I want a countdown on the projector, so that the room knows how long is left without me talking over it.
20. As a facilitator, I want to set how long the silent round runs, so that I can fit the activity to the time I have been given.
21. As a participant, I want the difficulty to be hard but finishable, so that I engage with it instead of giving up and concluding the activity is unfair.

### Spotlight rounds

22. As a facilitator, I want to choose who reads next from the roster, so that I can read the room rather than let software pick for me.
23. As a facilitator, I want a "draw at random" button, so that I can hand the choice to chance when that suits the group better.
24. As a participant, I want to volunteer by tapping "I'll go," so that willing readers surface without the facilitator having to guess.
25. As a facilitator, I want volunteers to appear at the top of the roster, so that I can pick a willing person at a glance.
26. As a reader, I want my passage to appear only on my phone, so that the diagnostic game is real and nobody in the room can read along.
27. As a reader, I want a barrier I have not had before, so that I experience two of the six rather than repeating one.
28. As a participant watching, I want the app to choose which barrier is spotlighted so that the room sees the full range, so that we do not watch low contrast three times and never see the typing one.
29. As a facilitator, I want the projector to announce whose turn it is in very large type, so that it reads from the back of a room.
30. As a participant watching, I want a prompt telling me to watch and listen, so that I know observing is the task rather than idle time.
31. As a participant watching, I want the locked state to look like a distinct mode rather than a greyed-out screen, so that it reads as deliberate rather than broken.
32. As a reader, I want a "done" button available at all times with no conditions on it, so that I can end my turn whenever I want to.
33. As a reader who is struggling, I want to tag a colleague in, so that I can hand the passage over as a move in the game rather than as giving up.
34. As a tagged-in colleague, I want to inherit the same condition and the same passage from the start, so that the round continues coherently.
35. As a tagged-in colleague, I want no accept-or-decline prompt, so that nobody has to publicly refuse to help a struggling colleague.
36. As a participant, I want the round to show the clean passage on the projector afterwards, so that the room finally learns what it said and gets the joke.
37. As a facilitator, I want to end spotlight rounds whenever I judge the room has had enough, so that I control pacing.
38. As a facilitator, I want to set the number of spotlight rounds up front against a live time estimate, so that I can plan the session against the slot I have.

### Accommodation cards

39. As a participant, I want a hand of cards on my phone, so that I have something concrete to play.
40. As a participant in a large group, I want three cards dealt to me, so that scarcity makes the choice interesting.
41. As a participant in a small group, I want the full deck of six, so that a small room can still find the right card and the round does not simply fail.
42. As a participant, I want the deal to guarantee somebody in the room holds the correct card, so that every round is winnable.
43. As a participant, I want cards locked for the first 25 seconds of a round, so that I am forced to observe before I am allowed to act.
44. As a participant, I want to see how long until cards unlock, so that the wait reads as part of the game rather than as a bug.
45. As a room, we want only three plays per round in total, so that we have to talk to each other rather than everyone mashing buttons.
46. As a reader, I want a correct card to visibly transform my text, so that the help is unmistakable and immediate.
47. As a reader, I want a wrong card to do nothing at all, so that I can say "that did nothing" out loud, which is the funny and instructive part.
48. As a participant, I want a correct play attributed to me on the projector, so that helping is publicly credited.
49. As a participant, I want a wrong play to stay anonymous, so that being wrong about how to help a colleague is not projected in enormous type at a staff meeting.
50. As a participant, I want to see the "that helped" moment on the projector, so that the whole room shares the resolution rather than only the reader.
51. As a facilitator, I want an override that grants the accommodation directly, so that I can rescue a reader who is genuinely stuck and keep the mood light.
52. As a participant, I want cards I have played to be visibly spent, so that I know what I still hold.
53. As a participant, I want no score, no ranking, and no comparison of read times anywhere, so that the activity stays a game rather than an assessment.

### The six conditions

54. As a reader with Soup, I want the word gaps removed from my passage, so that I experience text as an undifferentiated wall.
55. As a reader with Soup, I want "Give it room" to restore spacing, so that the fix is as visible as the barrier.
56. As a reader with Fog, I want my passage at very low contrast, so that I experience having to strain for every word.
57. As a reader with Fog, I want "Change the colours" to snap to full contrast in one action, so that the relief is immediate and complete.
58. As a reader with Slippery Floor, I want line baselines offset so that returning to the left margin loses my place, so that I experience tracking failure.
59. As a reader with Slippery Floor, I want the barrier to be static rather than animated, so that it is safe for people with motion sensitivity without anybody having to declare anything.
60. As a reader with Slippery Floor, I want "Line guide" to stabilise the lines, so that I can find my way back.
61. As a reader with The Vanishing, I want each word to disappear shortly after it renders, so that I experience losing text I have already read.
62. As a reader with The Vanishing, I want words genuinely removed rather than merely hidden, so that the barrier is real.
63. As a reader with The Vanishing, I want "Chunk it" to deliver the passage in stable pieces, so that I can hold onto what I have read.
64. As a reader with Mudsound, I want common letter patterns swapped for rarer but legitimate English spellings of the same sounds, so that I must sound words out rather than recognise them.
65. As a reader with Mudsound, I want the substitution to stay consistent within my passage, so that I can learn it as I go and accelerate toward the end.
66. As a reader with Mudsound, I want proper nouns and the closing joke left alone, so that the payoff survives.
67. As a reader with Mudsound, I want "Read it to them" to hand the clean passage to the colleague who played it so they can read it aloud to me, so that the accommodation is a person rather than a setting.
68. As a reader with Butterfingers, I want a typing task rather than a reading one, so that the room encounters the opposite frustration.
69. As a reader with Butterfingers, I want my input to drop and transpose characters, so that I cannot get words out no matter how well I know them.
70. As a participant watching Butterfingers, I want the reader's mangled output mirrored on the projector at full size, so that the round has a visible signal instead of a person silently staring at a phone.
71. As a participant watching Butterfingers, I want the output shown without corrections, squiggles, or highlighting, so that it is presented rather than marked.
72. As a participant watching Butterfingers, I want the target sentence withheld until the round ends, so that the round is still a diagnostic puzzle and not a giveaway.
73. As a reader with Butterfingers, I want "Give them a scribe" to move the keyboard to the colleague who played it while I dictate aloud, so that the accommodation models what scribing actually is.
74. As a scribe, I want the input to appear on my phone, so that I can type while my colleague speaks.
75. As a room, we want the projector to show the target sentence next to the mangled attempt at round end, so that we see the gap between what was meant and what got out.

### Reveal and debrief

76. As a participant, I want the projector to show all six barriers with the support that fixes each, so that I leave knowing the full catalogue whether or not I experienced it.
77. As a participant, I want my own conditions marked privately on my own phone, so that I know what happened to me without it being published to the room.
78. As a participant, I want the app never to display a person-to-condition map, so that disclosure stays voluntary.
79. As a facilitator, I want to prompt disclosure by show of hands, so that people who would rather not raise a hand simply do not.
80. As a participant, I want the reveal to be complete regardless of how many spotlight rounds ran, so that ending early does not leave anybody visibly blank.
81. As a participant, I want the catalogue framed as things I can do on Monday, so that it lands as action rather than diagnosis.
82. As a facilitator, I want three manually advanced debrief prompts, so that I can run the discussion at the pace of the room.

### Solo mode

83. As someone who found this on LinkedIn, I want to try it immediately and alone, so that I do not need a room code, a server, or seven colleagues.
84. As a solo visitor, I want a prominent "try it yourself" path on the landing page, so that arriving without a room is the normal case rather than an error.
85. As a solo visitor, I want to work through all six conditions at my own pace, so that I encounter the complete set.
86. As a solo visitor, I want to choose my own accommodation from the full deck each time, so that I make the diagnostic decision myself.
87. As a solo visitor, I want unlimited attempts with no penalty, so that it is a tour rather than a test.
88. As a solo visitor, I want no timing and no pressure, so that exploring is the point.
89. As a facilitator, I want to use solo mode as a dry run, so that I can walk the whole activity before running it with staff.
90. As a facilitator, I want to override tuning constants in solo mode, so that I can calibrate difficulty without experimenting on colleagues.

### Group sizes

91. As a facilitator with one active participant, I want the app to fall back to solo mode silently, so that a two-person session with one observer does not error.
92. As a facilitator, I want that fallback never to surface a message identifying who opted out, so that the observer stays invisible even at the smallest size.
93. As a facilitator of 2–5 people, I want multiple rounds each so that the group still encounters every condition, so that a pair still gets the full range.
94. As a facilitator of 2–5 people, I want nobody to repeat a condition, so that each round is new.
95. As a facilitator of a small group, I want the projector view to work in a narrow column on a laptop, so that I do not need a projector to run this.
96. As a facilitator of 6+, I want the silent round followed by capped spotlight rounds, so that a whole-staff session does not become forty minutes of the same game.
97. As a facilitator, I want spotlight rounds capped at eight, so that the activity ends before the room does.

### Reliability

98. As a participant whose phone locked during a round, I want to be exactly where I was when I unlock it, so that I am not thrown back to the join screen in front of the whole staff.
99. As a participant, I want my phone to stay awake during the activity, so that it does not lock every thirty seconds while I am listening.
100. As a participant who loses signal, I want to reconnect and resume with my name, role, condition, and hand intact, so that a network blip does not eject me.
101. As a facilitator, I want to refresh the projector browser without killing the session, so that a stuck slide is recoverable.
102. As a facilitator, I want a second browser opening the host view to be read-only with an explicit takeover, so that I do not accidentally drive the session from two devices.
103. As a facilitator, I want the session to survive a server crash, so that a technical fault does not end a whole-staff activity irrecoverably.
104. As a facilitator, I want to end a session and start a fresh one, so that I can run the activity twice in a day.
105. As a participant, I want nothing about my performance recorded anywhere, so that there is no artefact of how I did.

### Development

106. As a developer, I want the whole session to run headlessly against simulated participants, so that I can test 1, 2, 5, 8, and 20-person behaviour without a room full of phones.
107. As a developer, I want the game core to be pure functions, so that a full session can be tested in milliseconds with no sockets.
108. As a developer, I want a single test proving no non-reader ever receives passage content, so that the core privacy rule is enforced structurally rather than by vigilance.
109. As a developer, I want all tuning constants in one config object, so that difficulty can be adjusted between sessions without hunting through the codebase.
110. As a maintainer, I want the static site deployable to Netlify from GitHub with no build step, so that the public demo requires no infrastructure.
111. As a maintainer, I want the realtime server deployed to Fly.io from GitHub Actions, so that shipping the multiplayer half needs no server administration.
112. As a maintainer, I want the realtime server to sleep when idle and wake on demand, so that a server used a few times a year costs approximately nothing.
113. As someone clicking the link from LinkedIn, I want the demo to work even when the realtime server is asleep, down, or never deployed, so that the public link cannot be broken by infrastructure I am not using.
114. As a maintainer, I want the game core to run unmodified in both Bun and the browser, so that solo mode is the same code as multiplayer rather than a second implementation that drifts.

## Implementation Decisions

### Architecture: pure core, thin shell

The application is a pure functional core wrapped in a thin I/O shell. Everything
with logic in it is a pure function; sockets, files, and the DOM are transport
details at the edge. This is the decision the rest of the design hangs off, and
it is what makes both the test strategy and the Netlify deployment possible.

**Deep modules — all pure, no I/O, no DOM, no clock reads:**

- **`mangle`** — `mangle(passage, condition, config) → Token[]`. All six barrier
  algorithms behind one signature. Owns a sub-module `graphemes` holding the
  Mudsound substitution table and consistent per-passage mapping selection.
- **`view`** — `viewFor(state, participantId) → ClientView`. The sole path by
  which any client obtains any data, and it requires a participant id. This makes
  the privacy boundary structural rather than a matter of discipline.
- **`session`** — `reduce(state, event) → { state, effects }`. A reducer owning
  phases, mode selection, the watch window, the play cap, condition assignment
  with coverage tracking, tag-in, both handovers, observer rules, and late-joiner
  catch-up. Emits effects as data; never performs them.
- **`deck`** — dealing and match resolution. Owns hand-size scaling, spent-card
  tracking, and the guarantee that at least one participant holds the correct card.
- **`passages`** — the content library and a no-repeat selector with per-condition
  length banding.

**Thin shell — deliberately boring, no game logic:** `server` (Bun HTTP, static
files, Socket.IO wiring; translates socket events into reducer events and reducer
effects into emits), `client` (renders a `ClientView`, holds no game state),
`qr`, `snapshot`, `sim`.

Time is an input, never read inside the core. The shell supplies timestamps on
events and schedules timers from emitted effects. This is what allows a
twenty-person session to run deterministically in a unit test in under a second.

### The privacy boundary

Three enforceable rules replace the original "no clean string anywhere"
formulation, which was not achievable for presentational barriers such as low
contrast or collapsed spacing while the content remains text:

1. The server never sends passage text to a socket that is not the current reader.
2. The client never receives the unmangled form of what it is currently
   displaying and can never reconstruct it. Accommodation sends a fresh token
   array from the server; the client never un-mangles anything itself.
3. Clean passage text exists client-side in exactly one place: the host screen,
   after a round has ended.

Rule 1 is the load-bearing one and is asserted in tests. Canvas or SVG glyph
rendering was considered and rejected: it would satisfy a literal reading of the
original constraint at the cost of text reflow, font scaling, and roughly doubled
client complexity in the hardest part of the app, to defend against an attack that
requires devtools on a phone.

The Vanishing removes tokens from the DOM on expiry rather than setting opacity to
zero. It is the one condition where a struggling reader has motive to inspect, and
deletion costs the same to implement as fading.

### Token contract

The client is dumb. It receives render instructions and never derives them.
Approximate shape, given here because it encodes the boundary more precisely than
prose:

```
Token = {
  id: string            // stable across re-renders within a round
  text: string          // already mangled; never the source form
  break?: boolean       // line break after this token
  expiresInMs?: number  // The Vanishing — client deletes the node on expiry
  offsetY?: number      // Slippery Floor — static per-line baseline offset
  rotate?: number       // Slippery Floor
}

ClientView = {
  phase, role, mode,
  tokens?: Token[]      // present only for the current reader
  hand?: Card[], spent?: Card[], cardsUnlockAtMs?: number,
  ...
}
```

Passage-level presentation that applies uniformly (Fog's contrast, Soup's
tracking) is carried as a render mode on the view rather than repeated per token.

### Session structure

- **Solo (1 active):** self-paced tour of all six conditions, full deck, unlimited
  attempts, no timing.
- **Small (2–5):** `ceil(6 / activeParticipants)` rounds each, capped at 3. No
  participant repeats a condition.
- **Group (6+):** a **silent round** where every active participant receives a
  condition simultaneously and privately, followed by **spotlight rounds** capped
  at **8**, followed by the catalogue.

The silent round exists because the original one-round-per-person loop does not
scale: twenty rounds at roughly two minutes each is forty minutes of the same
game, and cutting it short would leave participants visibly blank on a reveal that
listed who had what. Separating the two payloads — *feeling a barrier* and
*diagnosing one* — lets everybody get the first in ninety seconds while the second
runs only as long as it is interesting. It also means a participant's first
encounter with their barrier is private rather than in front of nineteen
colleagues.

The silent round uses **one shared passage for the entire room**. Identical text,
six different reasons it is hard, isolating the variable and giving the facilitator
the strongest available discussion opener.

**Butterfingers is excluded from the silent round** and appears only in spotlights;
it is a typing task whose contrast only lands when the room watches it.

Spotlight readers receive a condition they have **not** had. The app chooses which,
selecting whichever condition has been spotlighted least so the room witnesses the
full range; the facilitator chooses the person, from volunteers or a random draw.
The app owns pedagogical coverage, the human owns reading the room.

The facilitator sets a spotlight count up front against a live time estimate, and
may end spotlights at any point. The reveal is complete regardless, because every
active participant received a condition in the silent round.

Late joiners receive a private catch-up run of the silent round on arrival, then
join the card game.

### Cards

- **Watch window:** no card may be played for the first ~25 seconds of a round.
  Without this, a room of nineteen card-holders finds the correct card by brute
  force within seconds, and — more damagingly — the reader's barrier dissolves
  before it has registered on anyone, including them.
- **Three plays per round, room-wide** — not three per player. One rule prevents
  both the large-group stampede and small-group brute-forcing of the full deck.
- **Dealing:** three cards each at 6+, the full deck at 2–5, always guaranteeing at
  least one holder of the correct card.
- **Observers receive a full hand.** Card play requires no reading and carries no
  exposure, so it is the half of the activity that is safe for everyone. This also
  makes observer a role a person might reasonably choose on its merits, which is
  far stronger camouflage for a genuine opt-out than hoping nobody notices.
- **Attribution is asymmetric:** correct plays are named on the projector, wrong
  plays are anonymous.
- **Facilitator override** grants the accommodation directly, as a distress valve.
  Built early, not as polish.

### Conditions

| Name | Mechanic | Card |
|---|---|---|
| Soup | Letter spacing collapsed, word gaps removed | Give it room |
| The Vanishing | Words removed from the DOM shortly after render | Chunk it |
| Slippery Floor | Static per-line baseline offset and slight rotation | Line guide |
| Mudsound | Common graphemes swapped for rarer legitimate English equivalents | Read it to them |
| Fog | Very low contrast | Change the colours |
| Butterfingers | Typed response; keystrokes dropped and transposed | Give them a scribe |

**"Read it aloud" was renamed to "Read it to them."** The original was a no-op:
reading aloud is already what every reader is doing, so the card could not change
behaviour. Rebuilt as the mirror of the scribe — the card player's phone receives
the clean passage and they read it *to* the struggling reader.

This gives the deck a deliberate structure: four cards remove a difficulty from
the environment; two hand you a person.

**Mudsound substitutes legitimate rare English graphemes**, not symbols —
`f`→`ph`, `sh`→`ci`, `ee`→`ea`, `k`→`ch`. Output stays pronounceable English
orthography that simply is not the variant the reader has automated: `fish`
becomes `phici`. A symbol cipher would be undecodable and would teach the wrong
lesson. The mapping is consistent within a passage so the reader can learn it
mid-read and accelerate, which is what makes it finishable. Proper nouns and the
closing line are excluded so the joke survives.

**Slippery Floor renders static offsets rather than animating.** Continuous motion
is a vestibular hazard and there is no way to ask about motion sensitivity on a
join screen without outing people. Fixed per-line offsets already destroy the
return sweep to the left margin, which is the actual mechanic. Optional slow drift
remains a tuning constant, disabled under `prefers-reduced-motion`.

### Reveal

The projector shows the six-condition catalogue — names, descriptions, and the
support that fixes each — framed as things you can do on Monday. Each phone
privately marks the conditions that participant had. **The app never publishes a
person-to-condition map.** Attribution happens by show of hands, which makes
disclosure voluntary and gives people who would rather not participate in it an
ordinary way to decline.

This replaces the originally specified who-had-what slide, which could not satisfy
the observer-invisibility requirement (an observer is simply absent from such a
list) and would not fit on a projector at twenty participants.

### Group-size edge cases

A two-person session with one observer falls back to solo mode silently. No
message may be surfaced that would identify who opted out. Observers receive the
shared silent-round passage **rendered clean** with a prompt to read it and then
watch the room — physically indistinguishable from every other head-down phone
user, and useful, since it gives them the baseline text.

### Identity and reconnection

Socket ids are never identity. On first join the server mints a participant token
stored in `localStorage`; every reconnect re-presents it. Name, role, condition,
hand, and spent cards live against the token. On reconnect the client sends only
its token and receives a complete server-authoritative view; it never restores
from its own memory.

This is not an edge case. iOS locks phones at thirty seconds by default —
*shorter than the watch window* — and suspends sockets on background. Without
token identity, the majority of a room would be ejected to the join screen during
every round. The phone view also requests a Screen Wake Lock, which removes most
of the problem where supported.

The host view is token-based on the same basis. The first browser to claim `/host`
for a room owns it; subsequent ones get a read-only view with an explicit takeover.

### Deployment

**Netlify cannot host the realtime server.** Netlify Functions are serverless with
no inbound WebSocket support, no persistent connections, and no in-memory state
across invocations. The resolution is one core with two transports:

- **Static site + client-side solo mode → Netlify from GitHub, no build step.**
  Because `mangle`, `deck`, `passages`, and `session` are pure ES modules with no
  I/O, they run unmodified in the browser behind a loopback transport. Solo mode is
  the same core, not a reimplementation. This is the public demo and it needs no
  infrastructure.
- **Multiplayer → Bun + Socket.IO on Fly.io**, reached via an injected
  `SOCKET_URL`, deployed from GitHub Actions as a container with
  `auto_stop_machines` enabled so it sleeps at near-zero cost between sessions and
  wakes on demand. If the server is asleep, down, misconfigured, or never deployed
  at all, the site still works completely; solo simply does not advertise a room.

No VPS is used, and self-hosting is not a fallback. The failure mode is the reason
for the split: the journey every visitor actually takes requires no server, so the
public link cannot be broken by anything that happens to the game server.

Client-side mangling in solo mode does not violate the privacy boundary: that
boundary exists to prevent *other participants* from seeing the passage, and in
solo there are none. Multiplayer keeps all mangling server-side.

Server configuration is via `PORT` and `PUBLIC_URL` environment variables. The
server cannot discover the hostname clients actually reach it on — it sits behind
a platform proxy and the join URL points at the Netlify site rather than at the
server itself — so the QR code requires `PUBLIC_URL` explicitly or it will encode
an unreachable address. QR codes are generated server-side as inline SVG — no
client library, no CDN, no build step. The server must accept a configurable CORS
origin so the Netlify-hosted client can connect to it cross-origin.

Room state is in memory, with a JSON snapshot written on state change and reloaded
on boot as crash insurance. This is not persistence between sessions and not a
database; the snapshot is deleted when a session ends.

**Nothing is logged.** No read times, no per-participant data, no analytics, to
disk or to stdout. Server logs carry room lifecycle events only.

### Visual system

Imported from Claude Design (`Soup Visual System.dc.html`). Risograph/printed
paper: Paper `#F7F1E3`, Red `#E8452C`, Ink `#1F2B5B`, Deep `#141C38`, Blue tint
`#C3CCE8`, Red tint `#F6C4B6`. Archivo — 900 for display, 600–700 elsewhere, tight
tracking, nothing below 17px on phone. Each card carries a distinct
ground/border/ink combination plus a stroke mark, legible across a room.

The governing constraint: **the application's own chrome must be high-contrast and
unmistakably deliberate.** Barriers are simulated as deviation from a baseline, so
a soft or low-contrast resting state would leave Fog nowhere to go and would make
every condition read as a broken app rather than as something done on purpose.

Two copy corrections against the imported design: the join screen must not imply
observers only skip reading (they also never receive a condition), and the locked
state must say cards unlock partway through the round rather than after the reader
finishes, since the watch-then-act mechanic depends on cards arriving while the
reader is still reading.

### Content

Twenty reading passages plus ten short dictation prompts for Butterfingers.
Everyday vocabulary throughout, so difficulty comes from the mangling rather than
from unfamiliar words. The comic payoff sits in the final clause so that finishing
is rewarded. Length is banded by condition — Soup and Mudsound draw from a shorter
band. Subject matter is bureaucratic and domestic absurdity only: nothing about
children, schools, disability, or assessment.

Deadpan absurdity removes contextual prediction, which is a substantial part of
fluent reading. The passages are therefore already harder than ordinary prose
before any mangling is applied, and **all difficulty tuning must be calibrated
against the absurd passages themselves**, never against normal text. Tuning against
ordinary prose will overshoot into the unfinishable range.

All tuning constants — spacing, fade delay, offset amplitude, substitution
density, keystroke drop rate, watch window, play cap — live in a single config
object, overridable by query string in solo mode.

## Testing Decisions

A good test here exercises external behaviour through a module's public interface
and would survive a complete rewrite of that module's internals. It asserts on
what a participant can observe — what arrives in their view, what their hand
contains, whether a card resolved — never on internal state shape, call order, or
private helpers. Because the core is pure and time is an input, every test is
deterministic and fast; none require a socket, a browser, a timer, or a sleep.

There is no prior art in this repository. These tests are the prior art.

**Modules under test — the four pure ones:**

**`view`** — the highest-value tests in the project, because they encode the
privacy rule:
- No participant who is not the current reader ever receives passage content, in
  any phase, in any mode, at any group size. Asserted exhaustively over the full
  cross-product of phases and roles.
- Observers never receive a condition assignment.
- The current reader's view contains tokens whose combined text never equals the
  source passage.
- Playing a correct card produces a fresh token array from the server rather than
  any instruction the client could have derived.

**`session`** — the reducer, tested as a state machine at every group size:
- Full sessions driven end to end at 1, 2, 5, 8, and 20 participants.
- Mode selection, including silent fallback to solo when a two-person session has
  one observer, asserting no emitted effect identifies the observer.
- No participant is assigned a condition twice.
- Spotlight condition selection converges on full coverage of the six.
- Butterfingers never appears in a silent round.
- The watch window blocks plays before it elapses and permits them after.
- The play cap is room-wide, not per-participant.
- Tag-in transfers condition and passage, does not reset the watch window, and
  chains.
- Both handovers — scribe and read-it-to-them — transfer control and recover when
  the receiving participant disconnects.
- Late joiners receive a catch-up silent round.
- Mid-session conversion to observer, including conversion by the active reader,
  which must be indistinguishable from finishing.
- Reconnection by token restores role, condition, hand, and spent cards.
- The reveal is complete for all active participants regardless of how many
  spotlight rounds ran.

**`mangle`** — property-based across all passages × all conditions:
- Output never reconstructs the source passage.
- Every condition produces output distinguishable from its input.
- Mudsound substitution is consistent within a passage, produces only legitimate
  English graphemes, and leaves proper nouns and the final clause untouched.
- Applying an accommodation yields clean tokens.
- Slippery Floor emits no animation instruction under reduced-motion config.
- Tuning constants at their documented bounds do not produce empty or unbounded
  output.

**`deck`**:
- At least one participant always holds the correct card, at every group size.
- Hand size scales correctly across the 5/6 participant boundary.
- Observers are dealt in.
- Spent cards do not return within a round.
- Only the correct card resolves.

**Not unit-tested:** `server`, `client`, `qr`, `snapshot`, `sim`. These are
plumbing with no logic worth isolating. `sim` — a headless harness spawning N
Socket.IO clients — is itself the integration test, and is required from the point
the turn loop exists rather than added at the end.

## Out of Scope

- Accounts, authentication, and any identity that outlives a session.
- Persistence between sessions. The crash snapshot is not persistence and is
  deleted when a session ends.
- Multi-room support. One room at a time.
- Analytics, telemetry, and any record of participant performance.
- Any scoring, ranking, leaderboard, or comparison of read times.
- Native mobile applications.
- Screen reader support for the mangled passage specifically, which would defeat
  the simulation. The surrounding application chrome should remain accessible;
  participants who use a screen reader are served by the observer role, which
  provides the full diagnostic activity.
- Conditions beyond the six specified.
- Facilitator authoring of custom passages or conditions.
- Serverless multiplayer. Multiplayer requires the Bun server; Netlify hosts the
  static site and solo mode only.

## Further Notes

**On the wellbeing requirements.** The four hard requirements — observer role, tag
in rather than pass, no timing leaderboard, every condition paired with its
accommodation — are not features to be traded against schedule. Several design
decisions here exist only to serve them: the asymmetric card attribution, the
silent round preceding any public turn, the removal of the who-had-what slide, the
clean passage given to observers as physical cover, and the facilitator override.
If a change appears to simplify the build by weakening one of these, it is the
wrong change.

**On the seventh barrier.** Because the passages are absurd, contextual prediction
is unavailable, and every participant is therefore also experiencing a barrier that
is not on the list and has no card. This is worth giving the facilitator in the
notes rather than the deck: it is the reason a student who "knows all the words"
still cannot read the page, and it is invisible to everyone watching.

**On solo mode's status.** Solo was specified as a facilitator dry run. Given the
project ships as a public demonstration, it is now the primary user journey —
every visitor arrives alone. The front door must offer it without a room code.
Solo mode is also the only safe way to calibrate difficulty, since the alternative
is experimenting on staff.

**On build order.** Skeleton and join flow with solo reachable from the landing
page; turn loop and private delivery; Soup, then Fog, then Slippery Floor; cards,
dealing, watch window, play cap, silent and spotlight loops, catalogue; The
Vanishing; then Mudsound and Butterfingers together, since the scribe and
read-it-to-them handovers share their machinery and are the two highest-risk items
in the project; then tuning, visual polish, and README. Mudsound and Butterfingers
are last by design, but they are also the showcase — a demonstration in which the
keyboard moves to another human being is the part worth watching.
