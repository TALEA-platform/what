# -*- coding: utf-8 -*-
"""Rasterize the settled CityBuild vignettes used only by iPhone.

The production mobile implementation keeps the layered SVG animation on every
other platform.  iPhone receives one immutable, transparent PNG per vignette,
so WebKit never has to composite five or six independent SVG image surfaces.

Run from the project root after `build_cityplan_mobile_assets.py`:
    python scripts/generate_cityplan_iphone_static_vignettes.py
"""

from __future__ import annotations

import base64
import math
from pathlib import Path
import re
import subprocess
import tempfile

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "assets" / "cityplan-mobile"
OUTPUT_PREFIX = "cityplan-iphone-static-vignette-"

# "before" layers are deliberately absent: this is the settled visual state
# reached by the existing animation after parking/shadow has faded away.
VIGNETTES = {
    "costruire": (
        "context",
        "ground-and-green",
        "water",
        "life",
    ),
    "corridoio": (
        "context",
        "structures",
        "green",
        "shade",
        "life",
    ),
    "portico": (
        "context",
        "building",
        "arcades",
        "street",
        "life",
    ),
}

CHROME_CANDIDATES = (
    Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"),
    Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"),
    Path(r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"),
)


def find_chrome() -> Path:
    for candidate in CHROME_CANDIDATES:
        if candidate.exists():
            return candidate
    raise RuntimeError("Chrome or Edge is required to rasterize iPhone vignettes")


def svg_dimensions(source: str) -> tuple[int, int]:
    match = re.search(r'<svg[^>]*\bwidth="([0-9.]+)"[^>]*\bheight="([0-9.]+)"', source)
    if not match:
        raise RuntimeError("Unable to read SVG dimensions")
    return math.ceil(float(match.group(1))), math.ceil(float(match.group(2)))


def svg_data_url(path: Path) -> str:
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/svg+xml;base64,{encoded}"


def render_vignette(chrome: Path, name: str, layers: tuple[str, ...]) -> Path:
    sources = [ASSET_DIR / f"cityplan-vignette-{name}-{layer}.svg" for layer in layers]
    missing = [str(path) for path in sources if not path.exists()]
    if missing:
        raise RuntimeError(f"Missing vignette layers: {', '.join(missing)}")

    width, height = svg_dimensions(sources[0].read_text(encoding="utf-8"))
    images = "\n".join(
        f'<img src="{svg_data_url(source)}" alt="">' for source in sources
    )
    html = f"""<!doctype html>
<meta charset="utf-8">
<style>
html, body {{ margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }}
img {{ position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: contain; }}
</style>
{images}
"""

    output = ASSET_DIR / f"{OUTPUT_PREFIX}{name}.png"
    with tempfile.TemporaryDirectory(prefix="talea-vignette-") as temp_name:
        temp_dir = Path(temp_name)
        page = temp_dir / f"{name}.html"
        profile = temp_dir / "chrome-profile"
        screenshot = temp_dir / f"{name}.png"
        page.write_text(html, encoding="utf-8")
        command = [
            str(chrome),
            "--headless=new",
            "--disable-extensions",
            "--disable-background-networking",
            "--hide-scrollbars",
            "--no-first-run",
            "--force-device-scale-factor=1",
            "--default-background-color=00000000",
            "--virtual-time-budget=1000",
            f"--user-data-dir={profile}",
            f"--window-size={width},{height}",
            f"--screenshot={screenshot}",
            page.as_uri(),
        ]
        subprocess.run(command, check=True, capture_output=True)
        with Image.open(screenshot) as rendered:
            rgba = rendered.convert("RGBA")
            if rgba.size != (width, height):
                raise RuntimeError(
                    f"Unexpected {name} raster size {rgba.size}; expected {(width, height)}"
                )
            if rgba.getbbox() is None:
                raise RuntimeError(f"Rasterized {name} vignette is empty")
            rgba.save(output, format="PNG", optimize=True)

    return output


def main() -> None:
    chrome = find_chrome()
    for stale in ASSET_DIR.glob(f"{OUTPUT_PREFIX}*.png"):
        stale.unlink()
    for name, layers in VIGNETTES.items():
        output = render_vignette(chrome, name, layers)
        with Image.open(output) as image:
            decoded_mib = image.width * image.height * 4 / (1024 * 1024)
            print(
                f"{output.name}: {image.width}x{image.height}, "
                f"{output.stat().st_size / 1024:.0f} KiB / {decoded_mib:.2f} MiB decoded"
            )


if __name__ == "__main__":
    main()
