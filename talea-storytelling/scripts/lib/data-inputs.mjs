import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const REGISTRY_PATH = path.join(REPO_ROOT, "config/data-inputs.json");
const ENVIRONMENT_VARIABLE = "TALEA_EXTERNAL_DATA";

let registry;

export function externalDataRoot() {
  const configured = process.env[ENVIRONMENT_VARIABLE];
  if (!configured) return path.join(REPO_ROOT, "external");
  return path.isAbsolute(configured)
    ? path.resolve(configured)
    : path.resolve(REPO_ROOT, configured);
}

export function loadDataInputs() {
  if (!registry) {
    const parsed = JSON.parse(fs.readFileSync(REGISTRY_PATH, "utf8"));
    if (parsed.schemaVersion !== 1 || !parsed.inputs || typeof parsed.inputs !== "object") {
      throw new Error(`Unsupported external input registry: ${REGISTRY_PATH}`);
    }
    registry = parsed.inputs;
  }
  return registry;
}

export function resolveDataInput(inputId) {
  const entry = loadDataInputs()[inputId];
  if (!entry || typeof entry.path !== "string") {
    throw new Error(`Unknown external data input: ${inputId}`);
  }
  if (path.isAbsolute(entry.path)) {
    throw new Error(`External data input path must be relative: ${inputId}`);
  }

  const root = externalDataRoot();
  const resolved = path.resolve(root, entry.path);
  const relative = path.relative(root, resolved);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`External data input escapes its root: ${inputId}`);
  }
  return resolved;
}

export function requireDataInput(inputId) {
  const resolved = resolveDataInput(inputId);
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    throw new Error(
      `Missing external data input '${inputId}': ${resolved}. ` +
        `Set ${ENVIRONMENT_VARIABLE} or populate the default external directory.`,
    );
  }
  return resolved;
}
