import { motion, useReducedMotion } from "framer-motion";
import { useMemo, useRef } from "react";
import { CountUp } from "../ui/CountUp";
import { EuEmblem } from "../ui/EuEmblem";
import { ScrollCue } from "../ui/ScrollCue";
import { TaleaLogoDraw } from "../ui/TaleaLogoDraw";
import { TaleaGrowthBackdrop } from "./TaleaGrowthBackdrop";
import { TaleaParticipationVignette } from "./TaleaParticipationVignette";
import { CopySegments } from "./CopySegments";
import { useCountUpRun } from "../../hooks/useCountUpRun";
import {
  resolveTaleaLink,
  taleaOtherPartnerCount,
  taleaPartnerSpecs,
  taleaParticipationData,
} from "../../data/taleaProject";
import { useContent } from "../../content";

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

const PARTICIPATION_CARD_REVEAL = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.08,
    },
  },
};

const PARTICIPATION_ROW_REVEAL = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.56,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const PARTICIPATION_BAR_REVEAL = {
  hidden: { opacity: 0.4, scaleX: 0 },
  show: {
    opacity: 1,
    scaleX: 1,
    transition: {
      duration: 0.74,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const PARTICIPATION_STAT_REVEAL = {
  hidden: { opacity: 0, scale: 0.96, y: 16 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.72,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export function TaleaProjectSection({ onGlossary }) {
  const { content, locale } = useContent();
  const taleaProject = content.talea.project;
  const taleaFacts = useMemo(
    () => ({
      ...taleaProject.facts,
      items: taleaProject.facts.items.map((fact) => ({
        ...fact,
        note: fact.noteTemplate
          ? fact.noteTemplate.replace("{n}", String(taleaOtherPartnerCount))
          : fact.note,
      })),
    }),
    [taleaProject],
  );
  const reduceMotion = useReducedMotion();

  return (
    <section className="talea-chapter" aria-labelledby="talea-title" lang={locale}>
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
            {taleaProject.header.title}
          </motion.h2>

          <motion.p className="talea-subtitle" variants={TALEA_REVEAL_ITEM}>
            {taleaProject.header.subtitle}
          </motion.p>

          <motion.p className="talea-lockup" variants={TALEA_REVEAL_ITEM}>
            <span className="talea-lockup-label">{taleaProject.header.lockup}</span>
            <a
              className="talea-logo-link"
              href={resolveTaleaLink(taleaProject.header.logo.linkId)}
              target="_blank"
              rel="noreferrer"
            >
              <TaleaLogoDraw title={taleaProject.header.logo.alt} />
            </a>
          </motion.p>

          <motion.div className="talea-meaning" variants={TALEA_REVEAL_ITEM}>
            <p className="talea-gloss">
              <CopySegments parts={taleaProject.meaning.lead} onGlossary={onGlossary} />
            </p>

            <p className="talea-body">{taleaProject.meaning.body}</p>
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

      <div className="talea-bridge-wrap">
        <p className="talea-bridge">{taleaProject.bridge.text}</p>
        <ScrollCue variant="light" loop className="talea-bridge-cue" />
      </div>
    </section>
  );
}

export function TaleaParticipationSection() {
  const { content, locale } = useContent();
  const taleaParticipation = content.talea.participation;
  const reduceMotion = useReducedMotion();
  const participationAreas = useMemo(() => {
    const categoryCopyById = new Map(
      taleaParticipation.chart.categories.map((category) => [category.id, category]),
    );
    const areaCopyById = new Map(
      taleaParticipation.chart.areas.map((area) => [area.id, area]),
    );
    const percentageFormatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });

    return taleaParticipationData.areas.map((area) => {
      const total = taleaParticipationData.categories.reduce(
        (sum, category) => sum + area.categoryCounts[category.id],
        0,
      );
      const dominantCount = Math.max(
        ...taleaParticipationData.categories.map(
          (category) => area.categoryCounts[category.id],
        ),
      );
      const categories = taleaParticipationData.categories.map((category) => {
        const count = area.categoryCounts[category.id];
        const percentage = (count / total) * 100;
        return {
          ...category,
          ...categoryCopyById.get(category.id),
          count,
          percentage,
          percentageLabel: percentageFormatter.format(percentage),
          isDominant: count === dominantCount,
        };
      });

      return {
        ...area,
        ...areaCopyById.get(area.id),
        total,
        categories,
        ariaLabel: [
          `${areaCopyById.get(area.id).name}, ${total} ${taleaParticipation.chart.proposalsLabel}.`,
          ...categories.map(
            (category) =>
              `${category.label}: ${category.count}, ${category.percentageLabel}%.`,
          ),
        ].join(" "),
      };
    });
  }, [locale, taleaParticipation]);
  const totalProposals = participationAreas.reduce((sum, area) => sum + area.total, 0);
  const statRef = useRef(null);
  const runStatCount = useCountUpRun(statRef);

  return (
    <section
      className="talea-participation"
      aria-labelledby="talea-participation-title"
      lang={locale}
      data-motion="story"
    >
      <div className="talea-participation-frame">
        <motion.div
          className="talea-say"
          variants={TALEA_REVEAL}
          initial={reduceMotion ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, amount: 0.3 }}
        >
          <motion.h2
            id="talea-participation-title"
            className="talea-participation-intro-title"
            variants={TALEA_REVEAL_ITEM}
          >
            {taleaParticipation.intro.title}
          </motion.h2>
          <motion.p className="talea-say-body" variants={TALEA_REVEAL_ITEM}>
            {taleaParticipation.intro.body}
          </motion.p>
        </motion.div>

        <motion.div
          className="talea-participation-showcase"
          variants={TALEA_REVEAL}
          initial={reduceMotion ? false : "hidden"}
          whileInView="show"
          viewport={{ once: true, amount: 0.24 }}
        >
          <motion.div className="talea-participation-vignette" variants={TALEA_REVEAL_ITEM}>
            <TaleaParticipationVignette
              ariaLabel={taleaParticipation.intro.vignette.ariaLabel}
              description={taleaParticipation.intro.vignette.description}
              reduceMotion={reduceMotion}
            />
          </motion.div>

          <motion.div className="talea-participation-stat-column" variants={TALEA_REVEAL}>
            <div ref={statRef} className="talea-participation-stat">
              <motion.p
                className="talea-participation-stat-lockup"
                variants={PARTICIPATION_STAT_REVEAL}
              >
                <strong className="talea-participation-stat-value tnum">
                  <CountUp target={totalProposals} run={runStatCount} suffix="" />
                </strong>
                <span className="talea-participation-stat-label">
                  {taleaParticipation.stat.mappedLabel}
                </span>
                <span className="talea-participation-stat-scope">
                  {taleaParticipation.stat.scope}
                </span>
              </motion.p>
              <motion.ul
                className="talea-participation-area-summary"
                variants={TALEA_REVEAL_ITEM}
              >
                {participationAreas.map((area) => (
                  <li key={area.id}>
                    <strong className="tnum">{area.total}</strong> {area.name}
                  </li>
                ))}
              </motion.ul>
            </div>
            <motion.p
              className="talea-participation-methodology"
              variants={TALEA_REVEAL_ITEM}
            >
              {taleaParticipation.stat.methodology}
            </motion.p>
          </motion.div>
        </motion.div>

        <figure className="talea-participation-figure">
          <motion.figcaption
            className="talea-participation-figure-caption"
            variants={TALEA_REVEAL}
            initial={reduceMotion ? false : "hidden"}
            whileInView="show"
            viewport={{ once: true, amount: 0.36 }}
          >
            <motion.h3
              className="talea-participation-chart-title"
              variants={TALEA_REVEAL_ITEM}
            >
              {taleaParticipation.chart.title}
            </motion.h3>
          </motion.figcaption>

          <div className="talea-participation-areas">
            {participationAreas.map((area) => (
              <motion.article
                key={area.id}
                className="talea-participation-area"
                aria-label={area.ariaLabel}
                variants={PARTICIPATION_CARD_REVEAL}
                initial={reduceMotion ? false : "hidden"}
                whileInView="show"
                viewport={{ once: true, amount: 0.28 }}
              >
                <motion.header
                  className="talea-participation-area-header"
                  variants={PARTICIPATION_ROW_REVEAL}
                >
                  <h4 id={`talea-participation-${area.id}`}>{area.name}</h4>
                  <p className="talea-participation-area-total">
                    <strong className="tnum">{area.total}</strong>{" "}
                    {taleaParticipation.chart.proposalsLabel}
                  </p>
                </motion.header>

                <ul className="talea-participation-breakdown">
                  {area.categories.map((category) => (
                    <motion.li
                      key={category.id}
                      className={category.isDominant ? "is-dominant" : undefined}
                      variants={PARTICIPATION_ROW_REVEAL}
                    >
                      <span className="talea-participation-category-line">
                        <span className="talea-participation-category-label">
                          {category.label}
                        </span>
                        <span className="talea-participation-category-value tnum">
                          <strong>{category.count}</strong>
                        </span>
                      </span>
                      <span className="talea-participation-mini-track" aria-hidden="true">
                        <motion.span
                          className="talea-participation-mini-fill"
                          style={{ width: `${category.percentage}%` }}
                          variants={PARTICIPATION_BAR_REVEAL}
                        />
                      </span>
                    </motion.li>
                  ))}
                </ul>
              </motion.article>
            ))}
          </div>

        </figure>

        <motion.aside
          className="talea-participation-takeaway"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.68, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="talea-participation-takeaway-text">
            {taleaParticipation.takeaway.text}
          </p>
        </motion.aside>
      </div>
    </section>
  );
}

export function TaleaPartnersSection() {
  const { content, locale } = useContent();
  const taleaPartnerContent = content.talea.partners;
  const taleaPartners = useMemo(() => {
    const partnerCopyById = new Map(
      taleaPartnerContent.items.map((partner) => [partner.partnerId, partner]),
    );
    return taleaPartnerSpecs.map((spec) => ({
      ...spec,
      ...partnerCopyById.get(spec.id),
    }));
  }, [taleaPartnerContent]);

  return (
    <section className="talea-partners" aria-labelledby="talea-partners-title" lang={locale}>
      <div className="talea-frame">
        <h2 id="talea-partners-title" className="talea-partners-title">
          {taleaPartnerContent.title}
        </h2>

        <ul className="talea-partner-grid" aria-label={taleaPartnerContent.ariaLabel}>
          {taleaPartners.map((partner) => (
            <li key={partner.id}>
              <a
                className={`talea-partner-card${
                  partner.lead ? " talea-partner-card--lead" : ""
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
          href={resolveTaleaLink(taleaPartnerContent.funding.linkId)}
          target="_blank"
          rel="noreferrer"
        >
          <EuEmblem label={taleaPartnerContent.funding.emblemLabel} />
          <span>{taleaPartnerContent.funding.text}</span>
        </a>
      </div>
    </section>
  );
}
