/**
 * Le tre descrizioni della scena hotspot, la loro andatura e l'inquadratura.
 *
 * Le schede salgono a timer sulla mappa agganciata, con la progressione
 * 3 / 5 / 9 estati: impronta → ricorrenza → persistenza. Nessun titolo, nessuna
 * microlabel: la soglia in scena la dice la legenda, illuminando la parte di
 * barra che corrisponde a quello che si vede.
 *
 * I testi sono passati da 45 / 38 / 44 parole a 24 / 24 / 17 (05 § 5.8). Il
 * taglio è possibile perché la vignetta dell'intro ha già insegnato la logica
 * della ricorrenza: qui non c'è più un metodo da spiegare, c'è da commentare
 * quello che si vede muoversi. Chi le allunga si riprende anche i secondi:
 * l'andatura è calcolata da queste parole, qui sotto.
 *
 * I paragrafi sono liste di segmenti, come in heroCopy.js e
 * hotspotIntroCopy.js: `kw: true` è la parola chiave della schermata, e ne
 * esiste UNA sola in tutta la scena (01 § 1.3), sull'ultima scheda — il momento
 * in cui il concetto e l'immagine coincidono.
 *
 * Niente trattini, nemmeno negli intervalli (CONTESTO § 7).
 */

export const hotspotSteps = [
  {
    id: "threshold",
    minYears: 3,
    opacity: 0.82,
    paragraphs: [
      [
        {
          text:
            " Osservando le ultime 13 estati, il calore si concentra lungo specifici assi della città," +
            " risparmiando colli, parchi e campagna.",
        },
      ],
      [{ text: "Stringiamo il campo." }],
    ],
  },
  {
    id: "recurrence",
    minYears: 5,
    opacity: 0.9,
    paragraphs: [
      [
        {
          text:
            " Emergono le zone dove i picchi termici sono più frequenti:" +
            " la prova che questo comportamento sia ormai una caratteristica fissa.",
        },
      ],
    ],
  },
  {
    id: "persistence",
    minYears: 9,
    opacity: 0.98,
    paragraphs: [
      [
        { text: "Ecco gli " },
        { text: "hotspot climatici", kw: true },
        {
          text:
            " di Bologna: superfici che ogni anno accumulano e trattengono calore, faticando a" +
            " raffreddarsi.",
        },
      ],
      // Resta: è la prima delle tre domande che si rincorrono da qui al
      // capitolo dopo (questa, «Perché proprio lì?» sulla mappa, «Perché
      // proprio qui?» che apre le cause). L'eco è voluta.
      [{ text: "Resta una domanda…" }],
    ],
  },
];

/* ── Andatura della sequenza (05 § 5.4) ──────────────────────────────────────
   «Il tempo di lettura di una scheda deve seguire la sua lunghezza»: quindi non
   è una costante, è una funzione della scheda. Chi riscrive i testi qui sopra si
   riscrive anche i tempi, senza toccare il componente.

   Cos'è questo tempo è cambiato con la scena. Quando le schede entravano una
   alla volta era l'andatura con cui ARRIVAVANO — e non era il tempo di leggere,
   perché non sparivano: chi era ancora sulla prima continuava a leggerla mentre
   entrava la seconda. Adesso sono tutte e tre scritte dall'inizio e a spostarsi
   è solo l'evidenza, quindi questo è quanto ogni soglia resta sulla mappa prima
   che il commento passi alla successiva: il tempo di leggere la scheda in scena
   E di guardare la macchia che le corrisponde.
   Per questo la base è più alta rispetto a quando le schede arrivavano una per
   volta: senza fretta di rincorrere, ma con due cose da guardare invece di una.

   Con questi testi: 3,7 / 3,55 / 3,55 s. Le ultime due prendono il pavimento;
   la sequenza completa dura ~11,1 s, contro i ~16,2 s di partenza. Dentro ci sta
   anche l'ingresso, che è più lungo di prima perché la legenda arriva tutta
   prima del testo. */

const WORDS_OF = (step) =>
  step.paragraphs
    .map((parts) => parts.map((part) => part.text).join(""))
    .join(" ")
    .trim()
    .split(/\s+/).length;

const READ_MS_BASE = 1500;
const READ_MS_PER_WORD = 100;
// Il pavimento sale insieme alla base, sennò la scheda più corta — che è già
// sotto il minimo per lunghezza — sarebbe l'unica delle tre a non prendere il
// tempo in più.
const READ_MS_MIN = 3550;
const READ_MS_MAX = 7000;

export const hotspotStepReadMs = hotspotSteps.map((step) =>
  Math.min(
    READ_MS_MAX,
    Math.max(READ_MS_MIN, READ_MS_BASE + READ_MS_PER_WORD * WORDS_OF(step)),
  ),
);

/* ── Inquadratura (05 § 5.1) ─────────────────────────────────────────────────
   Il centro è più a nord del centro geografico del comune: il costruito sta
   nella metà nord, i colli a sud sono vuoti, e così la macchia calda sta in
   mezzo allo schermo invece che nel terzo alto.

   Il push-in è monotono: si parte un filo più larghi, si arriva
   sull'inquadratura di lavoro, e solo la persistenza stringe. Prima era
   un'oscillazione (11,5 → 12,1 → 12,55), cioè un avvicinamento che passava per
   un allontanamento — e il primo fotogramma, a 11,5, era mezza provincia con
   Bologna scritta piccola in mezzo.

   *Provato e scartato:* costruire l'inquadratura con `cameraForBounds` sul
   contorno del comune (§ 5.1 punto 3). Il comune è 16,2 × 14,9 km e a questi
   zoom non ci sta in altezza: farcelo stare significa scendere sotto 11,6,
   cioè tornare a vedere la provincia. L'inquadratura giusta di questa scena
   taglia i colli a sud, non li contiene. */
export const BOLOGNA_CENTER = [11.3430, 44.4998];
export const BOLOGNA_ZOOM = 12.35;
export const BOLOGNA_ZOOM_PERSISTENCE = 12.55;
export const BOLOGNA_ZOOM_INTRO = 12.2;

/** Su finestre strette (telefoni) lo stesso zoom mostrerebbe solo il centro:
 *  la larghezza è la dimensione che comanda, e va compensata. */
export const NARROW_MAX_WIDTH = 700;
export const NARROW_ZOOM_SHIFT = -0.75;
