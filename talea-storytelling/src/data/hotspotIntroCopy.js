/* Intro hotspot — il testo (04 § 4.2).

   Erano cinque paragrafi di fila in una colonna sola, ~140 parole, tutti allo
   stesso livello tipografico, per insegnare a parole due concetti che si
   mostrano in un disegno. Ora i concetti stanno nelle due vignette e il testo
   le accompagna.

   Il § 4.2 del piano scendeva a ~55 parole. Non è entrato così: quel taglio
   spezzava il tono discorsivo del resto della storia e faceva parlare la
   sezione per formule. Le frasi qui sotto sono quelle di prima, alleggerite,
   non riscritte.

   **Ogni didascalia sta in due paragrafi, e i due pannelli hanno la stessa
   forma**: prima il nome della cosa, poi la precisazione che la rende
   sorprendente. Un blocco unico di sei righe sotto un disegno si legge come una
   nota a piè di pagina; due paragrafi corti si leggono.

   La didascalia di sinistra **apre direttamente sui satelliti**: l'attacco che
   passava per i termometri ripeteva la riga di apertura, che il contrasto fra
   l'aria e le superfici lo fa già. Quella di destra riprende con «la stessa
   misura», così le due colonne si tengono e l'ordine di lettura è dichiarato
   anche dal testo, non solo dall'animazione.

   La prima riga è **intatta**: `03` l'aveva già eletta a raccordo del capitolo
   precedente («l'intro degli hotspot lo dice meglio nella sua prima riga»), e
   il testo del trend è stato scritto per non ripeterla.

   I paragrafi sono liste di segmenti, come in `heroCopy.js`: un segmento con
   `glossary: "<id>"` è un termine che apre il glossario. Nessun `kw` — le due
   parole chiave di questa schermata (temperatura di superficie, hotspot
   climatici) sono già termini di glossario, e sovrapporre i due livelli di
   enfasi li annullerebbe entrambi (01 § 1.3).

   La soglia è **10 %**, e questo chiude D5: era l'unico valore già presente nel
   codice (glossario, `hotspotSteps.js`, legenda di `HotspotMapScene`). Il 5 %
   viveva solo nei vecchi documenti. Chi la cambia deve cambiarla in tutti e
   quattro i posti.

   Sparito il refuso «all'inteno» (00 § 3.6), e con lui il paragrafo che stava
   commentato dentro il JSX: quello che diceva («la geografia del caldo») lo
   dice adesso la seconda vignetta.

   Niente trattini, nemmeno negli intervalli (CONTESTO § 7). */

export const hotspotIntroCopy = {
  // Sopra le due vignette, centrata: la frase che apre il capitolo.
  lead:
    "Se l'aria avvolge l'intera città in modo uniforme, le sue superfici" +
    " reagiscono al sole in modo differente da una zona all'altra.",

  vignettes: [
    {
      id: "superficie",
      svg: "superficieSvg",
      figureLabel:
        "Una strada al tramonto. Un satellite misura dall'alto il calore delle" +
        " superfici: il tetto segna 48 gradi, l'asfalto 52, la panchina 41," +
        " mentre il termometro della persona che cammina segna 34 gradi d'aria.",
      paragraphs: [
        [
          { text: "I satelliti registrano la " },
          {
            text: "temperatura di superficie",
            glossary: "temperatura-di-superficie",
          },
          {
            text:
              ": il calore accumulato da asfalto, tetti e piazze durante il" +
              " giorno e rilasciato a lungo dopo il tramonto.",
          },
        ],
      ],
    },
    {
      id: "ricorrenza",
      svg: "ricorrenzaSvg",
      figureLabel:
        "Tre fogli sovrapposti mostrano la stessa porzione di città vista" +
        " dall'alto, uno per estate. In ognuno alcune zone sono fra le più" +
        " calde, ma solo due tornano su tutti i fogli.",
      paragraphs: [
        [
          {
            text:
              " Misurato su più estati, questo valore fa emergere un" +
              " disegno ricorrente: le stesse zone di Bologna" +
              " finiscono quasi sempre tra le più calde ogni anno.",
          },
        ],
        [
          { text: "Sono gli " },
          { text: "hotspot climatici", glossary: "hotspot-di-superficie" },
          {
            text:
              ": le superfici che rientrano nel 10 % con le temperature più alte della città," +
              " estate dopo estate.",
          },
        ],
      ],
    },
  ],

  // Sul fondo scuro, appena prima che la città compaia.
  closer: "Andiamo a cercarli sulla mappa.",
};
