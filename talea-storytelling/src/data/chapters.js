/**
 * I capitoli della storia, nell'ordine in cui si incontrano scorrendo.
 *
 * Servono allo "stelo" (ScrollStem): un fiore per capitolo sul ramo di sinistra,
 * che dice al lettore dove si trova in una pagina lunga decine di schermate.
 * Il selettore punta all'elemento radice della scena; il nome è quello che
 * compare passandoci sopra il mouse (ed è anche l'etichetta del link).
 *
 * `nudge` sposta il fiore di una frazione della pagina rispetto all'inizio
 * reale della sezione. Serve dove il capitolo *si sente* cominciare prima di
 * dove comincia nel DOM: il fiore è un punto di riferimento per il lettore, non
 * una misura.
 *
 * Non sono tutte le sezioni: l'intro degli hotspot e la sua mappa contano come
 * un capitolo solo. L'ombra invece ha il suo fiore, anche se nel codice è una
 * coda delle cause, perché il lettore la vede come un cambio di scena. Il
 * capitolo del sollievo, che da solo vale un quarto della pagina, ne ha tre:
 * la tesi, i rifugi che già esistono, e ciò che si può costruire dove mancano.
 */
export const CHAPTERS = [
  { id: "hero", label: "Bologna si scalda", selector: ".hero-zoom-scroll" },
  { id: "trend", label: "Le estati", selector: ".trend-section" },
  { id: "hotspot", label: "Gli hotspot", selector: ".hotspot-intro" },
  { id: "cause", label: "Le cause", selector: ".causes-section" },
  { id: "ombra", label: "L'ombra", selector: ".shadow-focus", nudge: -0.016 },
  { id: "persone", label: "Le persone", selector: ".vulnerability-section" },
  { id: "sollievo", label: "Gli spazi verdi", selector: ".relief-chapter" },
  { id: "rifugi", label: "I rifugi di Bologna", selector: ".relief-field--rifugi" },
  { id: "costruire", label: "Dove manca, si costruisce", selector: ".plan-scene" },
  { id: "talea", label: "Il progetto TALEA", selector: ".talea-chapter" },
  { id: "aree", label: "Le aree pilota", selector: ".zones-scene" },
  { id: "chiusura", label: "Esplora i dati", selector: ".closing-chapter" },
];
