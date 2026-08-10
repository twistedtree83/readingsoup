import { test, expect, describe } from "bun:test";
import { mangleTyped } from "../src/core/butterfingers.js";
import { CONFIG } from "../src/core/config.js";

const INTENDED = "the wombat requires a permit before crossing the footpath";

describe("butterfingers input mangling", () => {
  test("output is shorter than intended — keystrokes are dropped", () => {
    expect(mangleTyped(INTENDED, CONFIG, 5).length).toBeLessThan(INTENDED.length);
  });

  test("it mangles rather than deletes wholesale", () => {
    const out = mangleTyped(INTENDED, CONFIG, 5);
    expect(out.length).toBeGreaterThan(INTENDED.length * 0.5);
  });

  test("the result is deterministic for a seed", () => {
    expect(mangleTyped(INTENDED, CONFIG, 5)).toBe(mangleTyped(INTENDED, CONFIG, 5));
  });

  test("each keystroke's fate depends only on its index, so backspacing is stable", () => {
    // Removing a later character must not retroactively change earlier output.
    const full = mangleTyped(INTENDED, CONFIG, 5);
    const shorter = mangleTyped(INTENDED.slice(0, 20), CONFIG, 5);
    expect(full.startsWith(shorter.slice(0, 10))).toBe(true);
  });

  test("drop and transposition rates are tuning constants", () => {
    const brutal = structuredClone(CONFIG);
    brutal.butterfingers.dropRate = 0.8;
    expect(mangleTyped(INTENDED, brutal, 5).length).toBeLessThan(
      mangleTyped(INTENDED, CONFIG, 5).length
    );
  });

  test("a zero drop and zero transpose rate passes text through untouched", () => {
    const clean = structuredClone(CONFIG);
    clean.butterfingers.dropRate = 0;
    clean.butterfingers.transposeRate = 0;
    expect(mangleTyped(INTENDED, clean, 5)).toBe(INTENDED);
  });

  test("transposition actually reorders characters", () => {
    const swappy = structuredClone(CONFIG);
    swappy.butterfingers.dropRate = 0;
    swappy.butterfingers.transposeRate = 0.9;
    const out = mangleTyped(INTENDED, swappy, 5);
    expect(out).not.toBe(INTENDED);
    expect([...out].sort().join("")).toBe([...INTENDED].sort().join(""));
  });

  test("empty input yields empty output", () => {
    expect(mangleTyped("", CONFIG, 5)).toBe("");
  });
});
