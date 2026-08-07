// Snapshot the Comune di Bologna's OFFICIAL climate-refuge network into
// src/data/rifugi_ufficiali.geojson.
//
// Why a snapshot and not a live fetch: every other dataset in this project is a
// local file (see the `?url` imports in reliefMaps.js), the story is static, and
// a third-party server that is slow or down must never be able to blank out a
// layer of the narrative. The trade-off is that the file goes stale when the
// city adds a refuge — re-run this script, and check the count in
// `rifugiCopy.counter` in src/data/climateRelief.js, which is written by hand
// precisely so nobody can publish a number the map doesn't draw.
//
// Source: the ArcGIS feature layer behind https://sitmappe.comune.bologna.it/RifugiClimatici
// (found via that app's config.json → webmap 1dca674bf8694636b9fdc9b4721904d7).
//
//   node scripts/build_rifugi_ufficiali.mjs

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LAYER =
  "https://sitmappe.comune.bologna.it/agshost/rest/services/Hosted/Rifugi_climatici/FeatureServer/0/query" +
  "?where=1%3D1&outFields=*&outSR=4326&f=geojson";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "rifugi_ufficiali.geojson");

// Only what the story renders. The source carries a full English mirror of every
// field, photo URLs and phone numbers: none of it reaches the page, so none of it
// needs to reach the bundle.
const round6 = (n) => Math.round(n * 1e6) / 1e6;
const clean = (v) => {
  const s = String(v ?? "").trim();
  return s && s !== "-" ? s : "";
};

const res = await fetch(LAYER);
if (!res.ok) throw new Error(`${LAYER} → ${res.status}`);
const raw = await res.json();
const src = raw.features || [];
if (!src.length) throw new Error("nessuna feature: il layer ha cambiato forma?");

const features = src
  .filter((f) => f.geometry && Array.isArray(f.geometry.coordinates))
  .map((f) => {
    const p = f.properties || {};
    return {
      type: "Feature",
      geometry: { type: "Point", coordinates: f.geometry.coordinates.slice(0, 2).map(round6) },
      properties: {
        nome: clean(p.nome),
        quartiere: clean(p.quartiere),
        tipo: clean(p.caratt_1), // "Biblioteca pubblica", "Parco pubblico"…
        // "Spazi interni" / "Spazi esterni" → the one distinction a citizen
        // needs on a hot afternoon: is there air conditioning or is there shade?
        ambiente: clean(p.legenda).toLowerCase().includes("intern") ? "interno" : "esterno",
        indirizzo: clean(p.indirizzo),
        acqua: clean(p.acqua),
        bagni: clean(p.bagni),
        orari: clean(p.orari),
      },
    };
  })
  .sort((a, b) => a.properties.nome.localeCompare(b.properties.nome, "it"));

const out = {
  type: "FeatureCollection",
  metadata: {
    fonte: "Comune di Bologna · rete dei rifugi climatici",
    mappa: "https://sitmappe.comune.bologna.it/RifugiClimatici/",
    aggiornato: new Date().toISOString().slice(0, 10),
    conteggio: features.length,
  },
  features,
};

writeFileSync(OUT, `${JSON.stringify(out, null, 1)}\n`, "utf8");

const interni = features.filter((f) => f.properties.ambiente === "interno").length;
console.log(`${features.length} rifugi ufficiali → ${OUT}`);
console.log(`  ${interni} al chiuso · ${features.length - interni} all'aperto`);
console.log("  ricordati di riallineare rifugiCopy.counter in src/data/climateRelief.js");
