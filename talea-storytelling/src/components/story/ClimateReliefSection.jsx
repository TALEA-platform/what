import { motion } from "framer-motion";
import { RifugioExplainer } from "./RifugioExplainer";
import { RifugiMapScene } from "./RifugiMapScene";
import { CityPlanScene } from "./CityPlanScene";
import { rifugiCopy } from "../../data/climateRelief";
import { planIntroCopy } from "../../data/cityPlanScene";

const RIFUGI_REVEAL = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.08,
    },
  },
};

const RIFUGI_REVEAL_ITEM = {
  hidden: { opacity: 0, y: 28 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.78,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

/**
 * Il cambio di registro fra la mappa dei rifugi e la pianta: due righe, e sono
 * l'unico posto in cui la storia dichiara a video che ciò che segue è disegnato
 * e non fotografato.
 *
 * Era una dissolvenza legata allo scroll (opacità, y, scala e sfocatura su
 * `scrollYProgress`) dentro un blocco alto 84svh con il testo centrato: la
 * dissolvenza finiva al 22% del percorso, ma a quel punto il testo era ancora
 * sotto il bordo dello schermo, e per leggerlo bisognava scorrere quasi una
 * schermata intera dopo la fine della mappa. Ora entra come la chiusura del
 * capitolo dell'ombra (`.sf-aftermath`): fascia bassa, testo in alto, si legge
 * appena arriva. Il movimento è quello che il capitolo usa già ovunque, così
 * questa non è più l'unica transizione con una regia tutta sua.
 */
function PlanIntroBridge() {
  return (
    <motion.div
      className="plan-intro"
      variants={RIFUGI_REVEAL}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.5 }}
    >
      <div className="plan-intro-inner">
        <motion.p className="plan-intro-lead" variants={RIFUGI_REVEAL_ITEM}>
          {planIntroCopy.lead}
        </motion.p>
        <motion.p className="plan-intro-body" variants={RIFUGI_REVEAL_ITEM}>
          {planIntroCopy.body}
        </motion.p>
      </div>
    </motion.div>
  );
}

/**
 * Closing chapter — "Gli spazi verdi sono la soluzione". One continuous, flowing
 * section and the main pay-off of the story: it teaches the citizen what a
 * climate refuge really is, shows that Bologna already has a network of them
 * (the only interactive moment of the chapter since the 3-30-300 block left the
 * story — see `11`), and how the city grows the relief where it is missing.
 *
 * L'ultimo movimento non è più tre "beat" illustrati (NBS · corridoi · portici),
 * ma **una scena sola** in cui la rete si vede formare (`12`). Fra la mappa reale
 * e la pianta c'è soltanto un breve cambio di registro: serve a dichiarare che
 * ciò che segue è uno scenario, non un'altra mappa dei luoghi esistenti.
 *
 * Quella scena è ora una PIANTA (`CityPlanScene`) e non più un nastro visto da
 * terra: i tre concetti che deve far passare sono tutti e tre fatti di distanze
 * (un buco nella copertura, una linea fra due punti, una rete che esiste già), e
 * le distanze da terra non si vedono.
 */
export function ClimateReliefSection({ onGlossary }) {
  return (
    <section className="relief-chapter" aria-labelledby="relief-title" lang="it">
      {/* Apertura e trasformazione condividono la stessa scena e la stessa
          vignetta: il disegno non riparte quando comincia lo sticky. */}
      <RifugioExplainer onGlossary={onGlossary} />

      {/* ── Bologna's refuges, in the real city ── */}
      <div className="relief-field relief-field--rifugi">
        <motion.div
          className="relief-flow relief-flow--rifugi"
          variants={RIFUGI_REVEAL}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.32 }}
        >
          <motion.div className="rifugi-intro-head" variants={RIFUGI_REVEAL_ITEM}>
            <h3 className="rifugi-title">{rifugiCopy.title}</h3>
          </motion.div>

          <div className="rifugi-intro-copy">
            {rifugiCopy.body.map((p, i) => (
              <motion.p key={i} className="relief-body" variants={RIFUGI_REVEAL_ITEM}>
                {p}
              </motion.p>
            ))}
            <motion.p className="rifugi-map-invitation" variants={RIFUGI_REVEAL_ITEM}>
              {rifugiCopy.mapInvitation}
            </motion.p>
          </div>
        </motion.div>
      </div>
      <RifugiMapScene />

      {/* La mappa appena lasciata contiene luoghi reali; la pianta che segue è
          invece uno scenario. Questo cambio va detto in uno spazio autonomo,
          prima che il lettore debba interpretare un nuovo disegno. */}
      <PlanIntroBridge />

      {/* ── Dove la rete non arriva, si costruisce: la pianta di un quartiere
          dall'alto, su cui spazi verdi, corridoi e portici diventano una rete
          sola mentre si scorre ── */}
      <CityPlanScene />
    </section>
  );
}
