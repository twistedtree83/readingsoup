// Thin shell. Holds no game logic: it drives the pure core through events and
// renders whatever ClientView comes back.
//
// Solo runs the same core in the browser behind a loopback transport — not a
// second implementation. Multiplayer swaps this transport for a socket.

import { initialState, reduce } from "/src/core/session.js";
import { viewFor } from "/src/core/view.js";
import { configFromQuery } from "/src/core/config.js";
import { CARD_LABELS } from "/src/core/conditions.js";

const ME = "solo-participant";
const config = configFromQuery(location.search);
const app = document.getElementById("app");

let state = initialState();

function send(event) {
  const result = reduce(state, { ...event, participantId: ME, at: performance.now() }, config);
  state = result.state;
  render();
}

const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};

function landing() {
  const node = el(`
    <div>
      <p class="eyebrow">A reading game for staff</p>
      <div class="wordmark"><span class="under" aria-hidden="true">SOUP</span><span class="over">SOUP</span></div>
      <p class="lede">Six ways reading can go wrong, and the six things that fix them. Takes about five minutes on your own.</p>
      <div class="spacer"></div>
      <button class="btn btn-primary" data-act="solo">Try it yourself</button>
      <p class="note">No sign-in, nothing saved, nothing timed.</p>
    </div>
  `);
  node.querySelector('[data-act="solo"]').addEventListener("click", () => send({ type: "START_SOLO" }));
  return node;
}

function reading(view) {
  // Join with a real separator rather than a CSS pseudo-element, so what the
  // DOM says matches what the eye sees — copy/paste and assistive tech included.
  const tokens = view.tokens
    .map((t) => `<span class="tok">${escapeHtml(t.text)}</span>`)
    .join(view.render.wordGaps ? " " : "");

  const node = el(`
    <div>
      <p class="eyebrow">Read this out loud</p>
      <div class="passage" data-gaps="${view.render.wordGaps}"
           style="letter-spacing:${view.render.letterSpacing}">${tokens}</div>
      ${view.accommodated ? `<p class="helped">That helped. Finish the sentence and move on.</p>` : ""}
      <p class="note">Which of these would make this easier?</p>
      <div class="hand">
        ${view.hand.map((c) => `<button class="card" data-card="${c}">${escapeHtml(CARD_LABELS[c])}</button>`).join("")}
      </div>
      <div class="spacer"></div>
      <button class="btn btn-secondary" data-act="done">I've finished reading</button>
    </div>
  `);

  node.querySelectorAll(".card").forEach((btn) =>
    btn.addEventListener("click", () => send({ type: "PLAY_CARD", card: btn.dataset.card }))
  );
  node.querySelector('[data-act="done"]').addEventListener("click", () => send({ type: "DONE" }));
  return node;
}

function catalogue(view) {
  return el(`
    <div>
      <p class="eyebrow">What you can do on Monday</p>
      <h1 class="display">Six things that help.</h1>
      ${Object.entries(view.cardLabels)
        .map(([, label]) => `<div class="catalogue-item">${escapeHtml(label)}</div>`)
        .join("")}
      <p class="note">The rest of the barriers arrive as the build continues.</p>
    </div>
  `);
}

function render() {
  const view = viewFor(state, ME);
  app.replaceChildren(
    view.phase === "landing" ? landing() :
    view.phase === "catalogue" ? catalogue(view) :
    reading(view)
  );
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

render();
