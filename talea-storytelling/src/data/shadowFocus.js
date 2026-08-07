/* Ombra — testi, camere e andatura (07).

   È l'ultima coda del capitolo sulle cause, non un capitolo nuovo: il lettore
   però la vede come un cambio di scena, e infatti sul ramo di sinistra ha il
   suo fiore (`chapters.js`). Da qui il titolo: «l'ombra» finora era un
   grassetto in mezzo a una frase, cioè la parola che dà il nome al capitolo
   detta di sfuggita.

   Niente trattini, nemmeno negli intervalli (CONTESTO § 7): erano rimasti
   nella legenda («ore 12–15») e nella fonte.

   Nessuna `.kw` in questa sezione. La sua parola chiave è *ombra*, che qui è
   un titolo in `--font-display`: sovrapporre due livelli di enfasi sulla
   stessa parola li annulla tutti e due (01 § 1.3, stessa scelta di 04). */

export const shadowFocus = {
  // 07 § 7.3 — erano 49 parole in tre blocchi senza gerarchia, e la parola
  // «ombra» ci passava dentro senza farsi notare. Ora sono 31, e la gerarchia
  // è vera: un attacco, il titolo, la smentita.
  opening: "C'è un terzo fattore, e si comporta in modo strano.",
  title: "L'ombra",
  lead: "Verrebbe da pensare che le zone più ombreggiate siano anche più fresche.",
  // Riga a sé, livello «frase-perno» (01 § 1.3): non è in grassetto, è più
  // grande, e resta impressa da sola.
  pivot: "A Bologna, in alcuni punti, succede il contrario.",
};

export const shadowScene = {
  /* La mappa entra da un'inquadratura larga e raggiunge la scala della città
     mentre compare la prima frase. Il centro storico arriva solo dopo, quando
     il testo lo nomina: due avvicinamenti leggibili, senza arretrare dal punto
     più ravvicinato appena si entra nella scena. */
  opening: { center: [11.3430, 44.4980], zoom: 11.55 },

  stages: [
    {
      id: "overview",
      // 43 → 27 parole.
      body:
        "Nelle ore più calde, alberi e edifici creano un'alternanza di luce e ombra in tutta la città.\n L'esposizione al sole cambia da una zona all'altra.",
      camera: { center: [11.3430, 44.4980], zoom: 12.1 },
    },
    {
      id: "centro",
      // 48 → 32 parole, in due paragrafi: la premessa e la smentita.
      body: [
        "Avvicinandosi al centro storico, i palazzi alti schermano la luce diretta per gran parte della giornata. \n Eppure è proprio qui, dove il riparo sembra maggiore, che la temperatura è spesso elevata."
      ],
      // Le sei zone comprendono i quattro nuclei, Marconi 2 e Irnerio 2:
      // l'inquadratura si sposta leggermente a nord e si allarga rispetto ai
      // soli nuclei, così il perimetro del centro resta interamente leggibile.
      camera: { center: [11.3449, 44.4984], zoom: 13.35 },
    },
  ],

  legend: {
    title: "Esposizione al sole",
    description:
      "Quanto strade e parchi restano al sole nelle ore centrali delle" +
      " giornate estive, fra le 12 e le 15.",
    from: "Più esposto al sole",
    to: "Più spesso in ombra",
    sourceLink: {
      href: "https://talea.comune.bologna.it/sci/",
      label: "Esplora i dati dell'ombra in dettaglio",
    },
  },

  sequence: {
    playing: "L'ombra alle ore più calde",
    // A sequenza conclusa le descrizioni stesse diventano i controlli: non
    // servono frecce duplicate nello stepper.
    done: "Seleziona una descrizione, o scorri per continuare",
  },
};

/* ── Andatura della sequenza (07 § 7.5, stesso impianto di 05) ───────────────
   Il tempo di lettura di una scheda segue la sua lunghezza, quindi non è una
   costante ma una funzione della scheda: chi riscrive i testi qui sopra si
   riscrive anche i tempi, senza aprire il componente.

   Qui le schede sono DUE e si sostituiscono invece di impilarsi (§ 7.6), il
   che cambia il significato del tempo: non è l'andatura con cui arrivano, è
   quanto la prima resta leggibile prima di sparire. Perciò il minimo è più
   alto che nella scena hotspot, dove chi sta ancora leggendo può continuare a
   farlo mentre entra la successiva.

   Con questi testi: ~4,4 s la prima, ~4,9 s la seconda. La sequenza intera
   dura ~10,5 s contro i ~15 s di partenza. */

const WORDS_OF = (stage) =>
  (Array.isArray(stage.body) ? stage.body.join(" ") : stage.body)
    .trim()
    .split(/\s+/).length;

const READ_MS_BASE = 1200;
const READ_MS_PER_WORD = 118;
const READ_MS_MIN = 3600;
const READ_MS_MAX = 7000;

export const shadowStageReadMs = shadowScene.stages.map((stage) =>
  Math.min(
    READ_MS_MAX,
    Math.max(READ_MS_MIN, READ_MS_BASE + READ_MS_PER_WORD * WORDS_OF(stage)),
  ),
);

/* ── La tabella del centro storico (07 § 7.8) ────────────────────────────────
   I NUMERI stanno in `public/data/shadow-focus/centro_aggregates.json`, che è
   generato da `scripts/build_shadow_focus.py`. Qui c'è solo quello che il
   lettore legge: le etichette non devono dipendere da un raster.

   Le quattro celle non sono pari, e la vecchia striscia le trattava come se lo
   fossero. Le prime due SONO il paradosso e stanno grandi, con «Eppure» come
   cerniera in mezzo; le altre due lo spiegano e stanno piccole, in linea.

   Sul 30 %: fino a questo refactor la cella diceva 72 %, calcolato con soglia
   «almeno 1 estate su 13», mentre due schermate prima la storia definisce gli
   hotspot come le superfici che tornano fra le più calde quasi ogni estate. Ora
   la soglia è quella della narrazione, 9 su 13, ed è dichiarata nella nota:
   è una scelta nostra, non una regola, e va scritta.

   Il soggetto sono sei zone centrali: i quattro nuclei, Marconi 2 e Irnerio 2.
   Restano fuori insieme Galvani 2 e Malpighi 2, che si estendono verso la
   collina. Il motivo e i codici esatti stanno in `build_shadow_focus.py`.

   Ogni percentuale è misurata dentro lo stesso perimetro giallo. Per rendere
   leggibile il peso dei numeri, ogni cella mostra anche la media comunale
   calcolata con lo stesso indicatore. */

export const shadowTable = {
  kicker: "Nel centro urbano di Bologna",
  scope: "Percentuale della superficie nel perimetro evidenziato",
  // La cerniera del paradosso, fra le due celle grandi. Prima non c'era, e
  // senza di lei le due percentuali sembravano due dati affiancati invece che
  // una contraddizione.
  hinge: "Eppure",
  because: "E questo perché qui c'è",
  handoff: "Ma la città non è fatta solo di superfici.",
  /* I due numeri piccoli NON hanno una nota. Ce l'avevano, e con quella la
     striscia diventava quattro blocchi di testo da mettere in relazione da
     soli: il difetto che il committente ha chiamato «dispersiva». Ora sono una
     riga sola che si legge come una frase, e il dettaglio di come sono misurati
     sta nel «Metodo e fonti», che è il posto delle soglie. Le due grandi la
     tengono, perché lì la soglia è parte di quello che il numero dice. */
  metrics: [
    {
      key: "shadow",
      tier: "lead",
      tone: "shadow",
      label: "è in ombra",
      note: "nelle ore più calde, fra le 12 e le 15",
    },
    {
      key: "hotspot",
      tier: "lead",
      tone: "hot",
      label: "ricade negli hotspot climatici",
      note: "nel 10 % più caldo dell'intero Comune, in almeno 9 estati su 13",
    },
    {
      key: "ndvi",
      tier: "support",
      tone: "green",
      label: "di verde",
    },
    {
      key: "albedo",
      tier: "support",
      tone: "dark",
      label: "superfici assorbenti",
    },
  ],
};

export const shadowFinal = {
  // 07 § 7.9 — quattro parole che valgono tutto il capitolo, su una riga sola.
  pivot: "L'ombra c'è, ma il calore rimane.",
  body:
    "Un paradosso urbano:" +
    " la protezione dal sole dona un sollievo apparente, mentre l'ambiente circostante continua ad assorbire e rilasciare calore.",
};
