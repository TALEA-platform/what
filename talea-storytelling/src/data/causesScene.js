/**
 * Testi della scena "cause" — "Perché proprio qui?" (prompt §5).
 *
 * Stato dei testi (prompt §5):
 *  - `title` e `aperture` sono DEFINITIVI.
 *  - `clueGreen`, `clueMaterials`, `compare` sono testi di scena coerenti con lo
 *    stile ma ANCORA DA VALIDARE: editabili qui senza toccare il JSX.
 *
 * Vincoli (§2): voce narrativa, niente descrizione dell'UI, niente "NDVI/albedo"
 * nel corpo, caldo raccontato in rapporto alla città, niente slogan/micro-etichette.
 */

// ── Titolo + apertura (DEFINITIVI) ──────────────────────────────────────────
export const title = "Perché proprio qui?";

export const aperture =
  "Per capire perché il calore tende ad immagazzinarsi proprio in queste zone, dobbiamo guardare il territorio più da vicino.";

/**
 * Il secondo blocco dell'apertura (06 § 6.1), a segmenti e non a stringa: due
 * parole vanno in grassetto, e una delle due deve poter essere presa e portata
 * altrove.
 *
 * Annuncia i due capitoli della scena prima di entrarci, così il lettore sa
 * quanti ne restano. Prima diceva «Tra le diverse cause, ce ne sono due in
 * particolare che incidono visibilmente sulla capacità di trattenere o mitigare
 * il caldo»: la stessa cosa, senza nominarla.
 *
 * `topic` marca i due concetti da cui partono le copie dirette all'indice sticky
 * sopra le mappe. Le parole vere restano sempre dentro questo testo.
 */
export const apertureCauseParts = [
  { text: "Le cause sono diverse: tra le principali ci sono la quantità del " },
  { text: "verde", kw: true, topic: "green" },
  { text: " e la capacità di " },
  { text: "assorbimento dei " },
  { text: "materiali", kw: true, topic: "materials" },
  { text: "." },
];

/**
 * Etichette dell'indice sticky. `greenTopicWord` viene anche cercata dentro la
 * descrizione del verde per applicarle la stessa enfasi tipografica.
 */
export const greenTopicWord = "verde";
export const materialsTopicWord = "materiali";

// Ultima frase dell'apertura: staccata e in grassetto (stesso stile delle altre sezioni).
export const apertureClose = "Analizziamole nel dettaglio.";

// ── Indizi, legame, ingresso, confronto (DA VALIDARE) ───────────────────────
export const clueGreen =
  "Il verde, inteso come presenza e densità della vegetazione sul territorio, non offre solo ombra, ma rilascia umidità nell'aria contribuendo a mitigare la temperatura circostante.\n\nDove alberi e piante si diradano, il tessuto urbano perde questa naturale capacità di bilanciare il calore.";

// DA VALIDARE — riformulata per non ripetere la frase "asfalto/tetti/piazze" già
// usata nella Sezione 1: qui si racconta solo il comportamento delle superfici.
export const clueMaterials =
  "I materiali da cui è composta la città, dall'asfalto delle strade al cemento degli edifici, rispondono al sole in base alle loro proprietà fisiche. \n\n Le superfici scure e compatte raggiungono temperature più elevate e si raffreddano più lentamente, influenzando anche le condizioni dell’ambiente circostante.";

// Le incise usano trattini lunghi (em dash) — punteggiatura corretta, non trattini
// di sillabazione: a fine riga non si confondono con un "a-capo" spezzato.
export const compare =
  "Quando materiali ad alto assorbimento e una scarsa presenza di verde coesistono nella stessa zona, il calore trova le condizioni per persistere più a lungo.";

// ── Micro-hint sulla maniglia dello split (NON nel corpo) ────────────────────
export const handleHint = "trascina";

/**
 * Legende delle due scale dati, una per lente (06 § 6.5).
 *
 * Le scale NON si toccano: verde = vegetazione, bianco e nero = quanto la
 * superficie assorbe o riflette. Sono due convenzioni che si spiegano da sole
 * nel momento in cui si guardano, ed è la ragione per cui la proposta di
 * unificarle è stata ritirata (00 § 3.2).
 *
 * Le etichette dicono **il soggetto**, non la scala: «meno verde → più verde»,
 * non «basso → alto». Serve perché il verde in questa storia ricorre con tre
 * significati diversi (vegetazione qui, rifugi più avanti, marchio ovunque) e
 * la legenda è l'unico punto in cui si può disambiguare a costo zero.
 *
 * Stanno qui e non nel JSX per la stessa regola di tutti gli altri testi.
 */
export const lensLegends = {
  green: {
    bar: "linear-gradient(90deg, #e6ead0, #93c47d, #1f7038)",
    from: "meno vegetazione",
    to: "più vegetazione",
  },
  materials: {
    bar: "linear-gradient(90deg, #2e2e2e, #9a9a9a, #f2f2f2)",
    from: "assorbe il sole",
    to: "riflette il sole",
  },
};

// Legenda del confronto: nel confronto le due scale sono già state lette una
// per una, e sulla mappa resta solo il contorno rosso degli hotspot.
export const hotspotLegendLabel = "Hotspot 10% ≥ 9/13";

/**
 * Stage della scena, in ordine di scroll. Pilotano crossfade + camera + testo + lato.
 * `lens` = raster in primo piano ("green" | "materials" | "compare").
 * `pos`  = lato del ritaglio sullo schermo ("left" | "right" | "center"); il testo
 *          va sul lato opposto. Verde→materiali fa uno swap animato dei lati.
 */
export const causeStages = [
  { id: "clue-green", lens: "green", pos: "left", body: clueGreen },
  { id: "clue-materials", lens: "materials", pos: "right", body: clueMaterials },
  { id: "compare", lens: "compare", pos: "center", body: compare },
];
