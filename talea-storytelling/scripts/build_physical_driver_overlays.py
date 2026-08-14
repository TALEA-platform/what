import json
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.features import geometry_mask
from rasterio.warp import transform, transform_geom

from lib.data_inputs import external_data_root, require_data_input, resolve_data_input


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "data" / "physical-drivers"
BOLOGNA_BOUNDARY = ROOT / "public" / "data" / "vectors" / "bologna_boundary_outline.geojson"
NDVI_SOURCE = resolve_data_input("ndvi2025Raster")
ALBEDO_SOURCE = resolve_data_input("albedo2025Raster")

LAYERS = [
    {
        "id": "green",
        "source": NDVI_SOURCE,
        "output": "ndvi_2025_direct_overlay.png",
        "value_range": (0.07, 0.89),
        "transparent_below": -0.2,
        "colors": np.array(
            [
                [245, 240, 208],
                [217, 232, 163],
                [135, 196, 114],
                [33, 168, 74],
                [0, 77, 25],
            ],
            dtype=np.float32,
        ),
        "alpha": (245, 255),
    },
    {
        "id": "absorbing",
        "source": ALBEDO_SOURCE,
        "output": "albedo_absorbing_2025_direct_overlay.png",
        "value_range": (0.12, 0.27),
        "gamma": 1.15,
        "clip_geometry": BOLOGNA_BOUNDARY,
        "colors": np.array(
            [
                [17, 17, 17],
                [68, 68, 68],
                [128, 128, 128],
                [192, 192, 192],
                [245, 245, 245],
            ],
            dtype=np.float32,
        ),
        "alpha": (255, 255),
    },
]


def layer_corners(src):
    corners = [
        (src.bounds.left, src.bounds.top),
        (src.bounds.right, src.bounds.top),
        (src.bounds.right, src.bounds.bottom),
        (src.bounds.left, src.bounds.bottom),
    ]
    xs, ys = transform(src.crs, "EPSG:4326", [x for x, _ in corners], [y for _, y in corners])
    return [[round(x, 7), round(y, 7)] for x, y in zip(xs, ys)]


def interpolate_colors(values, colors):
    stops = np.linspace(0, 1, len(colors))
    red = np.interp(values, stops, colors[:, 0])
    green = np.interp(values, stops, colors[:, 1])
    blue = np.interp(values, stops, colors[:, 2])
    return np.stack([red, green, blue], axis=-1)


def source_label(path):
    for base, prefix in ((ROOT, ""), (external_data_root(), "external/")):
        try:
            relative = str(path.relative_to(base)).replace("\\", "/")
            return f"{prefix}{relative}"
        except ValueError:
            continue
    return str(path).replace("\\", "/")


def render_rgba(values, mask, value_range, colors, alpha_range, invert=False, gamma=1.0):
    low, high = value_range
    normalized = np.clip((values - low) / (high - low), 0, 1)
    if invert:
        normalized = 1 - normalized
    normalized = np.where(mask, 0, normalized)
    color_position = normalized ** gamma

    rgb = interpolate_colors(color_position, colors)
    alpha_low, alpha_high = alpha_range
    alpha = np.interp(color_position, [0, 1], [alpha_low, alpha_high])

    rgba = np.zeros((*values.shape, 4), dtype=np.uint8)
    rgba[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8)
    rgba[..., 3] = np.where(mask, 0, np.clip(alpha, 0, 255)).astype(np.uint8)
    return rgba


def render_layer(layer):
    with rasterio.open(layer["source"]) as src:
        raster = src.read(1, masked=True).astype("float32")
        values = raster.filled(np.nan)
        mask = np.ma.getmaskarray(raster) | ~np.isfinite(values)
        mask |= values < layer.get("transparent_below", -np.inf)

        clip_geometry = layer.get("clip_geometry")
        if clip_geometry:
            with clip_geometry.open("r", encoding="utf8") as source_file:
                clip_data = json.load(source_file)
            projected_geometries = [
                transform_geom("EPSG:4326", src.crs.to_string(), feature["geometry"])
                for feature in clip_data.get("features", [])
                if feature.get("geometry")
            ]
            inside_clip = geometry_mask(
                projected_geometries,
                out_shape=(src.height, src.width),
                transform=src.transform,
                invert=True,
            )
            mask |= ~inside_clip

        low, high = layer["value_range"]
        rgba = render_rgba(
            values,
            mask,
            layer["value_range"],
            layer["colors"],
            layer["alpha"],
            invert=layer.get("invert", False),
            gamma=layer.get("gamma", 1.0),
        )

        output_path = OUTPUT_DIR / layer["output"]
        Image.fromarray(rgba, mode="RGBA").save(output_path, optimize=True)

        return {
            "id": layer["id"],
            "url": f"/data/physical-drivers/{layer['output']}",
            "source": source_label(layer["source"]),
            "coordinates": layer_corners(src),
            "width": src.width,
            "height": src.height,
            "valueRange": [low, high],
        }


def main():
    require_data_input("ndvi2025Raster")
    require_data_input("albedo2025Raster")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    overlays = [render_layer(layer) for layer in LAYERS]
    manifest = {
        "note": "Direct MapLibre image overlays rendered from source rasters. The 10 m albedo is clipped to Bologna's municipal boundary; no narrative grid aggregation is applied.",
        "layers": {layer["id"]: layer for layer in overlays},
    }
    manifest_path = OUTPUT_DIR / "physical_driver_overlays.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")

    print(f"Wrote {manifest_path.relative_to(ROOT)}")
    for layer in overlays:
        size_kb = (OUTPUT_DIR / Path(layer["url"]).name).stat().st_size / 1024
        print(f"{layer['id']}: {layer['width']}x{layer['height']} {size_kb:.1f} KB")


if __name__ == "__main__":
    main()
