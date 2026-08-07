import json
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.features import rasterize
from rasterio.transform import from_bounds
from rasterio.warp import transform


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "data" / "physical-drivers"
SHADOW_SOURCE = ROOT / "external" / "historysuhi" / "webapp" / "data" / "bologna_shadow_means" / "bologna_shadow_means.geojson"

LAYERS = [
    {
        "id": "green",
        "source": ROOT / "external" / "historysuhi" / "webapp" / "data" / "webapp_rasters" / "NDVI_2025_summer_30m.tif",
        "output": "ndvi_2025_direct_overlay.png",
        "value_range": (0.07, 0.89),
        "transparent_below": -0.2,
        # historysuhi "green" default palette: cream → light green → talea green → deep green.
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
        "source": ROOT / "external" / "historysuhi" / "webapp" / "data" / "webapp_rasters" / "Albedo_2025_summer_30m.tif",
        "output": "albedo_absorbing_2025_direct_overlay.png",
        "value_range": (0.14, 0.22),
        "transparent_below": 0.05,
        # historysuhi "albedo" default palette: dark = assorbente → chiaro = riflettente.
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
        "alpha": (245, 255),
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


def render_rgba(values, mask, value_range, colors, alpha_range, invert=False):
    low, high = value_range
    normalized = np.clip((values - low) / (high - low), 0, 1)
    if invert:
        normalized = 1 - normalized
    normalized = np.where(mask, 0, normalized)

    rgb = interpolate_colors(normalized, colors)
    alpha_low, alpha_high = alpha_range
    alpha = np.interp(normalized, [0, 1], [alpha_low, alpha_high])

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

        low, high = layer["value_range"]
        rgba = render_rgba(
            values,
            mask,
            layer["value_range"],
            layer["colors"],
            layer["alpha"],
            invert=layer.get("invert", False),
        )

        output_path = OUTPUT_DIR / layer["output"]
        Image.fromarray(rgba, mode="RGBA").save(output_path, optimize=True)

        return {
            "id": layer["id"],
            "url": f"/data/physical-drivers/{layer['output']}",
            "source": str(layer["source"].relative_to(ROOT)).replace("\\", "/"),
            "coordinates": layer_corners(src),
            "width": src.width,
            "height": src.height,
            "valueRange": [low, high],
        }


def shadow_value(properties):
    street_count = float(properties.get("street_shadow_pixel_count") or 0)
    roof_count = float(properties.get("roof_object_shadow_pixel_count") or 0)
    total_count = street_count + roof_count
    if total_count <= 0:
        return None

    street_mean = float(properties.get("street_shadow_mean") or 0)
    roof_mean = float(properties.get("roof_object_shadow_mean") or 0)
    return ((street_mean * street_count) + (roof_mean * roof_count)) / total_count


def render_shadow_layer(reference_layer):
    coordinates = reference_layer["coordinates"]
    west = min(point[0] for point in coordinates)
    east = max(point[0] for point in coordinates)
    south = min(point[1] for point in coordinates)
    north = max(point[1] for point in coordinates)
    width = reference_layer["width"]
    height = reference_layer["height"]
    output_transform = from_bounds(west, south, east, north, width, height)

    with SHADOW_SOURCE.open("r", encoding="utf8") as source_file:
        shadow_data = json.load(source_file)

    value_shapes = []
    mask_shapes = []
    for feature in shadow_data.get("features", []):
        geometry = feature.get("geometry")
        if not geometry:
            continue
        value = shadow_value(feature.get("properties", {}))
        if value is None:
            continue
        value_shapes.append((geometry, value))
        mask_shapes.append((geometry, 1))

    values = rasterize(
        value_shapes,
        out_shape=(height, width),
        transform=output_transform,
        fill=0,
        dtype="float32",
    )
    valid = rasterize(
        mask_shapes,
        out_shape=(height, width),
        transform=output_transform,
        fill=0,
        dtype="uint8",
    ).astype(bool)

    if not valid.any():
        raise RuntimeError("Shadow overlay is empty. Check the shadow GeoJSON CRS and bounds.")

    value_range = tuple(float(value) for value in np.percentile(values[valid], [5, 95]))
    rgba = render_rgba(
        values,
        ~valid,
        value_range,
        np.array(
            [
                [18, 114, 183],
                [139, 220, 241],
                [184, 241, 115],
            ],
            dtype=np.float32,
        ),
        (28, 214),
    )

    output = "shadow_means_direct_overlay.png"
    output_path = OUTPUT_DIR / output
    Image.fromarray(rgba, mode="RGBA").save(output_path, optimize=True)

    return {
        "id": "shade",
        "url": f"/data/physical-drivers/{output}",
        "source": str(SHADOW_SOURCE.relative_to(ROOT)).replace("\\", "/"),
        "coordinates": coordinates,
        "width": width,
        "height": height,
        "valueRange": list(value_range),
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    overlays = [render_layer(layer) for layer in LAYERS]
    overlays.append(render_shadow_layer(overlays[0]))
    manifest = {
        "note": "Direct MapLibre image overlays rendered from official HistorySUHI webapp rasters and shadow geometries. No narrative grid aggregation is applied.",
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