import { PLAN_ANCHORS } from "./cityPlan";

// Copy e telecamere della PIANTA che chiude il capitolo sollievo.
// Il disegno lo genera `scripts/build_city_plan.py` (→ `src/data/cityPlan.js`);
// qui c'è tutto quello che si legge, e da qui si cambia senza rigenerare niente.
//
// Prende il posto del nastro assonometrico e delle sue cinque battute
// (`cityBuildScene.js`, rimosso). Quel disegno mostrava una strada con delle
// case: dei tre concetti che questa sezione deve far arrivare a un cittadino
//   · dove non c'è nulla, si può costruire
//   · i corridoi climatici
//   · i portici
// non ne arrivava nessuno, perché tutti e tre sono fatti di DISTANZE e le
// distanze si vedono solo dall'alto.
//
// ── Sette battute, un'unica inquadratura ────────────────────────────────────
// La pianta resta agganciata e la telecamera non si muove. Cambiano soltanto gli
// interventi che si accendono e i tre primi piani: così il lettore può confrontare
// davvero il quartiere iniziale con la rete finale.
//
// ── Regole di scrittura, le stesse del resto della storia ──────────────────
//   · `lead` apre la frase, ma a video NON diventa un titolo separato: scorre
//     nello stesso paragrafo del `body`, appena più marcato. Ogni battuta deve
//     restare sotto le ~25 parole, perché il disegno è il contenuto e non deve
//     restare fermo ad aspettare una scheda da leggere;
//   · una sola `.kw` per battuta (`01` § 1.3), e sono tre in tutta la sezione:
//     soluzioni basate sulla natura, corridoio climatico, portici;
//   · nessun trattino nel testo visibile (CONTESTO.md § 7);
//   · il testo NOMINA quello che il disegno mostra (un parcheggio, il cortile
//     di una scuola, una piazza di pietra). Le poche annotazioni sulla pianta
//     servono soltanto nei punti ambigui e non sostituiscono il racconto. Non
//     descrive invece di cosa è fatto un rifugio climatico:
//     lo fa già la vignetta di `09`, e ripeterlo sarebbe dirlo due volte.

export const planSceneLabel =
  "Dove manca, si costruisce: scenario illustrativo di un quartiere tipo in cui spazi verdi, percorsi ombreggiati e portici diventano una rete";

export const planFigureLabel =
  "Scenario illustrativo, non una mappa dei cantieri. La pianta combina elementi riconoscibili di Bologna in un quartiere tipo: un viale, isolati a corte, strade porticate, palazzine, una piazza lastricata in parte usata per la sosta e il cortile asfaltato di una scuola. La piazza mantiene molto lastricato ma apre aiuole permeabili, acqua e ombra; altri spazi asfaltati diventano aree verdi. Una nuova fermata, filari di alberi e portici entrano nella stessa rete e un itinerario ombreggiato attraversa la mappa dal parco al giardino.";

export const planContext = {
  title: "Dove manca, si costruisce",
  note: "Scenario illustrativo di un quartiere tipo, non una mappa dei cantieri",
};

// La mappa appena lasciata mostra luoghi reali; la pianta che segue è uno
// scenario. Il cambio di statuto va dichiarato PRIMA che compaia il disegno,
// altrimenti il lettore può ragionevolmente scambiarlo per un'altra mappa: qui e
// non altrove, perché `planContext` vive solo nella trascrizione per i lettori
// di schermo e a video quel disegno arriva senza titolo né didascalia.
//
// Riscritto il 2026-08-06. Prima erano trentatré parole che spiegavano il METODO
// invece di raccontare la città: «Ora passiamo a uno scenario illustrativo… Serve
// a vedere come…». È lingua da nota editoriale, e questa storia non parla mai di
// sé: dice una cosa sulla città e basta («A Bologna, in alcuni punti, succede il
// contrario», «Ma la città non è fatta solo di superfici»).
//
// La cerniera resta sul RIFUGIO, per scelta del committente (2026-08-06): la
// mappa ha appena detto dove sono quelli che Bologna ha già, e questa riga
// aggiunge la sola cosa che quella mappa non può dire, cioè che l'elenco non è
// chiuso. Il «Ma» è lo stesso attacco con cui il capitolo dell'ombra congeda la
// sua mappa; `diventarlo` è il verbo con cui l'explainer aveva insegnato a
// guardare una strada («Vediamo come una strada può diventarlo»).
//
// Due cose da non toccare nella seconda riga. Nomina cose che si vedono, una
// piazza e un cortile, non il disegno che le mostra. E «un quartiere qualunque»
// fa, in lingua da racconto, il lavoro che `planContext` e `planFigureLabel`
// fanno solo per i lettori di schermo («scenario illustrativo di un quartiere
// tipo, non una mappa dei cantieri»): a video la pianta arriva senza titolo né
// didascalia, e senza quel «qualunque» si scambia per un'altra mappa di luoghi
// veri.
//
// Il ponte non deve invece anticipare le battute della pianta: il verde che non
// arriva a tutti, la distanza a piedi, dove manca si costruisce, un luogo solo
// non basta cominciano mezzo schermo più sotto, e dette prima arrivano già
// sapute.
export const planIntroCopy = {
  lead: "Dove non sono presenti, si possono costruire.",
};

// ── L'inquadratura: UNA, ferma, identica su ogni monitor ───────────────────
// La pianta non si muove più. C'era una telecamera che a ogni battuta volava, si
// stringeva, si inclinava e girava, ed è stata scartata per tre ragioni buone:
//
//   · non si capiva cosa si muovesse, perché si muoveva tutto insieme;
//   · l'inquadratura cambiava da monitor a monitor, perché la scala veniva dal
//     viewport: su uno schermo piccolo la scena stringeva troppo;
//   · muovere una `transform` su duemila elementi costa ~11 ms a colpo, e non
//     esiste ottimizzazione che lo tolga. L'unico modo è non muoverli.
//
// Adesso l'unica cosa che si muove è quella che sta arrivando, e quindi si legge.
// Il volume lo fanno le VIGNETTE (`planVignettes`), che sono disegni a parte.
//
// `units` è quante unità di disegno si vedono in larghezza, e NON dipende dalla
// finestra: è quello a rendere l'inquadratura la stessa su ogni schermo. In altezza
// si taglia quel che si taglia, e la sfumatura lo nasconde.
export const planView = { at: [1180, 745], units: 2320 };

// ── Le battute ─────────────────────────────────────────────────────────────
// `side` è il lato dove sta il testo. Cambia TRE volte in sette battute, e sempre
// dove la sezione cambia argomento: quando si costruisce (2), quando si collega
// (4), quando entrano i portici (5). Cambiarlo a ogni battuta stanca; non
// cambiarlo mai fa sembrare la sezione una diapositiva sola ripetuta sette volte.
//
// `vignette` è il nome del primo piano che accompagna la battuta, quando ce n'è
// uno (`planVignettes`): è lì che il concetto si vede da vicino e in volume, in
// vera assonometria e disegnandosi a tratto, mentre la pianta dice dove sta.
export const planBeats = [
  {
    id: "quartiere",
    side: "left",
    lead: "I rifugi climatici non sono sempre vicini a tutti.",
    body: [
      {
        text: "In alcune aree, parchi e giardini restano lontano dai percorsi quotidiani.",
      },
    ],
  },
  {
    id: "buco",
    side: "left",
    lead: "La distanza fa la differenza.",
    body: [
      {
        text: "È importante poterci arrivare con facilità.",
      },
    ],
  },
  {
    id: "costruisce",
    vignette: "costruire",
    side: "right",
    lead: "Dove mancano, si possono costruire.",
    body: [
      { text: "Le " },
      { text: "soluzioni basate sulla natura", kw: true },
      { text: " si ispirano a processi naturali e possono aiutare gli spazi urbani ad affrontare meglio il caldo." },
    ],
  },
  {
    id: "nonuno",
    side: "right",
    lead: "Un luogo solo non basta.",
    body: [
      {
        text: "Più spazi distribuiti nei quartieri creano una presenza diffusa, vicino alla vita di ogni giorno.",
      },
    ],
  },
  {
    id: "corridoi",
    vignette: "corridoio",
    side: "left",
    lead: "Il percorso conta quanto la meta.",
    body: [
      { text: "Collegare più punti della città lungo uno stesso itinerario dà forma a un " },
      { text: "corridoio climatico", kw: true },
      { text: "." },
    ],
  },
  {
    id: "portici",
    vignette: "portico",
    side: "right",
    lead: "Un pezzo di rete esiste già.",
    body: [
      { text: "I " },
      { text: "portici", kw: true },
      { text: " attraversano Bologna formando percorsi continui e riparati. Il progetto comunale " },
      {
        text: "Linee d'ombra",
        link: "https://www.comune.bologna.it/novita/comunicati-stampa/linee-dombra-itinerari-climatici-sotto-i-portici-approvato-giunta-il-progetto-che-guarda-ai-portici",
      },
      { text: " studia come valorizzarli e connetterli ai rifugi climatici." },
    ],
  },
  {
    id: "rete",
    side: "right",
    lead: "Quando i luoghi si collegano, cambia la città.",
    body: [
      {
        text: "Nuovi spazi, corridoi climatici e portici possono lavorare insieme e formare un sistema continuo e accessibile.",
      },
    ],
  },
];

// ── Annotazioni: soltanto dove il segno può essere ambiguo ─────────────────
// Non sono una legenda permanente e non nominano ogni edificio. Una sola nota
// per battuta chiarisce gli oggetti che, visti dall'alto, possono essere letti in
// più modi. La nota sparisce prima della successiva e l'ultima vista resta pulita.
// `point` usa le stesse coordinate della pianta; `offset` sposta il testo in pixel
// di schermo, così rimane leggibile anche quando cambia la larghezza del viewport.
export const planAnnotations = [
  {
    id: "parking",
    from: 0,
    until: 1,
    label: "parcheggio",
    point: PLAN_ANCHORS.piazzale,
    offset: [54, -38],
  },
  {
    id: "new-relief",
    from: 2,
    until: 3,
    label: "nuovo rifugio climatico",
    point: PLAN_ANCHORS.piazzale,
    offset: [54, -38],
  },
  {
    id: "corridor",
    from: 4,
    until: 4,
    label: "corridoio climatico",
    point: PLAN_ANCHORS.corridoio,
    offset: [52, -44],
  },
  {
    id: "arcades",
    from: 5,
    until: 5,
    label: "portici",
    point: PLAN_ANCHORS.portico,
    offset: [52, 38],
  },
];

// ── La legenda che cresce ───────────────────────────────────────────────────
// Non è una legenda di servizio: è la somma della sezione che si compone mentre
// la si legge, come la "ricetta" del rifugio in `09`. Ogni voce compare nella
// battuta che la nomina, e alla fine sono le tre cose da portarsi via.
export const planLegendLabel = "Per collegare i luoghi di sollievo";

export const planLegend = [
  { at: 2, tone: "green", label: "spazi verdi nuovi" },
  { at: 4, tone: "shade", label: "corridoi climatici" },
  { at: 5, tone: "portico", label: "portici" },
];
