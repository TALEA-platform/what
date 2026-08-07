import { dataSources } from "./taleaProject";

/**
 * "Metodo e fonti" — lightweight method/sources content, shown in a drawer so it
 * never interrupts the narrative. Keeps the header/footer links real instead of
 * pointing at sections that don't exist (#metodologia / #indicatori).
 * Citizen-facing language; the few technical terms are the ones the story uses.
 *
 * ── Il pannello segue la lettura ─────────────────────────────────────────────
 * «Metodo e fonti» si apre da ogni punto della storia, testata e piede
 * compresi: chi lo apre alla seconda schermata, con il vecchio testo, leggeva
 * in anticipo che cos'è un hotspot, che cosa sono i rifugi climatici e dove
 * lavora il progetto, cioè tre capitoli che non aveva ancora visto. Un pannello
 * di servizio non deve raccontare la storia prima della storia.
 *
 * Quindi ogni voce legata a un capitolo porta `after`: il selettore CSS della
 * scena che deve essere stata raggiunta perché la voce compaia. Le voci senza
 * `after` ci sono sempre, ed è deliberato: periodo, differenza fra aria e
 * superficie e soprattutto **limiti dei dati** sono la parte di garanzia, quella
 * che serve a chi apre il pannello per decidere se fidarsi. Nasconderla per
 * qualche schermata sarebbe far sembrare il metodo più magro di quello che è.
 * Chi vuole tutto subito ha il bottone «mostra tutto».
 *
 * I selettori sono la sola cosa fragile di questo file: vivono qui, tutti
 * insieme, e se una scena cambia nome di classe la voce corrispondente torna
 * visibile sempre (MethodDrawer sbaglia dalla parte del mostrare, non del
 * nascondere: una voce di metodo in anticipo è un guaio minore di una voce di
 * metodo sparita).
 */

// Le fonti sono le stesse quattro della griglia di chiusura («Tutto quello che
// hai visto viene da qui») e arrivano da lì, non da una seconda lista scritta a
// mano: erano già andate fuori sincrono una volta, quando SUHI uscì dalla
// griglia — perché HistorySUHI mostra le stesse isole di calore e in più le
// mostra cambiare — e restò qui dentro per mesi.
//
// L'acronimo fa da etichetta e il nome in italiano da riga sotto: in questo
// pannello il lettore sta cercando la fonte, e la fonte si chiama CRAF; la riga
// sotto gli dice che cosa ci troverà. Il portale, che un acronimo non ce l'ha,
// li scambia.
const links = dataSources.apps.map((app) => ({
  label: app.feature ? app.name : app.tag,
  note: app.feature ? app.tag : app.name,
  href: app.href,
}));

export const methodContent = {
  title: "Metodo e fonti",
  eyebrow: "Come leggere questa storia",
  intro:
    "Questa storia usa i dati delle webapp TALEA del Comune di Bologna. Qui trovi, in breve, cosa misuriamo e con quali limiti.",
  // La riga che dichiara il comportamento del pannello. Compare solo quando c'è
  // davvero qualcosa che aspetta: a storia finita non ha più niente da spiegare.
  progressive: {
    note:
      "Il pannello segue la lettura: qui sotto c'è il metodo dei capitoli che hai già incontrato. Gli altri si aprono mano a mano, per non anticiparti quello che deve ancora arrivare.",
    showAll: "Mostra tutto il metodo",
    showRead: "Mostra solo i capitoli letti",
  },
  // Le cifre che tornano in tutta la storia, in cima al pannello: chi apre
  // «Metodo e fonti» a metà lettura cerca quasi sempre una di queste. Non sono
  // dati nuovi, sono le cifre già scritte nelle voci qui sotto, e seguono la
  // lettura come loro.
  highlights: [
    { value: "13", label: "estati, dal 2013 al 2025" },
    {
      value: "10 %",
      label: "la soglia delle superfici più calde",
      after: ".hotspot-scene",
    },
    {
      value: "29",
      label: "i rifugi riconosciuti dal Comune",
      after: ".relief-map-section--rifugi",
    },
  ],
  sections: [
    {
      id: "periodo",
      heading: "Periodo osservato",
      body:
        "Le elaborazioni coprono tredici estati, dal 2013 al 2025, nei mesi di giugno, luglio e agosto.",
    },
    {
      id: "aria-superficie",
      heading: "Aria e superficie",
      body:
        "Il grafico iniziale usa la media estiva delle massime giornaliere dell'aria: racconta quanto diventano calde le giornate. La temperatura di superficie, registrata dai satelliti, racconta invece dove i materiali urbani accumulano calore. Sono due cose diverse: questa storia parla soprattutto di superfici.",
    },
    {
      id: "hotspot",
      heading: "Cos'è un hotspot climatico",
      after: ".hotspot-scene",
      body:
        "È un'area che, in una o più estati, rientra nel 10 % delle superfici più calde di Bologna. La ricorrenza indica in quante estati su tredici un'area è rientrata in quella fascia: 1, 3 o 5 estati segnano livelli diversi di persistenza.",
    },
    {
      id: "ombra",
      heading: "I dati sull'ombra",
      after: "#ombra",
      body:
        "Sono simulazioni basate sul modello tridimensionale della città, calcolate a intervalli di 15 minuti. Dicono quanto spesso strade e aree verdi restano al riparo nelle ore più calde dell'estate. Raccontano la protezione dal sole diretto, non la temperatura: per questo una strada molto ombreggiata può comunque restare calda.",
    },
    {
      // Il capitolo sulle persone è l'unico che porta un numero preso da fuori,
      // ed è anche il più delicato: dire da dove viene il 75 % è il motivo per
      // cui questa voce esiste.
      id: "fragilita",
      heading: "Chi è più esposto",
      after: ".vulnerability-section",
      body:
        "La fragilità climatica non si legge solo sul termometro: mette insieme quanto un'area si scalda, chi la abita e quante possibilità offre di trovare riparo. Il 75 % citato nella storia viene da uno studio pubblicato su Bologna, che trovi linkato nel testo, non da un'elaborazione di questa webapp.",
    },
    {
      id: "rifugi",
      heading: "Come si contano i rifugi climatici",
      after: ".relief-map-section--rifugi",
      body:
        "I 29 luoghi riconosciuti dal Comune, 16 al chiuso e 13 all'aperto, sono un elenco ufficiale. I 231 parchi e giardini che li accompagnano no: sono spazi verdi con caratteristiche compatibili, selezionati dall'analisi, e vanno letti come una possibilità, non come una promessa.",
    },
    {
      id: "aree",
      heading: "Le aree di intervento",
      // La scena mostra due cerchi morbidi e non lo spiega, ed è giusto così:
      // nella storia il testo non descrive mai la figura che gli sta accanto.
      // Ma la domanda «quel cerchio è il cantiere?» il lettore se la fa, e
      // questo è il posto dove rispondergli.
      after: ".zones-scene",
      body:
        "I due cerchi sulla mappa segnano gli ambiti in cui il progetto sta lavorando, la zona del Fossolo e la fascia a nord del centro storico. Sono contesti indicativi, non i perimetri dei singoli interventi: servono a dire dove, non fin dove.",
    },
    {
      id: "limiti",
      heading: "Limiti dei dati",
      body:
        "I dati satellitari e le simulazioni dell'ombra sono stime: descrivono tendenze a scala urbana, non la singola giornata né il caldo percepito da una persona. Vanno letti come indizi convergenti, non come misure esatte.",
    },
  ],
  linksLabel: "Fonti e strumenti TALEA",
  links,
};
