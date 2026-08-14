"""Build the Hotspot persistence GeoJSON series documented in D03."""

import json
import os
from pathlib import Path

import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.features import shapes
from shapely.geometry import MultiPolygon, Polygon, mapping, shape
from shapely.ops import unary_union

from lib.data_inputs import require_data_input, resolve_data_input


ROOT = Path(__file__).resolve().parents[1]
SRC_PATH = resolve_data_input("hotspotPersistenceRaster")
OUT_DIR = os.path.join("public", "data", "hotspots")
BOUNDARY_PATH = ROOT / "public" / "data" / "vectors" / "bologna_boundary_outline.geojson"

THRESHOLDS = [
    {
        "name": f"hotspots_ge_{value}",
        "filter": lambda values, threshold=value: values >= threshold,
        "threshold": f"ge_{value}",
        "label": f">= {value} {'estate' if value == 1 else 'estati'}",
    }
    for value in range(1, 14)
]

SIMPLIFY_TOLERANCE = 0.00005


def load_bologna_boundary():
    with open(BOUNDARY_PATH, "r", encoding="utf-8") as boundary_file:
        boundary_data = json.load(boundary_file)

    if boundary_data.get("type") == "FeatureCollection":
        geoms = [
            shape(feature["geometry"])
            for feature in boundary_data.get("features", [])
            if feature.get("geometry")
        ]
        return unary_union(geoms)

    if boundary_data.get("type") == "Feature":
        return shape(boundary_data["geometry"])

    return shape(boundary_data)


def reproject_geom(geom, transformer):
    if geom.geom_type == "Polygon":
        exterior = [transformer.transform(x, y) for x, y in geom.exterior.coords]
        interiors = [
            [transformer.transform(x, y) for x, y in ring.coords]
            for ring in geom.interiors
        ]
        return shape({"type": "Polygon", "coordinates": [exterior] + interiors})

    if geom.geom_type == "MultiPolygon":
        return MultiPolygon([reproject_geom(poly, transformer) for poly in geom.geoms])

    return geom


def feature_from_polygon(poly, threshold):
    return {
        "type": "Feature",
        "properties": {
            "threshold": threshold["threshold"],
            "source": "HistorySUHI",
            "period": "2013-2025",
            "hotspot_percentile": "top_10_pct",
            "label": threshold["label"],
        },
        "geometry": mapping(poly),
    }


def extract_polygons(geom):
    if geom.is_empty:
        return []
    if isinstance(geom, Polygon):
        return [geom]
    if isinstance(geom, MultiPolygon):
        return [poly for poly in geom.geoms if not poly.is_empty]
    if geom.geom_type == "GeometryCollection":
        polygons = []
        for part in geom.geoms:
            polygons.extend(extract_polygons(part))
        return polygons
    return []


def main():
    require_data_input("hotspotPersistenceRaster")
    os.makedirs(OUT_DIR, exist_ok=True)
    bologna_boundary = load_bologna_boundary()

    with rasterio.open(SRC_PATH) as dataset:
        data = dataset.read(1)
        transform = dataset.transform
        src_crs = dataset.crs
        nodata = dataset.nodata

    if nodata is not None:
        data[data == nodata] = 0

    transformer = Transformer.from_crs(src_crs, "EPSG:4326", always_xy=True)

    for threshold in THRESHOLDS:
        print(f"Processing {threshold['name']}...")

        mask = threshold["filter"](data).astype(np.uint8)
        pixel_count = int(mask.sum())
        print(f"  Pixels matching: {pixel_count}")

        if pixel_count == 0:
            print("  Skipping - no pixels match.")
            continue

        geoms = [
            shape(geom)
            for geom, value in shapes(mask, mask=mask, transform=transform)
            if value == 1
        ]

        if not geoms:
            print("  No polygons extracted.")
            continue

        merged = unary_union(geoms)
        reprojected = reproject_geom(merged, transformer)
        simplified = reprojected.simplify(SIMPLIFY_TOLERANCE, preserve_topology=True)
        clipped = simplified.intersection(bologna_boundary)
        polygons = extract_polygons(clipped)

        features = [feature_from_polygon(poly, threshold) for poly in polygons]

        geojson = {"type": "FeatureCollection", "features": features}

        out_path = os.path.join(OUT_DIR, f"{threshold['name']}.geojson")
        with open(out_path, "w", encoding="utf-8") as out_file:
            json.dump(geojson, out_file)

        size_kb = os.path.getsize(out_path) / 1024
        print(f"  -> {out_path} ({len(features)} features, {size_kb:.0f} KB)")

    print("\nDone.")


if __name__ == "__main__":
    main()
