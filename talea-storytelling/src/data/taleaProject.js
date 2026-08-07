// Copy + data for the closing arc: the TALEA project, its pilot areas, the
// citizens who help shape it, the people and institutions behind it, and the
// open data every map in this story comes from.
//
// Voice: the same citizen-facing, evocative-but-plain Italian as the rest of the
// story. Visible copy never uses dashes; apostrofi dritti, come nel resto di
// src/data.
//
// ── Fonti (verificate 2026-08-07) ───────────────────────────────────────────
// · talea.comune.bologna.it — «TALEA, Green Cells leading the Green transition»,
//   42 mesi, dicembre 2024 → maggio 2028, EUI-IA Call 2 2024. Tre aree di
//   intervento a Bologna: due nel Centro città area Nord, una al Fossolo
//   (Quartiere Savena). Città di replica: Cluj-Napoca, Marsiglia, Riga.
// · fondazioneiu.it/progetto/talea — le «cellule verdi» sono unità verdi compatte
//   e modulari che rigenerano gli ecosistemi di quegli spazi «al fine di creare
//   maggiore continuità tra le infrastrutture verdi della città». I tre pilastri
//   sono lo spazio pubblico, le tecnologie digitali e l'inclusione sociale.
// · fondazioneiu.it / bolognamissioneclima.it — al Fossolo si lavora sul Bosco
//   Tanari e sulle aree verdi attorno al Giardino Vittime della Uno Bianca; in
//   zona Marconi su via Boldrini e via Fratelli Rosselli, per aumentare le
//   superfici permeabili e ombreggiate.
//
// ── L'ordine del capitolo, e perché è questo ────────────────────────────────
// Il lettore arriva qui da una PIANTA dichiarata «scenario illustrativo». La
// prima cosa che deve sapere è che esiste un progetto vero; la seconda, dove
// agisce; solo dopo ha senso raccontargli come ci si entra e chi lo firma.
// Quindi:
//
//   1. chi è il progetto      → taleaHeader + taleaFacts   (TaleaProjectSection)
//   2. dove                   → zonesMap                   (ZonesMapScene)
//   3. come ci si entra       → taleaParticipation         (TaleaParticipationSection)
//   4. chi c'è dietro         → taleaPartners              (TaleaPartnersSection)
//
// Prima la partecipazione stava FRA l'identità del progetto e la sua mappa: era
// un muro di processo piazzato fra la promessa («ecco il progetto») e la sua
// verifica («ecco dove»). Ora sta dopo la mappa, dove la domanda del lettore
// smette di essere «dove?» e diventa «e io?».

import { assetUrl } from "../lib/assetUrl";

// Un solo indirizzo per la piattaforma: prima era ricopiato in cinque punti di
// questo file, e cambiarne uno solo sarebbe passato inosservato.
export const TALEA_PLATFORM = "https://talea.comune.bologna.it/";

// ── 1. Il progetto ───────────────────────────────────────────────────────────
// Il titolo dice chi fa la cosa; subito sotto arriva il nome, e il nome è il
// logo che si disegna (lo stesso della schermata d'ingresso). Prima il logo
// stava in fondo alla colonna di testo, dopo la spiegazione: il lettore leggeva
// per due paragrafi «il progetto» senza sapere come si chiamasse.
export const taleaHeader = {
  title: "Bologna ci sta già lavorando.",
  // Una frase, non un occhiello: il capitolo non ha etichette maiuscole sopra i
  // blocchi, perché nel resto della webapp non ce ne sono.
  lockup: "Il progetto si chiama",
  logoAlt: "TALEA",
  platformHref: TALEA_PLATFORM,
};

// ── Il nome, e perché il progetto si chiama così ─────────────────────────────
// Due passaggi: che cos'è una talea, e che cosa c'entra con la città. La
// versione lunga della prima riga resta — «tagliato dalla pianta madre», «messo
// nella terra giusta» — perché è quella che si capisce senza rileggerla.
//
// Qui c'era un terzo paragrafo che elencava di che cosa è fatto un intervento
// (alberi, ombra, superfici permeabili, posti dove fermarsi) e ne dava il nome
// tecnico, «cellule verdi». È stato tolto: di che cosa sia fatto un rifugio dal
// caldo lo ha già mostrato il capitolo prima, con un disegno, e il nome tecnico
// è un concetto in più che non serve a capire niente di quello che viene dopo.
// Chi lo rimettesse riagganci anche la voce `cellula-verde` del glossario, che
// senza quel paragrafo torna irraggiungibile.
export const taleaMeaning = {
  // "talea" apre il glossario; il segmento è ricomposto nel componente.
  glossLead: "",
  glossTerm: "TALEA",
  glossRest:
    " trasforma gli spazi pubblici utilizzando soluzioni basate sulla natura, per renderli più vivibili e aiutare la città ad adattarsi a un clima che cambia.",
  body: "Il nome deriva dal concetto di talea in botanica: un ramo tagliato dalla pianta madre che, nelle condizioni giuste, mette radici e continua a crescere.",
};

// ── I fatti che rendono credibile il resto ──────────────────────────────────
// Erano una riga di tre etichette maiuscole («PROGETTO EUROPEO · DA DICEMBRE
// 2024 A MAGGIO 2028 · 5 CELLULE VERDI IN 3 AREE PILOTA»): si leggeva come uno
// slogan, non come una scheda, e la cosa che più fa fiducia a un cittadino
// (chi lo realizza e con quali soldi) stava nascosta dentro il "+" dei partner,
// dopo la mappa.
//
// I conteggi di cellule e aree pilota NON stanno più qui: li dice la mappa, che
// è il posto in cui si vedono. Prima gli stessi tre numeri comparivano tre
// volte in mezza schermata (riga meta, ponte, chiusura della mappa).
//
// `partnersNote` si calcola da `taleaPartners.partners` in fondo al file: il
// numero e l'elenco non possono più divergere.
export const taleaFacts = {
  label: "Il progetto in breve",
  items: [
    {
      id: "chi",
      label: "Chi lo realizza",
      value: "Il Comune di Bologna",
      note: "", // riempita in fondo al file
    },
    {
      id: "quando",
      label: "Quanto dura",
      value: "Fino al 2028",
      note: "42 mesi, da dicembre 2024 a maggio 2028",
    },
    {
      id: "fondi",
      label: "Chi lo finanzia",
      value: "Unione Europea",
      note: "cofinanziato attraverso European Urban Initiative",
    },
  ],
};

// ── 2. Il passaggio alla mappa ──────────────────────────────────────────────
// Consegna alla scena che segue e basta: niente numeri, niente nomi tecnici.
//
// «A Bologna» è stato tolto: il capitolo si apre con «Bologna ci sta già
// lavorando» e la mappa che segue inquadra Bologna. Ripeterlo qui, a tre
// schermate di distanza, faceva sembrare che si stesse cambiando città.
export const taleaBridge = {
  text: "Il lavoro comincia da qui.",
};

// ── 3. Come ci si entra ─────────────────────────────────────────────────────
// Sta DOPO la mappa (vedi la nota sull'ordine, in cima al file).
//
// Il titolo era «Prima di cambiare una strada, bisogna ascoltarla»: una bella
// frase che però girava attorno alla cosa senza dirla, e sotto aveva un occhiello
// più due paragrafi di processo (passeggiate, incontri, laboratori, chi segnala
// cosa) in due colonne. Quattro blocchi per dire una cosa sola. Ora il titolo la
// dice, e sotto resta la riga che spiega come.
//
// «Con Bologna Verde» era stato tolto dal testo visibile: era un nome proprio
// senza spiegazione e senza link. Se qualcuno ha l'indirizzo della pagina di
// partecipazione, il posto per rimetterlo è `cta`, come link.
export const taleaParticipation = {
  title: "Il progetto cresce grazie anche al contributo di chi vive la città.",
  body: "I cittadini partecipano con passeggiate, incontri e laboratori nei quartieri: raccontano come vivono questi luoghi, quali difficoltà incontrano e cosa potrebbe migliorarli.",
};

// ── 4. Partner ──────────────────────────────────────────────────────────────
// Il titolo era «Chi c'è dietro»: una domanda retorica, che suona come se ci
// fosse qualcosa da svelare. La parola giusta è quella che usa il progetto,
// «Partner», ed è anche quella che il lettore cerca quando vuole sapere chi
// firma.
//
// Impaginazione presa dalla piattaforma TALEA (talea.comune.bologna.it): schede
// per i partner, ognuna con il nome e una parola sul ruolo, e in fondo la
// dichiarazione di finanziamento europeo con l'emblema. Le città di replica
// stanno separate dai partner, come lì: non finanziano e non realizzano, sono il
// posto dove il modello viene ripiantato.
//
// La parola sul ruolo dice il TIPO di organizzazione, non la mansione dentro il
// progetto: il tipo è verificabile guardando chi sono, la mansione no. Le due
// eccezioni sono dichiarate dal progetto stesso: il capofila e le città che
// replicano il modello.
//
// Le tre città stanno nello stesso elenco degli altri e non più in una riga a
// parte: sono partner del progetto a tutti gli effetti, e tenerle sotto
// un'etichetta separata («Il modello si ripianta a») le faceva sembrare una nota
// di coda.
//
// ── I loghi ─────────────────────────────────────────────────────────────────
// Scaricati dalla piattaforma del progetto (talea.comune.bologna.it/assets/img/
// team/team-N.jpg, 280×280) e messi in public/assets/partners. La numerazione è
// quella del sito e NON segue questo elenco: CINECA è il 4 e Bruno Kessler il 5,
// non viceversa. Chi rigenera i file controlli l'alt del sito prima di
// rinominare qualcosa.
export const taleaPartners = {
  title: "Partner",
  partnerListLabel: "Partner del progetto TALEA",
  partners: [
    { name: "Comune di Bologna", href: "https://www.comune.bologna.it/", role: "capofila", logo: assetUrl("/assets/partners/team-1.jpg") },
    { name: "Università di Bologna", href: "https://www.unibo.it/it", role: "università", logo: assetUrl("/assets/partners/team-2.jpg") },
    { name: "Fondazione IU Rusconi Ghigi", href: "https://fondazioneiu.it/", role: "fondazione", logo: assetUrl("/assets/partners/team-3.jpg") },
    { name: "Fondazione Bruno Kessler", href: "https://www.fbk.eu/it/", role: "fondazione", logo: assetUrl("/assets/partners/team-5.jpg") },
    { name: "CINECA", href: "https://www.cineca.it/", role: "consorzio", logo: assetUrl("/assets/partners/team-4.jpg") },
    { name: "R2M Solutions", href: "https://www.r2msolution.com/", role: "impresa", logo: assetUrl("/assets/partners/team-6.jpg") },
    { name: "R3GIS", href: "https://www.r3gis.com/it/", role: "impresa", logo: assetUrl("/assets/partners/team-7.jpg") },
    { name: "Cluj Napoca", href: "https://primariaclujnapoca.ro/", role: "città di replica", logo: assetUrl("/assets/partners/team-8.jpg") },
    { name: "Marsiglia", href: "https://www.marseille.fr/", role: "città di replica", logo: assetUrl("/assets/partners/team-9.jpg") },
    { name: "Riga", href: "https://www.riga.lv/en", role: "città di replica", logo: assetUrl("/assets/partners/team-10.jpg") },
  ],
  funding: {
    text: "Cofinanziato dall'Unione Europea attraverso European Urban Initiative.",
    href: "https://www.urban-initiative.eu/",
    linkLabel: "European Urban Initiative",
    emblemLabel: "Bandiera dell'Unione Europea",
  },
};

// Il "con l'Università di Bologna e altri N partner" della scheda viene da qui:
// aggiungere o togliere una riga a `partners` aggiorna il testo da solo. I due
// sottratti sono il Comune (che è il valore della scheda) e l'Università (che
// è nominata per esteso).
const OTHER_PARTNERS = taleaPartners.partners.length - 2;
taleaFacts.items[0].note = `con l'Università di Bologna e altri ${OTHER_PARTNERS} partner`;

// ── Guided pilot-zone map ────────────────────────────────────────────────────
// Stage 0 frames both neighbourhoods; stages 1–2 fly to each intervention area.
//
// ── I due cerchi, e perché sono grandi così ─────────────────────────────────
// Sono AMBITI, non perimetri: nessuna delle due aree ha un confine pubblicato,
// e un cerchio stretto attorno a un punto suggerirebbe una precisione che il
// progetto non ha ancora dichiarato. Quindi ognuno è tarato per contenere per
// intero i luoghi nominati dalle fonti, con margine:
//
//   · Fossolo — Bosco Tanari (OSM: 44.48925–44.49169 N, 11.38348–11.38725 E) e
//     le aree verdi attorno al Parco Vittime della Uno Bianca (44.48747,
//     11.38561). Il cerchio precedente era centrato sul solo bosco e ne tagliava
//     fuori il lato ovest e tutto il verde a sud.
//   · Centro storico-Nord — via Cesare Boldrini (fino a 11.34376 E) e via
//     Fratelli Rosselli (44.50266–44.50384 N, 11.3376 E). Il cerchio precedente
//     finiva sulla metà di via Boldrini: da qui lo spostamento verso est.
//
// Chi ricalcola questi valori li verifichi sulla mappa, non a occhio sul JSON:
// il raggio è in metri veri e il colpo d'occhio dipende anche dallo zoom.
export const zonesMap = {
  // L'etichetta del cerchio. Era «Ambito indicativo raccontato» in una legenda
  // all'angolo in alto a sinistra: tre parole di gergo redazionale, nel punto
  // dove nelle altre mappe c'è l'invito a fare qualcosa. Ora è al centro, dove
  // la mappa dei rifugi mette il suo invito, e dice che cosa è il cerchio.
  legend: {
    area: "Aree progettuali",
  },
  // Qui c'era `link`, «I rifugi climatici sulla piattaforma TALEA», stampato in
  // fondo a tutte e tre le tappe: un invito ad andarsene nel mezzo di una
  // sequenza guidata, per giunta ripetuto tre volte. La piattaforma resta
  // raggiungibile dal logo del capitolo e dalla griglia degli strumenti.
  //
  // Qui c'era una riga di chiusura a tutto schermo: «Due ambiti urbani. Tre aree
  // pilota. Cinque cellule verdi.» Tre conteggi diversi della stessa cosa, in
  // fila: per chi legge non è un riepilogo, è un indovinello. Ed era l'unico
  // punto in cui compariva «cellule verdi», senza spiegazione. Tolta: la scena
  // finisce sull'ultimo luogo e consegna direttamente al capitolo dopo.
  // La riga d'apertura non parla della mappa. Diceva «La mappa mostra i
  // contesti, non i perimetri dei singoli interventi»: in tutta la webapp non
  // c'è un solo punto in cui il testo spieghi come funziona la figura che gli
  // sta accanto, e non deve esserci nemmeno qui. Che i cerchi siano indicativi
  // lo dicono la loro forma e l'etichetta al centro dello schermo.
  //
  // Le aree sono DUE, come i due cerchi: la conta a tre veniva dalla scheda
  // tecnica del progetto, dove il Centro storico-Nord vale per due interventi
  // distinti. Un numero che non torna con quello che si vede è peggio di un
  // numero assente.
  intro: {
    title: "TALEA prende forma sul territorio.",
    text:
      "Due aree di intervento iniziali, nate dall'incontro tra analisi del territorio e partecipazione dei cittadini: la zona del Fossolo, e la fascia a nord del centro storico.",
    // Larghi abbastanza da contenere entrambi i cerchi con il loro raggio nuovo.
    bounds: [
      [11.3345, 44.4855],
      [11.3908, 44.5086],
    ],
  },
  // Niente occhiello sopra il nome del luogo: era l'unica etichetta maiuscola
  // della scena e portava informazioni (il quartiere, le vie) che stanno meglio
  // dentro la frase, dove si leggono insieme a quello che lì succede.
  zones: [
    {
      id: 0,
      area: "Fossolo",
      text:
        "Nel Quartiere Savena, il lavoro si concentra sul Bosco Tanari e sulle aree verdi vicine, per valorizzarle, e rafforzare i collegamenti tra parchi e giardini.",
      center: [11.3838, 44.4906],
      zoom: 15.15,
      radius_m: 470,
    },
    {
      id: 1,
      area: "Centro storico-Nord",
      text:
        "Fra via Boldrini e via Fratelli Rosselli, il progetto mette al centro vegetazione, suolo e spazio pubblico, in un'area densa, priva di terreno capace di assorbire la pioggia.",
      center: [11.341, 44.5038],
      zoom: 15.25,
      radius_m: 420,
    },
  ],
};

// ── The open data behind every map ───────────────────────────────────────────
export const dataSources = {
  title: "Tutto quello che hai visto viene da qui",
  intro:
    "Sono strumenti pubblici e aperti: puoi esplorarli tu stesso.",
  openLabel: "Apri la webapp",
  apps: [
    {
      id: "portale",
      name: "Piattaforma TALEA",
      tag: "Il progetto",
      desc: "Il punto di accesso a tutti gli strumenti e ai dati aperti del progetto.",
      href: TALEA_PLATFORM,
      icon: "hub",
      feature: true,
    },
    {
      id: "historysuhi",
      name: "Il caldo, estate dopo estate",
      tag: "HistorySUHI",
      desc: "Dove Bologna scalda di più, e come è cambiato dal 2013 al 2025.",
      href: "https://talea.comune.bologna.it/historysuhi/",
      icon: "history",
    },
    // Qui c'era anche SUHI, «Le isole di calore di Bologna». È uscito dalla
    // griglia: HistorySUHI mostra le stesse isole di calore e in più le mostra
    // cambiare di anno in anno, quindi le due schede promettevano al lettore la
    // stessa cosa una accanto all'altra, e una delle due era la versione
    // povera. Chi lo rimettesse rimetta anche l'icona `heat`, che resta in
    // ClosingSection.jsx perché è l'unica del suo genere.
    {
      id: "sci",
      name: "Quanta ombra c'è nelle strade",
      tag: "SCI",
      // Una riga, non un'etichetta: dice che cosa ci si trova, non che cosa
      // contiene. Erano quattro sintagmi nominali («L'ombra su strade e
      // piazze.») che ripetevano il nome della scheda con altre parole.
      desc: "Quanta ombra ricevono strade e piazze, ora per ora, in una giornata d'estate.",
      href: "https://talea.comune.bologna.it/sci/",
      icon: "shadow",
    },
    {
      id: "craf",
      name: "I rifugi climatici e le fragilità",
      tag: "CRAF",
      desc: "I luoghi dove ripararsi dal caldo, e i quartieri dove servono di più.",
      href: "https://talea.comune.bologna.it/craf/",
      icon: "refuge",
    },
  ],
};

// ── Final close ──────────────────────────────────────────────────────────────
export const closingFinal = {
  standout:
    "Un albero, una fontana, una piazza che respira: la città più fresca si costruisce così, una talea alla volta.",
};

// Compact footer: project identity, one route to the public tools, the method
// drawer and an explicit note about source licences.
// ── Il footer ───────────────────────────────────────────────────────────────
// Porta le stesse informazioni del footer della piattaforma TALEA
// (talea.comune.bologna.it, verificato il 7 agosto 2026): la dichiarazione di
// cofinanziamento con il codice del progetto, l'elenco dei partner e delle
// città di replica, il disclaimer dell'Unione Europea, i link utili e il logo
// della European Urban Initiative.
//
// Prima c'erano tre righe: il nome, un link ai dati e una riga di licenza. Una
// storia che si regge su dati pubblici finanziati dall'Unione Europea deve dire
// in fondo chi la paga e chi la firma, e deve dirlo con le stesse parole del
// progetto: il codice `EUI102-064` e il disclaimer non sono formule di
// cortesia, sono obblighi del programma.
//
// Il titolo del progetto, il codice e il nome del programma restano nella loro
// lingua ufficiale (non si traduce il nome di una cosa); il resto è in
// italiano, come tutto quello che in questa webapp si legge.
export const footerContent = {
  brand: {
    label: "TALEA",
    alt: "TALEA",
    href: TALEA_PLATFORM,
  },
  funding: {
    // I due marchi sono i file ufficiali presi dalla piattaforma TALEA e
    // copiati in `public/assets/eu/`. Non si ridisegnano e non si ricolorano:
    // «Co-funded by the European Union» e il logo della European Urban
    // Initiative hanno una forma prescritta dal programma. (L'emblema
    // disegnato a mano, `EuEmblem`, resta dov'è: sotto i partner, dove serve
    // solo la bandiera e non il lockup completo.)
    emblem: assetUrl("/assets/eu/cofunded-eu.svg"),
    emblemLabel: "Cofinanziato dall'Unione Europea",
    text:
      "Il progetto TALEA - Green cells leading the Green transition (EUI102-064) è cofinanziato dall'Unione Europea nell'ambito del programma European Urban Initiative - Innovative Actions (EUI-IA). Coinvolge il Comune di Bologna come Main Urban Authority, la Fondazione IU Rusconi Ghigi, l'Università di Bologna, la Fondazione Bruno Kessler, R2M Solutions, R3GIS e CINECA come partner italiani, e le città di Marsiglia, Riga e Cluj-Napoca come città di replica.",
    disclaimer:
      "Le opinioni espresse appartengono unicamente agli autori e non riflettono necessariamente quelle dell'Unione Europea o della European Urban Initiative (EUI). Né l'Unione Europea né la EUI possono esserne ritenute responsabili.",
  },
  eui: {
    label: "European Urban Initiative",
    href: "https://www.urban-initiative.eu/",
    logo: assetUrl("/assets/eu/eui.svg"),
  },
  linksLabel: "Link utili",
  // I primi tre sono le tre voci del footer della piattaforma (Home, About,
  // Atlas), qui con i nomi che hanno in italiano e con l'indirizzo assoluto:
  // da questa webapp non sono ancore interne, sono un altro sito.
  links: [
    { label: "Piattaforma TALEA", href: TALEA_PLATFORM },
    { label: "Il progetto", href: `${TALEA_PLATFORM}#about` },
    { label: "Atlante", href: `${TALEA_PLATFORM}#gallery` },
  ],
  // Qui c'era `license`, «Dati e contenuti seguono le licenze indicate negli
  // strumenti originali»: una riga che non dice quale sia la licenza di
  // niente, in fondo a un footer che già porta il testo legale che conta. Le
  // licenze vere stanno dove stanno i dati, cioè dentro «Metodo e fonti» e
  // dentro le webapp linkate qui sopra.
  methodLabel: "Metodo e fonti",
};
