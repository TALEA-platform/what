export function buildGlossary(glossaryContent) {
  return {
    glossary: Object.fromEntries(
      glossaryContent.terms.map((entry) => [
        entry.id,
        {
          term: entry.term,
          definition: entry.definition.join("\n\n"),
        },
      ]),
    ),
    glossaryOrder: glossaryContent.terms
      .filter((entry) => entry.trail)
      .map((entry) => entry.id),
  };
}
