"""Preprocess data for the Shadow Focus section.

Produces two artefacts under public/data/shadow-focus/:
  - centro_storico.geojson   the dissolved boundary of the 6 selected stat zones
  - centro_aggregates.json   real %s for NDVI / Albedo / Hotspot / Shadow

(bologna_shadow_lines.geojson — the city-wide shadow fills shown on the map — is
NOT written here: it is built from the cloned SCI repo by build_sci_shadow.mjs.
This script must not clobber it.)

Le sei zone statistiche del centro urbano, escludendo le due aree meridionali
che si estendono maggiormente verso la collina:
  - MARCONI-1  (30)
  - MARCONI-2  (29)
  - MALPIGHI-1 (78)
  - GALVANI-1  (53)
  - IRNERIO-1  (60)
  - IRNERIO-2  (61)
Il perché di questa scelta sta nel commento a CENTRO_STAT_CODES.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import rasterio
from rasterio.features import geometry_mask
from rasterio.warp import transform_geom
from shapely.geometry import shape, mapping
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parents[1]
EXTERNAL = ROOT / "external" / "historysuhi" / "webapp" / "data"
OUTPUT_DIR = ROOT / "public" / "data" / "shadow-focus"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Il centro urbano: i quattro nuclei (-1), più Marconi 2 e Irnerio 2. Restano
# fuori Galvani 2 e Malpighi 2, le due zone meridionali che si estendono verso
# la collina. Il perimetro risultante è continuo, riconoscibile e non è tagliato
# seguendo la distribuzione degli hotspot.
#
# Con tutte e otto le zone il 19 % di hotspot persistenti era corretto, ma la
# lunga estensione meridionale dominava il denominatore e non corrispondeva al
# centro urbanizzato raccontato dal testo. I soli quattro nuclei, al contrario,
# restringevano il soggetto fino a 0,89 km². Le sei zone mantengono la cintura
# urbana a nord e a ovest, eliminando insieme le due propaggini collinari:
# 2,84 km², di cui il 29,5 % è hotspot persistente.
#
# La tabella confronta questo perimetro con Bologna intera usando esattamente
# gli stessi indicatori e le stesse soglie. Non si confrontano percentuali
# costruite con denominatori diversi.
CENTRO_STAT_CODES = {29, 30, 53, 60, 61, 78}
CENTRO_MEMBERS = [
    "Marconi 1", "Marconi 2",
    "Malpighi 1",
    "Galvani 1",
    "Irnerio 1", "Irnerio 2",
]

STAT_ZONES_PATH = ROOT / "public" / "data" / "vectors" / "shadow_stat_zones_peak.geojson"
BOLOGNA_BOUNDARY_PATH = EXTERNAL / "webapp_vectors" / "bologna_boundary_outline.geojson"
NDVI_PATH = EXTERNAL / "webapp_rasters" / "NDVI_2025_summer_30m.tif"
ALBEDO_PATH = EXTERNAL / "webapp_rasters" / "Albedo_2025_summer_30m.tif"
# La soglia di ricorrenza degli hotspot (07 § 7.7). Era `hotspots_ge_1`, cioè
# «almeno 1 estate su 13»: dava il 72 %, ma contraddiceva la definizione data
# due schermate prima, dove gli hotspot sono le superfici che tornano fra le più
# calde quasi ogni estate. Ora è la stessa soglia della narrazione.
#
# Verificato per tre strade prima di fidarsene, perché il numero sembrava basso:
# contando i pixel del raster di persistenza, intersecando i poligoni del
# GeoJSON, e — per escludere un off-by-one — risommando a mano i tredici raster
# annuali, che danno il raster di persistenza con zero pixel di scarto.
#
# NOTA SULLA SORGENTE, da girare a chi produce `external/hotspot_10`: nelle
# estati 2017 e 2021 tutti i pixel del nucleo hanno un valore valido e NESSUNO
# rientra nel 10 % più caldo, mentre in cinque altre estati ce ne rientra il
# 95-99 %. Un selciato non esce dalla classifica per un'estate intera e poi ci
# rientra al 99 %: sono due annate da rifare. Toglierle non cambia però questo
# numero (dentro il centro non contribuiscono a nessun pixel: «9 su 13» e «9 su
# 11» danno lo stesso valore), quindi la tabella non le tratta in modo speciale.
HOTSPOT_MIN_SUMMERS = 9
HOTSPOT_PATH = (
    ROOT / "public" / "data" / "hotspots" / f"hotspots_ge_{HOTSPOT_MIN_SUMMERS}.geojson"
)
STREETS_SHADOW_PATH = EXTERNAL / "bologna_shadow_means" / "streets_shadow_means.geojson"
GREEN_SHADOW_PATH = EXTERNAL / "bologna_shadow_means" / "green_areas_shadow_means.geojson"

# Thresholds for "above/below" percentages (chosen to be editorially meaningful
# for the centro storico story — these are documented in centro_aggregates.json).
NDVI_VEGETATED_THRESHOLD = 0.45   # source app: relatively strong vegetation
ALBEDO_ABSORBING_THRESHOLD = 0.17  # albedo < 0.17 ≈ assorbente vs reflective


def load_geojson(path: Path):
    with path.open("r", encoding="utf8") as fh:
        return json.load(fh)


def format_percent(value: float) -> str:
    """Round percentages conventionally (half up), not with Python's banker rule."""
    return f"{int(np.floor(value + 0.5))} %"


def write_geojson(path: Path, data) -> None:
    with path.open("w", encoding="utf8") as fh:
        json.dump(data, fh, separators=(",", ":"))


def build_centro_boundary() -> dict:
    data = load_geojson(STAT_ZONES_PATH)
    members = [
        f for f in data["features"]
        if f["properties"].get("codice_area_statistica") in CENTRO_STAT_CODES
    ]
    if len(members) != len(CENTRO_STAT_CODES):
        raise RuntimeError(
            f"Expected {len(CENTRO_STAT_CODES)} centro zones, found {len(members)}"
        )
    geoms = [shape(f["geometry"]) for f in members]
    dissolved = unary_union(geoms).buffer(0)
    feature = {
        "type": "Feature",
        "properties": {
            "name": "Centro urbano di Bologna",
            "members": sorted(CENTRO_STAT_CODES),
            "area_m2": float(sum(f["properties"]["geometry_area_m2"] for f in members)),
            "shadow_area_weighted_mean": float(
                sum(
                    f["properties"]["mean"] * f["properties"]["geometry_area_m2"]
                    for f in members
                )
                / sum(f["properties"]["geometry_area_m2"] for f in members)
            ),
        },
        "geometry": mapping(dissolved),
    }
    return {"type": "FeatureCollection", "features": [feature]}


def shadow_area_weighted_percent(features: list[dict]) -> float:
    """Area-weighted mean shadow fraction, expressed as a percentage."""
    usable = [
        f for f in features
        if f["properties"].get("mean") is not None
        and f["properties"].get("geometry_area_m2")
    ]
    total_area = sum(float(f["properties"]["geometry_area_m2"]) for f in usable)
    if total_area <= 0:
        return 0.0
    weighted = sum(
        float(f["properties"]["mean"]) * float(f["properties"]["geometry_area_m2"])
        for f in usable
    )
    return 100.0 * weighted / total_area


def raster_percent_above(raster_path: Path, centro_geom_geo, threshold: float, *, invert: bool = False) -> float:
    """Return the percentage of finite pixels in `raster_path` clipped to
    centro_geom_geo (in EPSG:4326) whose value is >= threshold (or < threshold
    if invert=True)."""
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
    """% dell'area coperta dagli hotspot a HOTSPOT_MIN_SUMMERS/13.

    Il rapporto è calcolato in UTM 32N, non sui gradi di EPSG:4326, così centro
    e territorio comunale usano vere aree metriche.
    """
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


def build_shadow_lines() -> dict:
    """Merge streets + green areas shadow data into one slim FeatureCollection.

    For each feature we keep only the fields needed for rendering:
      - kind: "street" | "green"
      - name: human-readable label
      - shadow_mean: 0..1 mean shadow fraction (street_shadow_mean preferred,
        falls back to roof_object_shadow_mean for green areas where street_shadow
        is not meaningful)
    Geometry is simplified (~3m tolerance) to keep the bundle small.
    """
    out_features = []
    for path, kind in [(STREETS_SHADOW_PATH, "street"), (GREEN_SHADOW_PATH, "green")]:
        data = load_geojson(path)
        for f in data["features"]:
            geom = f.get("geometry")
            if not geom:
                continue
            props = f["properties"]
            shadow = props.get("street_shadow_mean")
            if shadow is None and kind == "green":
                shadow = props.get("roof_object_shadow_mean")
            if shadow is None:
                continue
            try:
                g = shape(geom)
            except Exception:
                continue
            if g.is_empty:
                continue
            # Drop microscopic features (visual noise at city scale)
            if hasattr(g, "area") and g.area > 0 and g.area < 5e-9:
                continue
            if hasattr(g, "length") and g.area == 0 and g.length < 5e-5:
                continue
            # Aggressive simplification: ~10m tolerance is plenty at city scale.
            simplified = g.simplify(9e-5, preserve_topology=True)
            if simplified.is_empty:
                continue
            out_features.append({
                "type": "Feature",
                "properties": {
                    "k": "s" if kind == "street" else "g",
                    "s": round(float(shadow), 3),
                },
                "geometry": mapping(simplified),
            })
    return {"type": "FeatureCollection", "features": out_features}


def main() -> None:
    print("-> perimetro delle sei zone centrali…")
    centro_fc = build_centro_boundary()
    centro_feature = centro_fc["features"][0]
    centro_geom_geo = centro_feature["geometry"]
    write_geojson(OUTPUT_DIR / "centro_storico.geojson", centro_fc)

    stat_zones = load_geojson(STAT_ZONES_PATH)["features"]
    bologna_feature = load_geojson(BOLOGNA_BOUNDARY_PATH)["features"][0]
    bologna_geom_geo = bologna_feature["geometry"]

    print("-> aggregati centro / Bologna…")
    ndvi_pct = raster_percent_above(NDVI_PATH, centro_geom_geo, NDVI_VEGETATED_THRESHOLD)
    albedo_pct = raster_percent_above(
        ALBEDO_PATH, centro_geom_geo, ALBEDO_ABSORBING_THRESHOLD, invert=True
    )
    hotspot_pct = hotspot_coverage_percent(centro_geom_geo)
    shadow_pct = centro_feature["properties"]["shadow_area_weighted_mean"] * 100

    bologna_ndvi_pct = raster_percent_above(
        NDVI_PATH, bologna_geom_geo, NDVI_VEGETATED_THRESHOLD
    )
    bologna_albedo_pct = raster_percent_above(
        ALBEDO_PATH, bologna_geom_geo, ALBEDO_ABSORBING_THRESHOLD, invert=True
    )
    bologna_hotspot_pct = hotspot_coverage_percent(bologna_geom_geo)
    bologna_shadow_pct = shadow_area_weighted_percent(stat_zones)

    # Solo numeri e provenienza. Le etichette che il lettore vede stanno in
    # src/data/shadowFocus.js, come tutti gli altri testi della storia: chi
    # tocca una frase apre un file di dati, non uno script di build (e non deve
    # rigenerare un raster per cambiare una parola).
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
            "superfici assorbenti: albedo < 0,17."
        ),
        "source": (
            "Fonte: superfici osservate da satellite (estati dal 2013 al 2025); "
            "ombra dalle simulazioni del Comune di Bologna (estate 2025)."
        ),
    }
    with (OUTPUT_DIR / "centro_aggregates.json").open("w", encoding="utf8") as fh:
        json.dump(aggregates, fh, indent=2, ensure_ascii=False)

    # NB: bologna_shadow_lines.geojson (the map fills) is built by
    # build_sci_shadow.mjs from the cloned SCI repo — do not overwrite it here.

    print()
    print("=== sei zone centrali / Bologna ===")
    print(f"  area: {centro_feature['properties']['area_m2'] / 1e6:.2f} km2")
    print(
        f"  NDVI >= {NDVI_VEGETATED_THRESHOLD:.2f}: "
        f"{ndvi_pct:.1f} % / {bologna_ndvi_pct:.1f} %"
    )
    print(
        f"  Albedo < {ALBEDO_ABSORBING_THRESHOLD:.2f}: "
        f"{albedo_pct:.1f} % / {bologna_albedo_pct:.1f} %"
    )
    print(
        f"  Hotspot >={HOTSPOT_MIN_SUMMERS}/13: "
        f"{hotspot_pct:.1f} % / {bologna_hotspot_pct:.1f} %"
    )
    print(f"  Ombra media:   {shadow_pct:.1f} % / {bologna_shadow_pct:.1f} %")


if __name__ == "__main__":
    main()
