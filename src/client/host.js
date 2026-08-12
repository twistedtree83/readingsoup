// The projector. A slide deck, not a dashboard: enormous type, readable from
// the back of a room, no dense status panels.
//
// It renders whatever ClientView the server sends and holds no game state.

import { socketTransport } from "/src/client/transport.js";
import { configFromQuery } from "/src/core/config.js";

// The two countdowns can be shortened from the URL:
//
//   /host?round.silentRoundMs=8000&round.watchWindowMs=4000
//
// For filming, and for a facilitator squeezed into the back half of a meeting.
// Nothing about the server's own configuration changes — both events already
// carry a duration, because the harness needed to run a real silent round and a
// real watch window in a second, and this rides on the same field.
//
// Only sent when the URL actually asks. Passing the defaults every time would
// quietly make the projector the authority on pacing instead of the config.
const asked = new URLSearchParams(location.search);
const tuned = configFromQuery(location.search);
const silentMs = asked.has("round.silentRoundMs") ? tuned.round.silentRoundMs : undefined;
const watchMs = asked.has("round.watchWindowMs") ? tuned.round.watchWindowMs : undefined;

const stage = document.getElementById("stage");
const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let identity = {};

function lobby(view) {
  const spot = view.spotlight ?? {};
  const over = spot.ended || spot.done >= spot.max;
  // One button. What it does is decided by how many people are playing, never
  // by the facilitator having to notice the headcount and pick a shape.
  const started = Boolean(view.mode);
  // The tour runs on one phone, self-paced. There is nothing for the projector
  // to drive, and offering a draw would interrupt it.
  const rounds = started && view.mode !== "solo";
  return el(`
    <section class="slide slide-lobby">
      <div class="lobby-left">
        <p class="host-eyebrow">SOUP</p>
        <div>
          <p class="host-join">Go to <strong>${esc(hostName())}</strong> and enter</p>
          <p class="host-code">${esc(view.roomCode ?? "----")}</p>
        </div>
        <p class="host-count">${countLine(view.headcount)}</p>
      </div>
      <div class="lobby-actions">
        ${started ? "" : `<button class="host-link" data-act="start">Start</button>`}
        ${rounds && !over ? `<button class="host-link" data-act="draw">Draw at random</button>` : ""}
        ${rounds ? plan(spot, view.mode) : ""}
        ${started ? `<button class="host-quiet" data-act="reveal">Show the six</button>` : ""}
        <button class="host-quiet" data-act="end-session">End the session</button>
      </div>
      <div class="lobby-right">
        <div class="qr"><img src="/qr.svg" alt="QR code to join" width="380" height="380"></div>
      </div>
    </section>
    `);
}

// The count is set against a live estimate, because the facilitator is planning
// against a slot on a timetable, not against a number of rounds.
function plan(spot, mode) {
  if (spot.ended || spot.done >= (spot.max ?? 0)) {
    return spot.done ? `<p class="plan-note">Rounds finished — ${spot.done} of them.</p>` : "";
  }
  // A small room's shape falls out of its headcount: there is nothing to pick,
  // so it is stated rather than offered.
  if (!spot.options) {
    if (!spot.perPerson) return "";
    return `
      <div class="plan">
        <p class="plan-label">Rounds${spot.done ? ` · ${spot.done} done` : ""}</p>
        <p class="plan-note">${spot.perPerson === 1 ? "One round" : `${spot.perPerson} rounds`} each —
          ${minutes(spot.estimateMs)} in all.</p>
      </div>`;
  }
  const choices = spot.options
    .map(
      (o) =>
        `<button class="plan-n${o.count === spot.planned ? " on" : ""}" data-count="${o.count}">${o.count}</button>`
    )
    .join("");
  return `
    <div class="plan">
      <p class="plan-label">Spotlight rounds${spot.done ? ` · ${spot.done} done` : ""}</p>
      <div class="plan-row">${choices}</div>
      <p class="plan-note">${
        spot.planned
          ? `About ${minutes(spot.estimateMs)} of spotlights.`
          : "Pick a number to see how long that takes."
      }</p>
    </div>`;
}

const minutes = (ms) => `${Math.round(ms / 60000)} minutes`;

// The payoff, in projector-scale type: six things you can do on Monday. Not one
// name — attribution happens by show of hands, which keeps it voluntary.
function reveal(view) {
  const d = view.debrief;
  const node = el(`
    <section class="slide slide-reveal">
      <div class="reveal-inner">
        ${
          d
            ? `<div class="prompt-band">
                 <p class="host-eyebrow">QUESTION ${d.index} OF ${d.total}</p>
                 <p class="prompt-text">${esc(d.prompt)}</p>
               </div>`
            : `<p class="host-eyebrow">SIX THINGS YOU CAN DO ON MONDAY</p>`
        }
        <ul class="reveal-list">
          ${view.catalogue
            .map(
              (c) => `
            <li class="reveal-item">
              <p class="reveal-name">${esc(c.label)}</p>
              <p class="reveal-desc">${esc(c.description)}</p>
              <span class="cat-card" data-card="${c.card}">${esc(c.cardLabel)}</span>
            </li>`
            )
            .join("")}
        </ul>
        ${
          d?.last
            ? ""
            : `<button class="host-link" data-act="prompt">${
                d ? "Next question" : "Start the discussion"
              }</button>`
        }
        <div class="reveal-exits">
          ${d ? `<button class="host-quiet" data-act="reveal">Back to the six</button>` : ""}
          <button class="host-quiet" data-act="end-session">End the session</button>
        </div>
      </div>
    </section>
  `);
  // The six stay on screen behind every question. They are the thing the room
  // is meant to leave with, and a question that replaced them would put the
  // answer out of sight exactly while people are reaching for it.
  node.querySelector('[data-act="prompt"]')?.addEventListener("click", () =>
    transport?.send({ type: "NEXT_PROMPT" })
  );
  wireExits(node);
  return node;
}

// The two ways out, wherever they appear. The reveal needs them as much as the
// lobby does: a facilitator who has clicked past the last question, or who has
// walked into somebody else's finished session, was previously stranded on the
// final slide with no control that did anything.
function wireExits(node) {
  node.querySelector('[data-act="reveal"]')?.addEventListener("click", () =>
    transport?.send({ type: "START_REVEAL" })
  );
  // A clean room, straight away, so the activity can run twice in a day. Every
  // phone from the last session is turned back into a stranger, which is the
  // point rather than a side effect.
  node.querySelector('[data-act="end-session"]')?.addEventListener("click", () => {
    if (confirm("End this session and start a fresh room? Everyone will need to join again.")) {
      transport?.send({ type: "END_SESSION" });
    }
  });
}

// A second browser on /host watches rather than drives. The facilitator sees
// the room they would be taking over before they take it, and takes it on
// purpose — nobody ends up running the session from a laptop and a phone at
// once without noticing.
function readOnlyBar() {
  const node = el(`
    <div class="host-watching">
      <p>Another screen is running this room.</p>
      <button class="host-link" data-act="takeover">Take over</button>
    </div>
  `);
  node.querySelector('[data-act="takeover"]').addEventListener("click", () =>
    transport?.send({ type: "TAKE_OVER" })
  );
  return node;
}

function silentSlide(view) {
  const secs = Math.ceil((view.remainingMs ?? 0) / 1000);
  return el(`
    <section class="slide slide-silent">
      <div>
        <p class="turn-lead">${view.finished ? "Time." : "Everyone, at the same time."}</p>
        <p class="countdown">${String(Math.floor(secs / 60))}:${String(secs % 60).padStart(2, "0")}</p>
        <p class="turn-foot">${
          view.finished
            ? "Look up. Nobody had the same trouble."
            : "Read it to yourself. Don't say anything yet."
        }</p>
      </div>
      ${view.finished ? `<button class="host-link" data-act="end-silent">Carry on</button>` : ""}
    </section>
  `);
}

function announce(view) {
  // Misregistration used once, on the name.
  const spot = view.spotlight ?? {};
  const node = el(`
    <section class="slide slide-turn">
      <p class="turn-lead">${
        view.tagged
          ? "Tagged in"
          : spot.planned
          ? `Spotlight ${spot.index} of ${spot.planned}`
          : "Reading next"
      }</p>
      <div class="turn-name">
        <span class="under" aria-hidden="true">${esc(view.readerName ?? "")}</span>
        <span class="over">${esc(view.readerName ?? "")}</span>
      </div>
      <p class="turn-foot">${roundFoot(view)}</p>
      ${
        view.canOverride
          ? `<button class="host-quiet host-quiet-light" data-act="override">Give them the accommodation</button>`
          : ""
      }
    </section>
  `);
  // The distress valve. Deliberately quiet: reaching for it is a judgement the
  // facilitator makes about a person, not a button the slide is built around.
  node.querySelector('[data-act="override"]')?.addEventListener("click", () =>
    transport?.send({ type: "OVERRIDE" })
  );
  return node;
}

// Watch first, then act. The room is told what it is waiting for, because
// sitting in that gap and noticing is the point rather than an obstacle to it.
function roundFoot(view) {
  // A handover is a move, and the slide says what happened rather than who
  // stopped. The person who tagged out is not named.
  if (view.tagged && !view.played) return "Same passage, same barrier, from the top.";
  if (view.locked) {
    return `Cards down. Just watch — ${Math.ceil((view.unlocksInMs ?? 0) / 1000)}s.`;
  }
  if (view.playsLeft === 0) return `That's three. No more cards this round.`;
  if (view.played) return `${playedLine(view.played)} ${view.playsLeft} left, between all of you.`;
  return "Three plays, for the whole room. Make them count.";
}

// Wrong plays are counted, never named. Being generous and wrong about how to
// help a struggling colleague is not something to put in projector-scale type
// at a staff meeting.
const playedLine = (n) => (n === 1 ? "One card played." : `${n} cards played.`);

// The moment the barrier comes off, and the only place a name is attached to a
// card. Same slide furniture as the announce, so it lands as the same beat.
function helped(view) {
  // Granted rather than found: the card takes the big type and nobody is named.
  // Whose plays did not land is not the room's business.
  const headline = view.helped.granted ? view.helped.cardLabel : view.helped.name;
  return el(`
    <section class="slide slide-helped">
      <p class="turn-lead">That helped</p>
      <div class="turn-name">
        <span class="under" aria-hidden="true">${esc(headline ?? "")}</span>
        <span class="over">${esc(headline ?? "")}</span>
      </div>
      <p class="turn-foot">${
        view.helped.granted
          ? "Given, so the reading can go on."
          : `played <strong>${esc(view.helped.cardLabel ?? "")}</strong>.`
      }</p>
    </section>
  `);
}

// What is actually arriving, character by character, at projector scale. No
// corrections, no spellcheck squiggles, no highlighting: the room has to see
// exactly what came out. The sentence it was meant to be stays hidden until the
// round is over, then appears beside it.
function mirror(view) {
  const node = el(`
    <section class="slide slide-mirror">
      <div class="mirror-inner">
        <p class="host-eyebrow">${view.finished ? "WHAT ARRIVED" : "WHAT IS ARRIVING"}</p>
        <p class="typed-text" spellcheck="false">${esc(view.typed) || "&nbsp;"}</p>
        ${
          view.finished
            ? `<p class="host-eyebrow">WHAT THEY WERE TYPING</p>
               <p class="clean-text">${esc(view.clean ?? "")}</p>
               <button class="host-link host-next" data-act="next">Next reader</button>`
            : `<p class="host-note">${esc(view.readerName ?? "")} knows exactly what they want to say.</p>`
        }
      </div>
    </section>
  `);
  node.querySelector('[data-act="next"]')?.addEventListener("click", () =>
    transport?.send({ type: "END_ROUND" })
  );
  return node;
}

function cleanPassage(view) {
  const node = el(`
    <section class="slide slide-clean">
      <div>
        <p class="host-eyebrow">WHAT IT ACTUALLY SAID</p>
        <p class="clean-text">${esc(view.clean ?? "")}</p>
        <button class="host-link host-next" data-act="next">Next reader</button>
        <button class="host-quiet" data-act="stop">That's enough spotlights</button>
      </div>
    </section>
  `);
  node.querySelector('[data-act="next"]').addEventListener("click", () =>
    transport?.send({ type: "END_ROUND" })
  );
  // Pacing is the facilitator's, not the plan's: they can stop the moment they
  // judge the room has had enough, without waiting out the number they set.
  node.querySelector('[data-act="stop"]').addEventListener("click", () => {
    transport?.send({ type: "END_ROUND" });
    transport?.send({ type: "END_SPOTLIGHTS" });
  });
  return node;
}

function roster(view) {
  if (!view.roster?.length) return "";
  // Names only. No roles, no counts split by role — this screen is projected to
  // the whole room, and anything role-shaped would disclose an opt-out to
  // everybody at once. `volunteered` is the one exception, and it is not a
  // role: it is a thing the person did on purpose to be seen doing.
  return `<ul class="roster">${view.roster
    .map(
      (r, i) =>
        `<li><button class="roster-name${r.connected ? "" : " away"}${
          r.volunteered ? " willing" : ""
        }" data-i="${i}">${esc(r.name)}</button></li>`
    )
    .join("")}</ul>`;
}

const countLine = (n) =>
  n === 0 ? "Waiting for the room." : n === 1 ? "1 in the room." : `${n} in the room.`;

function hostName() {
  const url = identity.publicUrl ?? location.origin;
  return url.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

let lastView = null;

function render(view) {
  lastView = view;

  // Read-only: show the room exactly as it is, with every control inert and one
  // way to take it. Rendering a different screen would hide what is happening.
  if (view.readOnly) {
    mounting = true;
    const shown = drive({ ...view, readOnly: false });
    mounting = false;
    shown.querySelectorAll("button, a.host-link").forEach((b) => {
      b.disabled = true;
      b.classList.add("inert");
    });
    stage.replaceChildren(shown, readOnlyBar());
    return;
  }
  return drive(view);
}

function drive(view) {

  if (view.phase === "silent") {
    const node = silentSlide(view);
    node.querySelector('[data-act="end-silent"]')?.addEventListener("click", () =>
      transport?.send({ type: "END_SILENT" })
    );
    return place(node);
  }

  if (view.phase === "catalogue") return place(reveal(view));

  if (view.phase === "round") {
    // A person silently typing gives the room no signal at all, so a typed
    // round takes the screen for itself the moment anything arrives.
    const mirroring = typeof view.typed === "string" && (view.typed || view.finished);
    return place(
      mirroring ? mirror(view) : view.finished ? cleanPassage(view) : view.helped ? helped(view) : announce(view)
    );
  }

  const node = lobby(view);
  const left = node.querySelector(".lobby-left");
  left.insertAdjacentHTML("beforeend", roster(view));
  // The human owns who reads — named, or handed to chance. Which barrier they
  // get is never on this screen: the app owns that.
  node.querySelector('[data-act="start"]')?.addEventListener("click", () =>
    transport?.send({ type: "START_SESSION", durationMs: silentMs })
  );
  node.querySelector('[data-act="draw"]')?.addEventListener("click", () =>
    transport?.send({ type: "START_ROUND", random: true, watchWindowMs: watchMs })
  );
  // The reveal is complete whenever it is reached: everybody active met a
  // barrier in the silent round, so ending after four spotlights or after
  // twelve leaves nobody blank.
  wireExits(node);
  node.querySelectorAll(".plan-n").forEach((btn) =>
    btn.addEventListener("click", () =>
      transport?.send({ type: "SET_SPOTLIGHT_COUNT", count: Number(btn.dataset.count) })
    )
  );
  // Once the spotlights are over the names stop being buttons. A control that
  // is still there and silently does nothing is the same problem as an
  // ineligible name in the list: the room watches the facilitator tap and sees
  // the screen ignore them.
  const spot = view.spotlight ?? {};
  const pickable = view.mode && view.mode !== "solo" && !(spot.ended || spot.done >= spot.max);
  if (pickable) {
    node.querySelectorAll(".roster-name").forEach((btn) =>
      btn.addEventListener("click", () => {
        transport?.send({ type: "START_ROUND", readerIndex: Number(btn.dataset.i), watchWindowMs: watchMs });
      })
    );
  } else {
    node.querySelectorAll(".roster-name").forEach((btn) => (btn.disabled = true));
  }
  return place(node);
}

// One place the stage is written, so the read-only view can borrow a slide
// without it being mounted twice.
let mounting = false;
function place(node) {
  if (!mounting) stage.replaceChildren(node);
  return node;
}

function offline() {
  // The static deploy has no game server, and the PRD requires the site to work
  // completely without one. A blank projector is the worst possible failure, so
  // say plainly what is missing and point at the half that does work.
  stage.replaceChildren(
    el(`
      <section class="slide slide-offline">
        <div class="lobby-left">
          <p class="host-eyebrow">SOUP</p>
          <div>
            <p class="host-join">The facilitator screen needs the game server.</p>
            <p class="host-note">Running a session takes the realtime server. The
              solo tour needs nothing at all — it runs entirely in the browser.</p>
          </div>
          <a class="host-link" href="/">Take the tour instead</a>
        </div>
      </section>
    `)
  );
}

let transport = null;

try {
  transport = await socketTransport({
    intent: "host",
    onIdentity: (id) => { identity = id ?? {}; },
    onView: render,
    onError: offline,
  });
  transport.start();
} catch {
  offline();
}
