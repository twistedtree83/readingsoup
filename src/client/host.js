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
        <button class="host-link" data-act="silent">Start — everyone at once</button>
        ${over ? "" : `<button class="host-link" data-act="draw">Draw at random</button>`}
        ${plan(spot)}
      </div>
      <div class="lobby-right">
        <div class="qr"><img src="/qr.svg" alt="QR code to join" width="380" height="380"></div>
      </div>
    </section>
    `);
}

// The count is set against a live estimate, because the facilitator is planning
// against a slot on a timetable, not against a number of rounds.
function plan(spot) {
  if (!spot.options) return "";
  if (spot.ended || spot.done >= spot.max) {
    return `<p class="plan-note">Spotlights finished — ${spot.done} of them.</p>`;
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
  return el(`
    <section class="slide slide-turn">
      <p class="turn-lead">${
        spot.planned ? `Spotlight ${spot.index} of ${spot.planned}` : "Reading next"
      }</p>
      <div class="turn-name">
        <span class="under" aria-hidden="true">${esc(view.readerName ?? "")}</span>
        <span class="over">${esc(view.readerName ?? "")}</span>
      </div>
      <p class="turn-foot">Everyone else: cards down, ears open.</p>
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
    stage.replaceChildren(view.finished ? cleanPassage(view) : announce(view));
    return;
  }

  const node = lobby(view);
  const left = node.querySelector(".lobby-left");
  left.insertAdjacentHTML("beforeend", roster(view));
  // The human owns who reads — named, or handed to chance. Which barrier they
  // get is never on this screen: the app owns that.
  node.querySelector('[data-act="silent"]')?.addEventListener("click", () =>
    transport?.send({ type: "START_SILENT" })
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
  if (!(spot.ended || spot.done >= spot.max)) {
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
