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

// Never waits in silence. A demo that stops with no output looks broken even
// when it is doing exactly what it should, so anything slow says what it is
// waiting for and keeps saying it.
async function waitFor(label, predicate, timeout = 180_000) {
  const started = Date.now();
  let nudged = 0;
  while (Date.now() - started < timeout) {
    if (predicate()) return true;
    const seconds = Math.floor((Date.now() - started) / 1000);
    if (seconds >= 12 && seconds >= nudged + 12) {
      nudged = seconds;
      console.log(`     …still waiting: ${label}`);
    }
    await wait(200);
  }
  console.log(`\n  Gave up waiting: ${label}`);
  return false;
}

const PROJECTOR = `${URL}/host?round.silentRoundMs=6000&round.watchWindowMs=3000`;

console.log(`\n  soup demo  ${URL}  ${CAST.length} simulated phones${HUMAN ? ` + ${HUMAN}` : ""}`);
console.log(`\n  Projector, with the countdowns cut down for filming:`);
console.log(`  ${PROJECTOR}\n`);

// THE PROJECTOR HAS TO BE OPEN FIRST, and this waits rather than trusting it.
//
// Opening /host opens a room, and opening a room clears the participant list —
// deliberately, so yesterday's phones cannot wander into today's session. Seat
// anybody before that happens and they are wiped the moment the facilitator
// arrives: the roster empties, Start does nothing because there is nobody
// active, and the demo sits there looking hung when it is really waiting for a
// room that has no people in it.
//
// A nameless socket is the probe. The server hands out a token and a view but
// never adds it to the roster, so asking the question does not disturb the
// answer.
const scout = phone(null);
if (!(await waitFor("a room to exist — open the projector now", () => scout.last()?.roomCode, 300_000))) {
  console.log(`\n  Open ${PROJECTOR} and run this again.\n`);
  process.exit(1);
}
scout.socket.disconnect();
console.log(`  Room ${scout.last().roomCode} is open.`);

say("They arrive.");
const room = [];
for (const name of CAST) {
  room.push(phone(name));
  // Names landing on the roster one at a time films far better than eight
  // appearing at once.
  await wait(650);
}

// If the room was reopened underneath them — a refresh of /host, or End the
// session — they are off the roster and nothing that follows will work. Better
// to say so than to wait out a two minute timeout.
if (!(await waitFor("the phones to appear on the roster", () => room.every((p) => p.last()?.joined !== false), 15_000))) {
  console.log(`\n  They are not on the roster. The projector was probably opened or reset`);
  console.log(`  after they joined, which clears the room. Restart this script.\n`);
  process.exit(1);
}

if (HUMAN) {
  say(`Waiting for ${HUMAN} to join on a real phone…`);
  await waitFor(`${HUMAN} to scan the code and pick a name`, () => false, 45_000);
}

await beat();
say("Press Start on the projector. Everyone reads the same forty words at once.");
await waitFor("Start to be pressed on the projector", () => room.every((p) => p.last()?.phase === "silent"));
say("They are all on the same passage, and each one is hard for a different reason.");

await waitFor("the silent round to finish, then Carry on", () => room[0].last()?.phase === "lobby");
await beat();
say("Now pick a reader on the projector, or draw at random.");
await waitFor("a reader to be picked on the projector", () => room.some((p) => p.last()?.phase === "round"));

const readerName = room.find((p) => p.last()?.reader)?.name;
say(readerName ? `${readerName} is reading. Cards are locked for the watch window.` : "Someone is reading.");
const table = room.filter((p) => !p.last()?.reader);

// Wait out the lock, so the film shows the room having to watch first.
await waitFor("the watch window to run down", () => table[0]?.last()?.locked === false, 60_000);
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
