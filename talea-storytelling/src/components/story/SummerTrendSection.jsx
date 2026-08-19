import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SummerTrendChart } from "../charts/SummerTrendChart";
import { TitleSprig } from "../ui/TitleSprig";
import { SectionDivider } from "./SectionDivider";
import { useContent } from "../../content";
import { CopySegments } from "./CopySegments";

const EASE = [0.22, 1, 0.36, 1];

const REVEAL_VIEWPORT = { once: true, margin: "0px 0px -42% 0px" };
const MOBILE_REVEAL_VIEWPORT = { once: true, margin: "0px 0px 8% 0px" };

const textGroup = {
  hidden: {},
  show: { transition: { staggerChildren: 0.14, delayChildren: 0.05 } },
};
const textItem = {
  hidden: { opacity: 0, x: -56 },
  show: { opacity: 1, x: 0, transition: { duration: 0.85, ease: EASE } },
};

const chartRise = {
  initial: { opacity: 0, x: 72 },
  whileInView: { opacity: 1, x: 0 },
  viewport: REVEAL_VIEWPORT,
  transition: { duration: 1.0, delay: 0.12, ease: EASE },
};

export function SummerTrendSection() {
  const { content, locale } = useContent();
  const { summerTrend } = content;
  const [mobileLayout, setMobileLayout] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 1279px)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    const updateLayout = (event) => setMobileLayout(event.matches);
    media.addEventListener?.("change", updateLayout);
    return () => media.removeEventListener?.("change", updateLayout);
  }, []);

  const revealViewport = mobileLayout
    ? MOBILE_REVEAL_VIEWPORT
    : REVEAL_VIEWPORT;

  return (
    <section className="trend-section" aria-label={summerTrend.ariaLabel}>
      <div className="trend-frame">
        <SectionDivider />
        <div className="trend-inner">
          <motion.div
            className="trend-text"
            lang={locale}
            variants={textGroup}
            initial={mobileLayout ? "show" : "hidden"}
            animate={mobileLayout ? "show" : undefined}
            whileInView={mobileLayout ? undefined : "show"}
            viewport={mobileLayout ? undefined : REVEAL_VIEWPORT}
          >
            <motion.h2 className="trend-title" variants={textItem}>
              {summerTrend.title}
            </motion.h2>

            <motion.div className="trend-title-sprig" variants={textItem}>
              <TitleSprig />
            </motion.div>

            <motion.p className="trend-lead" variants={textItem}>
              {summerTrend.lead}
            </motion.p>

            <motion.p className="trend-body" variants={textItem}>
              {summerTrend.bridge}
              <br />
              <span className="trend-punch">
                <CopySegments parts={summerTrend.punch} />
              </span>
            </motion.p>
          </motion.div>

          <motion.div
            className="trend-chart-wrapper"
            {...chartRise}
            viewport={revealViewport}
          >
            <div className="trend-chart-frame">
              <SummerTrendChart />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
