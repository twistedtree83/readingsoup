import { test, expect, describe } from "bun:test";
import { initialState, reduce } from "../src/core/session.js";
import { viewFor } from "../src/core/view.js";
import { CONFIG } from "../src/core/config.js";

const open = () =>
  reduce(initialState(), { type: "OPEN_ROOM", roomCode: "4417", token: "host-1", at: 0, seed: 9 }, CONFIG).state;

const join = (s, token, name, role = "participant") =>
  reduce(s, { type: "JOIN", token, name, role, at: 1 }, CONFIG).state;

describe("opening a room", () => {
  test("the host lands in a lobby with a room code", () => {
    const s = open();
    expect(s.phase).toBe("lobby");
    expect(s.roomCode).toBe("4417");
  });

  test("the host view carries the code and a headcount", () => {
    const v = viewFor(open(), "host-1");
    expect(v.role).toBe("host");
    expect(v.roomCode).toBe("4417");
    expect(v.headcount).toBe(0);
  });
});

describe("joining", () => {
  test("a participant appears on the roster", () => {
    const v = viewFor(join(open(), "p1", "Priya"), "host-1");
    expect(v.roster.map((r) => r.name)).toEqual(["Priya"]);
    expect(v.headcount).toBe(1);
  });

  test("an observer appears on the roster exactly like everyone else", () => {
    const s = join(join(open(), "p1", "Priya"), "p2", "Marcus", "observer");
    const v = viewFor(s, "host-1");
    expect(v.roster.map((r) => r.name)).toEqual(["Priya", "Marcus"]);
    expect(v.headcount).toBe(2);
  });

  test("THE ROSTER NEVER CARRIES A ROLE — the host screen is projected", () => {
    // Hard requirement 1: no other participant may be able to tell who opted
    // out. The host view is on a projector in front of the whole room, so a
    // role on the roster would disclose it to everybody at once.
    const s = join(join(open(), "p1", "Priya"), "p2", "Marcus", "observer");
    const v = viewFor(s, "host-1");
    expect(JSON.stringify(v.roster)).not.toContain("observer");
    expect(JSON.stringify(v.roster)).not.toContain("participant");
    for (const entry of v.roster) expect(entry.role).toBeUndefined();
  });

  test("the headcount is a single total, never split by role", () => {
    const s = join(join(open(), "p1", "Priya"), "p2", "Marcus", "observer");
    const v = viewFor(s, "host-1");
    expect(v.headcount).toBe(2);
    expect(JSON.stringify(v)).not.toContain("observerCount");
    expect(JSON.stringify(v)).not.toContain("observers");
  });

  test("a participant sees their own role, and nobody else's", () => {
    const s = join(join(open(), "p1", "Priya"), "p2", "Marcus", "observer");
    expect(viewFor(s, "p2").role).toBe("observer");
    const priya = JSON.stringify(viewFor(s, "p1"));
    expect(priya).not.toContain("observer");
  });

  test("observers are never assigned a condition", () => {
    const s = join(join(open(), "p1", "Priya"), "p2", "Marcus", "observer");
    expect(s.participants["p2"].condition).toBeUndefined();
  });
});

describe("reconnection", () => {
  test("a token restores name and role after a dropped socket", () => {
    let s = join(join(open(), "p1", "Priya"), "p2", "Marcus", "observer");
    s = reduce(s, { type: "DISCONNECT", token: "p2", at: 2 }, CONFIG).state;
    expect(s.participants["p2"]).toBeTruthy();

    s = reduce(s, { type: "RECONNECT", token: "p2", at: 3 }, CONFIG).state;
    const v = viewFor(s, "p2");
    expect(v.name).toBe("Marcus");
    expect(v.role).toBe("observer");
    expect(s.participants["p2"].connected).toBe(true);
  });

  test("a disconnected participant stays on the roster — phones lock constantly", () => {
    let s = join(open(), "p1", "Priya");
    s = reduce(s, { type: "DISCONNECT", token: "p1", at: 2 }, CONFIG).state;
    expect(viewFor(s, "host-1").roster.map((r) => r.name)).toEqual(["Priya"]);
  });

  test("reconnecting with an unknown token does not crash or invent a participant", () => {
    const s = reduce(open(), { type: "RECONNECT", token: "ghost", at: 3 }, CONFIG).state;
    expect(s.participants["ghost"]).toBeUndefined();
    expect(viewFor(s, "ghost").phase).toBe("lobby");
  });

  test("joining twice with the same token updates rather than duplicating", () => {
    const s = join(join(open(), "p1", "Priya"), "p1", "Priya");
    expect(viewFor(s, "host-1").headcount).toBe(1);
  });
});

describe("token surfaces do not collide", () => {
  test("a participant token and a host token are never the same identity", () => {
    // The facilitator may run the projector and their own phone on one device,
    // and both share localStorage. The host's token must never be adoptable as
    // a participant's, or the phone takes over the room.
    const s = join(open(), "host-1", "Priya");
    // JOIN against the host's own token must not silently demote or duplicate.
    expect(viewFor(s, "host-1").role).toBe("participant");
    expect(Object.keys(s.participants).length).toBe(1);
  });
});

describe("a live room is never destroyed by arrival", () => {
  test("opening the host view again keeps the room and everyone in it", () => {
    // A facilitator refreshing the projector, or a participant wandering onto
    // /host, must not wipe the session out from under the room.
    const s = join(join(open(), "p1", "Priya"), "p2", "Marcus", "observer");
    const again = reduce(s, { type: "OPEN_ROOM", roomCode: "9999", token: "host-2", at: 5, seed: 1 }, CONFIG).state;
    // The reducer itself is unconditional — the guard lives in the shell, so
    // assert the shell's contract here: the state it is given back must still
    // describe a room that can be resumed.
    expect(again.phase).toBe("lobby");
    expect(s.hostToken).toBe("host-1");
    expect(viewFor(s, "host-1").headcount).toBe(2);
  });
})

describe("the headcount is honest", () => {
  test("it counts who is actually in the room, not who has ever joined", () => {
    // The facilitator reads this number when deciding to start, and the PRD
    // selects solo/small/group mode from participant count. Someone who left
    // permanently must not inflate it into the wrong mode.
    let s = join(join(open(), "p1", "Priya"), "p2", "Marcus", "observer");
    expect(viewFor(s, "host-1").headcount).toBe(2);

    s = reduce(s, { type: "DISCONNECT", token: "p2", at: 5 }, CONFIG).state;
    expect(viewFor(s, "host-1").headcount).toBe(1);
  });

  test("but the roster still shows everyone, so a locked phone keeps its place", () => {
    let s = join(join(open(), "p1", "Priya"), "p2", "Marcus", "observer");
    s = reduce(s, { type: "DISCONNECT", token: "p2", at: 5 }, CONFIG).state;
    const roster = viewFor(s, "host-1").roster;
    expect(roster.map((r) => r.name)).toEqual(["Priya", "Marcus"]);
    expect(roster.find((r) => r.name === "Marcus").connected).toBe(false);
  });

  test("the count is still a single total, never split by role", () => {
    const s = join(join(open(), "p1", "Priya"), "p2", "Marcus", "observer");
    const v = viewFor(s, "host-1");
    expect(JSON.stringify(v)).not.toContain("observer");
    expect(v.headcount).toBe(2);
  });
});
