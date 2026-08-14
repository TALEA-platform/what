import climateReliefStats from "../generated/climate-relief-stats.json";
import { resolveTaleaLink, taleaSourceSpecs } from "./taleaProject";

const SECTION_AFTER = {
  hotspot: ".hotspot-scene",
  ombra: "#ombra",
  fragilita: ".vulnerability-section",
  rifugi: ".relief-map-section--rifugi",
  aree: ".zones-scene",
};

const HIGHLIGHT_AFTER = {
  "hottest-surfaces-threshold": ".hotspot-scene",
  "municipal-refuges": ".relief-map-section--rifugi",
};

const sourceSpecById = new Map(taleaSourceSpecs.map((source) => [source.id, source]));

const DATA_VALUES = {
  "officialRefuges.total": climateReliefStats.officialRefuges.total,
};

export function buildMethodContent(content) {
  const editorialMethod = content.method;
  const sourceCopyById = new Map(
    content.talea.closing.sources.apps.map((source) => [source.id, source]),
  );
  const links = editorialMethod.sources.sourceIds.map((sourceId) => {
    const source = sourceCopyById.get(sourceId);
    const spec = sourceSpecById.get(sourceId);
    if (!source || !spec) throw new Error(`Missing Method source: ${sourceId}`);
    return {
      id: sourceId,
      label: spec.feature ? source.name : source.tag,
      note: spec.feature ? source.tag : source.name,
      href: resolveTaleaLink(source.linkId),
    };
  });

  return {
    ...editorialMethod,
    highlights: editorialMethod.highlights.map(({ dataValue, ...highlight }) => ({
      ...highlight,
      value: dataValue ? String(DATA_VALUES[dataValue]) : highlight.value,
      after: HIGHLIGHT_AFTER[highlight.id],
    })),
    sections: editorialMethod.sections.map((section) => ({
      ...section,
      after: SECTION_AFTER[section.id],
    })),
    linksLabel: editorialMethod.sources.label,
    links,
  };
}
