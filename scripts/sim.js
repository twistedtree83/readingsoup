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
const NAMES = "Priya Marcus Aisha Tom Bea Dev Noor Sam Rin Ola Kit Jo Ada Ravi Mei Ines Zed Fen Cal Uma".split(" ");

// ---------------------------------------------------------------- the server

async function bootServer() {
  const port = 9000 + Math.floor(Math.random() * 900);
  const proc = spawn("bun", ["run", "src/server/index.js"], {
    env: { ...process.env, PORT: String(port), PUBLIC_URL: `http://localhost:${port}` },
    stdio: "ignore",
  });
  const url = `http://localhost:${port}`;
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(url, { signal: AbortSignal.timeout(500) })).ok) return { url, proc };
    } catch {}
    await wait(120);
  }
  proc.kill();
  throw new Error(`server did not come up on ${port}`);
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
      const s = JSON.stringify(v);
      check(`${label}: non-reader received tokens`, !("tokens" in v), p.name);
      check(`${label}: non-reader view mentions a passage`, !/"text":/.test(s), p.name);
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
