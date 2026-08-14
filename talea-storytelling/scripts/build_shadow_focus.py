"""Build the Shadow Focus boundary and aggregates documented in D09."""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom
from shapely import make_valid
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

from lib.data_inputs import require_data_input, resolve_data_input


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "data" / "shadow-focus"

CENTRO_MEMBERS = [
    "Marconi 1", "Marconi 2",
    "Malpighi 1",
    "Galvani 1",
    "Irnerio 1", "Irnerio 2",
]

CENTRO_BOUNDARY_PATH = OUTPUT_DIR / "centro_storico.geojson"
SHADOW_LINES_PATH = OUTPUT_DIR / "bologna_shadow_lines.geojson"
BOLOGNA_BOUNDARY_PATH = ROOT / "public" / "data" / "vectors" / "bologna_boundary_outline.geojson"
NDVI_PATH = resolve_data_input("ndvi2025Raster")
ALBEDO_PATH = resolve_data_input("albedo2025Raster")
HOTSPOT_MIN_SUMMERS = 9
HOTSPOT_PATH = (
    ROOT / "public" / "data" / "hotspots" / f"hotspots_ge_{HOTSPOT_MIN_SUMMERS}.geojson"
)
NDVI_VEGETATED_THRESHOLD = 0.45
ALBEDO_ABSORBING_THRESHOLD = 0.165
SHADOW_SOURCE_CRS = "EPSG:4326"
METRIC_CRS = "EPSG:32632"


def load_geojson(path: Path):
    with path.open("r", encoding="utf8") as fh:
        return json.load(fh)


def format_percent(value: float) -> str:
    """Round percentages conventionally (half up), not with Python's banker rule."""
    return f"{int(np.floor(value + 0.5))} %"


def metric_geometry(geometry: dict, label: str):
    try:
        geom = shape(geometry)
    except Exception as exc:
        raise RuntimeError(f"{label}: unreadable geometry: {exc}") from exc
    if geom.is_empty:
        raise RuntimeError(f"{label}: empty geometry")
    if not geom.is_valid:
        geom = make_valid(geom)
    if geom.is_empty or not geom.is_valid:
        raise RuntimeError(f"{label}: geometry remains invalid after make_valid")

    metric = shape(
        transform_geom(
            SHADOW_SOURCE_CRS,
            METRIC_CRS,
            mapping(geom),
            precision=-1,
        )
    )
    if not metric.is_valid:
        metric = make_valid(metric)
    if metric.is_empty or not metric.is_valid or metric.area <= 0:
        raise RuntimeError(f"{label}: unusable metric geometry after make_valid")
    return metric


def shadow_area_weighted_percent(features: list[dict], boundary_geometry: dict) -> float:
    """Area-weighted D07 street + green shadow fraction, expressed as a percentage."""
    boundary = metric_geometry(boundary_geometry, "shadow boundary")
    total_area = 0.0
    weighted_shadow = 0.0

    for index, feature in enumerate(features):
        properties = feature.get("properties") or {}
        if properties.get("k") not in {"s", "g"}:
            raise RuntimeError(f"D07 feature {index}: expected k='s' or k='g'")
        shadow = properties.get("s")
        if (
            isinstance(shadow, bool)
            or not isinstance(shadow, (int, float))
            or not np.isfinite(shadow)
            or not 0 <= shadow <= 1
        ):
            raise RuntimeError(f"D07 feature {index}: invalid shadow fraction {shadow!r}")
        geometry = feature.get("geometry")
        if not geometry:
            raise RuntimeError(f"D07 feature {index}: missing geometry")

        feature_geometry = metric_geometry(geometry, f"D07 feature {index}")
        try:
            clipped = feature_geometry.intersection(boundary)
        except Exception as exc:
            raise RuntimeError(f"D07 feature {index}: clipping failed: {exc}") from exc
        if clipped.is_empty or clipped.area <= 0:
            continue
        if not clipped.is_valid:
            clipped = make_valid(clipped)
        if clipped.is_empty or not clipped.is_valid or clipped.area <= 0:
            raise RuntimeError(f"D07 feature {index}: unusable clipped geometry")

        clipped_area = clipped.area
        # Street/green overlaps intentionally retain both feature weights.
        total_area += clipped_area
        weighted_shadow += clipped_area * float(shadow)

    if total_area <= 0:
        raise RuntimeError("D07 shadow: no positive clipped feature area")
    return 100.0 * weighted_shadow / total_area


def raster_percent_above(raster_path: Path, centro_geom_geo, threshold: float, *, invert: bool = False) -> float:
    """Measure finite clipped pixels above, or below when inverted, a threshold."""
    with rasterio.open(raster_path) as src:
        centro_reprojected = transform_geom("EPSG:4326", src.crs.to_string(), centro_geom_geo)
        mask = geometry_mask(
            [centro_reprojected],
            out_shape=(src.height, src.width),
            transform=src.transform,
            invert=True,
        )
        band = src.read(1, masked=True).astype("float32")
        values = band.filled(np.nan)
        inside = mask & np.isfinite(values)
        total = int(inside.sum())
        if total == 0:
            return 0.0
        if invert:
            hits = int(np.sum(inside & (values < threshold)))
        else:
            hits = int(np.sum(inside & (values >= threshold)))
        return 100.0 * hits / total


def hotspot_coverage_percent(area_geom_geo) -> float:
    """Measure hotspot coverage in metric UTM 32N areas, not geographic degrees."""
    area_shape = shape(
        transform_geom("EPSG:4326", "EPSG:32632", area_geom_geo)
    )
    hotspots = load_geojson(HOTSPOT_PATH)
    polys = [
        shape(transform_geom("EPSG:4326", "EPSG:32632", f["geometry"]))
        for f in hotspots["features"]
    ]
    hotspot_union = unary_union(polys).buffer(0)
    covered = area_shape.intersection(hotspot_union)
    if area_shape.area <= 0:
        return 0.0
    return 100.0 * covered.area / area_shape.area


def metric_with_bologna(value: float, bologna_value: float, **extra) -> dict:
    """Build one table metric and its like-for-like municipal comparison."""
    return {
        "value_pct": round(value, 1),
        "value_fmt": format_percent(value),
        "bologna_pct": round(bologna_value, 1),
        "bologna_fmt": format_percent(bologna_value),
        **extra,
    }


def main() -> None:
    require_data_input("ndvi2025Raster")
    require_data_input("albedo2025Raster")
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("-> perimetro versionato delle sei zone centrali…")
    centro_fc = load_geojson(CENTRO_BOUNDARY_PATH)
    if len(centro_fc.get("features", [])) != 1:
        raise RuntimeError("Expected one feature in centro_storico.geojson")
    centro_feature = centro_fc["features"][0]
    centro_geom_geo = centro_feature["geometry"]

    bologna_fc = load_geojson(BOLOGNA_BOUNDARY_PATH)
    if len(bologna_fc.get("features", [])) != 1:
        raise RuntimeError("Expected one feature in bologna_boundary_outline.geojson")
    bologna_feature = bologna_fc["features"][0]
    bologna_geom_geo = bologna_feature["geometry"]

    shadow_fc = load_geojson(SHADOW_LINES_PATH)
    if shadow_fc.get("type") != "FeatureCollection":
        raise RuntimeError("Expected a FeatureCollection in bologna_shadow_lines.geojson")
    shadow_features = shadow_fc.get("features", [])

    print("-> aggregati centro / Bologna…")
    ndvi_pct = raster_percent_above(NDVI_PATH, centro_geom_geo, NDVI_VEGETATED_THRESHOLD)
    albedo_pct = raster_percent_above(
        ALBEDO_PATH, centro_geom_geo, ALBEDO_ABSORBING_THRESHOLD, invert=True
    )
    hotspot_pct = hotspot_coverage_percent(centro_geom_geo)
    shadow_pct = shadow_area_weighted_percent(shadow_features, centro_geom_geo)

    bologna_ndvi_pct = raster_percent_above(
        NDVI_PATH, bologna_geom_geo, NDVI_VEGETATED_THRESHOLD
    )
    bologna_albedo_pct = raster_percent_above(
        ALBEDO_PATH, bologna_geom_geo, ALBEDO_ABSORBING_THRESHOLD, invert=True
    )
    bologna_hotspot_pct = hotspot_coverage_percent(bologna_geom_geo)
    bologna_shadow_pct = shadow_area_weighted_percent(
        shadow_features,
        bologna_geom_geo,
    )

    aggregates = {
        "boundary": {
            "label": "Il centro urbano di Bologna",
            "members": CENTRO_MEMBERS,
            "area_m2": centro_feature["properties"]["area_m2"],
        },
        "metrics": {
            "shadow": metric_with_bologna(shadow_pct, bologna_shadow_pct),
            "hotspot": metric_with_bologna(
                hotspot_pct,
                bologna_hotspot_pct,
                min_summers=HOTSPOT_MIN_SUMMERS,
            ),
            "ndvi": metric_with_bologna(ndvi_pct, bologna_ndvi_pct),
            "albedo": metric_with_bologna(albedo_pct, bologna_albedo_pct),
        },
        "method": (
            "Ogni percentuale è misurata dentro le sei zone centrali, escluse "
            "Galvani 2 e Malpighi 2 perché si estendono verso la collina, e "
            "rapportata alla sola superficie di quel perimetro. La media "
            "comunale usa gli stessi indicatori e le stesse soglie sull'intero "
            "territorio di Bologna: per gli hotspot è la quota di superficie "
            "comunale coperta; per vegetazione e albedo è la quota di pixel "
            "validi; per l'ombra è la media delle aree statistiche pesata per "
            "la loro superficie. Non è una media semplice delle zone. Gli "
            "indicatori non vanno sommati. "
            f"Superfici molto calde: nel 10 % più caldo di Bologna in almeno "
            f"{HOTSPOT_MIN_SUMMERS} estati su 13; vegetazione: indice ≥ 0,45; "
            "superfici assorbenti: albedo < 0,165."
        ),
        "source": (
            "Fonte: superfici osservate da satellite (estati dal 2013 al 2025); "
            "ombra dalle simulazioni del Comune di Bologna (estate 2025)."
        ),
    }
    with (OUTPUT_DIR / "centro_aggregates.json").open("w", encoding="utf8") as fh:
        json.dump(aggregates, fh, indent=2, ensure_ascii=False)


    print()
    print("=== sei zone centrali / Bologna ===")
    print(f"  area: {centro_feature['properties']['area_m2'] / 1e6:.2f} km2")
    print(
        f"  NDVI >= {NDVI_VEGETATED_THRESHOLD:.2f}: "
        f"{ndvi_pct:.1f} % / {bologna_ndvi_pct:.1f} %"
    )
    print(
        f"  Albedo < {ALBEDO_ABSORBING_THRESHOLD:.3f}: "
        f"{albedo_pct:.1f} % / {bologna_albedo_pct:.1f} %"
    )
    print(
        f"  Hotspot >={HOTSPOT_MIN_SUMMERS}/13: "
        f"{hotspot_pct:.1f} % / {bologna_hotspot_pct:.1f} %"
    )
    print(f"  Ombra media:   {shadow_pct:.1f} % / {bologna_shadow_pct:.1f} %")


if __name__ == "__main__":
    main()
