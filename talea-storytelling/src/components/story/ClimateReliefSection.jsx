import { motion } from "framer-motion";
import { RifugioExplainer } from "./RifugioExplainer";
import { RifugiMapScene } from "./RifugiMapScene";
import { CityPlanScene } from "./CityPlanScene";
import { useContent } from "../../content";

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

function PlanIntroBridge({ content }) {
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
          {content.lead}
        </motion.p>
        <motion.p className="plan-intro-body" variants={RIFUGI_REVEAL_ITEM} />
      </div>
    </motion.div>
  );
}

export function ClimateReliefSection({ onGlossary }) {
  const { content, locale } = useContent();
  const refugesIntro = content.climateRelief.refuges.intro;
  const cityPlanBridge = content.climateRelief.cityPlan.bridge;

  return (
    <section className="relief-chapter" aria-labelledby="relief-title" lang={locale}>
      <RifugioExplainer onGlossary={onGlossary} />

      <div className="relief-field relief-field--rifugi">
        <motion.div
          className="relief-flow relief-flow--rifugi"
          variants={RIFUGI_REVEAL}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.32 }}
        >
          <motion.div className="rifugi-intro-head" variants={RIFUGI_REVEAL_ITEM}>
            <h3 className="rifugi-title">{refugesIntro.title}</h3>
          </motion.div>

          <div className="rifugi-intro-copy">
            {refugesIntro.body.map((paragraph) => (
              <motion.p
                key={paragraph.id}
                className="relief-body"
                variants={RIFUGI_REVEAL_ITEM}
              >
                {paragraph.text}
              </motion.p>
            ))}
            <motion.p className="rifugi-map-invitation" variants={RIFUGI_REVEAL_ITEM}>
              {refugesIntro.mapInvitation}
            </motion.p>
          </div>
        </motion.div>
      </div>
      <RifugiMapScene />

      <PlanIntroBridge content={cityPlanBridge} />

      <CityPlanScene />
    </section>
  );
}
