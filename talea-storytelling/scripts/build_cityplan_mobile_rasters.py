# -*- coding: utf-8 -*-
"""Rasterize the static mobile CityPlan map into tightly cropped WebP layers.

The SVG build remains the deterministic source of truth. This second build step
uses a local Chromium renderer and Pillow to create lossless-alpha WebP assets:

    python scripts/build_cityplan_mobile_assets.py
    python scripts/build_cityplan_mobile_rasters.py

Set CITYPLAN_CHROME to an explicit Chromium executable when auto-discovery is
not sufficient.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time

try:
    from PIL import Image
except ImportError as error:  # pragma: no cover - developer environment guard
    raise SystemExit("Pillow is required to build CityPlan mobile WebP assets") from error


ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "public" / "assets" / "cityplan-mobile"
MANIFEST_PATH = OUT_DIR / "manifest.json"
GENERATED_MODULE = ROOT / "src" / "generated" / "cityPlanMobileRasters.js"
CANVAS_X = -560
CANVAS_Y = -308
CANVAS_W = 3530
CANVAS_H = 2394
CROP_PAD = 4


def find_chromium() -> Path:
    configured = os.environ.get("CITYPLAN_CHROME")
    candidates = [
        configured,
        shutil.which("google-chrome"),
        shutil.which("chrome"),
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("msedge"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    ]
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return Path(candidate)
    raise SystemExit(
        "Chromium was not found. Set CITYPLAN_CHROME to Chrome, Chromium or Edge."
    )


def wait_for_file(path: Path, timeout: float = 15.0) -> None:
    deadline = time.monotonic() + timeout
    previous_size = -1
    stable_reads = 0
    while time.monotonic() < deadline:
        if path.is_file():
            size = path.stat().st_size
            if size > 0 and size == previous_size:
                stable_reads += 1
                if stable_reads >= 2:
                    return
            else:
                stable_reads = 0
                previous_size = size
        time.sleep(0.1)
    raise RuntimeError(f"Chromium did not finish writing {path}")


def rasterize(
    chromium: Path,
    source: Path,
    target: Path,
    work_dir: Path,
) -> dict[str, object]:
    screenshot = work_dir / f"{source.stem}.png"
    profile = work_dir / f"profile-{source.stem}"
    command = [
        str(chromium),
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu-sandbox",
        "--enable-unsafe-swiftshader",
        "--use-angle=swiftshader",
        "--hide-scrollbars",
        "--no-first-run",
        f"--user-data-dir={profile}",
        "--default-background-color=00000000",
        "--force-device-scale-factor=1",
        f"--window-size={CANVAS_W},{CANVAS_H}",
        f"--screenshot={screenshot}",
        source.resolve().as_uri(),
    ]
    subprocess.run(
        command,
        cwd=ROOT,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    wait_for_file(screenshot)

    with Image.open(screenshot) as opened:
        image = opened.convert("RGBA")
    if image.size != (CANVAS_W, CANVAS_H):
        raise RuntimeError(
            f"Unexpected Chromium output for {source.name}: {image.size}"
        )

    alpha_bounds = image.getchannel("A").getbbox()
    if alpha_bounds is None:
        raise RuntimeError(f"Raster layer {source.name} has no visible pixels")
    left, top, right, bottom = alpha_bounds
    left = max(0, left - CROP_PAD)
    top = max(0, top - CROP_PAD)
    right = min(CANVAS_W, right + CROP_PAD)
    bottom = min(CANVAS_H, bottom + CROP_PAD)
    cropped = image.crop((left, top, right, bottom))
    cropped.save(
        target,
        format="WEBP",
        lossless=True,
        method=6,
        exact=True,
    )
    width, height = cropped.size
    return {
        "file": target.name,
        "bytes": target.stat().st_size,
        "pixelWidth": width,
        "pixelHeight": height,
        "decodedBytes": width * height * 4,
        "style": {
            "left": CANVAS_X + left,
            "top": CANVAS_Y + top,
            "width": width,
            "height": height,
        },
    }


def main() -> None:
    if not MANIFEST_PATH.is_file():
        raise SystemExit(
            "Build the external SVG assets before rasterizing CityPlan mobile."
        )
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    plan = manifest["plan"]
    chromium = find_chromium()

    for stale in OUT_DIR.glob("cityplan-base.webp"):
        stale.unlink()
    for stale in OUT_DIR.glob("cityplan-layer-*.webp"):
        stale.unlink()

    sources = [("base", plan["base"])] + [
        (layer["name"], layer) for layer in plan["layers"]
    ]
    raster_layers: list[dict[str, object]] = []
    with tempfile.TemporaryDirectory(prefix="cityplan-mobile-raster-") as temp:
        work_dir = Path(temp)
        for name, source_spec in sources:
            source = OUT_DIR / source_spec["file"]
            target = source.with_suffix(".webp")
            raster_layers.append(
                {"name": name, **rasterize(chromium, source, target, work_dir)}
            )

    base = raster_layers[0]
    layers = raster_layers[1:]
    total_bytes = sum(int(item["bytes"]) for item in raster_layers)
    peak_decoded = max(int(item["decodedBytes"]) for item in raster_layers)
    plan["raster"] = {
        "format": "webp-lossless-alpha",
        "scale": 1,
        "base": base,
        "layers": layers,
        "totalBytes": total_bytes,
        "largestDecodedLayerBytes": peak_decoded,
    }
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    runtime_manifest = {"base": base, "layers": layers}
    GENERATED_MODULE.parent.mkdir(parents=True, exist_ok=True)
    GENERATED_MODULE.write_text(
        "// Generated by scripts/build_cityplan_mobile_rasters.py.\n"
        "// Do not edit manually.\n"
        "export const cityPlanMobileRasters = "
        + json.dumps(runtime_manifest, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )
    print(
        f"{len(raster_layers)} cropped WebP assets, "
        f"{total_bytes / 1024:.1f} KiB -> {OUT_DIR}"
    )


if __name__ == "__main__":
    main()
