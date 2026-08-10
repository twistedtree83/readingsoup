import { test, expect, describe } from "bun:test";
import { rng } from "../src/core/random.js";

describe("seeded rng", () => {
  test("the same seed gives the same sequence", () => {
    const a = rng(42), b = rng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  test("different seeds diverge", () => {
    const a = rng(1), b = rng(2);
    expect(a()).not.toBe(b());
  });

  test("values sit in [0, 1)", () => {
    const r = rng(7);
    for (let i = 0; i < 500; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
