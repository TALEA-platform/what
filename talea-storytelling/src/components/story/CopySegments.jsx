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

export function CopySegments({ parts, kwClass = "kw", onGlossary, breakAfterPeriod = false }) {
  return parts.map((part, index) => {
    const key = part.id ?? index;
    if (part.kw) {
      return (
        <span key={key} className={kwClass}>
          {withLineBreaks(part.text, breakAfterPeriod)}
        </span>
      );
    }
    if (part.glossary && onGlossary) {
      return (
        <GlossaryTerm key={key} id={part.glossary} onOpen={onGlossary}>
          {withLineBreaks(part.text, breakAfterPeriod)}
        </GlossaryTerm>
      );
    }
    if (part.link) {
      return (
        <a
          key={key}
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
        <span key={key} className="hero-subtitle-keep">
          {withLineBreaks(part.text, breakAfterPeriod)}
        </span>
      );
    }
    return <Fragment key={key}>{withLineBreaks(part.text, breakAfterPeriod)}</Fragment>;
  });
}
