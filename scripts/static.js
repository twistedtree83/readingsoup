// Local dev server for the static half. The real server (S10) will serve these
// same files alongside Socket.IO; this exists so solo mode can be run without it.

import { fileURLToPath } from "node:url";

const PORT = Number(process.env.PORT ?? 8765);
// fileURLToPath, not URL.pathname — the repo path may contain spaces, which
// pathname percent-encodes and Bun.file then fails to resolve.
const ROOT = fileURLToPath(new URL("..", import.meta.url));

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname === "/" ? "/index.html" : url.pathname;
    if (path.includes("..")) return new Response("no", { status: 400 });
    const file = Bun.file(ROOT + path.slice(1));
    if (await file.exists()) return new Response(file);
    return new Response(Bun.file(ROOT + "index.html"));
  },
});

console.log(`soup static  http://localhost:${PORT}`);
