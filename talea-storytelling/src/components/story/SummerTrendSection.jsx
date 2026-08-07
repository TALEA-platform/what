import { motion } from "framer-motion";
import { SummerTrendChart } from "../charts/SummerTrendChart";
import { TitleSprig } from "../ui/TitleSprig";
import { SectionDivider } from "./SectionDivider";
import { summerTrendCopy } from "../../data/summerTrend";
import { CopySegments } from "./CopySegments";

// Shared soft "cinematic" easing (same curve family as the hero transitions).
const EASE = [0.22, 1, 0.36, 1];

// This section is pulled up UNDER the hero and revealed by its dissolve, so a
// naive whileInView would fire while the elements are still BEHIND the (opaque)
// hero — the reveal would finish unseen. The negative BOTTOM viewport margin
// delays every trigger until the element has risen well past the fold (i.e. after
// the hero has dissolved away), so the cascade actually plays on screen. If it
// still starts too early/late, tune the "-42%" below.
const REVEAL_VIEWPORT = { once: true, margin: "0px 0px -42% 0px" };

// The section assembles FROM ITS TWO SIDES: the copy sweeps in from the LEFT
// (staggered, line by line) while the chart comes in from the RIGHT — they meet
// in the middle as the hero clears.
const textGroup = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.05 } },
};
const textItem = {
  hidden: { opacity: 0, x: -56 },
  show: { opacity: 1, x: 0, transition: { duration: 0.85, ease: EASE } },
};

// Chart slides in from the RIGHT. NO scale here: the chart measures its container
// width, and a scaled wrapper makes it draw the curve at the wrong size — a
// translateX leaves the measured width untouched, so it's safe.
const chartRise = {
  initial: { opacity: 0, x: 72 },
  whileInView: { opacity: 1, x: 0 },
  viewport: REVEAL_VIEWPORT,
  transition: { duration: 1.0, delay: 0.12, ease: EASE },
};

export function SummerTrendSection() {
  return (
    <section className="trend-section" aria-label="Trend estati a Bologna">
      <div className="trend-frame">
        <SectionDivider />
        <div className="trend-inner">
          <motion.div
            className="trend-text"
            lang="it"
            variants={textGroup}
            initial="hidden"
            whileInView="show"
            viewport={REVEAL_VIEWPORT}
          >
            <motion.h2 className="trend-title" variants={textItem}>
              {summerTrendCopy.title}
            </motion.h2>

            <motion.div className="trend-title-sprig" variants={textItem}>
              <TitleSprig />
            </motion.div>

            <motion.p className="trend-lead" variants={textItem}>
              {summerTrendCopy.lead}
            </motion.p>

            {/* Una frase sola, in un paragrafo solo: il colpo finale va a capo
                ma non si stacca (03, Esito). */}
            <motion.p className="trend-body" variants={textItem}>
              {summerTrendCopy.bridge}
              <br />
              <span className="trend-punch">
                <CopySegments parts={summerTrendCopy.punch} />
              </span>
            </motion.p>
          </motion.div>

          <motion.div className="trend-chart-wrapper" {...chartRise}>
            <div className="trend-chart-frame">
              <SummerTrendChart />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
