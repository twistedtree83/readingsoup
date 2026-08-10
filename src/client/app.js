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

const REDUCED_MOTION = matchMedia("(prefers-reduced-motion: reduce)").matches;

function send(event) {
  const result = reduce(
    state,
    { ...event, participantId: ME, at: performance.now(), reducedMotion: REDUCED_MOTION },
    config
  );
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
  node.querySelector('[data-act="solo"]').addEventListener("click", () => send({ type: "START_SOLO", seed: Math.floor(Math.random() * 1e9) }));
  return node;
}

function typing(view) {
  const node = el(`
    <div>
      <p class="eyebrow">Type this out<span class="pos">${view.position}</span></p>
      <div class="prompt">${escapeHtml(view.prompt)}</div>
      <input class="typebox" type="text" autocomplete="off" autocapitalize="off"
             autocorrect="off" spellcheck="false" aria-label="Type the sentence">
      <p class="note">What is actually coming out:</p>
      <div class="output">${escapeHtml(view.output) || "&nbsp;"}</div>
      ${view.accommodated ? `<p class="helped">A colleague is typing for you now.</p>` : ""}
      <div class="hand">
        ${view.hand.map((c) => `<button class="card" data-card="${c}">${escapeHtml(CARD_LABELS[c])}</button>`).join("")}
      </div>
      <div class="spacer"></div>
      <button class="btn btn-secondary" data-act="done">I've finished</button>
    </div>
  `);

  const box = node.querySelector(".typebox");
  box.value = view.intended;
  box.addEventListener("input", () => send({ type: "TYPE", intended: box.value }));
  node.querySelectorAll(".card").forEach((btn) =>
    btn.addEventListener("click", () => send({ type: "PLAY_CARD", card: btn.dataset.card }))
  );
  node.querySelector('[data-act="done"]').addEventListener("click", () => send({ type: "DONE" }));
  return node;
}

function reading(view) {
  // Join with a real separator rather than a CSS pseudo-element, so what the
  // DOM says matches what the eye sees — copy/paste and assistive tech included.
  const span = (t) => {
    const shifted = t.offsetY || t.rotate;
    const style = shifted
      ? ` style="transform:translateY(${t.offsetY || 0}px) rotate(${t.rotate || 0}deg)"`
      : "";
    return `<span class="tok" data-id="${t.id}"${style}>${escapeHtml(t.text)}</span>`;
  };
  const sep = view.render.wordGaps ? " " : "";

  // Chunk it delivers the passage in stable pieces rather than one block.
  const size = view.render.chunkSize;
  const tokens = size
    ? Array.from({ length: Math.ceil(view.tokens.length / size) }, (_, c) =>
        `<span class="chunk">${view.tokens.slice(c * size, c * size + size).map(span).join(sep)}</span>`
      ).join("")
    : view.tokens.map(span).join(sep);

  const node = el(`
    <div>
      <p class="eyebrow">Read this out loud<span class="pos">${view.position}</span></p>
      <div class="passage" data-gaps="${view.render.wordGaps}"
           style="letter-spacing:${view.render.letterSpacing};
                  color:color-mix(in srgb, var(--ink) ${view.render.contrast * 100}%, var(--paper))">${tokens}</div>
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
  const node = el(`
    <div>
      <p class="eyebrow">What you can do on Monday</p>
      <h1 class="display">Six barriers.<br>Six things that lift them.</h1>
      ${view.catalogue
        .map(
          (c) => `
        <div class="catalogue-item${c.had ? " had" : ""}">
          <div class="cat-head">
            <span class="cat-name">${escapeHtml(c.label)}</span>
            ${c.had ? `<span class="cat-badge">you had this</span>` : ""}
          </div>
          <p class="cat-desc">${escapeHtml(c.description)}</p>
          <div class="cat-card" data-card="${c.card}">${escapeHtml(c.cardLabel)}</div>
        </div>`
        )
        .join("")}
      <p class="note">Nothing here was recorded. Nothing was timed.</p>
      <button class="btn btn-primary" data-act="again">Start again</button>
    </div>
  `);
  node
    .querySelector('[data-act="again"]')
    .addEventListener("click", () => send({ type: "START_SOLO", seed: Math.floor(Math.random() * 1e9) }));
  return node;
}

// The Vanishing: the server (here, the core) says when each word expires; the
// client removes the node. Never opacity — the word has to actually be gone.
let expiryTimers = [];

function scheduleExpiries(view) {
  expiryTimers.forEach(clearTimeout);
  expiryTimers = [];
  if (!view.tokens) return;
  for (const t of view.tokens) {
    if (typeof t.expiresInMs !== "number") continue;
    expiryTimers.push(
      setTimeout(() => app.querySelector(`.tok[data-id="${t.id}"]`)?.remove(), t.expiresInMs)
    );
  }
}

function render() {
  const view = viewFor(state, ME);
  app.replaceChildren(
    view.phase === "landing" ? landing() :
    view.phase === "catalogue" ? catalogue(view) :
    view.kind === "typing" ? typing(view) :
    reading(view)
  );
  scheduleExpiries(view);
  const box = app.querySelector(".typebox");
  if (box) {
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

render();
