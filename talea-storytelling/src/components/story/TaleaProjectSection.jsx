import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { EuEmblem } from "../ui/EuEmblem";
import { ScrollCue } from "../ui/ScrollCue";
import { TaleaLogoDraw } from "../ui/TaleaLogoDraw";
import { TaleaGrowthBackdrop } from "./TaleaGrowthBackdrop";
import { CopySegments } from "./CopySegments";
import {
  resolveTaleaLink,
  taleaOtherPartnerCount,
  taleaPartnerSpecs,
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

  return (
    <section
      className="talea-participation"
      aria-labelledby="talea-participation-title"
      lang={locale}
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
