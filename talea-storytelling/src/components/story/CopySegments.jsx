import { Fragment } from "react";
import { GlossaryTerm } from "../ui/GlossaryDrawer";

const withLineBreaks = (text, breakAfterPeriod = false) => {
  const lines = text.split("\n");
  if (lines.length === 1 && !breakAfterPeriod) return text;

  return lines.flatMap((line, lineIndex) => {
    const chunks = breakAfterPeriod ? line.split(/(\.\s*)/g) : [line];
    const rendered = [];

    if (lineIndex > 0) rendered.push(<br key={`line-${lineIndex}`} />);

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      if (!chunk) continue;

      if (breakAfterPeriod && /^\.\s*$/.test(chunk)) {
        rendered.push(<Fragment key={`${lineIndex}-dot-${index}`}>.</Fragment>);
        if (chunks.slice(index + 1).some(Boolean)) {
          rendered.push(<br key={`${lineIndex}-br-${index}`} />);
        }
        continue;
      }

      rendered.push(<Fragment key={`${lineIndex}-text-${index}`}>{chunk}</Fragment>);
    }

    return rendered;
  });
};

// Renders copy declared as segments in src/data/*.js — il modo con cui i testi
// portano la loro enfasi senza che finisca nel JSX:
//   kw:       parola in evidenza (01 § 1.3)
//   glossary: id di un termine del glossario (01 § 1.3, secondo livello)
//   keep:     pezzo che non deve andare a capo
// Tutto il resto è testo semplice, così il paragrafo va a capo normalmente.
//
// `kwClass` esiste per l'hero: lì il testo sta sopra un video e la `.kw` verde
// scuro sarebbe illeggibile, quindi usa la sua variante chiara.
//
// `onGlossary` è l'handler che App.jsx passa per prop: senza, un segmento
// `glossary` resta testo semplice invece di diventare un bottone morto.
export function CopySegments({ parts, kwClass = "kw", onGlossary, breakAfterPeriod = false }) {
  return parts.map((part, index) => {
    if (part.kw) {
      return (
        <span key={index} className={kwClass}>
          {withLineBreaks(part.text, breakAfterPeriod)}
        </span>
      );
    }
    if (part.glossary && onGlossary) {
      return (
        <GlossaryTerm key={index} id={part.glossary} onOpen={onGlossary}>
          {withLineBreaks(part.text, breakAfterPeriod)}
        </GlossaryTerm>
      );
    }
    if (part.link) {
      return (
        <a
          key={index}
          href={part.link}
          className="copy-link"
          target="_blank"
          rel="noopener noreferrer"
        >
          {withLineBreaks(part.text, breakAfterPeriod)}
        </a>
      );
    }
    if (part.keep) {
      return (
        <span key={index} className="hero-subtitle-keep">
          {withLineBreaks(part.text, breakAfterPeriod)}
        </span>
      );
    }
    return <Fragment key={index}>{withLineBreaks(part.text, breakAfterPeriod)}</Fragment>;
  });
}
