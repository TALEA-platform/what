
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const LAYER =
  "https://sitmappe.comune.bologna.it/agshost/rest/services/Hosted/Rifugi_climatici/FeatureServer/0/query" +
  "?where=1%3D1&outFields=*&outSR=4326&f=geojson";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "data", "rifugi_ufficiali.geojson");

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
        tipo: clean(p.caratt_1),
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
console.log("  esegui npm run data:build per rigenerare e validare le statistiche locali");
