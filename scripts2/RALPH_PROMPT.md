# RALPH_PROMPT — shared rules

Canonical operating rules for shipping tasks from a `scripts2/prd*.json` graph.
Stable across headless and TUI runs. **Do not edit casually** — the TUI runner
overrides only what it must, in `TUI_PROMPT.md`.

## Bibles

- `../PRD.md` and GH issue #1 — the product spec. The authority on *what* and *why*.
- The linked GH issue on each task — the authority on *this slice's* scope and acceptance criteria.
- This file — the authority on *how* to ship.

If the bibles are silent on a fork, **park the task for the human**. Do not invent
product decisions.

## The 10-step, per task

1. **Announce** the task: id, issue number, title, one line on the slice.
2. **Read the code** that already exists in the touched area before writing anything.
3. **`/tdd` one vertical slice.** Red → green → refactor. The slice must cut through
   every layer it touches and be demoable on its own. Never a horizontal layer.
4. **`npm run verify`** must be green. Never commit a red gate.
5. **Commit** on the graph's `branchName`. One commit per task, never batched.
6. **Close the GH issue** with a comment linking the commit.
7. **Set `passes: true`** on the task in the target graph.
8. **Write `scripts2/progress/<ID>.md`** — what shipped, what was decided, what was left.
9. **Flip the task's line in `scripts2/progress/INDEX.md`**.
10. **Push the branch.** The green gate is the guard.

A task ships **whole** or **does not start**. Never leave a half-applied slice.

## Step 2 cross-check

Before the loop, reconcile open GH issues against the graph. An open issue that is
not in the graph and cannot be auto-ingested is a **stop condition** — park for triage.

## Hard rules — project-specific, non-negotiable

These come from the PRD's wellbeing requirements. They are not tradeable against
schedule, and an autonomous run must **never** weaken one to make a slice simpler.
If a change appears to simplify the build by weakening one of these, it is the
wrong change — park it.

1. **The privacy boundary.** The server never sends passage text to a socket that
   is not the current reader. The client can never reconstruct what it is
   displaying. `view.viewFor` is the sole path by which any client obtains any
   data. Any slice that adds a second data path is wrong.
2. **The observer must stay invisible.** No view, effect, log, error, or timing
   difference may reveal who chose to observe — at any group size, including the
   two-person case.
3. **No timing, scoring, ranking, or comparison** between participants. Anywhere.
   Not in the UI, not in state, not in logs.
4. **Every condition ships with its accommodation.** A barrier is never merged
   without the card that removes it.
5. **Nothing participant-identifying is logged** to disk or stdout.
6. **Tag in is framed as a game move**, never as giving up.

## Purity rule

`mangle`, `deck`, `passages`, `session`, and `view` are pure. No socket, filesystem,
DOM, or clock reads. Time enters as an event field. `npm run check:purity` enforces
this; a slice that needs to break it is a design error, not a licence.
