// One core, two transports.
//
// Solo runs the pure core in the browser behind a loopback; multiplayer sends
// the same events to a server that runs the same core. The renderer cannot tell
// the difference — it receives a ClientView either way and holds no game state.

import { initialState, reduce } from "/src/core/session.js";
import { viewFor } from "/src/core/view.js";

export function loopback(config, { participantId, onView }) {
  let state = initialState();
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const emit = () => onView(viewFor(state, participantId));

  return {
    kind: "loopback",
    send(event) {
      state = reduce(
        state,
        { ...event, participantId, at: performance.now(), reducedMotion },
        config
      ).state;
      emit();
    },
    start: emit,
  };
}

// Namespaced per surface. A facilitator may legitimately run the projector and
// their own phone view side by side on one device — the PRD requires it for
// small groups — and both tabs share localStorage. One key would mean the phone
// presenting the host's token and being reconnected as the host.
const KEY = (intent) => (intent === "host" ? "soup.token.host" : "soup.token.player");

const DEFAULT_URL = () => globalThis.__SOUP_SERVER__ ?? "";

// The token is minted and persisted BEFORE the first connect, not on the way
// back from the server. `hello` fires on every `connect`, so a socket that
// reconnects before the first identity arrives would otherwise send a second
// null token and join the room twice — one person, two names on the projector.
// Establishing identity client-side makes every hello idempotent.
function ensureToken(key) {
  let token = localStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(key, token);
  }
  return token;
}

export async function socketTransport({ url, intent, name, role, onView, onIdentity, onError }) {
  url = url || DEFAULT_URL();
  const tokenKey = KEY(intent);
  const myToken = ensureToken(tokenKey);
  // The client library is served by the game server itself, never a CDN — and
  // it is only ever loaded when someone actually joins a room, so the static
  // site keeps working with no server at all.
  await import(`${url}/socket.io/socket.io.js`);
  const socket = window.io(url || undefined, { transports: ["websocket", "polling"] });

  socket.on("view", onView);
  socket.on("identity", (id) => {
    // Identity is a token in localStorage, never the socket id. Phones lock
    // during every round and the socket churns; the participant does not.
    if (id?.token) localStorage.setItem(tokenKey, id.token);
    onIdentity?.(id);
  });

  const hello = () => socket.emit("hello", { token: myToken, intent, name, role });

  socket.on("connect_error", () => onError?.());

  socket.on("connect", hello);

  return {
    kind: "socket",
    send: (event) => socket.emit("event", event),
    start: () => {},
  };
}

export const storedToken = (intent) => localStorage.getItem(KEY(intent));
