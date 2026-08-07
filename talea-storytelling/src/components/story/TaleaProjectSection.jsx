import { motion, useReducedMotion } from "framer-motion";
import { EuEmblem } from "../ui/EuEmblem";
import { GlossaryTerm } from "../ui/GlossaryDrawer";
import { ScrollCue } from "../ui/ScrollCue";
import { TaleaLogoDraw } from "../ui/TaleaLogoDraw";
import { TaleaGrowthBackdrop } from "./TaleaGrowthBackdrop";
import {
  taleaHeader,
  taleaMeaning,
  taleaFacts,
  taleaParticipation,
  taleaPartners,
  taleaBridge,
} from "../../data/taleaProject";

const TALEA_REVEAL = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.14,
      delayChildren: 0.06,
    },
  },
};

const TALEA_REVEAL_ITEM = {
  hidden: { opacity: 0, y: 34, filter: "blur(5px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.92,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

/**
 * Il capitolo TALEA.
 *
 * Colonna centrata: titolo, il nome del progetto (il logo che si disegna con la
 * stessa animazione della schermata d'ingresso), due righe sul perché di quel
 * nome, la scheda dei fatti, la riga che consegna alla mappa. Dietro a tutto,
 * la striscia di talee che crescono (`TaleaGrowthBackdrop`).
 *
 * Era una composizione a due colonne con una vignetta a destra: uno stelo in
 * tratto pieno, alto quanto la colonna di testo, che si guardava per primo e
 * diceva quello che il testo dice in una riga. Il disegno non è sparito, è
 * passato dietro: dà il tono senza chiedere di essere decifrato.
 */
export function TaleaProjectSection({ onGlossary }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="talea-chapter" aria-labelledby="talea-title" lang="it">
      <TaleaGrowthBackdrop />

      <div className="talea-frame">
        <motion.div
          className="talea-intro"
          variants={TALEA_REVEAL}
          initial={reduceMotion ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, amount: 0.12 }}
        >
          <motion.h2 id="talea-title" className="talea-title" variants={TALEA_REVEAL_ITEM}>
            {taleaHeader.title}
          </motion.h2>

          {/* Il nome, subito. Il logo è un link alla piattaforma: è l'unico
              punto del capitolo in cui il lettore può andare a vedere il
              progetto vero prima di aver letto altro. */}
          <motion.p className="talea-lockup" variants={TALEA_REVEAL_ITEM}>
            <span className="talea-lockup-label">{taleaHeader.lockup}</span>
            <a
              className="talea-logo-link"
              href={taleaHeader.platformHref}
              target="_blank"
              rel="noreferrer"
            >
              <TaleaLogoDraw title={taleaHeader.logoAlt} />
            </a>
          </motion.p>

          <motion.div className="talea-meaning" variants={TALEA_REVEAL_ITEM}>
            <p className="talea-gloss">
              {taleaMeaning.glossLead}
              <GlossaryTerm id="progetto-talea" onOpen={onGlossary}>
                {taleaMeaning.glossTerm}
              </GlossaryTerm>
              {taleaMeaning.glossRest}
            </p>

            <p className="talea-body">{taleaMeaning.body}</p>
          </motion.div>
        </motion.div>

        <hr className="talea-rule" />

        <dl className="talea-facts" aria-label={taleaFacts.label}>
          {taleaFacts.items.map((fact) => (
            <div key={fact.id} className="talea-fact">
              <dt className="talea-fact-label">{fact.label}</dt>
              <dd className="talea-fact-body">
                <span className="talea-fact-value">{fact.value}</span>
                <span className="talea-fact-note">{fact.note}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* «Il lavoro comincia da qui» promette qualcosa che sta sotto, e sotto
          c'è una mappa che prima di agganciarsi si prende quasi una schermata
          di campo vuoto: proprio nel punto in cui il lettore non ha più niente
          da leggere e non vede ancora niente da guardare. Il chevron dice in
          che direzione sta la cosa promessa.

          `loop` e non i due impulsi di default: questa non è la fine di una
          sequenza automatica ma la chiusura di un capitolo che si legge con
          calma, e chi si ferma sulla riga troverebbe una freccia già morta. È
          la stessa scelta di `.vulnerability-chapter-cue` e `.sf-chapter-cue`,
          che stanno nello stesso posto alla fine dei loro capitoli. */}
      <div className="talea-bridge-wrap">
        <p className="talea-bridge">{taleaBridge.text}</p>
        <ScrollCue variant="light" loop className="talea-bridge-cue" />
      </div>
    </section>
  );
}

/**
 * La partecipazione, subito dopo la mappa.
 *
 * Un titolo che dice la cosa, una riga che dice come. Erano un titolo
 * indiretto («Prima di cambiare una strada, bisogna ascoltarla»), un occhiello e
 * due paragrafi di processo, impaginati in due colonne: quattro blocchi per una
 * informazione sola, ed è la sezione che il lettore incontra appena esce dalla
 * mappa, quando l'attenzione è al minimo.
 */
export function TaleaParticipationSection() {
  return (
    <section
      className="talea-participation"
      aria-labelledby="talea-participation-title"
      lang="it"
    >
      <div className="talea-say">
        <h2 id="talea-participation-title" className="talea-say-title">
          {taleaParticipation.title}
        </h2>
        <p className="talea-say-body">{taleaParticipation.body}</p>
      </div>
    </section>
  );
}

/**
 * I partner.
 *
 * Il titolo era «Chi c'è dietro»: una domanda retorica, che promette di svelare
 * qualcosa. La parola è «Partner», che è quella che usa il progetto e quella che
 * il lettore cerca.
 *
 * Impaginazione presa dalla piattaforma TALEA: una griglia di schede con il nome
 * e una parola sul ruolo, le città di replica separate dai partner (non
 * finanziano e non realizzano: sono il posto dove il modello viene ripiantato) e
 * in fondo la dichiarazione di finanziamento con l'emblema europeo.
 *
 * Le schede sono la stessa famiglia di quelle degli strumenti in chiusura
 * (`.source-card`): stesso raggio, stesso bordo, stesso sollevamento al passaggio
 * del mouse. Prima erano righe da 0.86 rem in tre colonne, cioè crediti che
 * nessuno si sarebbe fermato a leggere.
 */
export function TaleaPartnersSection() {
  return (
    <section className="talea-partners" aria-labelledby="talea-partners-title" lang="it">
      <div className="talea-frame">
        <h2 id="talea-partners-title" className="talea-partners-title">
          {taleaPartners.title}
        </h2>

        {/* Il logo sta nel FONDO della scheda, ingrandito fino a coprirla e
            portato a bassa opacità: serve a dare il colore dell'ente, non a
            essere letto. Il nome resta l'oggetto della scheda, e sopra il logo
            passa una velatura che gli tiene il contrasto. Il percorso arriva da
            `--logo`, così la regola sta tutta nel CSS. */}
        <ul className="talea-partner-grid" aria-label={taleaPartners.partnerListLabel}>
          {taleaPartners.partners.map((partner) => (
            <li key={partner.name}>
              <a
                className={`talea-partner-card${
                  partner.role === "capofila" ? " talea-partner-card--lead" : ""
                }`}
                href={partner.href}
                target="_blank"
                rel="noreferrer"
                style={{ "--logo": `url("${partner.logo}")` }}
              >
                <span className="talea-partner-body">
                  <span className="talea-partner-name">{partner.name}</span>
                  <span className="talea-partner-role">{partner.role}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>

        <a
          className="talea-funding"
          href={taleaPartners.funding.href}
          target="_blank"
          rel="noreferrer"
        >
          <EuEmblem label={taleaPartners.funding.emblemLabel} />
          <span>{taleaPartners.funding.text}</span>
        </a>
      </div>
    </section>
  );
}
