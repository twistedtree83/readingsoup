import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor } from "../src/core/view.js";
import { CONDITIONS } from "../src/core/conditions.js";
import { CONFIG } from "../src/core/config.js";

const room = (n, observerEvery = 4) => {
  let s = reduce(initialState(), { type: "OPEN_ROOM", roomCode: "4417", token: "host", at: 0, seed: 7 }, CONFIG).state;
  for (let i = 0; i < n; i++) {
    s = reduce(s, {
      type: "JOIN", token: `p${i}`, name: `P${i}`,
      role: i % observerEvery === 1 ? "observer" : "participant", at: 1,
    }, CONFIG).state;
  }
  return s;
};
const startSilent = (s, at = 100) => reduce(s, { type: "START_SILENT", at }, CONFIG).state;
const actives = (s) => Object.values(s.participants).filter((p) => p.role === "participant");
const observers = (s) => Object.values(s.participants).filter((p) => p.role === "observer");

describe("the silent round", () => {
  test("every active participant gets a condition at the same moment", () => {
    const s = startSilent(room(8));
    for (const p of actives(s)) expect(s.silent.assigned[p.token]).toBeTruthy();
  });

  test("THE WHOLE ROOM READS THE SAME FORTY WORDS", () => {
    // Identical text, different reasons it is hard. That is what isolates the
    // variable and gives the facilitator the strongest line in the activity.
    const s = startSilent(room(20));
    const ids = new Set();
    for (const p of [...actives(s), ...observers(s)]) {
      const v = viewFor(s, p.token);
      ids.add(v.passageId);
    }
    expect(ids.size).toBe(1);
  });

  test("observers are never assigned a condition", () => {
    const s = startSilent(room(12));
    for (const p of observers(s)) expect(s.silent.assigned[p.token]).toBeUndefined();
  });

  test("observers get the passage rendered CLEAN, as cover", () => {
    // Head down over a phone, physically indistinguishable from everyone else.
    // An observer with nothing to do discloses through body language what the
    // app is carefully keeping private.
    const s = startSilent(room(12));
    const o = observers(s)[0];
    const v = viewFor(s, o.token);
    expect(v.tokens.length).toBeGreaterThan(0);
    expect(v.render.wordGaps).toBe(true);
    expect(v.render.contrast).toBe(1);
    expect(v.observerCover).toBe(true);
  });

  test("Butterfingers never appears — it is meaningless done silently", () => {
    for (let seed = 1; seed <= 25; seed++) {
      let s = reduce(initialState(), { type: "OPEN_ROOM", roomCode: "1", token: "host", at: 0, seed }, CONFIG).state;
      for (let i = 0; i < 12; i++) s = reduce(s, { type: "JOIN", token: `p${i}`, name: `P${i}`, role: "participant", at: 1 }, CONFIG).state;
      s = startSilent(s);
      expect(Object.values(s.silent.assigned)).not.toContain(CONDITIONS.BUTTERFINGERS);
    }
  });

  test("conditions are spread as evenly as the deck allows", () => {
    const s = startSilent(room(20, 99));
    const counts = {};
    for (const c of Object.values(s.silent.assigned)) counts[c] = (counts[c] ?? 0) + 1;
    const values = Object.values(counts);
    expect(Object.keys(counts).length).toBe(5); // all five reading conditions
    expect(Math.max(...values) - Math.min(...values)).toBeLessThanOrEqual(1);
  });

  test("no turn announcement, and no per-person timing anywhere", () => {
    const s = startSilent(room(8));
    for (const p of [...actives(s), ...observers(s)]) {
      const v = JSON.stringify(viewFor(s, p.token));
      expect(v).not.toContain("readerName");
      for (const banned of ["elapsed", "score", "rank", "startedAt", "finishedAt"]) {
        expect(v.toLowerCase()).not.toContain(banned.toLowerCase());
      }
    }
  });

  test("the host sees a countdown and nothing else", () => {
    const s = startSilent(room(8));
    const v = viewFor(s, "host");
    expect(v.phase).toBe("silent");
    expect(typeof v.remainingMs).toBe("number");
    expect(v.roster).toBeUndefined();
    expect(v.tokens).toBeUndefined();
  });

  test("the countdown runs down on ticks and time is never read inside the core", () => {
    let s = startSilent(room(4), 1000);
    const first = viewFor(s, "host").remainingMs;
    s = reduce(s, { type: "TICK", at: 1000 + 30_000 }, CONFIG).state;
    expect(viewFor(s, "host").remainingMs).toBe(first - 30_000);
  });

  test("it ends when the clock runs out", () => {
    let s = startSilent(room(4), 1000);
    s = reduce(s, { type: "TICK", at: 1000 + CONFIG.round.silentRoundMs + 1 }, CONFIG).state;
    expect(viewFor(s, "host").remainingMs).toBe(0);
    expect(s.silent.finished).toBe(true);
  });

  test("the facilitator can set the duration", () => {
    const s = reduce(room(4), { type: "START_SILENT", at: 0, durationMs: 45_000 }, CONFIG).state;
    expect(viewFor(s, "host").remainingMs).toBe(45_000);
  });

  test("everybody who was active has now met a barrier, whatever happens next", () => {
    const s = startSilent(room(20));
    expect(Object.keys(s.silent.assigned).length).toBe(actives(s).length);
    for (const p of actives(s)) expect(s.participants[p.token].seen).toContain(s.silent.assigned[p.token]);
  });
});
