// Headless N-participant sessions.
//
// A twenty-person session cannot be tested with twenty phones, and turn logic
// breaks most often at the SMALL sizes — a two-person session is the
// configuration most likely to expose it. So every size runs, every time.
//
// This is the integration test. It is not itself unit-tested: if it is wrong,
// it fails loudly rather than quietly passing.
//
//   bun run sim                    # every size, spawns its own server
//   bun run sim -- --sizes 2,20    # just those
//   bun run sim -- --url http://…  # against an already-running server
//   bun run sim -- --keep          # leave the room up at the end

import { io } from "socket.io-client";
import { spawn } from "node:child_process";

const args = new Map(
  process.argv.slice(2).flatMap((a, i, all) =>
    a.startsWith("--") ? [[a.slice(2), all[i + 1]?.startsWith("--") ? "true" : all[i + 1] ?? "true"]] : []
  )
);
const SIZES = (args.get("sizes") ?? "1,2,5,8,20").split(",").map(Number);
const OBSERVER_RATIO = Number(args.get("observers") ?? 0.2);
const KEEP = args.has("keep");

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Wait for a view to ARRIVE, not for a guessed number of milliseconds. A fixed
// sleep encodes how fast this machine happened to be the day it was written: a
// twenty-person session under load misses it and reports a phantom failure,
// while a fast one sits there burning seconds it did not need. Polling returns
// the moment the thing is true, so the harness gets both faster and steadier.
async function until(predicate, timeout = 6000) {
  for (let waited = 0; waited < timeout; waited += 50) {
    if (predicate()) return true;
    await wait(50);
  }
  return predicate();
}
const NAMES = "Priya Marcus Aisha Tom Bea Dev Noor Sam Rin Ola Kit Jo Ada Ravi Mei Ines Zed Fen Cal Uma".split(" ");

// ---------------------------------------------------------------- the server

// Booting is fussier than it looks. A random port may already be held by
// something entirely unrelated, and "it responded" is not the same as "it is
// ours" — asserting a whole session against a stranger's service produces
// baffling failures. So: refuse an occupied port, then confirm the thing that
// answered is actually this server.
async function isOurs(url) {
  try {
    const res = await fetch(`${url}/qr.svg`, { signal: AbortSignal.timeout(700) });
    return res.ok && (await res.text()).startsWith("<svg");
  } catch {
    return false;
  }
}

async function portFree(port) {
  try {
    await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(300) });
    return false; // something answered
  } catch {
    return true;
  }
}

async function bootServer() {
  for (let attempt = 0; attempt < 12; attempt++) {
    const port = 9000 + Math.floor(Math.random() * 900);
    if (!(await portFree(port))) continue;

    const url = `http://localhost:${port}`;
    const proc = spawn("bun", ["run", "src/server/index.js"], {
      env: { ...process.env, PORT: String(port), PUBLIC_URL: url },
      stdio: "ignore",
    });

    for (let i = 0; i < 50; i++) {
      if (await isOurs(url)) return { url, proc };
      await wait(120);
    }
    proc.kill();
  }
  throw new Error("could not obtain a free port for the sim server");
}

// --------------------------------------------------------------- a simulated
// participant. Holds a token exactly like a phone does, so reconnection is real.

function participant(url, { intent, name, role } = {}) {
  const p = { name, role, views: [], identity: null, effects: [] };
  const connect = () => {
    p.socket = io(url, { transports: ["websocket"], forceNew: true });
    p.socket.on("view", (v) => p.views.push(v));
    p.socket.on("effect", (e) => p.effects.push(e));
    p.socket.on("identity", (i) => (p.identity = i));
    p.socket.on("connect", () =>
      p.socket.emit("hello", { token: p.identity?.token ?? null, intent, name, role })
    );
  };
  connect();
  p.last = () => p.views.at(-1);
  p.send = (event) => p.socket.emit("event", event);
  p.drop = () => p.socket.disconnect();       // a phone locking
  p.returnToRoom = () => connect();            // and coming back, same token
  return p;
}

// -------------------------------------------------------------------- checks

const failures = [];
const check = (label, ok, detail = "") => {
  if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
};

// The load-bearing rule, asserted on every view any simulated participant has
// ever received. As round slices land this starts doing real work; until then
// it is a tripwire that costs nothing.
function assertNoPassageLeak(people, label) {
  for (const p of people) {
    for (const v of p.views) {
      if (v.reader === true || v.role === "host") continue;
      // The silent round is the exception, by design: everybody has their own
      // copy of the same passage at the same moment. There is no reader to be
      // a non-reader of. The rule governs SPOTLIGHT rounds, where one person
      // reads aloud and the room must not be able to read along.
      if (v.phase === "silent") continue;
      const s = JSON.stringify(v);
      check(`${label}: non-reader received tokens`, !("tokens" in v), p.name);
      check(`${label}: non-reader view mentions a passage`, !/"text":/.test(s), p.name);
    }
  }
}

// What the silent round must still guarantee: your phone tells you nothing
// about anyone else — not their condition, not their name, not their progress.
function assertSilentTellsYouNothingAboutOthers(people, label) {
  const names = people.map((p) => p.name);
  for (const p of people) {
    for (const v of p.views.filter((v) => v.phase === "silent")) {
      const s = JSON.stringify(v);
      for (const other of names.filter((n) => n !== p.name)) {
        check(`${label}: a silent view names someone else`, !s.includes(`"${other}"`), `${p.name} sees ${other}`);
      }
      check(`${label}: a silent view carries an assignment map`, !/"assigned"/.test(s), p.name);
      check(`${label}: a silent view names a condition`, !/"condition"/.test(s), p.name);
    }
  }
}

// --------------------------------------------------------------- one session

async function runSize(url, size) {
  const label = `${size}p`;
  const host = participant(url, { intent: "host" });
  await wait(400);

  const people = [];
  for (let i = 0; i < size; i++) {
    const role = i > 0 && i / size < OBSERVER_RATIO ? "observer" : "participant";
    people.push(participant(url, { name: NAMES[i % NAMES.length], role }));
    await wait(25);
  }
  await wait(600);

  const hv = host.last();
  check(`${label}: host got a view`, Boolean(hv));
  check(`${label}: everyone is on the roster`, hv?.roster?.length === size, `${hv?.roster?.length}/${size}`);
  check(`${label}: headcount matches`, hv?.headcount === size, `${hv?.headcount}/${size}`);

  // Wellbeing rule 1: the projector is shown to the whole room at once, so it
  // must never carry anything role-shaped.
  const rosterJson = JSON.stringify(hv?.roster ?? []);
  check(`${label}: roster leaks a role`, !/observer|participant/.test(rosterJson), rosterJson.slice(0, 80));
  check(`${label}: host view leaks a role split`, !/observerCount|observers/.test(JSON.stringify(hv ?? {})));

  // Nobody can see anyone ELSE's role. A participant's own role is legitimately
  // in their own view — they chose it — so observers are checked only for
  // whether they can see other observers, which they must not.
  const observerNames = people.filter((o) => o.role === "observer").map((o) => o.name);
  for (const p of people) {
    const view = JSON.stringify(p.last() ?? {});
    const mine = p.role === "observer" ? 1 : 0;
    const mentions = (view.match(/observer/g) ?? []).length;
    check(`${label}: sees another's role`, mentions <= mine, `${p.name} (${mentions} vs own ${mine})`);
    for (const other of observerNames.filter((n) => n !== p.name)) {
      check(`${label}: another observer is nameable`, !view.includes(`"${other}"`), `${p.name} sees ${other}`);
    }
  }

  // A phone that flaps: several reconnects in quick succession. `hello` fires
  // on every connect, so this is where a participant can duplicate themselves.
  const flapper = people[0];
  for (let i = 0; i < 3; i++) {
    flapper.drop();
    await wait(60);
    flapper.returnToRoom();
    await wait(120);
  }
  await wait(700);
  check(`${label}: a flapping phone duplicated itself`, host.last()?.roster?.length === size,
    `${host.last()?.roster?.length}/${size}`);

  // a phone locks, then comes back — the single most common real event
  const victim = people.at(-1);
  victim.drop();
  await wait(400);
  const away = host.last();
  check(`${label}: a locked phone keeps its roster place`, away?.roster?.length === size);
  check(`${label}: headcount drops while away`, away?.headcount === size - 1, `${away?.headcount}`);

  victim.returnToRoom();
  await wait(700);
  const back = victim.last();
  check(`${label}: reconnect restored the name`, back?.name === victim.name, `${back?.name}`);
  check(`${label}: reconnect restored the role`, back?.role === victim.role, `${back?.role}`);
  check(`${label}: headcount recovers`, host.last()?.headcount === size, `${host.last()?.headcount}`);

  assertNoPassageLeak(people, label);

  // ---- the silent round: everyone at once, on the same words --------------
  host.send({ type: "START_SILENT", durationMs: 4000 });
  await until(() => people.every((p) => Array.isArray(p.last()?.tokens)) && host.last()?.phase === "silent");

  const withCondition = people.filter((p) => p.role === "participant");
  const cover = people.filter((p) => p.role === "observer");
  const passageIds = new Set(people.map((p) => p.last()?.passageId).filter(Boolean));

  check(`${label}: silent round did not start`, host.last()?.phase === "silent", `${host.last()?.phase}`);
  check(`${label}: the room did not get ONE passage`, passageIds.size === 1, `${passageIds.size} distinct`);
  check(`${label}: host countdown missing`, typeof host.last()?.remainingMs === "number");
  check(`${label}: host slide shows a roster`, host.last()?.roster === undefined);

  for (const p of withCondition) {
    check(`${label}: an active participant got no passage`, Array.isArray(p.last()?.tokens), p.name);
    check(`${label}: a turn was announced in the silent round`, !("readerName" in (p.last() ?? {})), p.name);
  }
  for (const p of cover) {
    // Cover, not exclusion: the same passage, rendered clean.
    check(`${label}: observer got no cover passage`, Array.isArray(p.last()?.tokens), p.name);
    check(`${label}: observer cover was not clean`, p.last()?.render?.wordGaps === true && p.last()?.render?.contrast === 1, p.name);
    check(`${label}: observer cover not flagged`, p.last()?.observerCover === true, p.name);
  }

  assertSilentTellsYouNothingAboutOthers(people, label);

  // it must end on its own, and the room must be able to carry on
  await until(() => host.last()?.remainingMs === 0, 9000);
  check(`${label}: countdown did not reach zero`, host.last()?.remainingMs === 0, `${host.last()?.remainingMs}`);
  host.send({ type: "END_SILENT" });
  await until(() => [host, ...people].every((p) => p.last()?.phase === "lobby"));
  check(`${label}: END_SILENT did not return to the lobby`, host.last()?.phase === "lobby", `${host.last()?.phase}`);

  // ---- volunteering -------------------------------------------------------
  // The button is on every phone. Whose tap reaches the projector is not.
  for (const p of people) {
    check(`${label}: a phone was not offered the volunteer button`, p.last()?.canVolunteer === true, p.name);
  }

  const willing = people.filter((p) => p.role === "participant").at(-1);
  const rosterBefore = host.last()?.roster?.map((r) => r.name) ?? [];
  if (willing && size > 1) {
    willing.send({ type: "VOLUNTEER" });
    await until(() => willing.last()?.volunteered === true);
    check(`${label}: a volunteer did not surface at the top`, host.last()?.roster?.[0]?.name === willing.name,
      `${host.last()?.roster?.[0]?.name}`);
    check(`${label}: the volunteer's own phone did not confirm`, willing.last()?.volunteered === true, willing.name);
  }

  const quiet = people.find((p) => p.role === "observer");
  if (quiet) {
    quiet.send({ type: "VOLUNTEER" });
    await until(() => quiet.last()?.volunteered === true);
    // Their own phone confirms exactly like everyone else's...
    check(`${label}: an observer's phone did not confirm`, quiet.last()?.volunteered === true, quiet.name);
    // ...and the projector never hears about it. An ineligible name at the top
    // of the roster is the name the facilitator taps, and a tap that visibly
    // does nothing discloses the role to the whole room at once.
    const names = host.last()?.roster?.map((r) => r.name) ?? [];
    check(`${label}: an observer surfaced as a volunteer`, names[0] !== quiet.name, quiet.name);
    check(`${label}: an observer's tap reordered the roster`,
      names.join("|") === (willing && size > 1
        ? [willing.name, ...rosterBefore.filter((n) => n !== willing.name)].join("|")
        : rosterBefore.join("|")),
      names.join(","));
    check(`${label}: an observer was flagged willing on the projector`,
      (host.last()?.roster ?? []).every((r) => r.volunteered === false || r.name === willing?.name));
  }

  // ---- the spotlights -----------------------------------------------------
  // The unit suite proves the boundary in the core. This proves it on the wire.
  host.send({ type: "SET_SPOTLIGHT_COUNT", count: 20 });
  await until(() => host.last()?.spotlight?.planned > 0);
  const plan = host.last()?.spotlight ?? {};
  check(`${label}: spotlight count was not capped at eight`, plan.planned === plan.max, `${plan.planned}`);
  check(`${label}: no time estimate for the plan`, plan.estimateMs > 0, `${plan.estimateMs}`);

  const hasTask = (v) => Array.isArray(v?.tokens) || typeof v?.prompt === "string";
  const observerNamesAll = people.filter((p) => p.role === "observer").map((p) => p.name);
  // Hand size scales off active participants, exactly as the group-size modes
  // in the PRD do. Observers hold a hand but do not push a small room into
  // scarcity — they are not the reason a group is a group.
  const activeParticipants = people.filter((p) => p.role === "participant").length;
  const readerIdx = people.findIndex((p) => p.role === "participant");

  if (readerIdx >= 0) {
    // An observer must never be selectable as a reader. Their position is read
    // off the projector, not off the join order: volunteers move the roster
    // about, and the facilitator taps what is actually on screen.
    if (quiet) {
      const obsIdx = (host.last()?.roster ?? []).findIndex((r) => r.name === quiet.name);
      check(`${label}: an observer is missing from the roster`, obsIdx >= 0, quiet.name);
      host.send({ type: "START_ROUND", readerIndex: obsIdx });
      await wait(400);
      check(`${label}: an observer was put in the reader seat`,
        host.last()?.phase !== "round", quiet.name);
    }

    // The cap is what matters at the sizes the cap was written for. Below that
    // the loop is the same code with fewer people in it, so two rounds prove it
    // without adding a minute of wall clock to every run.
    const rounds = size >= 8 ? 8 : 2;
    let ran = 0;
    let typedRounds = 0;
    for (let i = 0; i < rounds; i++) {
      // Chance picks the person; the app picks the barrier. Neither is on a phone.
      host.send({ type: "START_ROUND", random: true });
      await until(() => host.last()?.phase === "round", 1500);
      if (host.last()?.phase !== "round") break; // everyone has had all six
      ran++;

      const name = host.last()?.readerName;
      const reader = people.find((p) => p.name === name);
      await until(() => people.every((p) => p.last()?.phase === "round"));
      check(`${label}: the draw landed on an observer`, !observerNamesAll.includes(name), `${name}`);
      check(`${label}: the drawn reader is not in the room`, Boolean(reader), `${name}`);
      if (!reader) break;

      check(`${label}: reader got no task`, hasTask(reader.last()), `${name}`);
      check(`${label}: clean passage withheld mid-round`, host.last()?.clean === undefined);
      check(`${label}: the reader was told which barrier they have`,
        !("condition" in (reader.last() ?? {})), name);
      if (reader.last()?.kind === "typing") typedRounds++;

      for (const p of people.filter((p) => p !== reader)) {
        const v = p.last() ?? {};
        check(`${label}: a non-reader got tokens`, !("tokens" in v), p.name);
        check(`${label}: a non-reader got a dictation prompt`, !("prompt" in v), p.name);
        check(`${label}: a non-reader was not told to watch`, v.watching === true, p.name);
      }

      // ---- the cards, on the wire, once per size --------------------------
      // The unit suite proves the correct card is always dealt. This proves the
      // consequence: a room that plays everything it holds always gets the
      // barrier off, and nobody but the reader ever sees the passage doing it.
      const table = people.filter((p) => p !== reader);
      if (i === 1 && table.length) {
        const expectedHand = activeParticipants >= 6 ? 3 : 6;
        for (const p of table) {
          check(`${label}: a hand was the wrong size`, p.last()?.hand?.length === expectedHand,
            `${p.name} holds ${p.last()?.hand?.length}, expected ${expectedHand}`);
        }
        check(`${label}: the reader was dealt cards`, reader.last()?.hand === undefined, name);

        // One play first, on its own, so attribution can be read cleanly.
        const first = table[0];
        first.send({ type: "PLAY_CARD", card: first.last().hand[0] });
        await until(() => (first.last()?.spent ?? []).length > 0);
        check(`${label}: a played card was not spent`, (first.last()?.spent ?? []).length === 1, first.name);
        if (host.last()?.helped) {
          check(`${label}: a correct play went unattributed`, host.last().helped.name === first.name,
            `${host.last().helped.name}`);
        } else {
          check(`${label}: a wrong play was attributed`,
            !JSON.stringify(host.last() ?? {}).includes(first.name), first.name);
          check(`${label}: a wrong play was not counted`, host.last()?.played >= 1, `${host.last()?.played}`);
        }

        // Now everything else. Somebody holds the card that lifts this barrier.
        for (const p of table) {
          for (const card of p.last()?.hand ?? []) {
            if (host.last()?.helped) break;
            p.send({ type: "PLAY_CARD", card });
            await until(() => (p.last()?.spent ?? []).includes(card), 1500);
          }
        }
        await until(() => Boolean(host.last()?.helped));
        check(`${label}: the room played every card and the barrier stayed on`,
          Boolean(host.last()?.helped), `played=${host.last()?.played}`);
        check(`${label}: the helper was not named`, table.some((p) => p.name === host.last()?.helped?.name),
          `${host.last()?.helped?.name}`);
        check(`${label}: the reader was not accommodated`, reader.last()?.accommodated === true, name);
        check(`${label}: the barrier was still on the reader's screen`,
          reader.last()?.render?.contrast === 1 && reader.last()?.render?.wordGaps === true,
          JSON.stringify(reader.last()?.render));

        for (const p of table) {
          check(`${label}: a card-holder received tokens`, !("tokens" in (p.last() ?? {})), p.name);
        }
      }

      reader.send({ type: "DONE" });
      await until(() => typeof host.last()?.clean === "string");
      check(`${label}: host gets the clean passage after done`, typeof host.last()?.clean === "string",
        `${typeof host.last()?.clean}`);
      for (const p of people) {
        check(`${label}: a phone received the clean passage`, !("clean" in (p.last() ?? {})), p.name);
      }

      // The loop must loop. A single turn is not a turn loop.
      host.send({ type: "END_ROUND" });
      await until(() => host.last()?.phase === "lobby");
      check(`${label}: END_ROUND did not return to the roster`, host.last()?.phase === "lobby",
        `phase=${host.last()?.phase}`);
    }

    check(`${label}: no spotlight round ran`, ran > 0, `${ran}`);
    if (size >= 8) {
      check(`${label}: the eight-round cap was not reached`, ran === 8, `${ran}`);
      // Butterfingers only ever appears here, so a run with no typed round means
      // the room never watched the one barrier that is not about reading.
      check(`${label}: the typing barrier never came up`, typedRounds > 0, `${typedRounds}`);
      host.send({ type: "START_ROUND", random: true });
      await wait(400);
      check(`${label}: a ninth spotlight started`, host.last()?.phase === "lobby", `${host.last()?.phase}`);
    }

    // The facilitator can stop whenever they judge the room has had enough.
    host.send({ type: "END_SPOTLIGHTS" });
    await until(() => host.last()?.spotlight?.ended === true);
    check(`${label}: END_SPOTLIGHTS was not recorded`, host.last()?.spotlight?.ended === true);
    host.send({ type: "START_ROUND", random: true });
    await wait(400);
    check(`${label}: a round started after spotlights ended`, host.last()?.phase === "lobby",
      `${host.last()?.phase}`);

    // A second /host arrival must not destroy the room — least of all
    // mid-round, which is the worst possible moment.
    const phaseBefore = host.last()?.phase;
    const intruder = participant(url, { intent: "host" });
    await wait(600);
    // Mid-round the host view is the announce slide and legitimately carries no
    // roster, so the room code and the still-running round are what to assert.
    check(`${label}: a second host reset the room code`,
      intruder.identity?.roomCode === host.identity?.roomCode,
      `${intruder.identity?.roomCode} vs ${host.identity?.roomCode}`);
    // Whatever the room was doing, it must still be doing it. At one
    // participant there is no second reader, so the room is legitimately back
    // in the lobby by this point — the rule is "unchanged", not "in a round".
    check(`${label}: a second host changed the phase`,
      intruder.last()?.phase === phaseBefore,
      `${phaseBefore} -> ${intruder.last()?.phase}`);
    intruder.socket.disconnect();

    assertNoPassageLeak(people, `${label}/round`);
  }

  const phase = host.last()?.phase;
  if (!KEEP) [host, ...people].forEach((p) => p.socket.disconnect());
  await wait(200);
  return phase;
}

// ----------------------------------------------------------------------- run

const fixedUrl = args.get("url");
console.log(`sim  sizes: ${SIZES.join(", ")}  observers: ~${Math.round(OBSERVER_RATIO * 100)}%${fixedUrl ? `  ${fixedUrl}` : ""}\n`);

for (const size of SIZES) {
  // A fresh room per size. Disconnected participants are deliberately never
  // removed (phones lock every round) and there is no session reset until S22,
  // so a shared server would carry every previous size's people into the next.
  const { url, proc } = fixedUrl ? { url: fixedUrl, proc: null } : await bootServer();
  const before = failures.length;
  const phase = await runSize(url, size);
  const added = failures.length - before;
  console.log(`  ${String(size).padStart(2)} participants  phase=${phase ?? "?"}  ${added ? `✗ ${added} failure(s)` : "✓"}`);
  proc?.kill();
  await wait(250);
}

if (failures.length) {
  console.log(`\n${failures.length} failure(s):`);
  for (const f of failures) console.log(`  ✗ ${f}`);
} else {
  console.log(`\n✓ all sizes passed`);
}

process.exit(failures.length ? 1 : 0);
