/* I testi dell'interfaccia della mappa hotspot: legenda, slider, didascalie
   della sequenza. Stavano nel JSX, contro la convenzione della casa («nessun
   testo nel componente»): chi tocca una frase deve poter aprire un file di
   dati, non un componente.

   Le tre descrizioni che salgono sulla mappa stanno invece in hotspotSteps.js,
   accanto alle soglie e ai tempi che dipendono dalla loro lunghezza.

   Niente trattini, nemmeno negli intervalli (CONTESTO § 7). */

export const hotspotMapCopy = {
  legend: {
    title: "Aree di ricorrenza climatica",
    // `${n}` è il numero di estati della soglia in scena.
    active: (n) => `Rientrano nel 10% in almeno ${n} ${n === 1 ? "anno" : "anni"} su 13`,
    scaleMin: "1 estate",
    scaleMax: "13 estati",
    caption:
      "In quante delle 13 estati (dal 2013 al 2025) l'area è rientrata nel" +
      " 10 % di superfici più calde di Bologna.",
    sourceLink: {
      href: "https://talea.comune.bologna.it/historysuhi/#2.v1.yc.l0",
      label: "Esplora i dati tecnici in dettaglio",
    },
  },

  sequence: {
    playing: "13 estati, una sopra l'altra",
    done: "Tocca una frase per rivederla, o scorri per continuare",
  },

  slider: {
    /* Provata e ritirata una riscrittura in «In almeno quante estati?»: il
       committente tiene la formulazione di prima. */
    label: "Cambia la soglia di ricorrenza",
    value: (n) => `≥ ${n}/13`,
    markLabel: (n) => `Imposta ${n} estati su 13`,
  },
};
