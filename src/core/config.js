// Every tuning constant lives here so difficulty can be adjusted between
// sessions without hunting through the codebase.
//
// Calibrate against the absurd passages themselves, never against ordinary
// prose. Deadpan absurdity removes contextual prediction, so these passages are
// already harder than normal text before any mangling is applied.
// Target: roughly 3-4x normal reading time. Hard but finishable.

export const CONFIG = {
  soup: {
    letterSpacing: "-0.03em",
    wordGaps: false,
  },
  round: {
    watchWindowMs: 25_000,
    playsPerRound: 3,
    silentRoundMs: 90_000,
  },
  spotlight: {
    maxRounds: 8,
  },
  motion: {
    respectReducedMotion: true,
  },
};

// Solo mode is the calibration rig, so constants are overridable there.
export function configFromQuery(search, base = CONFIG) {
  const params = new URLSearchParams(search || "");
  const merged = structuredClone(base);
  for (const [key, value] of params) {
    const path = key.split(".");
    if (path.length !== 2) continue;
    const [group, name] = path;
    if (!(group in merged) || !(name in merged[group])) continue;
    const current = merged[group][name];
    merged[group][name] =
      typeof current === "number" ? Number(value) :
      typeof current === "boolean" ? value === "true" : value;
  }
  return merged;
}
