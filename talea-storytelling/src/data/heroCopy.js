/* Hero — copy dell'apertura e del ponte.

   Convenzione della casa: nessun testo nel JSX. Qui stanno sia le frasi sia la
   loro struttura di enfasi, così chi tocca una parola tocca questo file.

   I paragrafi sono liste di segmenti invece che stringhe perché il ponte ha
   parole in evidenza (02 § 2.7): un segmento con `kw: true` è una parola chiave,
   uno con `keep: true` è un pezzo che non deve andare a capo.

   Le parole chiave del ponte sono DUE — «microclima urbano» e «quartieri più
   esposti». La regola di 01 § 1.3 ne concede una per schermata; il ponte è
   l'unica eccezione prevista, perché è una schermata di sola apertura ed è il
   punto in cui il lettore decide se restare.

   Il testo del ponte è quello attuale, non riscritto: decisione D8 = B.

   Attenzione all'ultimo segmento del ponte: dopo «di» e dopo «e» ci sono due
   spazi unificatori (U+00A0), invisibili qui ma già presenti nel testo
   pubblicato. Tengono insieme «presidi di sollievo» ed evitano che la «e»
   resti da sola in fondo alla riga: chi riscrive quella frase li perde. */

export const heroOpening = {
  title: "Bologna si sta scaldando.",
  subtitle: [
    { text: "Negli ultimi anni le estati sono sempre più intense. " },
    { text: "Il caldo è entrato", keep: true },
    {
      text:
        " nella vita quotidiana, lasciando tracce sulla città e cambiando il" +
        " modo in cui viene abitata.",
    },
  ],
  scrollLabel: "Scorri per iniziare",
};

export const heroBridge = {
  body: [
    { text: "Esplorare il " },
    { text: "microclima urbano", kw: true },
    { text: " permette di individuare i " },
    { text: "quartieri più esposti", kw: true },
    {
      text:
        " alle ondate di calore, valorizzare i presidi di sollievo" +
        " e pianificare soluzioni concrete per la vivibilità della città.",
    },
  ],
  calloutLead: "Non si tratta solo di osservare il cambiamento:",
  calloutPivot: "Bologna sta lavorando per adattarsi.",
};
