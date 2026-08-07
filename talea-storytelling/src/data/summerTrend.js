/**
 * Summer mean daily maximum air temperature — Bologna city centre, 1961-2025
 *
 * Source: ARPAE Emilia-Romagna, Eraclito61 / ERG5 central grid cell 01421.
 *
 * Method: DAILY_TMAX averaged over June-July-August (always exactly 92 days).
 * This keeps the same official air-temperature source as before, but uses the
 * daily maximum because the story is about daytime heat exposure and surface
 * heat accumulation. Cell 01421 intersects Bologna's central statistical areas
 * and avoids the hill cells that affect the municipal average.
 *
 * The chart opens on 2013-2025 to align with the HistorySUHI hotspot period
 * used in the following map. The full 1961-2025 series (`summerTrendFull`) is
 * revealed on demand via the "dezoom" control, so a reader who wants the long
 * view can see every summer back to the first year of the historical mean.
 *
 * The reference line is the mean of this same DAILY_TMAX metric over the full
 * period 1961-2025: 30.02 °C. Every annual value below was recomputed directly
 * from the ARPAE per-cell daily archive and reproduces the previous 2013-2025
 * figures exactly (see public/data/summer-trend/).
 */

export const summerTrendFull = [
  { year: 1961, temp: 29.81 },
  { year: 1962, temp: 30.10 },
  { year: 1963, temp: 29.47 },
  { year: 1964, temp: 30.07 },
  { year: 1965, temp: 29.06 },
  { year: 1966, temp: 28.83 },
  { year: 1967, temp: 28.99 },
  { year: 1968, temp: 27.32 },
  { year: 1969, temp: 28.00 },
  { year: 1970, temp: 28.54 },
  { year: 1971, temp: 29.61 },
  { year: 1972, temp: 28.02 },
  { year: 1973, temp: 29.30 },
  { year: 1974, temp: 29.41 },
  { year: 1975, temp: 28.71 },
  { year: 1976, temp: 28.04 },
  { year: 1977, temp: 28.00 },
  { year: 1978, temp: 27.90 },
  { year: 1979, temp: 28.82 },
  { year: 1980, temp: 28.51 },
  { year: 1981, temp: 28.72 },
  { year: 1982, temp: 30.08 },
  { year: 1983, temp: 30.20 },
  { year: 1984, temp: 28.98 },
  { year: 1985, temp: 29.71 },
  { year: 1986, temp: 28.99 },
  { year: 1987, temp: 29.68 },
  { year: 1988, temp: 30.22 },
  { year: 1989, temp: 28.76 },
  { year: 1990, temp: 29.96 },
  { year: 1991, temp: 30.48 },
  { year: 1992, temp: 29.84 },
  { year: 1993, temp: 30.67 },
  { year: 1994, temp: 31.36 },
  { year: 1995, temp: 28.83 },
  { year: 1996, temp: 29.26 },
  { year: 1997, temp: 30.11 },
  { year: 1998, temp: 32.59 },
  { year: 1999, temp: 31.11 },
  { year: 2000, temp: 32.09 },
  { year: 2001, temp: 31.23 },
  { year: 2002, temp: 29.02 },
  { year: 2003, temp: 32.98 },
  { year: 2004, temp: 29.44 },
  { year: 2005, temp: 29.27 },
  { year: 2006, temp: 29.60 },
  { year: 2007, temp: 29.93 },
  { year: 2008, temp: 30.53 },
  { year: 2009, temp: 30.28 },
  { year: 2010, temp: 29.25 },
  { year: 2011, temp: 29.50 },
  { year: 2012, temp: 31.97 },
  { year: 2013, temp: 30.13 },
  { year: 2014, temp: 28.57 },
  { year: 2015, temp: 31.45 },
  { year: 2016, temp: 30.43 },
  { year: 2017, temp: 32.76 },
  { year: 2018, temp: 31.44 },
  { year: 2019, temp: 32.51 },
  { year: 2020, temp: 30.96 },
  { year: 2021, temp: 32.11 },
  { year: 2022, temp: 33.13 },
  { year: 2023, temp: 32.26 },
  { year: 2024, temp: 32.26 },
  { year: 2025, temp: 32.39 },
];

/** First year of the story focus. The chart opens here; dezoom reveals 1961+. */
export const summerTrendFocusStartYear = 2013;

/** Default (zoomed) view: the recent story period. Derived from the full series. */
export const summerTrendData = summerTrendFull.filter(
  (d) => d.year >= summerTrendFocusStartYear,
);

export const summerTrendCurrentMean =
  summerTrendData.reduce((s, d) => s + d.temp, 0) / summerTrendData.length;

// Mean of the JJA DAILY_TMAX metric over the full period 1961-2025 (65 summers,
// each exactly 92 days, so an equal-weighted annual mean is exact): 30.024 °C.
export const summerTrendMean = 30.024;
export const summerTrendMeanPeriod = "dal 1961 al 2025";
export const summerTrendMeanLabel =
  "media storica delle massime, dal 1961 al 2025";

/* ── Copy della sezione (convenzione della casa: i testi non stanno nel JSX) ──

   Il raccordo finale è riscritto (03 § 3.5). Prima diceva «…bisogna cambiare
   punto di vista»: un'astrazione proprio dove il lettore dovrebbe avere voglia
   di guardare una mappa. Ora chiude sulla domanda a cui risponde la sezione
   dopo, e *dove* resta l'ultima parola.

   Due parole evitate di proposito: «aria» e «superfici» le spiega già l'intro
   degli hotspot («Se l'aria avvolge l'intera città in modo uniforme, le sue
   superfici reagiscono al sole in modo differente…»), e «città» ricorre lì tre
   volte — ripeterla qui, due schermate prima, si sente. */
export const summerTrendCopy = {
  title: "La prima conferma arriva dall'aria.",
  lead:
    "Le temperature massime si stanno alzando sempre di più, e i picchi torridi" +
    " che un tempo erano rari stanno diventando la normalità.",
  bridge: "Questa tendenza, però, dice quanto fa caldo.",
  /* «Non dove.» va a capo da sola ma resta nello STESSO paragrafo: è il colpo
     finale della frase di sopra, non un blocco nuovo. Provata come paragrafo a
     sé, a misura maggiore: il ragionamento si spezzava in tre frammenti
     staccati e la lettura perdeva il filo.
     `.trend-punch` è `white-space: nowrap`: quelle due parole non devono mai
     finire su righe diverse. */
  punch: [{ text: "Non " }, { text: "dove", kw: true }, { text: "." }],
};

/* Intestazione del grafico: anche questa è copy, e non deve stare nel JSX.
   Gli intervalli sono scritti «dal … al …» e non con un trattino: nella storia
   i trattini si usano solo per spezzare le parole a fine riga. */
export const summerTrendChartMeta = {
  collapsed: "Estati dal 2013 al 2025",
  expanded: "Estati dal 1961 al 2025",
  value: "Media delle massime giornaliere",
  unit: "°C, aria, centro di Bologna",
};

/* Invito ad allargare la vista (03 § 3.3). Era una pillola con un'icona in alto
   a destra e si leggeva come un pulsante di impostazioni; ora è una riga di
   testo sotto l'asse x — dove l'occhio arriva dopo aver letto la curva, cioè
   esattamente quando si forma la domanda «e prima?». */
export const summerTrendZoomInvite = {
  collapsed: { lead: "Le ultime tredici estati.", action: "Guardale tutte, dal 1961" },
  expanded: { lead: "Sessantacinque estati, dal 1961.", action: "Torna agli ultimi anni" },
};

export const summerTrendSource = {
  label: "ARPAE Eraclito61, cella ERG5 centrale 01421",
  variable: "Media delle massime giornaliere dell'aria (°C)",
  period: "giugno-agosto, 1961-2025",
  area: "Bologna centro, quota media cella 69 m",
};
