// The phone. One thing on screen, one action, never two decisions at once.
//
// Holds no game logic: it drives a transport and renders whatever ClientView
// comes back. Solo runs the pure core in this browser; a room sends the same
// events to a server running the same core. The renderer cannot tell which.

import { configFromQuery } from "/src/core/config.js";
import { CARD_LABELS } from "/src/core/conditions.js";
import { loopback, socketTransport, storedToken } from "/src/client/transport.js";

const ME = "solo-participant";
const config = configFromQuery(location.search);
const app = document.getElementById("app");
const params = new URLSearchParams(location.search);

let transport = null;
let pendingRoom = params.get("room") ?? "";
// A stored token that the server does not recognise — a restarted server, or a
// new session — is not a resume. Until the person tells us who they are they
// belong in no room, so incoming views must not paint over the join screen and
// leave them sitting in a nameless lobby, invisible to the facilitator.
let awaitingJoin = false;

const el = (html) => {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
};
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const send = (event) => transport?.send(event);

// ------------------------------------------------------------------ screens

function landing() {
  const node = el(`
    <div>
      <p class="eyebrow">A reading game for staff</p>
      <div class="wordmark"><span class="under" aria-hidden="true">SOUP</span><span class="over">SOUP</span></div>
      <p class="lede">Six ways reading can go wrong, and the six things that fix them. Takes about five minutes on your own.</p>
      <div class="spacer"></div>
      <button class="btn btn-primary" data-act="solo">Try it yourself</button>
      <button class="btn btn-secondary" data-act="room">I have a room code</button>
      <p class="note">No sign-in, nothing saved, nothing timed.</p>
    </div>
  `);
  node.querySelector('[data-act="solo"]').addEventListener("click", startSolo);
  node.querySelector('[data-act="room"]').addEventListener("click", () => {
    pendingRoom = " ";
    app.replaceChildren(joinScreen());
  });
  return node;
}

function joinScreen() {
  // Both options are the same size, the same weight, and sit in the same stack.
  // Observing must never look like an accessibility setting.
  const node = el(`
    <div>
      <p class="eyebrow">${pendingRoom.trim() ? `ROOM ${esc(pendingRoom.trim())}` : "JOINING"}</p>
      <h1 class="display">What should we call you?</h1>
      <input class="namebox" type="text" maxlength="24" autocomplete="off" aria-label="Your name" placeholder="First name">
      <div class="spacer"></div>
      <button class="btn btn-primary" data-role="participant">Join the round</button>
      <button class="btn btn-secondary" data-role="observer">Observe instead</button>
      <p class="note">Observers get the cards and see everything. They are never given a passage and are never called on.</p>
    </div>
  `);
  const box = node.querySelector(".namebox");
  node.querySelectorAll("[data-role]").forEach((btn) =>
    btn.addEventListener("click", () => joinRoom(box.value.trim() || "Someone", btn.dataset.role))
  );
  return node;
}

function lobby(view) {
  return el(`
    <div>
      <p class="eyebrow">${view.roomCode ? `ROOM ${esc(view.roomCode)}` : "CONNECTED"}</p>
      <h1 class="display">You're in${view.name ? `, ${esc(view.name)}` : ""}.</h1>
      <p class="lede">Nothing to do yet. Keep your phone in your hand and watch the screen at the front.</p>
      <div class="spacer"></div>
      <div class="waiting-cards" aria-hidden="true"><i></i><i></i><i></i></div>
    </div>
  `);
}

function silent(view) {
  const secs = Math.ceil((view.remainingMs ?? 0) / 1000);
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  const span = (t) => {
    const shifted = t.offsetY || t.rotate;
    const style = shifted
      ? ` style="transform:translateY(${t.offsetY || 0}px) rotate(${t.rotate || 0}deg)"`
      : "";
    return `<span class="tok" data-id="${t.id}"${style}>${esc(t.text)}</span>`;
  };
  const tokens = view.tokens.map(span).join(view.render.wordGaps ? " " : "");

  return el(`
    <div>
      <p class="eyebrow">${
        view.observerCover ? "Read this, then look up" : "Read this to yourself"
      }<span class="pos">${clock}</span></p>
      <div class="passage" data-gaps="${view.render.wordGaps}"
           style="letter-spacing:${view.render.letterSpacing};
                  color:color-mix(in srgb, var(--ink) ${view.render.contrast * 100}%, var(--paper))">${tokens}</div>
      <p class="note">${
        view.observerCover
          ? "Then look up and watch the room. Everyone has the same forty words."
          : "Nobody is watching. Nothing is being timed."
      }</p>
    </div>
  `);
}

function watching(view) {
  // Inverted to ink so it reads as a DIFFERENT MODE, not a disabled screen.
  // Waiting is the task here, not an absence of one.
  return el(`
    <div class="inverted">
      <p class="eyebrow eyebrow-light">${esc(view.readerName ?? "Someone")} is reading</p>
      <h1 class="display">${view.finished ? "That's the round." : "Watch and listen."}</h1>
      <p class="lede">${
        view.finished
          ? "Look up at the screen — you're about to find out what it actually said."
          : "You can't see their screen. Listen to how they're going, not what they're saying."
      }</p>
      <div class="spacer"></div>
      <div class="waiting-cards" aria-hidden="true"><i></i><i></i><i></i></div>
    </div>
  `);
}

function typing(view) {
  const node = el(`
    <div>
      <p class="eyebrow">Type this out<span class="pos">${esc(view.position ?? "")}</span></p>
      <div class="prompt">${esc(view.prompt)}</div>
      <input class="typebox" type="text" autocomplete="off" autocapitalize="off"
             autocorrect="off" spellcheck="false" aria-label="Type the sentence">
      <p class="note">What is actually coming out:</p>
      <div class="output">${esc(view.output) || "&nbsp;"}</div>
      ${view.accommodated ? `<p class="helped">A colleague is typing for you now.</p>` : ""}
      <div class="hand">${hand(view)}</div>
      <div class="spacer"></div>
      <button class="btn btn-secondary" data-act="done">I've finished</button>
    </div>
  `);
  const box = node.querySelector(".typebox");
  box.value = view.intended;
  box.addEventListener("input", () => send({ type: "TYPE", intended: box.value }));
  wireRound(node);
  return node;
}

function reading(view) {
  // Join with a real separator rather than a CSS pseudo-element, so the DOM
  // matches what the eye sees — copy/paste and assistive tech included.
  const span = (t) => {
    const shifted = t.offsetY || t.rotate;
    const style = shifted
      ? ` style="transform:translateY(${t.offsetY || 0}px) rotate(${t.rotate || 0}deg)"`
      : "";
    return `<span class="tok" data-id="${t.id}"${style}>${esc(t.text)}</span>`;
  };
  const sep = view.render.wordGaps ? " " : "";
  const size = view.render.chunkSize;
  const tokens = size
    ? Array.from({ length: Math.ceil(view.tokens.length / size) }, (_, c) =>
        `<span class="chunk">${view.tokens.slice(c * size, c * size + size).map(span).join(sep)}</span>`
      ).join("")
    : view.tokens.map(span).join(sep);

  const node = el(`
    <div>
      <p class="eyebrow">Read this out loud<span class="pos">${esc(view.position ?? "")}</span></p>
      <div class="passage" data-gaps="${view.render.wordGaps}"
           style="letter-spacing:${view.render.letterSpacing};
                  color:color-mix(in srgb, var(--ink) ${view.render.contrast * 100}%, var(--paper))">${tokens}</div>
      ${view.accommodated ? `<p class="helped">That helped. Finish the sentence and move on.</p>` : ""}
      ${view.hand?.length ? `<p class="note">Which of these would make this easier?</p>` : ""}
      <div class="hand">${hand(view)}</div>
      <div class="spacer"></div>
      <button class="btn btn-secondary" data-act="done">I've finished reading</button>
    </div>
  `);
  wireRound(node);
  return node;
}

const hand = (view) =>
  (view.hand ?? [])
    .map((c) => `<button class="card" data-card="${c}">${esc(CARD_LABELS[c])}</button>`)
    .join("");

function wireRound(node) {
  node.querySelectorAll(".card").forEach((btn) =>
    btn.addEventListener("click", () => send({ type: "PLAY_CARD", card: btn.dataset.card }))
  );
  node.querySelector('[data-act="done"]')?.addEventListener("click", () => send({ type: "DONE" }));
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
            <span class="cat-name">${esc(c.label)}</span>
            ${c.had ? `<span class="cat-badge">you had this</span>` : ""}
          </div>
          <p class="cat-desc">${esc(c.description)}</p>
          <div class="cat-card" data-card="${c.card}">${esc(c.cardLabel)}</div>
        </div>`
        )
        .join("")}
      <p class="note">Nothing here was recorded. Nothing was timed.</p>
      ${transport?.kind === "loopback" ? `<button class="btn btn-primary" data-act="again">Start again</button>` : ""}
    </div>
  `);
  node.querySelector('[data-act="again"]')?.addEventListener("click", startSolo);
  return node;
}

// ------------------------------------------------------------- the vanishing

// The core says when each word expires; the client removes the node. Never
// opacity — the word has to actually be gone.
let expiryTimers = [];

function scheduleExpiries(view) {
  expiryTimers.forEach(clearTimeout);
  expiryTimers = [];
  for (const t of view.tokens ?? []) {
    if (typeof t.expiresInMs !== "number") continue;
    expiryTimers.push(
      setTimeout(() => app.querySelector(`.tok[data-id="${t.id}"]`)?.remove(), t.expiresInMs)
    );
  }
}

// ------------------------------------------------------------------- driving

function render(view) {
  if (awaitingJoin) return;
  app.replaceChildren(
    view.phase === "lobby" ? lobby(view) :
    view.phase === "catalogue" ? catalogue(view) :
    view.phase === "silent" ? silent(view) :
    view.kind === "typing" ? typing(view) :
    view.watching ? watching(view) :
    view.tokens ? reading(view) :
    lobby(view)
  );
  scheduleExpiries(view);
  const box = app.querySelector(".typebox");
  if (box) {
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
  }
}

function startSolo() {
  transport = loopback(config, { participantId: ME, onView: render });
  transport.send({ type: "START_SOLO", seed: Math.floor(Math.random() * 1e9) });
}

async function joinRoom(name, role) {
  app.replaceChildren(el(`<div><p class="eyebrow">Connecting…</p></div>`));
  try {
    transport = await socketTransport({
      url: params.get("server") ?? undefined,
      name,
      role,
      onView: render,
      onIdentity: (id) => {
        if (!name && id && !id.known) {
          awaitingJoin = true;
          app.replaceChildren(joinScreen());
        } else {
          awaitingJoin = false;
        }
      },
    });
  } catch {
    app.replaceChildren(
      el(`<div>
            <p class="eyebrow">No room found</p>
            <h1 class="display">That room isn't running.</h1>
            <p class="lede">The facilitator's screen needs to be open. You can still take the tour on your own.</p>
            <div class="spacer"></div>
            <button class="btn btn-primary" data-act="solo">Try it yourself</button>
          </div>`)
    );
    app.querySelector('[data-act="solo"]').addEventListener("click", startSolo);
  }
}

// A phone that already holds a token resumes silently. This is not an edge
// case: iOS locks at thirty seconds and suspends the socket, so a participant
// returns to this page repeatedly during a single session and must never be
// dropped back to a name prompt in front of the room.
if (storedToken("player")) {
  app.replaceChildren(el(`<div><p class="eyebrow">Reconnecting…</p></div>`));
  joinRoom(null, null);
} else {
  // A scanned QR lands straight on the join screen; everyone else sees the
  // front door, because most people arrive alone.
  app.replaceChildren(pendingRoom ? joinScreen() : landing());
}
