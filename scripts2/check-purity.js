// The core is pure: no I/O, no DOM, no clock reads. Time enters as an event
// field. This is what lets a twenty-person session run deterministically in a
// unit test. A slice that needs to break this is a design error, not a licence.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const CORE = "src/core";
const FORBIDDEN = [
  [/\bDate\.now\s*\(/, "Date.now() — time must arrive as an event field"],
  [/\bnew\s+Date\s*\(/, "new Date() — time must arrive as an event field"],
  [/\bMath\.random\s*\(/, "Math.random() — randomness must be seeded via the event"],
  [/\bdocument\b/, "document — the core must not touch the DOM"],
  [/\bwindow\b/, "window — the core must not touch the DOM"],
  [/\blocalStorage\b/, "localStorage — the core must not touch storage"],
  [/\bprocess\.[a-z]/i, "process — the core must not touch the runtime"],
  [/from\s+["']node:/, "node: import — the core must have no I/O"],
  [/from\s+["'](fs|path|socket\.io[^"']*)["']/, "I/O import — the core must be pure"],
  [/\bconsole\.\w+\s*\(/, "console — the core must not log"],
];

let failures = 0;
for (const file of readdirSync(CORE).filter((f) => f.endsWith(".js"))) {
  const path = join(CORE, file);
  const lines = readFileSync(path, "utf8").split("\n");
  lines.forEach((line, i) => {
    if (line.trim().startsWith("//")) return;
    for (const [pattern, why] of FORBIDDEN) {
      if (pattern.test(line)) {
        console.error(`${path}:${i + 1}  ${why}`);
        console.error(`    ${line.trim()}`);
        failures++;
      }
    }
  });
}

if (failures) {
  console.error(`\npurity gate: ${failures} violation(s) in ${CORE}`);
  process.exit(1);
}
console.log(`purity gate: ${CORE} is clean`);
