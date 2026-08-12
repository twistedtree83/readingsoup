// A staffroom, on demand, so a session can be filmed without six phones.
//
// The sim harness proves the thing works and runs as fast as it can. This is
// the opposite: the same simulated participants, paced for a camera, doing the
// handful of beats that are worth watching and pausing on each one.
//
//   bun run dev                 # in one terminal
//   bun run demo                # in another
//
// Open the projector with the countdowns cut down, or the film has ninety
// seconds of clock in the middle of it:
//
//   /host?round.silentRoundMs=6000&round.watchWindowMs=3000
//
//   bun run demo -- --with Kane # leaves a seat for a real phone, and puts
//                               # that person in the reader's chair
//   bun run demo -- --beat 3000 # slower, for narration
//
// It drives participants only. The projector is yours to click, so the camera
// follows a person running a session rather than a script pretending to be one.

import { io } from "socket.io-client";

const args = new Map(
  process.argv.slice(2).flatMap((a, i, all) =>
    a.startsWith("--") ? [[a.slice(2), all[i + 1]?.startsWith("--") ? "true" : all[i + 1] ?? "true"]] : []
  )
);

const URL = args.get("url") ?? "http://localhost:8787";
const BEAT = Number(args.get("beat") ?? 2200);
const HUMAN = args.get("with") ?? null;
const CAST = "Priya Marcus Aisha Tom Bea Dev Noor Sam".split(" ").slice(0, Number(args.get("seats") ?? 7));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (line) => console.log(`\n  ${line}`);
const beat = (n = 1) => wait(BEAT * n);

// Someone in the room. Holds a token exactly as a phone does, so the projector
// cannot tell these apart from real people.
function phone(name) {
  const p = { name, views: [] };
  p.socket = io(URL, { transports: ["websocket"], forceNew: true });
  p.socket.on("view", (v) => p.views.push(v));
  p.socket.on("identity", (i) => (p.token = i?.token));
  p.socket.on("connect", () => p.socket.emit("hello", { token: p.token ?? null, name, role: "participant" }));
  p.last = () => p.views.at(-1);
  p.send = (event) => p.socket.emit("event", event);
  return p;
}

const until = async (predicate, timeout = 20_000) => {
  for (let waited = 0; waited < timeout; waited += 100) {
    if (predicate()) return true;
    await wait(100);
  }
  return false;
};

console.log(`\n  soup demo  ${URL}  ${CAST.length} simulated phones${HUMAN ? ` + ${HUMAN}` : ""}`);
console.log(`  Open the projector at ${URL}/host before you start recording.\n`);

say("They arrive.");
const room = [];
for (const name of CAST) {
  room.push(phone(name));
  // Names landing on the roster one at a time films far better than eight
  // appearing at once.
  await wait(650);
}

if (HUMAN) {
  say(`Waiting for ${HUMAN} to join on a real phone…`);
  await until(() => room[0].last()?.roomCode !== undefined);
  await until(() => false, 30_000); // give them time to scan and type a name
}

await beat();
say("Press Start on the projector. Everyone reads the same forty words at once.");
await until(() => room.every((p) => p.last()?.phase === "silent"), 120_000);
say("They are all on the same passage, and each one is hard for a different reason.");

await until(() => room[0].last()?.phase === "lobby", 180_000);
await beat();
say("Now pick a reader on the projector, or draw at random.");
await until(() => room.some((p) => p.last()?.phase === "round"), 180_000);

const readerName = room.find((p) => p.last()?.reader)?.name;
say(readerName ? `${readerName} is reading. Cards are locked for the watch window.` : "Someone is reading.");
const table = room.filter((p) => !p.last()?.reader);

// Wait out the lock, so the film shows the room having to watch first.
await until(() => table[0]?.last()?.locked === false, 60_000);
await beat();

// A wrong card, on purpose. The projector says one card played and names
// nobody, which is the moment worth capturing.
const wrong = table.find((p) => (p.last()?.hand ?? []).length);
if (wrong) {
  const card = wrong.last().hand[0];
  say(`${wrong.name} tries ${card}. If it is wrong, nothing happens and nobody is named.`);
  wrong.send({ type: "PLAY_CARD", card });
  await beat(1.5);
}

// Then the right one. This is the shot: the barrier comes off a phone that
// belongs to somebody else, mid sentence.
for (const p of table) {
  if (room.some((x) => x.last()?.accommodated)) break;
  for (const card of p.last()?.hand ?? []) {
    if (room.some((x) => x.last()?.accommodated)) break;
    p.send({ type: "PLAY_CARD", card });
    await wait(900);
  }
}
say("Right card. The barrier lifts on the reader's phone while they are still reading.");
await beat(2);

say("Have them tap done, then show the six on the projector.");
const reader = room.find((p) => p.last()?.reader);
reader?.send({ type: "DONE" });

await beat(2);
console.log(`
  Done. The room is still live, so take as long as you like on the reveal.
  Ctrl-C when you have the footage.
`);

// Held open deliberately: the phones stay on the roster so the projector does
// not empty out halfway through the last shot.
await new Promise(() => {});
