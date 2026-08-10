# TUI_PROMPT — autonomous runner, in-session

Master prompt for `/ralph-runner` on **soup**. Reuses `RALPH_PROMPT.md` for the
stable rules and overrides only the TUI/autonomous deltas below.

## Deltas from RALPH_PROMPT

- **In-session only.** Do the work yourself. Never shell out to `claude`,
  `ralph.sh`, or `ralphonce.sh`. That is what keeps this on the subscription.
- **No check-ins between tasks.** "Autonomous" means uninterrupted within this
  session. Loop straight from one task to the next.
- **Re-resolve eligibility every iteration** off live graph state. A task is
  eligible when `passes:false` **and** `afk:true` **and** every `depends` entry
  now passes. Re-resolving is what lets a task unblocked by the one just shipped
  get picked up automatically.
- **Sequential by default.** Fan out to parallel subagents only if the user
  explicitly asks and the tasks are genuinely independent (worktree isolation).

## Project context

- Graph: `scripts2/prd.json` · Branch: `sprint/soup-mvp` · Repo: `twistedtree83/readingsoup`
- Parent issue: #1 (the PRD). **Never work #1 directly** — it is the spec, not a task.
- Runtime is **Bun**. `npm run verify` runs `bun test` plus the purity and privacy gates.

## Architecture the runner must preserve

Pure core, thin shell. Everything with logic in it is a pure function; sockets,
files and the DOM are transport details at the edge.

- **Pure:** `mangle`, `deck`, `passages`, `session` (a reducer), `view`.
- **Shell:** `server`, `client`, `qr`, `snapshot`, `sim` — no game logic.
- Solo mode is the **same core** behind a loopback transport, never a second
  implementation. A slice that forks logic between solo and multiplayer is wrong.

## Parallel structure of this graph

`S1` unblocks seven independent lanes (`S2`, `S3`, `S4`, `S5`, `S6`, `S7`, `S8`, `S10`).
`S16` unblocks six more. Sequential order within a lane matters; across lanes it
does not. Prefer finishing the solo track (`S3`–`S9`) early — it is the public demo
and needs no server.

## Human gates in this graph

- **`S2` (#25)** — Netlify and Fly account setup, secrets. `afk:false`.
- **`S23` (#46)** — difficulty calibration. `afk:false`: nobody can assert
  "3–4× normal reading time" from a test.

The loop must not attempt these. Surface a `WAITING:` line with the exact action.

## Stop conditions

1. Most-important remaining task is `afk:false` / `ship-gate` → park with `WAITING:`.
2. `npm run verify` fails and cannot be fixed within the slice → stop, report,
   never commit red, never leave the slice half-applied.
3. An open GH issue is not in the graph and cannot be auto-ingested → stop for triage.
4. A slice cannot be built without weakening a hard rule in `RALPH_PROMPT.md` → park.

## Terminus

Report IDs and commits shipped, what is now unblocked, what remains, and a
`WAITING:` line for **each** human-gated task still open.
