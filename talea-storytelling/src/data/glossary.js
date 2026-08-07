/**
 * Glossary definitions for TALEA storytelling.
 * Terms are referenced inline via <GlossaryTerm>.
 *
 * Kept intentionally minimal and citizen-facing: only the two terms used in the
 * story so far (Section 1). Technical indices a citizen can't read (NDVI,
 * Albedo, CSI, CFI, UHEI, SCI…) were removed from the webapp; if the lower
 * sections return, add back only what is actually shown and explained.
 */
export const glossary = {
  "temperatura-di-superficie": {
    term: "temperatura di superficie",
    definition:
      "È il calore registrato dal satellite sulle superfici urbane: asfalto, tetti, piazze, suoli e aree verdi.\n\nNon coincide con la temperatura dell'aria e non descrive da sola il caldo percepito da una persona, ma aiuta a capire dove la città accumula calore.",
  },
  "hotspot-di-superficie": {
    term: "hotspot climatico",
    definition:
      "In questa webapp indica un'area che rientra nel 10 % delle superfici più calde di Bologna in una o più estati osservate. Il dato si basa sulla temperatura di superficie, non sulla temperatura dell’aria.\n\nQuando un hotspot climatico ritorna più volte tra il 2013 e il 2025, diventa un segnale di ricorrenza del calore superficiale.",
  },
  "rifugio-climatico": {
    term: "rifugio climatico",
    definition:
      "Uno spazio pubblico pensato per dare sollievo durante il caldo. Non un semplice parco, ma un luogo che mette insieme più elementi: ombra, acqua, possibilità di sedersi, verde, suolo permeabile e facilità di accesso.\n\nA Bologna è una rete di spazi verdi riconosciuti dal Comune e valutati per la loro capacità di offrire riparo nelle giornate più calde.",
  },
  "progetto-talea": {
    term: "TALEA",
    definition:
      "TALEA, Green Cells leading the Green transition, è il progetto con cui il Comune di Bologna affronta il caldo urbano: è sostenuto dall'Unione Europea ed è attivo fino al 2028.\n\nUna talea, in giardinaggio, è un piccolo ramo che, piantato, mette radici e diventa una pianta nuova: l'immagine di un intervento che cresce da sé e si moltiplica in tutta la città.",
  },
  // ⚠️ Voce non collegata da nessun <GlossaryTerm>: non è raggiungibile.
  // "Cellula verde" è il nome con cui il progetto chiama i propri interventi. Il
  // capitolo TALEA lo ha nominato e poi tolto: è un concetto in più da imparare
  // che non serve a capire nient'altro della storia, e il paragrafo che lo
  // introduceva era il terzo di fila sulla stessa cosa. La scheda resta scritta
  // per chi lo reintroducesse: in quel caso la agganci con <GlossaryTerm
  // id="cellula-verde">. Chi decide che non tornerà, la tolga.
  // I trattini lunghi della prima frase sono stati riscritti con le virgole,
  // come in tutto il testo visibile della webapp.
  "cellula-verde": {
    term: "cellula verde",
    definition:
      "Una porzione di città, grande più o meno quanto un isolato, in cui ombra, acqua, verde e suolo permeabile vengono messi insieme per trasformare un punto critico in un rifugio dal caldo.\n\nOgni cellula funziona da sola, ma è pensata per collegarsi alle altre: una accanto all'altra formano una rete diffusa di spazi freschi.",
  },
};

/**
 * L'ordine in cui la storia incontra i termini, dall'alto verso il basso.
 *
 * Serve al pannello del glossario per elencare le parole già incontrate nella
 * stessa sequenza in cui il lettore le ha viste, e per numerarle. È una lista
 * scritta a mano, non l'ordine del DOM: le scene compaiono e si animano, e
 * chiedere al documento «chi viene prima» durante un'animazione dà risposte
 * diverse a seconda del momento. Chi aggiunge un <GlossaryTerm> in una scena
 * nuova aggiunge il suo id qui, al punto giusto della storia; un id che manca
 * resta comunque cliccabile, semplicemente non entra nell'elenco.
 */
export const glossaryOrder = [
  "temperatura-di-superficie",
  "hotspot-di-superficie",
  "rifugio-climatico",
  "progetto-talea",
];
