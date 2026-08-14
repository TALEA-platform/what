"""Resolve scientific inputs declared in config/data-inputs.json."""

import json
import os
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
REGISTRY_PATH = REPO_ROOT / "config" / "data-inputs.json"
ENVIRONMENT_VARIABLE = "TALEA_EXTERNAL_DATA"

_registry = None


def external_data_root() -> Path:
    configured = os.environ.get(ENVIRONMENT_VARIABLE)
    if not configured:
        return (REPO_ROOT / "external").resolve()

    root = Path(configured).expanduser()
    if not root.is_absolute():
        root = REPO_ROOT / root
    return root.resolve()


def load_data_inputs() -> dict:
    global _registry
    if _registry is None:
        with REGISTRY_PATH.open("r", encoding="utf8") as registry_file:
            registry = json.load(registry_file)
        if registry.get("schemaVersion") != 1 or not isinstance(registry.get("inputs"), dict):
            raise RuntimeError(f"Unsupported external input registry: {REGISTRY_PATH}")
        _registry = registry["inputs"]
    return _registry


def resolve_data_input(input_id: str) -> Path:
    entry = load_data_inputs().get(input_id)
    if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
        raise KeyError(f"Unknown external data input: {input_id}")

    relative_path = Path(entry["path"])
    if relative_path.is_absolute():
        raise RuntimeError(f"External data input path must be relative: {input_id}")

    root = external_data_root()
    resolved = (root / relative_path).resolve()
    try:
        resolved.relative_to(root)
    except ValueError as error:
        raise RuntimeError(f"External data input escapes its root: {input_id}") from error
    return resolved


def require_data_input(input_id: str) -> Path:
    resolved = resolve_data_input(input_id)
    if not resolved.is_file():
        raise FileNotFoundError(
            f"Missing external data input '{input_id}': {resolved}. "
            f"Set {ENVIRONMENT_VARIABLE} or populate the default external directory."
        )
    return resolved
