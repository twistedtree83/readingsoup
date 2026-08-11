// The projector. A slide deck, not a dashboard: enormous type, readable from
// the back of a room, no dense status panels.
//
// It renders whatever ClientView the server sends and holds no game state.

import { socketTransport } from "/src/client/transport.js";

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

  if (view.phase === "silent") {
    const node = silentSlide(view);
    node.querySelector('[data-act="end-silent"]')?.addEventListener("click", () =>
      transport?.send({ type: "END_SILENT" })
    );
    stage.replaceChildren(node);
    return;
  }

  if (view.phase === "round") {
    stage.replaceChildren(
      view.finished ? cleanPassage(view) : view.helped ? helped(view) : announce(view)
    );
    return;
  }

  const node = lobby(view);
  const left = node.querySelector(".lobby-left");
  left.insertAdjacentHTML("beforeend", roster(view));
  // The human owns who reads — named, or handed to chance. Which barrier they
  // get is never on this screen: the app owns that.
  node.querySelector('[data-act="start"]')?.addEventListener("click", () =>
    transport?.send({ type: "START_SESSION" })
  );
  node.querySelector('[data-act="draw"]')?.addEventListener("click", () =>
    transport?.send({ type: "START_ROUND", random: true })
  );
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
        transport?.send({ type: "START_ROUND", readerIndex: Number(btn.dataset.i) });
      })
    );
  } else {
    node.querySelectorAll(".roster-name").forEach((btn) => (btn.disabled = true));
  }
  stage.replaceChildren(node);
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
