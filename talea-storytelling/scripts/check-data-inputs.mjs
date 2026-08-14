import fs from "node:fs";
import { createHash } from "node:crypto";

import {
  externalDataRoot,
  loadDataInputs,
  resolveDataInput,
} from "./lib/data-inputs.mjs";

function sha256(file) {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function main() {
  const inputs = loadDataInputs();
  let found = 0;
  let missing = 0;
  let mismatched = 0;

  console.log(`External data root: ${externalDataRoot()}`);
  console.log();

  for (const [inputId, entry] of Object.entries(inputs)) {
    const resolved = resolveDataInput(inputId);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      missing += 1;
      console.log(`MISSING ${inputId}`);
      console.log(`        ${resolved}`);
      continue;
    }

    found += 1;
    console.log(`FOUND   ${inputId}`);
    console.log(`        ${resolved}`);

    if (entry.sha256) {
      const actual = sha256(resolved);
      if (actual.toLowerCase() === entry.sha256.toLowerCase()) {
        console.log("        SHA-256 OK");
      } else {
        mismatched += 1;
        console.error(`        SHA-256 MISMATCH (expected ${entry.sha256}, got ${actual})`);
      }
    }
  }

  console.log();
  console.log(`Summary: ${found} FOUND, ${missing} MISSING, ${mismatched} CHECKSUM MISMATCH`);
  if (missing > 0 || mismatched > 0) process.exitCode = 1;
}

main();
