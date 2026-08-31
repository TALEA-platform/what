# -*- coding: utf-8 -*-
"""Generate lossless, precomposed CityPlan WebP and legacy PNG states.

Run from the project root after the source mobile rasters are current:
    python scripts/generate_cityplan_mobile_composites.py

The source manifest defines production layer order and beat lifetimes. The
reference canvas comes from cityplan-base.svg's expanded viewBox, rather than
the tightly cropped base WebP, so negative offsets and overflow stay aligned.
"""

from __future__ import annotations

import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

try:
    from PIL import Image
except ImportError as error:  # pragma: no cover - developer environment guard
    raise SystemExit("Pillow is required to compose CityPlan mobile WebP assets") from error


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "assets" / "cityplan-mobile"
SOURCE_MANIFEST = ASSET_DIR / "manifest.json"
BEAT_SOURCE = ROOT / "src" / "data" / "cityPlanScene.js"
GENERATED_MODULE = ROOT / "src" / "generated" / "cityPlanMobileComposites.js"
OUTPUT_PREFIX = "cityplan-mobile-composite-beat-"
IPHONE_OUTPUT_PREFIX = "cityplan-iphone-composite-beat-"

# All phone and phone-landscape camera paths stay inside this source-space
# envelope. It is the single persistent Canvas2D backing store used on iPhone.
# Cropping is pixel-for-pixel (no resize), so the perceived map and camera
# framing are unchanged while the decoded surface drops from 3530x2394 to
# 2240x2394.
IPHONE_CANVAS = (-64, -308, 2240, 2394)

# Each transient decode only contains the source-space envelope reachable by
# that beat (including its entry camera from the previous beat), with a safety
# margin. The source is drawn at its original offset into IPHONE_CANVAS; it is
# never scaled. This matters most around costruisce/nonuno, where a uniform
# 2240x2394 source would otherwise briefly coexist with the 2240x2394 canvas.
# Values deliberately remain conservative for portrait and landscape iPhones.
IPHONE_BEAT_CROPS = (
    (-64, 0, 2016, 2086),
    (-64, 0, 2016, 2086),
    (-64, 160, 1664, 1926),
    (-64, -308, 1888, 2394),
    (-64, -308, 2240, 2394),
    (0, -308, 2176, 2394),
    (32, -308, 2144, 2394),
)


def read_beat_ids() -> list[str]:
    source = BEAT_SOURCE.read_text(encoding="utf-8")
    match = re.search(
        r"export\s+const\s+planBeatSpecs\s*=\s*\[(.*?)\];",
        source,
        flags=re.DOTALL,
    )
    if not match:
        raise RuntimeError(f"Unable to read planBeatSpecs from {BEAT_SOURCE}")
    beat_ids = re.findall(r'\bid\s*:\s*"([^"]+)"', match.group(1))
    if not beat_ids:
        raise RuntimeError("planBeatSpecs contains no beats")
    return beat_ids


def read_reference_canvas(base_svg: Path) -> tuple[int, int, int, int]:
    root = ET.parse(base_svg).getroot()
    values = [float(value) for value in root.get("viewBox", "").split()]
    if len(values) != 4 or any(value != int(value) for value in values):
        raise RuntimeError(f"Expected an integer viewBox in {base_svg}")
    return tuple(int(value) for value in values)


def active_layers_for_beat(layers: list[dict[str, object]], beat: int):
    return [
        layer
        for layer in layers
        if beat >= int(layer["from"])
        and (layer["until"] is None or beat < int(layer["until"]))
    ]


def paste_source(
    canvas: Image.Image,
    source_spec: dict[str, object],
    canvas_x: int,
    canvas_y: int,
) -> None:
    source_path = ASSET_DIR / str(source_spec["file"])
    style = source_spec["style"]
    assert isinstance(style, dict)
    with Image.open(source_path) as opened:
        source = opened.convert("RGBA")
    expected_size = (int(style["width"]), int(style["height"]))
    if source.size != expected_size:
        raise RuntimeError(
            f"{source_path.name} is {source.size}, expected {expected_size} from its style"
        )
    offset = (int(style["left"]) - canvas_x, int(style["top"]) - canvas_y)
    if (
        offset[0] < 0
        or offset[1] < 0
        or offset[0] + source.width > canvas.width
        or offset[1] + source.height > canvas.height
    ):
        raise RuntimeError(f"{source_path.name} falls outside the reference canvas")
    # Pillow's source-over alpha composition matches the browser layer stack.
    canvas.alpha_composite(source, dest=offset)


def main() -> None:
    manifest = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    plan = manifest["plan"]
    raster = plan["raster"]
    base = raster["base"]
    raster_by_name = {
        item["name"]: item for item in raster["layers"]
    }
    production_layers = plan["layers"]
    beat_ids = read_beat_ids()
    canvas_x, canvas_y, canvas_width, canvas_height = read_reference_canvas(
        ASSET_DIR / str(plan["base"]["file"])
    )

    for extension in ("webp", "png"):
        for prefix in (OUTPUT_PREFIX, IPHONE_OUTPUT_PREFIX):
            for stale in ASSET_DIR.glob(f"{prefix}*.{extension}"):
                stale.unlink()

    generated_beats = []
    generated_iphone_beats = []
    for beat, beat_id in enumerate(beat_ids):
        # Beat 2 temporarily keeps parking/gap DOM layers for its exit motion,
        # but both have opacity 0 at the stable endpoint represented here.
        active_layers = active_layers_for_beat(production_layers, beat)
        source_specs = [base]
        source_names = ["base"]
        source_files = [str(base["file"])]
        for layer in active_layers:
            name = str(layer["name"])
            source_spec = raster_by_name.get(name)
            if source_spec is None:
                raise RuntimeError(f"Missing raster source for production layer {name}")
            source_specs.append(source_spec)
            source_names.append(name)
            source_files.append(str(source_spec["file"]))

        composite = Image.new(
            "RGBA",
            (canvas_width, canvas_height),
            (0, 0, 0, 0),
        )
        for source_spec in source_specs:
            paste_source(composite, source_spec, canvas_x, canvas_y)

        filename = f"{OUTPUT_PREFIX}{beat}.webp"
        output_path = ASSET_DIR / filename
        composite.save(
            output_path,
            format="WEBP",
            lossless=True,
            method=6,
            exact=True,
        )
        fallback_filename = f"{OUTPUT_PREFIX}{beat}.png"
        fallback_output_path = ASSET_DIR / fallback_filename
        composite.save(
            fallback_output_path,
            format="PNG",
            optimize=True,
            compress_level=9,
        )
        generated_beats.append(
            {
                "beat": beat,
                "id": beat_id,
                "file": filename,
                "bytes": output_path.stat().st_size,
                "fallbackFile": fallback_filename,
                "fallbackBytes": fallback_output_path.stat().st_size,
                "pixelWidth": canvas_width,
                "pixelHeight": canvas_height,
                "decodedBytes": canvas_width * canvas_height * 4,
                "style": {
                    "left": canvas_x,
                    "top": canvas_y,
                    "width": canvas_width,
                    "height": canvas_height,
                },
                "layers": source_names,
                "sourceFiles": source_files,
            }
        )

        if beat >= len(IPHONE_BEAT_CROPS):
            raise RuntimeError(f"Missing iPhone crop for beat {beat}")
        iphone_x, iphone_y, iphone_width, iphone_height = IPHONE_BEAT_CROPS[beat]
        iphone_box = (
            iphone_x - canvas_x,
            iphone_y - canvas_y,
            iphone_x - canvas_x + iphone_width,
            iphone_y - canvas_y + iphone_height,
        )
        if (
            iphone_box[0] < 0
            or iphone_box[1] < 0
            or iphone_box[2] > canvas_width
            or iphone_box[3] > canvas_height
        ):
            raise RuntimeError("IPHONE_CANVAS falls outside the reference canvas")
        iphone_composite = composite.crop(iphone_box)
        iphone_filename = f"{IPHONE_OUTPUT_PREFIX}{beat}.webp"
        iphone_output_path = ASSET_DIR / iphone_filename
        iphone_composite.save(
            iphone_output_path,
            format="WEBP",
            lossless=True,
            method=6,
            exact=True,
        )
        iphone_fallback_filename = f"{IPHONE_OUTPUT_PREFIX}{beat}.png"
        iphone_fallback_output_path = ASSET_DIR / iphone_fallback_filename
        iphone_composite.save(
            iphone_fallback_output_path,
            format="PNG",
            optimize=True,
            compress_level=9,
        )
        generated_iphone_beats.append(
            {
                "beat": beat,
                "id": beat_id,
                "file": iphone_filename,
                "bytes": iphone_output_path.stat().st_size,
                "fallbackFile": iphone_fallback_filename,
                "fallbackBytes": iphone_fallback_output_path.stat().st_size,
                "pixelWidth": iphone_width,
                "pixelHeight": iphone_height,
                "decodedBytes": iphone_width * iphone_height * 4,
                "style": {
                    "left": iphone_x,
                    "top": iphone_y,
                    "width": iphone_width,
                    "height": iphone_height,
                },
                "layers": source_names,
                "sourceFiles": source_files,
            }
        )

    runtime_manifest = {
        "format": "webp-lossless-alpha-with-png-fallback",
        "composition": "production-stable-state-source-over",
        "canvas": {
            "left": canvas_x,
            "top": canvas_y,
            "width": canvas_width,
            "height": canvas_height,
        },
        "beats": generated_beats,
        "iphoneCanvas": {
            "left": IPHONE_CANVAS[0],
            "top": IPHONE_CANVAS[1],
            "width": IPHONE_CANVAS[2],
            "height": IPHONE_CANVAS[3],
        },
        "iphoneBeats": generated_iphone_beats,
    }
    GENERATED_MODULE.parent.mkdir(parents=True, exist_ok=True)
    GENERATED_MODULE.write_text(
        "// Generated by scripts/generate_cityplan_mobile_composites.py.\n"
        "// Do not edit manually.\n"
        "export const cityPlanMobileComposites = "
        + json.dumps(runtime_manifest, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    total_bytes = sum(int(item["bytes"]) for item in generated_beats)
    fallback_bytes = sum(int(item["fallbackBytes"]) for item in generated_beats)
    iphone_total_bytes = sum(int(item["bytes"]) for item in generated_iphone_beats)
    iphone_fallback_bytes = sum(
        int(item["fallbackBytes"]) for item in generated_iphone_beats
    )
    print(
        f"{len(generated_beats)} lossless composites, "
        f"{canvas_width}x{canvas_height}, "
        f"{total_bytes / (1024 * 1024):.2f} MiB WebP / "
        f"{fallback_bytes / (1024 * 1024):.2f} MiB PNG; "
        f"iPhone {IPHONE_CANVAS[2]}x{IPHONE_CANVAS[3]}, "
        f"{iphone_total_bytes / (1024 * 1024):.2f} MiB WebP / "
        f"{iphone_fallback_bytes / (1024 * 1024):.2f} MiB PNG -> {ASSET_DIR}"
    )


if __name__ == "__main__":
    main()
