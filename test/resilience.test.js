import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor } from "../src/core/view.js";
import { CONFIG } from "../src/core/config.js";

// The hour a term when this actually matters: a crash thirty minutes into a
// whole-staff session, a facilitator driving from two devices at once, and a
// second session after lunch.

const T0 = 10_000;
const step = (s, event, at = T0) => reduce(s, { at, ...event }, CONFIG).state;

function room(n = 8, { seed = 7 } = {}) {
  let s = step(initialState(), { type: "OPEN_ROOM", roomCode: "4417", token: "host", seed }, 0);
  for (let i = 0; i < n; i++) {
    s = step(s, { type: "JOIN", token: `p${i}`, name: `P${i}`, role: i % 4 === 1 ? "observer" : "participant" }, 0);
  }
  return s;
}

// A session that is genuinely mid-flight: silent round done, a spotlight open,
// a card spent, somebody late, somebody opted out.
function midSession() {
  let s = step(room(8), { type: "START_SESSION" });
  s = step(s, { type: "TICK" }, T0 + 95_000);
  s = step(s, { type: "END_SILENT" }, T0 + 96_000);
  s = step(s, { type: "JOIN", token: "late", name: "LATE", role: "participant" }, T0 + 97_000);
  s = step(s, { type: "OPT_OUT", token: "p2" }, T0 + 98_000);
  s = step(s, { type: "START_ROUND", random: true }, T0 + 100_000);
  const holder = Object.values(s.participants).find(
    (p) => p.token !== s.round.reader && (p.hand ?? []).length
  );
  return step(s, { type: "PLAY_CARD", token: holder.token, card: holder.hand[0] },
    T0 + 100_000 + CONFIG.round.watchWindowMs);
}

describe("the crash mat", () => {
  // The snapshot itself is a file on disk and is not unit-tested. What IS
  // testable, and what the whole mechanism rests on, is that room state
  // survives a round trip through JSON and goes on behaving identically.
  test("a mid-session room survives a round trip through JSON", () => {
    const live = midSession();
    const revived = JSON.parse(JSON.stringify(live));
    expect(revived).toEqual(live);
  });

  test("and goes on reducing identically afterwards", () => {
    const live = midSession();
    const revived = JSON.parse(JSON.stringify(live));

    const events = [
      { type: "DONE", token: live.round.reader, at: T0 + 200_000 },
      { type: "END_ROUND", at: T0 + 201_000 },
      { type: "START_ROUND", random: true, at: T0 + 202_000 },
      { type: "TICK", at: T0 + 230_000 },
      { type: "START_REVEAL", at: T0 + 300_000 },
    ];
    const play = (s) => events.reduce((acc, e) => reduce(acc, e, CONFIG).state, s);
    expect(play(revived)).toEqual(play(live));
  });

  test("every phone sees the same thing either side of it", () => {
    const live = midSession();
    const revived = JSON.parse(JSON.stringify(live));
    for (const token of [...Object.keys(live.participants), "stranger"]) {
      expect(JSON.stringify(viewFor(revived, token)), token).toBe(JSON.stringify(viewFor(live, token)));
    }
  });

  test("nothing in the room carries a clock reading or a duration anybody spent", () => {
    // Timings would be a leaderboard in waiting, and a snapshot is exactly
    // where one would quietly accumulate.
    const s = JSON.stringify(midSession());
    for (const tell of ["readTime", "elapsedFor", "finishedAt", "durationFor", "score", "ranking"]) {
      expect(s, `state carries ${tell}`).not.toContain(tell);
    }
  });
});

describe("one facilitator, however many browsers", () => {
  test("the first to claim it owns the room", () => {
    const s = step(room(), { type: "CLAIM_HOST", token: "laptop" });
    expect(s.hostToken).toBe("host");
    expect(viewFor(s, "host").readOnly).toBe(false);
  });

  test("a second gets a read-only view with an explicit way to take it", () => {
    const s = step(room(), { type: "CLAIM_HOST", token: "phone" });
    const v = viewFor(s, "phone");
    expect(v.role).toBe("host");
    expect(v.readOnly).toBe(true);
    expect(v.canTakeOver).toBe(true);
    // It still shows the room, so the facilitator can see what they would be
    // taking over before they take it.
    expect(v.roster.length).toBe(8);
  });

  test("taking over moves control, and the old one goes read-only", () => {
    let s = step(room(), { type: "CLAIM_HOST", token: "phone" });
    s = step(s, { type: "TAKE_OVER", token: "phone" });
    expect(s.hostToken).toBe("phone");
    expect(viewFor(s, "phone").readOnly).toBe(false);
    expect(viewFor(s, "host").readOnly).toBe(true);
    expect(viewFor(s, "host").canTakeOver).toBe(true);
  });

  test("a participant cannot claim or take the room", () => {
    let s = step(room(), { type: "TAKE_OVER", token: "p0" });
    expect(s.hostToken).toBe("host");
    expect(s.participants.p0.role).toBe("participant");
    s = step(s, { type: "CLAIM_HOST", token: "p0" });
    expect(s.participants.p0.role).toBe("participant");
    expect(s.hostToken).toBe("host");
  });

  test("neither host is ever on the roster", () => {
    const s = step(room(), { type: "CLAIM_HOST", token: "phone" });
    const names = viewFor(s, "host").roster.map((r) => r.name);
    expect(names.length).toBe(8);
    expect(JSON.stringify(viewFor(s, "host"))).not.toContain('"phone"');
  });

  test("claiming twice from the same browser is not two claims", () => {
    let s = step(room(), { type: "CLAIM_HOST", token: "phone" });
    s = step(s, { type: "CLAIM_HOST", token: "phone" });
    const hosts = Object.values(s.participants).filter((p) => p.role === "host");
    expect(hosts.length).toBe(2);
  });
});

describe("running it again after lunch", () => {
  test("ending a session clears the room out entirely", () => {
    const s = step(midSession(), { type: "END_SESSION" }, T0 + 500_000);
    expect(s.phase).toBe("landing");
    expect(s.participants).toEqual({});
    expect(s.round).toBeFalsy();
    expect(s.silent ?? null).toBeNull();
    expect(s.mode).toBeNull();
    expect(s.plan ?? null).toBeNull();
  });

  test("the old tokens are worth nothing afterwards", () => {
    const before = midSession();
    const after = step(before, { type: "END_SESSION" }, T0 + 500_000);
    for (const token of Object.keys(before.participants)) {
      expect(after.participants[token], token).toBeUndefined();
      // A stale token gets a view, not a crash and not somebody else's seat.
      const v = viewFor(after, token);
      expect(v.tokens, token).toBeUndefined();
      expect(v.role, token).toBe("spectator");
    }
  });

  test("a fresh room can be opened straight afterwards", () => {
    let s = step(midSession(), { type: "END_SESSION" }, T0 + 500_000);
    s = step(s, { type: "OPEN_ROOM", roomCode: "9182", token: "host2", seed: 11 }, T0 + 501_000);
    expect(s.phase).toBe("lobby");
    expect(s.roomCode).toBe("9182");
    expect(s.hostToken).toBe("host2");
    s = step(s, { type: "JOIN", token: "q0", name: "Q0", role: "participant" }, T0 + 502_000);
    expect(viewFor(s, "host2").roster.map((r) => r.name)).toEqual(["Q0"]);
  });

  test("nothing carries over — not the barriers met, not the passages used", () => {
    let s = step(midSession(), { type: "END_SESSION" }, T0 + 500_000);
    s = step(s, { type: "OPEN_ROOM", roomCode: "9182", token: "host2", seed: 11 }, T0 + 501_000);
    expect(s.usedPassages ?? []).toEqual([]);
    expect(s.spotlight ?? null).toBeNull();
    expect(s.silentPassageId ?? null).toBeNull();
  });

  test("only the facilitator holding the room can end it", () => {
    const live = step(room(), { type: "CLAIM_HOST", token: "phone" });
    expect(step(live, { type: "END_SESSION", token: "p0" }).phase).toBe("lobby");
  });
});
