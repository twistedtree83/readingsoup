// Thin shell. Holds NO game logic: it translates socket events into reducer
// events, and reducer effects into emits. Everything interesting lives in the
// pure core, which is why a twenty-person session can be tested without a socket.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";

import { initialState, reduce } from "../core/session.js";
import { viewFor, rosterTokens, tagTokens } from "../core/view.js";
import { CONFIG } from "../core/config.js";
import { qrSvg, joinUrl } from "./qr.js";
import * as snapshot from "./snapshot.js";

const PORT = Number(process.env.PORT ?? 8787);
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
// The server cannot discover the hostname clients actually reach it on: it sits
// behind a platform proxy, and the join URL may point at the static site rather
// than here. Without PUBLIC_URL the QR would encode an unreachable address.
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://localhost:${PORT}`;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

// ---------------------------------------------------------------- room state

// A room that was live when the process died comes back. Reconnecting phones
// present the tokens they still hold and simply resume.
let state = snapshot.load() ?? initialState();
let roomCode = state.roomCode ?? "";

function openRoom(hostToken) {
  roomCode = String(Math.floor(1000 + Math.random() * 9000));
  const seed = Math.floor(Math.random() * 1e9);
  state = reduce(state, { type: "OPEN_ROOM", roomCode, token: hostToken, at: Date.now(), seed }, CONFIG).state;
  snapshot.save(state);
  return roomCode;
}

// Every socket carries its participant token. Identity is never the socket id:
// iOS locks phones at thirty seconds and suspends the connection, so sockets
// churn constantly while participants do not.
const socketsByToken = new Map();

function dispatch(event) {
  const { state: next, effects } = reduce(state, { ...event, at: Date.now() }, CONFIG);
  state = next;
  // The mirror is written before anything is sent, so what comes back after a
  // crash is at least as new as what the room last saw.
  if (state.hostToken) snapshot.save(state);
  else snapshot.clear();
  broadcast();
  // Effects are emitted by the core as data and performed here. Nothing uses
  // them yet, but dropping them silently would leave the round slices (S12+)
  // inheriting a shell that looks wired and is not.
  for (const effect of effects) io.emit("effect", effect);
  return effects;
}

function broadcast() {
  for (const [token, sockets] of socketsByToken) {
    const view = viewFor(state, token);
    for (const s of sockets) s.emit("view", view);
  }
}

// -------------------------------------------------------------- static files

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};

async function serveFile(res, path) {
  const body = await readFile(path);
  res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
  res.end(body);
}

const httpServer = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = decodeURIComponent(url.pathname);

    if (path === "/qr.svg") {
      res.writeHead(200, { "content-type": "image/svg+xml", "cache-control": "no-store" });
      return res.end(qrSvg(joinUrl(PUBLIC_URL, roomCode)));
    }

    const file =
      path === "/" ? "index.html" :
      path === "/host" ? "host.html" :
      normalize(path).replace(/^(\.\.[/\\])+/, "").replace(/^[/\\]+/, "");

    const full = join(ROOT, file);
    if (!full.startsWith(ROOT) || !existsSync(full)) {
      return serveFile(res, join(ROOT, "index.html"));
    }
    await serveFile(res, full);
  } catch {
    res.writeHead(500).end("server error");
  }
});

// ------------------------------------------------------------------- sockets

const io = new Server(httpServer, { cors: { origin: CORS_ORIGIN } });

io.on("connection", (socket) => {
  let token = null;

  const attach = (t) => {
    token = t;
    if (!socketsByToken.has(t)) socketsByToken.set(t, new Set());
    socketsByToken.get(t).add(socket);
  };

  // The client presents its stored token, or asks for one. It never restores
  // from its own memory — it sends the token and receives a complete view.
  socket.on("hello", ({ token: presented, intent, name, role } = {}) => {
    const known = presented && state.participants[presented];

    if (intent === "host") {
      const resumingHost = known && state.participants[presented].role === "host";
      // A room is live from the moment it is opened until the session ends —
      // NOT only while it sits in the lobby. Checking the phase meant a second
      // /host connection destroyed the room the instant a round started, which
      // is the worst possible moment: mid-activity, in front of everyone.
      const liveRoom = Boolean(state.hostToken);

      // A room is NEVER destroyed by someone arriving at /host. A facilitator
      // refreshing must not end the session, and a participant who wanders onto
      // the host URL must not wipe the room out from under everybody.
      //
      // A second browser gets its OWN host token and a read-only view of the
      // room, with an explicit way to take it: a facilitator with a laptop and
      // a phone must not end up driving the session from both at once.
      let hostToken;
      if (resumingHost) hostToken = presented;
      else if (liveRoom) {
        hostToken = randomUUID();
        dispatch({ type: "CLAIM_HOST", token: hostToken });
      } else {
        hostToken = randomUUID();
        openRoom(hostToken);
      }

      attach(hostToken);
      socket.emit("identity", { token: hostToken, roomCode, publicUrl: PUBLIC_URL, known: true });
      return broadcast();
    }

    // A stale or cross-surface token that belongs to the host is not identity
    // for a participant. Never hand over the room.
    const isHostToken = known && state.participants[presented].role === "host";
    const adoptable = known && !isHostToken;
    // Clients mint their own token before connecting, so honour it when it is
    // not the host's. That makes a repeated `hello` idempotent: JOIN is keyed
    // by token, so the same person cannot appear on the roster twice.
    const t = adoptable ? presented : presented && !isHostToken ? presented : randomUUID();
    attach(t);
    if (adoptable) dispatch({ type: "RECONNECT", token: t });
    else if (name) {
      // A late arrival gets a private catch-up round, which needs the clock.
      dispatch({ type: "JOIN", token: t, name, role });
      syncTicker();
    }
    // `known` lets the client tell a genuine resume from a stale token
    // pointing at a room that no longer exists.
    socket.emit("identity", { token: t, roomCode, known: Boolean(adoptable) });
    socket.emit("view", viewFor(state, t));
  });

  // Running the session is the facilitator's job. Listed rather than inferred:
  // a participant who could name themselves the next reader would be able to
  // put a colleague in the seat too.
  const HOST_ONLY = new Set([
    "START_SESSION",
    "START_SILENT",
    "END_SILENT",
    "START_ROUND",
    "END_ROUND",
    "SET_SPOTLIGHT_COUNT",
    "END_SPOTLIGHTS",
    "OVERRIDE",
    "START_REVEAL",
    "NEXT_PROMPT",
    "END_SESSION",
  ]);

  socket.on("event", (event = {}) => {
    if (!token) return;

    // Taking the room over is the one thing a read-only host may do.
    if (event.type === "TAKE_OVER") {
      if (state.participants[token]?.role !== "host") return;
      return void dispatch({ type: "TAKE_OVER", token });
    }

    if (HOST_ONLY.has(event.type)) {
      // Host ROLE is not enough: only the browser actually holding the room
      // drives it. The other one is watching.
      if (state.participants[token]?.role !== "host" || token !== state.hostToken) return;

      if (event.type === "END_SESSION") {
        // A fresh room, straight away, so the activity can run twice in a day.
        dispatch({ type: "END_SESSION", token });
        snapshot.clear();
        socketsByToken.clear();
        attach(token);
        openRoom(token);
        socket.emit("identity", { token, roomCode, publicUrl: PUBLIC_URL, known: true });
        return broadcast();
      }

      if (event.type === "START_ROUND") {
        // The host addresses participants by roster position. Resolving it here
        // keeps tokens off the projector entirely.
        const reader = event.random ? undefined : rosterTokens(state)[event.readerIndex];
        if (!event.random && !reader) return;
        dispatch({
          type: "START_ROUND",
          random: Boolean(event.random),
          reader,
          watchWindowMs: event.watchWindowMs,
        });
        return void syncTicker();
      }

      dispatch({ type: event.type, durationMs: event.durationMs, count: event.count });
      return void syncTicker();
    }

    // The reader picks a colleague by position in the list their own phone was
    // given, for the same reason the host does: a token is an auth credential,
    // and one on somebody else's phone would let them act as that person.
    if (event.type === "TAG_IN") {
      const to = tagTokens(state)[event.index];
      if (!to) return;
      return void dispatch({ type: "TAG_IN", token, to });
    }

    dispatch({ ...event, token, participantId: token });
  });

  socket.on("disconnect", () => {
    if (!token) return;
    const set = socketsByToken.get(token);
    set?.delete(socket);
    if (set && set.size === 0) {
      socketsByToken.delete(token);
      if (state.participants[token]?.role !== "host") dispatch({ type: "DISCONNECT", token });
    }
  });
});

// The core never reads a clock; the shell ticks it. Runs only while something
// is actually counting down — a silent round, or a spotlight's watch window —
// so an idle room costs nothing.
let ticker = null;
const counting = () =>
  (state.phase === "silent" && !state.silent?.finished) ||
  (state.phase === "round" && state.round?.locked === true) ||
  // A latecomer's private catch-up runs on its own clock, alongside whatever
  // the room is doing.
  Object.values(state.participants).some((p) => p.catchUp && !p.catchUp.finished);

function syncTicker() {
  if (counting() && !ticker) {
    // Twice a second while a window is open: a countdown that jumps two at a
    // time in front of a room reads as a broken clock.
    ticker = setInterval(() => {
      dispatch({ type: "TICK" });
      if (!counting()) syncTicker();
    }, 500);
  } else if (!counting() && ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

httpServer.listen(PORT, () => {
  // Room lifecycle only. No participant data is ever logged, to disk or stdout.
  console.log(`soup  http://localhost:${PORT}   host: ${PUBLIC_URL}/host`);
});
