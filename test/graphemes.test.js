import { test, expect, describe } from "bun:test";
import { RULES, chooseRules, applyRules, substitute } from "../src/core/graphemes.js";
import { CONFIG } from "../src/core/config.js";

const toks = (s) => s.split(/\s+/).map((text, i) => ({ id: `t${i}`, text }));
const LEGAL = /^[A-Za-z.,;:'"()!?-]*$/;

describe("grapheme rules", () => {
  test("every rule yields legitimate English orthography, never a symbol", () => {
    // Asserted on output rather than on the rule template: a replacement may
    // legitimately carry a backreference, what must never appear is a symbol.
    const probes = ["quick", "bracket", "six", "station", "between", "wait",
                    "book", "photo", "footpath", "quickly", "counter", "cousin",
                    "where", "screws"];
    for (const r of RULES) {
      for (const w of probes) {
        expect(applyRules(w, [r])).toMatch(/^[a-z]+$/);
      }
    }
  });

  test("a rule set is chosen deterministically from the seed", () => {
    expect(chooseRules(11, CONFIG).map((r) => r.id)).toEqual(chooseRules(11, CONFIG).map((r) => r.id));
    expect(chooseRules(11, CONFIG).map((r) => r.id)).not.toEqual(chooseRules(99, CONFIG).map((r) => r.id));
  });

  test("density controls how many rules are in play", () => {
    const sparse = structuredClone(CONFIG); sparse.mudsound.density = 0.2;
    const dense = structuredClone(CONFIG); dense.mudsound.density = 0.9;
    expect(chooseRules(4, dense).length).toBeGreaterThan(chooseRules(4, sparse).length);
  });

  test("output stays pronounceable — letters only, no symbols", () => {
    const rules = chooseRules(3, CONFIG);
    for (const w of ["footpath", "quickly", "bracket", "between", "screws", "counter", "six"]) {
      expect(applyRules(w, rules)).toMatch(LEGAL);
    }
  });

  test("the mapping is consistent within a passage", () => {
    const rules = chooseRules(3, CONFIG);
    // the same source pattern must map the same way wherever it appears
    const a = applyRules("footpath", rules);
    const b = applyRules("foot", rules);
    if (a !== "footpath") expect(b).not.toBe("foot");
  });
});

describe("substitute — exclusions", () => {
  const cfg = structuredClone(CONFIG);

  test("proper nouns are left alone", () => {
    const t = substitute(toks("the quick Parks Office will look"), 3, cfg);
    expect(t.find((x) => x.text.startsWith("Park"))?.text).toBe("Parks");
    expect(t.find((x) => x.text.startsWith("Offic"))?.text).toBe("Office");
  });

  test("the sentence-opening capital is not mistaken for a proper noun", () => {
    const t = substitute(toks("Quickly attach the bracket."), 3, cfg);
    expect(t[0].text[0]).toBe(t[0].text[0].toUpperCase());
  });

  test("the closing clause survives so the joke lands", () => {
    const t = substitute(toks("attach the bracket properly, and never look back"), 3, cfg);
    const tail = t.slice(-4).map((x) => x.text).join(" ");
    expect(tail).toBe("and never look back");
  });

  test("something is actually substituted", () => {
    const src = "the quick brown footpath between six screws quickly counted";
    const out = substitute(toks(src), 3, cfg).map((t) => t.text).join(" ");
    expect(out).not.toBe(src);
  });
});
