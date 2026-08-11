// A crash mat, not a database.
//
// Room state lives in memory. This mirrors it to one JSON file on every change
// and reads it back on boot, so an unhandled exception thirty minutes into a
// whole-staff session does not lose everything irrecoverably, in front of
// everyone. The file is deleted when the session ends.
//
// It is NOT persistence between sessions and NOT a log: it is overwritten, never
// appended, and it holds only what the room currently is. Nothing is derived,
// accumulated, or kept once the session is over.

import { writeFileSync, readFileSync, existsSync, unlinkSync, renameSync } from "node:fs";
import { dirname } from "node:path";
import { mkdirSync } from "node:fs";

const PATH = process.env.SOUP_SNAPSHOT ?? "/tmp/soup-snapshot.json";

// Written to a sibling and renamed, so a crash mid-write leaves the previous
// snapshot intact rather than half a file that will not parse on boot.
export function save(state) {
  try {
    mkdirSync(dirname(PATH), { recursive: true });
    const tmp = `${PATH}.writing`;
    writeFileSync(tmp, JSON.stringify(state));
    renameSync(tmp, PATH);
  } catch {
    // A room that cannot write its crash mat still runs. Failing the session
    // over the safety net would be the net causing the fall.
  }
}

export function load() {
  try {
    if (!existsSync(PATH)) return null;
    const state = JSON.parse(readFileSync(PATH, "utf8"));
    // A snapshot of a room nobody was in is worse than none: it would restore a
    // stale code onto the projector.
    return state && state.hostToken ? state : null;
  } catch {
    return null;
  }
}

export function clear() {
  try {
    if (existsSync(PATH)) unlinkSync(PATH);
  } catch {
    // Nothing to do. The next session overwrites it anyway.
  }
}

export const snapshotPath = () => PATH;
