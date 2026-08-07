// Copy + structure for the closing chapter "Gli spazi verdi sono la soluzione" —
// the answer the city offers to the heat: what a climate refuge really is, the
// network Bologna already has, and how the city grows that relief where it is
// missing (NBS → corridoi → portici).
//
// Voice: the same citizen-facing, evocative-but-plain Italian as the rest of the
// story — curly apostrophes, a bold stand-out line to close each beat, no jargon,
// no UI description. Nessun trattino nel testo (CONTESTO.md § 7): gli incisi si
// riscrivono con virgole o due punti.

// ── Chapter opening ─────────────────────────────────────────────────────────
// Titolo deciso dal committente il 2026-07-28 (D2, opzione D). La formulazione è
// affermativa e afferma che gli spazi verdi SONO la risposta: perché non litighi
// con l'explainer, la chiusura della tappa 7 è stata riscritta di conseguenza
// (non più «non è semplicemente un parco», ma «ecco cos'è uno spazio verde fatto
// bene»). Le due frasi vanno lette insieme: cambiarne una sola rimette in piedi
// la contraddizione.
export const reliefHeader = {
  title: "Gli spazi verdi sono la soluzione.",
  lead: {
    before: "Un ",
    term: "rifugio climatico",
    after: " nasce quando più forme di sollievo si incontrano nello stesso luogo.",
  },
  body: [
    "Questa combinazione trasforma uno spazio di passaggio in un luogo dove fermarsi, rinfrescarsi e riprendere fiato nelle ore più calde.",
  ],
  close: "Vediamo come una strada può diventarlo, un elemento alla volta.",
};

// ── Sticky-figure explainer: a street becomes a refuge, element by element ────
export const rifugioFigureLabel =
  "Una strada assolata di Bologna — sullo sfondo le Due Torri e i colli — si trasforma progressivamente in un rifugio climatico: compaiono ombra, strutture leggere, sedute, acqua, verde e suolo permeabile, una fermata dell’autobus a due passi. Il sole resta ma si fa più leggero, gli oggetti proiettano ombre e piccole etichette indicano la temperatura al sole e all’ombra. Le persone accaldate ritrovano il sorriso.";

// Each step carries: `added` — the short "what's new" status shown above the
// vignette; `piece` — the ingredient it adds to the cumulative "un rifugio è
// fatto di…" recipe line below (null where nothing new is added); `tone` — come
// si legge il testo a destra.
//
// ── Perché le tappe sono righe e non paragrafi ──────────────────────────────
// Con un paragrafo per tappa il lettore leggeva OPPURE guardava, non tutt'e due:
// la vignetta è il contenuto, e mentre l'occhio scendeva su tre righe di testo
// il pezzo nuovo si era già disegnato. Ora ogni tappa è **una riga sola**, 5-10
// parole, che si legge in un secondo e lascia il resto della battuta al disegno.
//
// La riga non ripete la pillola sopra la vignetta: la pillola dice **che cosa**
// arriva ("+ Acqua per rinfrescarsi"), la riga dice **che cosa cambia** ("le ore
// peggiori diventano sopportabili"). Chi le scrive tenga d'occhio le due cose
// insieme: se cominciano a dire la stessa cosa, una delle due è di troppo.
//
// L'unica tappa che resta un testo disteso è l'ultima: lì non si aggiunge più
// niente al disegno, si tira la somma, e il lettore ha tutto il tempo di leggere
// perché la sequenza è finita.
//
// Da ~254 parole a ~106. Le durate sono calcolate dal numero di parole
// (RifugioExplainer.jsx), quindi accorciare un testo accorcia da sé la scena:
// non c'è un secondo posto da aggiornare.
export const rifugioSteps = [
  {
    id: 0,
    added: "La trasformazione comincia",
    piece: null,
    tone: "key",
    paragraphs: [
      "Una piazza spoglia e senza ripari.",
    ],
  },
  {
    id: 1,
    added: "Ombra naturale",
    piece: "ombra",
    tone: "key",
    paragraphs: ["Le chiome filtrano il sole e offrono il primo riparo."],
  },
  {
    id: 2,
    added: "Ombra continua",
    piece: "riparo continuo",
    tone: "key",
    paragraphs: ["Pergole e tettoie proteggono anche dove gli alberi non arrivano."],
  },
  {
    id: 3,
    added: "Sosta",
    piece: "sosta",
    tone: "key",
    paragraphs: ["Una seduta all’ombra trasforma il passaggio in una pausa."],
  },
  {
    id: 4,
    added: "Acqua",
    piece: "acqua",
    tone: "key",
    paragraphs: ["Avere acqua a disposizione per bere e rinfrescarsi aiuta ad abbassare la temperatura corporea."],
  },
  {
    id: 5,
    added: "Suolo vivo",
    piece: "verde e suolo vivo",
    tone: "key",
    paragraphs: ["Il verde a terra mitiga il calore e permette all'acqua piovana di infiltrarsi naturalmente nel terreno."],
  },
  {
    id: 6,
    added: "Accessibilità",
    piece: "accessibilità",
    tone: "key",
    paragraphs: ["Il rifugio funziona davvero se è inclusivo e facilmente raggiungibile da tutti."],
  },
  {
    id: 7,
    added: "Il rifugio è completo",
    piece: null,
    tone: "prose",
    paragraphs: [
      "La stessa piazza, prima difficile da attraversare, ora accoglie chi ha bisogno di una pausa.",
      "La vera differenza non è data da un singolo elemento, ma dal modo in cui assieme creano un microclima più fresco e confortevole.",
    ],
  },
];

// Label of the cumulative recipe line under the sticky vignette.
export const rifugioRecipeLabel = "Un rifugio climatico è fatto di";

// Didascalie dello stepper. Quella di chiusura dice che la sequenza è FINITA,
// non che c'è un'interfaccia da usare: chi ha appena guardato una scena che si
// racconta da sola non sa se è finita, e resta fermo (01 § 1.4).
export const rifugioSequenceCaptions = {
  playing: "Guarda la strada · il prossimo elemento sta arrivando",
  done: "Scorri per continuare",
  prev: "Elemento precedente",
  next: "Elemento successivo",
};

// Indicative temperature readings overlaid on the vignette (illustrative values:
// the point is how the scene cools, not a measurement). Only ONE shows at a time
// — each appears with its element (`from`) and fades again (`until`, exclusive)
// before the next, so the numbers never pile up in the same corner. The reading
// is the whole scene's temperature, and it drops with every element added: as
// shade, shelter, water and greenery combine, the union pulls the number down
// step after step (36° → 34° → 33° → 32° → 31°). The range stays conservative:
// it reads as a local air-temperature improvement, not as surface temperature or
// a thermal-comfort index, where shade can produce much larger apparent gains.
// Each reading sits near the element that just lowered it.
export const rifugioTempSpots = [
  { id: "sun", from: 0, until: 1, tone: "sun", value: "36°", label: "al sole" },
  { id: "shade", from: 1, until: 2, tone: "shade", value: "34°", label: "sotto gli alberi" },
  { id: "portico", from: 2, until: 4, tone: "portico", value: "33°", label: "al riparo" },
  { id: "water", from: 4, until: 6, tone: "water", value: "32°", label: "vicino all’acqua" },
  { id: "final", from: 6, tone: "final", value: "31°", label: "nel rifugio" },
];

// ── Bologna's refuges, in the real city ──────────────────────────────────────
//
// La mappa mostra DUE cose, e non devono confondersi:
//   · i rifugi che il Comune ha riconosciuto, uno per uno, con un nome e un
//     orario di apertura (29: 16 al chiuso, 13 all'aperto);
//   · i parchi e i giardini che ne hanno le caratteristiche secondo lo studio
//     CRAF, cioè abbastanza grandi e abbastanza alberati (231).
// Il verde piccolo della città (aiuole, fasce stradali) NON è disegnato: non
// sono rifugi, e disegnarli direbbe che lo sono.
//
// ⚠️ I DUE NUMERI SONO SCRITTI A MANO e devono corrispondere a ciò che la mappa
// disegna, non a un comunicato stampa.
//   · `officialCount` = features in src/data/rifugi_ufficiali.geojson
//                       (rigenera con `node scripts/build_rifugi_ufficiali.mjs`,
//                       che stampa conteggio e divisione dentro/fuori)
//   · `selectedCount` = luoghi DISTINTI dopo il filtro CRAF, cioè countRifugi()
//                       in reliefMaps.js — 231, non 259: i parchi grandi sono
//                       spezzati in più poligoni.
// La scena li verifica tutti e due all'avvio e avvisa in console se qualcuno
// cambia i dati senza cambiare il testo.
export const rifugiCopy = {
  title: "A Bologna questi luoghi esistono già.",
  body: [
    "Il Comune ne riconosce alcuni come rifugi climatici. Accanto a questi, altri parchi e giardini hanno caratteristiche compatibili.",
  ],
  mapInvitation: "Andiamo a scoprirli sulla mappa",
  mapHint: "Seleziona un luogo per scoprirlo",
  officialCount: 29,
  officialLabel: "riconosciuti dal Comune",
  officialSub: "sedici al chiuso, tredici all’aperto",
  selectedCount: 231,
  selectedLabel: "parchi e giardini con caratteristiche compatibili",
  selectedLink: {
    href: "https://talea.comune.bologna.it/craf/",
    label: "La mappa dei rifugi climatici di Talea",
  },
  searchPrompt: "Parti da un luogo che conosci: una via, anche con il civico.",
  searchPlaceholder: "Via, civico o parco",
  searchEmpty: "Non ho trovato questo indirizzo a Bologna.",
  routeLoading: "Calcolo i percorsi a piedi sulla rete stradale…",
  routeError: "Non riesco a calcolare i percorsi pedonali in questo momento. Riprova tra poco.",
  link: {
    href: "https://sitmappe.comune.bologna.it/RifugiClimatici/",
    label: "La mappa dei rifugi climatici del Comune",
  },
};

// ── Dove la rete non arriva ─────────────────────────────────────────────────
// Il ponte scritto in `11` per rimpiazzare il 3-30-300 e i tre beat illustrati
// (NBS · corridoi · portici) non stanno più qui: sono diventati **una scena
// sola**, in cui la rete si vede formare invece di essere descritta.
//
// È una PIANTA del quartiere vista dall'alto, non un nastro visto da terra: le
// tre cose da far capire (dove non c'è si può costruire, i corridoi climatici, i
// portici) sono tutte e tre fatte di distanze, e le distanze si vedono solo
// dall'alto. Testi e telecamere in `src/data/cityPlanScene.js`, disegno generato
// in `src/data/cityPlan.js` (`scripts/build_city_plan.py`).
