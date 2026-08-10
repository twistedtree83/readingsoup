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
import { viewFor } from "../core/view.js";
import { CONFIG } from "../core/config.js";
import { qrSvg, joinUrl } from "./qr.js";

const PORT = Number(process.env.PORT ?? 8787);
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
// The server cannot discover the hostname clients actually reach it on: it sits
// behind a platform proxy, and the join URL may point at the static site rather
// than here. Without PUBLIC_URL the QR would encode an unreachable address.
const PUBLIC_URL = process.env.PUBLIC_URL ?? `http://localhost:${PORT}`;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? "*";

// ---------------------------------------------------------------- room state

let state = initialState();
let roomCode = "";

function openRoom(hostToken) {
  roomCode = String(Math.floor(1000 + Math.random() * 9000));
  const seed = Math.floor(Math.random() * 1e9);
  state = reduce(state, { type: "OPEN_ROOM", roomCode, token: hostToken, at: Date.now(), seed }, CONFIG).state;
  return roomCode;
}

// Every socket carries its participant token. Identity is never the socket id:
// iOS locks phones at thirty seconds and suspends the connection, so sockets
// churn constantly while participants do not.
const socketsByToken = new Map();

function dispatch(event) {
  const { state: next, effects } = reduce(state, { ...event, at: Date.now() }, CONFIG);
  state = next;
  broadcast();
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
      const liveRoom = state.phase === "lobby" && state.hostToken;

      // A room is NEVER destroyed by someone arriving at /host. A facilitator
      // refreshing must not end the session, and a participant who wanders onto
      // the host URL must not wipe the room out from under everybody.
      // (S22 adds the read-only second-host view and explicit takeover.)
      let hostToken;
      if (resumingHost) hostToken = presented;
      else if (liveRoom) hostToken = state.hostToken;
      else {
        hostToken = randomUUID();
        openRoom(hostToken);
      }

      attach(hostToken);
      socket.emit("identity", { token: hostToken, roomCode, publicUrl: PUBLIC_URL, known: true });
      return broadcast();
    }

    // A stale or cross-surface token that belongs to the host is not identity
    // for a participant. Mint a fresh one rather than handing over the room.
    const adoptable = known && state.participants[presented].role !== "host";
    const t = adoptable ? presented : randomUUID();
    attach(t);
    if (adoptable) dispatch({ type: "RECONNECT", token: t });
    else if (name) dispatch({ type: "JOIN", token: t, name, role });
    // `known` lets the client tell a genuine resume from a stale token
    // pointing at a room that no longer exists.
    socket.emit("identity", { token: t, roomCode, known: Boolean(adoptable) });
    socket.emit("view", viewFor(state, t));
  });

  socket.on("event", (event = {}) => {
    if (!token) return;
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

httpServer.listen(PORT, () => {
  // Room lifecycle only. No participant data is ever logged, to disk or stdout.
  console.log(`soup  http://localhost:${PORT}   host: ${PUBLIC_URL}/host`);
});
