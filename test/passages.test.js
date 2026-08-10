import { test, expect, describe } from "bun:test";
import { PASSAGES, DICTATION, BANDS, pick, pickDictation } from "../src/core/passages.js";

const words = (t) => t.split(/\s+/).filter(Boolean);
const BANNED = /\b(child|children|pupil|student|school|teacher|classroom|dyslex|disabilit|disabled|assessment|diagnos|special needs|autis)/i;

describe("the passage library", () => {
  test("there are twenty reading passages and ten dictation prompts", () => {
    expect(PASSAGES.length).toBe(20);
    expect(DICTATION.length).toBe(10);
  });

  test("every id is unique", () => {
    expect(new Set(PASSAGES.map((p) => p.id)).size).toBe(20);
    expect(new Set(DICTATION.map((d) => d.id)).size).toBe(10);
  });

  test("short-band passages are short enough that a wall of unspaced text is survivable", () => {
    for (const p of PASSAGES.filter((p) => p.band === BANDS.SHORT)) {
      expect(words(p.text).length).toBeGreaterThanOrEqual(28);
      expect(words(p.text).length).toBeLessThanOrEqual(38);
    }
  });

  test("full-band passages sit in the 38-52 word range", () => {
    for (const p of PASSAGES.filter((p) => p.band === BANDS.FULL)) {
      expect(words(p.text).length).toBeGreaterThanOrEqual(38);
      expect(words(p.text).length).toBeLessThanOrEqual(52);
    }
  });

  test("both bands are well populated, so no condition runs out", () => {
    expect(PASSAGES.filter((p) => p.band === BANDS.SHORT).length).toBeGreaterThanOrEqual(8);
    expect(PASSAGES.filter((p) => p.band === BANDS.FULL).length).toBeGreaterThanOrEqual(8);
  });

  test("dictation prompts are 8-16 words — a typing task needs a different shape", () => {
    for (const d of DICTATION) {
      expect(words(d.text).length).toBeGreaterThanOrEqual(8);
      expect(words(d.text).length).toBeLessThanOrEqual(16);
    }
  });

  test("nothing references children, schools, disability or assessment", () => {
    for (const item of [...PASSAGES, ...DICTATION]) {
      expect(item.text).not.toMatch(BANNED);
    }
  });

  test("vocabulary stays everyday — difficulty comes from the mangling", () => {
    for (const item of [...PASSAGES, ...DICTATION]) {
      for (const w of words(item.text)) {
        expect(w.replace(/[^A-Za-z]/g, "").length).toBeLessThanOrEqual(13);
      }
    }
  });

  test("every passage ends on a full stop, so the payoff has landed", () => {
    for (const item of [...PASSAGES, ...DICTATION]) expect(item.text.trim()).toMatch(/[.!?]$/);
  });
});

describe("selection", () => {
  test("a passage is never repeated within a session", () => {
    const used = [];
    for (let i = 0; i < PASSAGES.length; i++) {
      const p = pick(BANDS.FULL, used, i * 31);
      expect(used).not.toContain(p.id);
      used.push(p.id);
    }
  });

  test("selection respects the band while any remain unused", () => {
    expect(pick(BANDS.SHORT, [], 5).band).toBe(BANDS.SHORT);
    expect(pick(BANDS.FULL, [], 5).band).toBe(BANDS.FULL);
  });

  test("different seeds pick different passages, so sessions vary", () => {
    const picks = new Set([1, 2, 3, 4, 5, 6].map((s) => pick(BANDS.FULL, [], s).id));
    expect(picks.size).toBeGreaterThan(1);
  });

  test("dictation prompts never repeat within a session", () => {
    const used = [];
    for (let i = 0; i < DICTATION.length; i++) {
      const d = pickDictation(used, i * 17);
      expect(used).not.toContain(d.id);
      used.push(d.id);
    }
  });

  test("running out falls back rather than returning nothing", () => {
    expect(pick(BANDS.FULL, PASSAGES.map((p) => p.id), 1)).toBeTruthy();
    expect(pickDictation(DICTATION.map((d) => d.id), 1)).toBeTruthy();
  });
});
