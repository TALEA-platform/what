# -*- coding: utf-8 -*-
"""Build deterministic external SVG assets for the mobile CityPlan renderer.

The desktop renderer keeps using the generated inline SVG sources. Mobile uses
these documents through ``<img>`` so their geometry never enters the page DOM.

Run from the project root:
    python scripts/build_cityplan_mobile_assets.py
"""

from __future__ import annotations

import copy
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data"
OUT_DIR = ROOT / "public" / "assets" / "cityplan-mobile"
SVG_NS = "http://www.w3.org/2000/svg"
NS = f"{{{SVG_NS}}}"
# The inline desktop SVG deliberately paints beyond its nominal 2400x1500
# viewBox. An external image clips at its own canvas, so mobile assets need an
# expanded canvas that contains the same overflow geometry. The values include
# an 8-unit safety margin around the measured source bounds
# (-552, -300) -> (2961, 2078).
PLAN_CANVAS = (-560, -308, 3530, 2394)
PLAN_LAYER_SPECS = (
    ("parking-state", 0, 2),
    ("initial-sites", 0, 3),
    ("gap-emphasis", 1, 2),
    ("relief-sites", 1, 3),
    ("first-refuge-accent", 2, 3),
    ("first-refuge", 2, None),
    ("extra-refuges-accent", 3, 4),
    ("extra-refuges", 3, None),
    ("corridor-network", 4, None),
    ("porticoes", 5, None),
    ("final-network", 6, None),
)

ET.register_namespace("", SVG_NS)


def extract_template(path: Path, export_name: str) -> str:
    source = path.read_text(encoding="utf-8")
    match = re.search(
        rf"(?:export const {re.escape(export_name)} = `|{re.escape(export_name)}: `)\s*"
        r"(<svg.*?</svg>)\s*`",
        source,
        flags=re.DOTALL,
    )
    if not match:
        raise RuntimeError(f"SVG template {export_name!r} not found in {path}")
    return match.group(1)


def parse_svg(markup: str) -> ET.Element:
    # The generated strings are injected into HTML, whose parser normalises these
    # names. Standalone SVG documents are XML and therefore need canonical case.
    markup = (
        markup.replace("viewbox=", "viewBox=")
        .replace("preserveaspectratio=", "preserveAspectRatio=")
        .replace("pathlength=", "pathLength=")
    )
    return ET.fromstring(markup)


def class_names(node: ET.Element) -> set[str]:
    return set(node.get("class", "").split())


def strip_story_attributes(node: ET.Element) -> None:
    for child in node.iter():
        child.attrib.pop("data-at", None)
        child.attrib.pop("data-until", None)
        child.attrib.pop("data-step", None)
        child.attrib.pop("data-gone-step", None)
        style = child.get("style", "")
        if style.startswith("--d:"):
            child.attrib.pop("style", None)


def make_decorative(root: ET.Element) -> None:
    root.attrib.pop("role", None)
    root.set("aria-hidden", "true")
    root.set("focusable", "false")
    width, height = svg_dimensions(root)
    root.set("width", f"{width:g}")
    root.set("height", f"{height:g}")
    for desc in list(root.findall(f"{NS}desc")):
        root.remove(desc)


def style_plan_linework(root: ET.Element) -> None:
    for node in root.iter():
        if "pl-ink" not in class_names(node):
            continue
        node.set("fill", "none")
        node.set("stroke", "#3A352A")
        node.set("stroke-width", "1.25")
        node.set("stroke-linecap", "round")
        node.set("stroke-linejoin", "round")
        node.set("vector-effect", "non-scaling-stroke")


def plan_group_is_active(node: ET.Element, beat: int) -> bool:
    at = int(node.get("data-at", "0"))
    until_value = node.get("data-until")
    until = int(until_value) if until_value is not None else None
    return beat >= at and (until is None or beat < until)


def plan_state(source: ET.Element, beat: int, *, stable_base: bool = False) -> ET.Element:
    root = copy.deepcopy(source)
    for layer in root.findall(f"{NS}g"):
        for item in list(layer.findall(f"{NS}g")):
            if stable_base:
                keep = int(item.get("data-at", "0")) == 0 and item.get("data-until") is None
            else:
                keep = plan_group_is_active(item, beat)
            if not keep:
                layer.remove(item)
    root.set("viewBox", " ".join(str(value) for value in PLAN_CANVAS))
    make_decorative(root)
    style_plan_linework(root)
    strip_story_attributes(root)
    return root


def plan_lifecycle_layer(
    source: ET.Element,
    at: int,
    until: int | None,
) -> ET.Element:
    root = copy.deepcopy(source)
    for layer in root.findall(f"{NS}g"):
        for item in list(layer.findall(f"{NS}g")):
            item_at = int(item.get("data-at", "0"))
            item_until_value = item.get("data-until")
            item_until = int(item_until_value) if item_until_value is not None else None
            if item_at != at or item_until != until:
                layer.remove(item)
    root.set("viewBox", " ".join(str(value) for value in PLAN_CANVAS))
    make_decorative(root)
    style_plan_linework(root)
    strip_story_attributes(root)
    return root


VIGNETTE_LAYERS = {
    "costruire": (
        ("context", {0}, False),
        ("parking", {0, 1}, True),
        ("ground-and-green", {2, 3, 4, 5, 6}, False),
        ("water", {7, 8}, False),
        ("life", {9, 10}, False),
    ),
    "corridoio": (
        ("context", {0}, False),
        ("existing-shadow", {0, 1}, True),
        ("structures", {2, 3, 4}, False),
        ("green", {5, 6, 7, 8}, False),
        ("shade", {9}, False),
        ("life", {10}, False),
    ),
    "portico": (
        ("context", {0}, False),
        ("building", {1}, False),
        ("arcades", {2, 3, 4, 5}, False),
        ("street", {6}, False),
        ("life", {7}, False),
    ),
}


def vignette_layer(
    source: ET.Element,
    steps: set[int],
    goes_only: bool,
) -> ET.Element:
    root = copy.deepcopy(source)
    for item in list(root):
        if "pv-i" not in class_names(item):
            continue
        step = int(item.get("data-step", "0"))
        is_goes = "pv-goes" in class_names(item)
        keep = step in steps and is_goes == goes_only
        if not keep:
            root.remove(item)

    for item in root:
        if "pv-i" not in class_names(item):
            continue
        step = int(item.get("data-step", "0"))
        for child in item:
            classes = class_names(child)
            if "pv-c" in classes and step <= 1:
                child.set("opacity", "0.82")
            if "pv-l" in classes:
                for path in child.iter(f"{NS}path"):
                    path.set("fill", "none")
                    path.set("stroke", "#3A352A")
                    path.set("stroke-width", "1.9")
                    path.set("stroke-linecap", "round")
                    path.set("stroke-linejoin", "round")
                    path.set("opacity", "0.44")

    make_decorative(root)
    strip_story_attributes(root)
    return root


def serialise(root: ET.Element) -> bytes:
    return ET.tostring(root, encoding="utf-8", xml_declaration=True, short_empty_elements=True)


def svg_dimensions(root: ET.Element) -> tuple[float, float]:
    values = [float(value) for value in root.get("viewBox", "0 0 0 0").split()]
    return values[2], values[3]


def element_counts(root: ET.Element) -> dict[str, int]:
    return {
        "paths": sum(1 for _ in root.iter(f"{NS}path")),
        "groups": sum(1 for _ in root.iter(f"{NS}g")),
        "circles": sum(1 for _ in root.iter(f"{NS}circle")),
        "ellipses": sum(1 for _ in root.iter(f"{NS}ellipse")),
    }


def write_asset(filename: str, root: ET.Element) -> dict[str, object]:
    payload = serialise(root)
    path = OUT_DIR / filename
    path.write_bytes(payload)
    width, height = svg_dimensions(root)
    return {
        "file": filename,
        "bytes": len(payload),
        "viewBox": [round(width, 1), round(height, 1)],
        **element_counts(root),
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # The directory is generated output. Remove superseded vignette variants so
    # changing the semantic partition cannot leave unused assets in a build.
    for stale_vignette in OUT_DIR.glob("cityplan-vignette-*.svg"):
        stale_vignette.unlink()
    for stale_plan_state in OUT_DIR.glob("cityplan-state-*.svg"):
        stale_plan_state.unlink()
    for stale_plan_layer in OUT_DIR.glob("cityplan-layer-*.svg"):
        stale_plan_layer.unlink()

    plan_source = parse_svg(extract_template(DATA_DIR / "cityPlan.js", "cityPlanSvg"))
    vignette_source = {
        name: parse_svg(extract_template(DATA_DIR / "planVignettes.js", name))
        for name in ("costruire", "corridoio", "portico")
    }

    manifest: dict[str, object] = {
        "format": "external-svg",
        "architecture": "stable-base-plus-semantic-delta-layers",
        "plan": {
            "base": write_asset("cityplan-base.svg", plan_state(plan_source, 0, stable_base=True)),
            "layers": [],
        },
        "vignettes": {},
    }

    plan_layers = manifest["plan"]["layers"]
    assert isinstance(plan_layers, list)
    for name, at, until in PLAN_LAYER_SPECS:
        plan_layers.append(
            {
                "name": name,
                "from": at,
                "until": until,
                **write_asset(
                    f"cityplan-layer-{name}.svg",
                    plan_lifecycle_layer(plan_source, at, until),
                ),
            }
        )

    vignettes = manifest["vignettes"]
    assert isinstance(vignettes, dict)
    for name, source in vignette_source.items():
        layers = []
        for layer_name, steps, goes_only in VIGNETTE_LAYERS[name]:
            layers.append(
                {
                    "name": layer_name,
                    **write_asset(
                        f"cityplan-vignette-{name}-{layer_name}.svg",
                        vignette_layer(source, steps, goes_only),
                    ),
                }
            )
        vignettes[name] = {"layers": layers}

    total_bytes = sum(
        item["bytes"]
        for item in [
            manifest["plan"]["base"],
            *plan_layers,
            *(layer for vignette in vignettes.values() for layer in vignette["layers"]),
        ]
    )
    manifest["totalBytes"] = total_bytes
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    vignette_layer_count = sum(len(item["layers"]) for item in vignettes.values())
    print(
        f"{len(plan_layers) + vignette_layer_count + 1} SVG assets, "
        f"{total_bytes / 1024:.1f} KiB -> {OUT_DIR}"
    )


if __name__ == "__main__":
    main()
