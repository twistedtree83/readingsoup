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
      <div class="lobby-right">
        <div class="qr"><img src="/qr.svg" alt="QR code to join" width="380" height="380"></div>
      </div>
    </section>
    `);
}

function announce(view) {
  // Misregistration used once, on the name.
  return el(`
    <section class="slide slide-turn">
      <p class="turn-lead">Reading next</p>
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
      </div>
    </section>
  `);
  node.querySelector('[data-act="next"]').addEventListener("click", () =>
    transport?.send({ type: "END_ROUND" })
  );
  return node;
}

function roster(view) {
  if (!view.roster?.length) return "";
  // Names only. No roles, no counts split by role — this screen is projected to
  // the whole room, and anything role-shaped would disclose an opt-out to
  // everybody at once.
  return `<ul class="roster">${view.roster
    .map((r, i) => `<li><button class="roster-name${r.connected ? "" : " away"}" data-i="${i}">${esc(r.name)}</button></li>`)
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

  if (view.phase === "round") {
    stage.replaceChildren(view.finished ? cleanPassage(view) : announce(view));
    return;
  }

  const node = lobby(view);
  const left = node.querySelector(".lobby-left");
  left.insertAdjacentHTML("beforeend", roster(view));
  // The facilitator picks the person. Volunteers and the random draw are S14.
  node.querySelectorAll(".roster-name").forEach((btn) =>
    btn.addEventListener("click", () => {
      transport?.send({ type: "START_ROUND", readerIndex: Number(btn.dataset.i) });
    })
  );
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
