/**
 * Porta un basemap Positron sulla carta della storia.
 *
 * Positron è un bianco freddo (il suo fondo è rgb(242,243,240), le strade sono
 * grigi neutri), la storia è avorio caldo: sulla giunzione fra la pagina e la
 * mappa quella differenza si legge come uno stacco, e nessuna transizione la
 * può nascondere, perché non è un problema di come si entra ma di dove si
 * arriva.
 *
 * Qui si riverniciano SOLO i livelli dello stile di base, cioè scenografia:
 * nessuna scala di dati è toccata, e non può esserlo — questa funzione gira
 * appena lo stile è caricato, quando i nostri livelli non esistono ancora.
 *
 * Il criterio: tutto ciò che è terra diventa una carta appena più scura del
 * fondo, le strade due grigi caldi (il tratto e il suo alone), l'acqua resta
 * l'unica cosa fredda della mappa perché è l'unica che deve dire «acqua».
 */

const PAPER = "#F6F4EE"; // = --paper
const LAND = "#EFEBDF";
const ROAD = "#E6E1D3";
const ROAD_CASING = "#DAD3C3";
const ROAD_DASH = "#F3EFE4";

// I livelli che meritano un valore loro invece del colore generico.
const EXPLICIT = {
  water: ["fill-color", "#DBE0DF"],
  waterway: ["line-color", "#DBE0DF"],
  park: ["fill-color", "#E8E8D6"],
  landcover_wood: ["fill-color", "#E3E3D0"],
  landuse_residential: ["fill-color", "#F1EDE1"],
  building: ["fill-color", "#EBE7DA"],
};

export function applyPaperBasemap(map) {
  const layers = map.getStyle().layers || [];

  layers.forEach((layer) => {
    const { id, type } = layer;

    if (type === "background") {
      map.setPaintProperty(id, "background-color", PAPER);
      return;
    }

    const explicit = EXPLICIT[id];
    if (explicit) {
      map.setPaintProperty(id, explicit[0], explicit[1]);
      return;
    }

    if (type === "line") {
      // Le dashline stanno SOPRA la loro linea e la interrompono: se prendono
      // lo stesso colore il tratteggio sparisce.
      if (id.endsWith("_dashline")) map.setPaintProperty(id, "line-color", ROAD_DASH);
      else if (id.includes("casing")) map.setPaintProperty(id, "line-color", ROAD_CASING);
      else map.setPaintProperty(id, "line-color", ROAD);
      return;
    }

    if (type === "fill") {
      map.setPaintProperty(id, "fill-color", LAND);
    }
  });
}
