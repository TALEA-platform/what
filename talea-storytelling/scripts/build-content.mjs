import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";
import { parse } from "yaml";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supportedLocales = ["it", "en"];
const defaultLocale = "it";

function requireObject(value, location) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${location} must be an object`);
  }
  return value;
}

function requireString(value, location) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${location} must be a non-empty string`);
  }
  return value;
}

function requireArray(value, location) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${location} must be a non-empty array`);
  }
  return value;
}

function validateSegments(value, location) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${location} must be a non-empty array`);
  }

  const ids = new Set();
  return value.map((rawSegment, index) => {
    const segment = requireObject(rawSegment, `${location}[${index}]`);
    const id = requireString(segment.id, `${location}[${index}].id`);
    if (ids.has(id)) throw new Error(`${location} contains duplicate id: ${id}`);
    ids.add(id);

    for (const flag of ["kw", "keep", "emphasis"]) {
      if (segment[flag] !== undefined && typeof segment[flag] !== "boolean") {
        throw new Error(`${location}[${index}].${flag} must be boolean`);
      }
    }

    const glossary =
      segment.glossary === undefined
        ? undefined
        : requireString(segment.glossary, `${location}[${index}].glossary`);
    const linkId =
      segment.linkId === undefined
        ? undefined
        : requireString(segment.linkId, `${location}[${index}].linkId`);

    return {
      id,
      text: requireString(segment.text, `${location}[${index}].text`),
      ...(segment.kw ? { kw: true } : {}),
      ...(segment.keep ? { keep: true } : {}),
      ...(segment.emphasis ? { emphasis: true } : {}),
      ...(glossary ? { glossary } : {}),
      ...(linkId ? { linkId } : {}),
    };
  });
}

function validatePhysicalDriverSegments(value, expectedIds, location) {
  requireOrderedIds(value, expectedIds, location);
  const segments = validateSegments(value, location).map((segment, index) => {
    const rawSegment = value[index];
    const structuralStrings = {};
    for (const field of ["topic", "flightTarget", "emphasisGroup"]) {
      if (rawSegment[field] !== undefined) {
        structuralStrings[field] = requireString(
          rawSegment[field],
          `${location}[${index}].${field}`,
        );
      }
    }
    return { ...segment, ...structuralStrings };
  });

  const structuralFields = [
    "kw",
    "keep",
    "glossary",
    "topic",
    "flightTarget",
    "emphasisGroup",
  ];
  segments.forEach((segment) => {
    const expected = physicalDriverSegmentStructure[segment.id] ?? {};
    for (const field of structuralFields) {
      if (segment[field] !== expected[field]) {
        throw new Error(`${location}.${segment.id}.${field} has invalid structure`);
      }
    }
  });

  return segments;
}

function validateParagraphs(value, location) {
  const paragraphs = requireArray(value, location);
  const ids = new Set();
  return paragraphs.map((rawParagraph, index) => {
    const paragraph = requireObject(rawParagraph, `${location}[${index}]`);
    const id = requireString(paragraph.id, `${location}[${index}].id`);
    if (ids.has(id)) throw new Error(`${location} contains duplicate id: ${id}`);
    ids.add(id);
    return {
      id,
      segments: validateSegments(
        paragraph.segments,
        `${location}[${index}].segments`,
      ),
    };
  });
}

function requireOrderedIds(value, expectedIds, location) {
  const items = requireArray(value, location);
  const actualIds = items.map((item, index) =>
    requireString(requireObject(item, `${location}[${index}]`).id, `${location}[${index}].id`),
  );
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) {
    throw new Error(`${location} IDs must be: ${expectedIds.join(", ")}`);
  }
  return items;
}

function validateStringMap(value, expectedKeys, location) {
  const map = requireObject(value, location);
  const actualKeys = Object.keys(map);
  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    throw new Error(`${location} keys must be: ${expectedKeys.join(", ")}`);
  }
  return Object.fromEntries(
    actualKeys.map((key) => [key, requireString(map[key], `${location}.${key}`)]),
  );
}

function requireNumberTemplate(value, location) {
  const template = requireString(value, location);
  if (!template.includes("{n}")) {
    throw new Error(`${location} must contain the {n} placeholder`);
  }
  return template;
}

function validateDocument(raw, locale, fileName) {
  const location = `${locale}/${fileName}`;
  const document = requireObject(raw, location);
  if (document.schemaVersion !== 1) {
    throw new Error(`${location}.schemaVersion must be 1`);
  }
  if (document.locale !== locale) {
    throw new Error(`${location}.locale must be ${locale}`);
  }
  return document;
}

function validateHero(document, location) {
  const opening = requireObject(document.opening, `${location}.opening`);
  const bridge = requireObject(document.bridge, `${location}.bridge`);
  const callout = requireObject(bridge.callout, `${location}.bridge.callout`);

  return {
    heroOpening: {
      id: requireString(opening.id, `${location}.opening.id`),
      ariaLabel: requireString(opening.ariaLabel, `${location}.opening.ariaLabel`),
      title: requireString(opening.title, `${location}.opening.title`),
      subtitle: validateSegments(opening.subtitle, `${location}.opening.subtitle`),
      scrollLabel: requireString(opening.scrollLabel, `${location}.opening.scrollLabel`),
    },
    heroBridge: {
      id: requireString(bridge.id, `${location}.bridge.id`),
      body: validateSegments(bridge.body, `${location}.bridge.body`),
      callout: {
        id: requireString(callout.id, `${location}.bridge.callout.id`),
        lead: requireString(callout.lead, `${location}.bridge.callout.lead`),
        pivot: requireString(callout.pivot, `${location}.bridge.callout.pivot`),
      },
    },
  };
}

function validateSummerTrend(document, location) {
  const section = requireObject(document.section, `${location}.section`);
  const chart = requireObject(document.chart, `${location}.chart`);
  const meta = requireObject(chart.meta, `${location}.chart.meta`);
  const zoomInvite = requireObject(chart.zoomInvite, `${location}.chart.zoomInvite`);
  const collapsed = requireObject(
    zoomInvite.collapsed,
    `${location}.chart.zoomInvite.collapsed`,
  );
  const expanded = requireObject(
    zoomInvite.expanded,
    `${location}.chart.zoomInvite.expanded`,
  );
  const tooltip = requireObject(chart.tooltip, `${location}.chart.tooltip`);
  const reference = requireObject(chart.reference, `${location}.chart.reference`);
  const source = requireObject(chart.source, `${location}.chart.source`);

  return {
    summerTrend: {
      id: requireString(section.id, `${location}.section.id`),
      ariaLabel: requireString(section.ariaLabel, `${location}.section.ariaLabel`),
      title: requireString(section.title, `${location}.section.title`),
      lead: requireString(section.lead, `${location}.section.lead`),
      bridge: requireString(section.bridge, `${location}.section.bridge`),
      punch: validateSegments(section.punch, `${location}.section.punch`),
      chart: {
        id: requireString(chart.id, `${location}.chart.id`),
        meta: {
          id: requireString(meta.id, `${location}.chart.meta.id`),
          collapsed: requireString(meta.collapsed, `${location}.chart.meta.collapsed`),
          expanded: requireString(meta.expanded, `${location}.chart.meta.expanded`),
          value: requireString(meta.value, `${location}.chart.meta.value`),
          unit: requireString(meta.unit, `${location}.chart.meta.unit`),
        },
        zoomInvite: {
          id: requireString(zoomInvite.id, `${location}.chart.zoomInvite.id`),
          collapsed: {
            id: requireString(collapsed.id, `${location}.chart.zoomInvite.collapsed.id`),
            lead: requireString(collapsed.lead, `${location}.chart.zoomInvite.collapsed.lead`),
            action: requireString(
              collapsed.action,
              `${location}.chart.zoomInvite.collapsed.action`,
            ),
          },
          expanded: {
            id: requireString(expanded.id, `${location}.chart.zoomInvite.expanded.id`),
            lead: requireString(expanded.lead, `${location}.chart.zoomInvite.expanded.lead`),
            action: requireString(
              expanded.action,
              `${location}.chart.zoomInvite.expanded.action`,
            ),
          },
        },
        tooltip: {
          id: requireString(tooltip.id, `${location}.chart.tooltip.id`),
          versusMean: requireString(
            tooltip.versusMean,
            `${location}.chart.tooltip.versusMean`,
          ),
        },
        reference: {
          id: requireString(reference.id, `${location}.chart.reference.id`),
          label: requireString(reference.label, `${location}.chart.reference.label`),
        },
        source: {
          id: requireString(source.id, `${location}.chart.source.id`),
          prefix: requireString(source.prefix, `${location}.chart.source.prefix`),
          label: requireString(source.label, `${location}.chart.source.label`),
          meanLabel: requireString(source.meanLabel, `${location}.chart.source.meanLabel`),
          variable: requireString(source.variable, `${location}.chart.source.variable`),
          period: requireString(source.period, `${location}.chart.source.period`),
          area: requireString(source.area, `${location}.chart.source.area`),
        },
      },
    },
  };
}

const hotspotVignetteIds = ["superficie", "ricorrenza"];
const hotspotVignetteLabelKeys = {
  superficie: ["air"],
  ricorrenza: ["recurring"],
};
const hotspotStepIds = ["threshold", "recurrence", "persistence"];
const hotspotAnnotationIds = [
  "centro-storico",
  "stazione-centrale",
  "scalo-ravone",
  "caab",
  "fiera",
  "villaggio-ina",
  "aeroporto",
  "bolognina",
  "roveri",
];

function validateHotspot(document, location) {
  const chapter = requireObject(document.chapter, `${location}.chapter`);
  const intro = requireObject(document.intro, `${location}.intro`);
  const closer = requireObject(intro.closer, `${location}.intro.closer`);
  const map = requireObject(document.map, `${location}.map`);
  const annotations = requireObject(map.annotations, `${location}.map.annotations`);
  const legend = requireObject(map.legend, `${location}.map.legend`);
  const active = requireObject(legend.active, `${location}.map.legend.active`);
  const scale = requireObject(legend.scale, `${location}.map.legend.scale`);
  const sourceLink = requireObject(
    legend.sourceLink,
    `${location}.map.legend.sourceLink`,
  );
  const sequence = requireObject(map.sequence, `${location}.map.sequence`);
  const slider = requireObject(map.slider, `${location}.map.slider`);
  const handoff = requireObject(map.handoff, `${location}.map.handoff`);

  const vignettes = requireOrderedIds(
    intro.vignettes,
    hotspotVignetteIds,
    `${location}.intro.vignettes`,
  ).map((rawVignette, index) => {
    const vignetteLocation = `${location}.intro.vignettes[${index}]`;
    const vignette = requireObject(rawVignette, vignetteLocation);
    const visual = requireObject(vignette.visual, `${vignetteLocation}.visual`);
    return {
      id: requireString(vignette.id, `${vignetteLocation}.id`),
      figureLabel: requireString(
        vignette.figureLabel,
        `${vignetteLocation}.figureLabel`,
      ),
      visual: {
        ariaLabel: requireString(visual.ariaLabel, `${vignetteLocation}.visual.ariaLabel`),
        description: requireString(
          visual.description,
          `${vignetteLocation}.visual.description`,
        ),
        labels: validateStringMap(
          visual.labels,
          hotspotVignetteLabelKeys[vignette.id],
          `${vignetteLocation}.visual.labels`,
        ),
      },
      paragraphs: validateParagraphs(
        vignette.paragraphs,
        `${vignetteLocation}.paragraphs`,
      ),
    };
  });

  const steps = requireOrderedIds(
    map.steps,
    hotspotStepIds,
    `${location}.map.steps`,
  ).map((rawStep, index) => {
    const stepLocation = `${location}.map.steps[${index}]`;
    const step = requireObject(rawStep, stepLocation);
    return {
      id: requireString(step.id, `${stepLocation}.id`),
      paragraphs: validateParagraphs(step.paragraphs, `${stepLocation}.paragraphs`),
    };
  });

  const annotationItems = requireOrderedIds(
    annotations.items,
    hotspotAnnotationIds,
    `${location}.map.annotations.items`,
  ).map((rawItem, index) => {
    const itemLocation = `${location}.map.annotations.items[${index}]`;
    const item = requireObject(rawItem, itemLocation);
    return {
      id: requireString(item.id, `${itemLocation}.id`),
      name: requireString(item.name, `${itemLocation}.name`),
      tag: requireString(item.tag, `${itemLocation}.tag`),
      context: requireString(item.context, `${itemLocation}.context`),
    };
  });

  return {
    hotspot: {
      id: requireString(chapter.id, `${location}.chapter.id`),
      intro: {
        id: requireString(intro.id, `${location}.intro.id`),
        ariaLabel: requireString(intro.ariaLabel, `${location}.intro.ariaLabel`),
        lead: requireString(intro.lead, `${location}.intro.lead`),
        vignettes,
        closer: {
          id: requireString(closer.id, `${location}.intro.closer.id`),
          text: requireString(closer.text, `${location}.intro.closer.text`),
        },
      },
      map: {
        id: requireString(map.id, `${location}.map.id`),
        ariaLabel: requireString(map.ariaLabel, `${location}.map.ariaLabel`),
        steps,
        annotations: {
          id: requireString(annotations.id, `${location}.map.annotations.id`),
          ariaLabel: requireString(
            annotations.ariaLabel,
            `${location}.map.annotations.ariaLabel`,
          ),
          items: annotationItems,
        },
        legend: {
          id: requireString(legend.id, `${location}.map.legend.id`),
          title: requireString(legend.title, `${location}.map.legend.title`),
          active: {
            id: requireString(active.id, `${location}.map.legend.active.id`),
            one: requireNumberTemplate(active.one, `${location}.map.legend.active.one`),
            other: requireNumberTemplate(
              active.other,
              `${location}.map.legend.active.other`,
            ),
          },
          scale: {
            id: requireString(scale.id, `${location}.map.legend.scale.id`),
            min: requireString(scale.min, `${location}.map.legend.scale.min`),
            max: requireString(scale.max, `${location}.map.legend.scale.max`),
          },
          caption: requireString(legend.caption, `${location}.map.legend.caption`),
          sourceLink: {
            id: requireString(sourceLink.id, `${location}.map.legend.sourceLink.id`),
            label: requireString(
              sourceLink.label,
              `${location}.map.legend.sourceLink.label`,
            ),
          },
        },
        sequence: {
          id: requireString(sequence.id, `${location}.map.sequence.id`),
          playing: requireString(sequence.playing, `${location}.map.sequence.playing`),
          done: requireString(sequence.done, `${location}.map.sequence.done`),
        },
        slider: {
          id: requireString(slider.id, `${location}.map.slider.id`),
          label: requireString(slider.label, `${location}.map.slider.label`),
          valueTemplate: requireNumberTemplate(
            slider.valueTemplate,
            `${location}.map.slider.valueTemplate`,
          ),
          markLabelTemplate: requireNumberTemplate(
            slider.markLabelTemplate,
            `${location}.map.slider.markLabelTemplate`,
          ),
        },
        handoff: {
          id: requireString(handoff.id, `${location}.map.handoff.id`),
          question: requireString(handoff.question, `${location}.map.handoff.question`),
        },
      },
    },
  };
}

const physicalDriverIntroSegmentIds = [
  "topic-statement-intro",
  "topic-green",
  "topic-statement-bridge",
  "topic-absorption",
  "topic-materials",
  "topic-statement-end",
];
const physicalDriverStageIds = ["clue-green", "clue-materials", "compare"];
const physicalDriverStageSegmentIds = {
  "clue-green": ["green-intro", "green-topic", "green-body"],
  "clue-materials": ["materials-intro", "materials-topic", "materials-body"],
  compare: [
    "compare-intro",
    "compare-materials-topic",
    "compare-materials-detail",
    "compare-bridge",
    "compare-green-detail",
    "compare-green-topic",
    "compare-end",
  ],
};
const physicalDriverSegmentStructure = {
  "topic-green": { kw: true, topic: "green" },
  "topic-materials": { kw: true, topic: "materials" },
  "green-topic": { kw: true, topic: "green", flightTarget: "green" },
  "materials-topic": {
    kw: true,
    topic: "materials",
    flightTarget: "materials",
  },
  "compare-materials-topic": {
    kw: true,
    topic: "materials",
    flightTarget: "compare-materials",
    emphasisGroup: "compare-materials",
  },
  "compare-materials-detail": {
    kw: true,
    emphasisGroup: "compare-materials",
  },
  "compare-green-detail": { kw: true, emphasisGroup: "compare-green" },
  "compare-green-topic": {
    kw: true,
    topic: "green",
    flightTarget: "compare-green",
    emphasisGroup: "compare-green",
  },
};

function validatePhysicalDrivers(document, location) {
  const chapter = requireObject(document.chapter, `${location}.chapter`);
  const intro = requireObject(document.intro, `${location}.intro`);
  const topicStatement = requireObject(
    intro.topicStatement,
    `${location}.intro.topicStatement`,
  );
  const close = requireObject(intro.close, `${location}.intro.close`);
  const narrative = requireObject(document.narrative, `${location}.narrative`);
  const legends = requireObject(document.legends, `${location}.legends`);
  const hotspot = requireObject(legends.hotspot, `${location}.legends.hotspot`);
  const comparison = requireObject(document.comparison, `${location}.comparison`);

  const introSegments = validatePhysicalDriverSegments(
    topicStatement.segments,
    physicalDriverIntroSegmentIds,
    `${location}.intro.topicStatement.segments`,
  );

  const stages = requireOrderedIds(
    narrative.stages,
    physicalDriverStageIds,
    `${location}.narrative.stages`,
  ).map((rawStage, index) => {
    const stageLocation = `${location}.narrative.stages[${index}]`;
    const stage = requireObject(rawStage, stageLocation);
    const id = requireString(stage.id, `${stageLocation}.id`);
    return {
      id,
      segments: validatePhysicalDriverSegments(
        stage.segments,
        physicalDriverStageSegmentIds[id],
        `${stageLocation}.segments`,
      ),
    };
  });

  const topicLabels = new Map(
    introSegments
      .filter((segment) => segment.topic)
      .map((segment) => [segment.topic, segment.text]),
  );
  stages.flatMap((stage) => stage.segments).forEach((segment) => {
    if (segment.topic && segment.text !== topicLabels.get(segment.topic)) {
      throw new Error(
        `${location}.${segment.id}.text must match topic ${segment.topic}`,
      );
    }
  });

  const lenses = requireOrderedIds(
    legends.lenses,
    ["green", "materials"],
    `${location}.legends.lenses`,
  ).map((rawLens, index) => {
    const lensLocation = `${location}.legends.lenses[${index}]`;
    const lens = requireObject(rawLens, lensLocation);
    return {
      id: requireString(lens.id, `${lensLocation}.id`),
      from: requireString(lens.from, `${lensLocation}.from`),
      to: requireString(lens.to, `${lensLocation}.to`),
    };
  });

  return {
    physicalDrivers: {
      id: requireString(chapter.id, `${location}.chapter.id`),
      intro: {
        id: requireString(intro.id, `${location}.intro.id`),
        ariaLabel: requireString(intro.ariaLabel, `${location}.intro.ariaLabel`),
        title: requireString(intro.title, `${location}.intro.title`),
        lead: requireString(intro.lead, `${location}.intro.lead`),
        topicStatement: {
          id: requireString(
            topicStatement.id,
            `${location}.intro.topicStatement.id`,
          ),
          segments: introSegments,
        },
        close: {
          id: requireString(close.id, `${location}.intro.close.id`),
          text: requireString(close.text, `${location}.intro.close.text`),
        },
      },
      narrative: {
        id: requireString(narrative.id, `${location}.narrative.id`),
        stages,
      },
      legends: {
        id: requireString(legends.id, `${location}.legends.id`),
        lenses,
        hotspot: {
          id: requireString(hotspot.id, `${location}.legends.hotspot.id`),
          label: requireString(hotspot.label, `${location}.legends.hotspot.label`),
        },
      },
      comparison: {
        id: requireString(comparison.id, `${location}.comparison.id`),
        handleHint: requireString(
          comparison.handleHint,
          `${location}.comparison.handleHint`,
        ),
        ariaLabel: requireString(
          comparison.ariaLabel,
          `${location}.comparison.ariaLabel`,
        ),
      },
    },
  };
}

const shadowStageIds = ["overview", "centro"];
const shadowMetricIds = [
  "shade",
  "hotspot",
  "vegetation",
  "absorbing-surfaces",
];

function validateShadowFocus(document, location) {
  const chapter = requireObject(document.chapter, `${location}.chapter`);
  const intro = requireObject(document.intro, `${location}.intro`);
  const map = requireObject(document.map, `${location}.map`);
  const legend = requireObject(map.legend, `${location}.map.legend`);
  const sourceLink = requireObject(
    legend.sourceLink,
    `${location}.map.legend.sourceLink`,
  );
  const sequence = requireObject(map.sequence, `${location}.map.sequence`);
  const closing = requireObject(document.closing, `${location}.closing`);
  const statistics = requireObject(document.statistics, `${location}.statistics`);

  const stages = requireOrderedIds(
    map.stages,
    shadowStageIds,
    `${location}.map.stages`,
  ).map((rawStage, index) => {
    const stageLocation = `${location}.map.stages[${index}]`;
    const stage = requireObject(rawStage, stageLocation);
    return {
      id: requireString(stage.id, `${stageLocation}.id`),
      body: requireString(stage.body, `${stageLocation}.body`),
    };
  });

  const metricItems = requireArray(
    statistics.metrics,
    `${location}.statistics.metrics`,
  );
  const metricIds = metricItems.map((rawMetric, index) =>
    requireString(
      requireObject(rawMetric, `${location}.statistics.metrics[${index}]`).metricId,
      `${location}.statistics.metrics[${index}].metricId`,
    ),
  );
  if (JSON.stringify(metricIds) !== JSON.stringify(shadowMetricIds)) {
    throw new Error(
      `${location}.statistics.metrics metricId values must be: ${shadowMetricIds.join(", ")}`,
    );
  }
  const metrics = metricItems.map((rawMetric, index) => {
    const metricLocation = `${location}.statistics.metrics[${index}]`;
    const metric = requireObject(rawMetric, metricLocation);
    const metricId = requireString(metric.metricId, `${metricLocation}.metricId`);
    const note = metric.note === undefined
      ? undefined
      : requireString(metric.note, `${metricLocation}.note`);
    if (["shade", "hotspot"].includes(metricId) && !note) {
      throw new Error(`${metricLocation}.note is required for lead metrics`);
    }
    if (!["shade", "hotspot"].includes(metricId) && note !== undefined) {
      throw new Error(`${metricLocation}.note is only allowed for lead metrics`);
    }
    return {
      metricId,
      label: requireString(metric.label, `${metricLocation}.label`),
      ...(note ? { note } : {}),
    };
  });

  return {
    shadowFocus: {
      id: requireString(chapter.id, `${location}.chapter.id`),
      ariaLabel: requireString(chapter.ariaLabel, `${location}.chapter.ariaLabel`),
      intro: {
        id: requireString(intro.id, `${location}.intro.id`),
        opening: requireString(intro.opening, `${location}.intro.opening`),
        title: requireString(intro.title, `${location}.intro.title`),
        lead: requireString(intro.lead, `${location}.intro.lead`),
        pivot: requireString(intro.pivot, `${location}.intro.pivot`),
      },
      map: {
        id: requireString(map.id, `${location}.map.id`),
        ariaLabel: requireString(map.ariaLabel, `${location}.map.ariaLabel`),
        stages,
        legend: {
          id: requireString(legend.id, `${location}.map.legend.id`),
          title: requireString(legend.title, `${location}.map.legend.title`),
          description: requireString(
            legend.description,
            `${location}.map.legend.description`,
          ),
          from: requireString(legend.from, `${location}.map.legend.from`),
          to: requireString(legend.to, `${location}.map.legend.to`),
          sourceLink: {
            id: requireString(
              sourceLink.id,
              `${location}.map.legend.sourceLink.id`,
            ),
            label: requireString(
              sourceLink.label,
              `${location}.map.legend.sourceLink.label`,
            ),
          },
        },
        sequence: {
          id: requireString(sequence.id, `${location}.map.sequence.id`),
          playing: requireString(sequence.playing, `${location}.map.sequence.playing`),
          done: requireString(sequence.done, `${location}.map.sequence.done`),
        },
      },
      closing: {
        id: requireString(closing.id, `${location}.closing.id`),
        pivot: requireString(closing.pivot, `${location}.closing.pivot`),
        body: requireString(closing.body, `${location}.closing.body`),
      },
      statistics: {
        id: requireString(statistics.id, `${location}.statistics.id`),
        kicker: requireString(statistics.kicker, `${location}.statistics.kicker`),
        scope: requireString(statistics.scope, `${location}.statistics.scope`),
        hinge: requireString(statistics.hinge, `${location}.statistics.hinge`),
        because: requireString(statistics.because, `${location}.statistics.because`),
        municipalComparison: requireString(
          statistics.municipalComparison,
          `${location}.statistics.municipalComparison`,
        ),
        handoff: requireString(statistics.handoff, `${location}.statistics.handoff`),
        metrics,
      },
    },
  };
}

const vulnerabilityPersonIds = [
  "older-people",
  "young-children",
  "pregnant-women",
  "people-with-illness",
  "street-workers",
];
const vulnerabilityHandoffSegmentIds = [
  "vulnerability-handoff-before",
  "vulnerability-handoff-keyword",
  "vulnerability-handoff-after",
];
const vulnerabilityStatisticLabelIds = [
  "vulnerability-statistic-label-primary",
  "vulnerability-statistic-label-context",
];

function validateVulnerability(document, location) {
  const chapter = requireObject(document.chapter, `${location}.chapter`);
  const intro = requireObject(document.intro, `${location}.intro`);
  const vignette = requireObject(intro.vignette, `${location}.intro.vignette`);
  const study = requireObject(document.study, `${location}.study`);
  const handoff = requireObject(study.handoff, `${location}.study.handoff`);
  const statistic = requireObject(study.statistic, `${location}.study.statistic`);
  const source = requireObject(
    statistic.source,
    `${location}.study.statistic.source`,
  );
  const closing = requireObject(document.closing, `${location}.closing`);

  const people = requireOrderedIds(
    intro.people,
    vulnerabilityPersonIds,
    `${location}.intro.people`,
  ).map((rawPerson, index) => {
    const personLocation = `${location}.intro.people[${index}]`;
    const person = requireObject(rawPerson, personLocation);
    return {
      id: requireString(person.id, `${personLocation}.id`),
      text: requireString(person.text, `${personLocation}.text`),
    };
  });

  requireOrderedIds(
    handoff.segments,
    vulnerabilityHandoffSegmentIds,
    `${location}.study.handoff.segments`,
  );
  const handoffSegments = validateSegments(
    handoff.segments,
    `${location}.study.handoff.segments`,
  );
  handoffSegments.forEach((segment) => {
    const expectedKeyword = segment.id === "vulnerability-handoff-keyword";
    if (Boolean(segment.kw) !== expectedKeyword) {
      throw new Error(
        `${location}.study.handoff.segments.${segment.id}.kw has invalid structure`,
      );
    }
    if (segment.keep !== undefined || segment.glossary !== undefined) {
      throw new Error(
        `${location}.study.handoff.segments.${segment.id} has unsupported metadata`,
      );
    }
  });

  const labelLines = requireOrderedIds(
    statistic.labelLines,
    vulnerabilityStatisticLabelIds,
    `${location}.study.statistic.labelLines`,
  ).map((rawLine, index) => {
    const lineLocation = `${location}.study.statistic.labelLines[${index}]`;
    const line = requireObject(rawLine, lineLocation);
    return {
      id: requireString(line.id, `${lineLocation}.id`),
      text: requireString(line.text, `${lineLocation}.text`),
    };
  });

  return {
    vulnerability: {
      id: requireString(chapter.id, `${location}.chapter.id`),
      intro: {
        id: requireString(intro.id, `${location}.intro.id`),
        title: requireString(intro.title, `${location}.intro.title`),
        people,
        ellipsis: requireString(intro.ellipsis, `${location}.intro.ellipsis`),
        health: requireString(intro.health, `${location}.intro.health`),
        vignette: {
          id: requireString(vignette.id, `${location}.intro.vignette.id`),
          title: requireString(vignette.title, `${location}.intro.vignette.title`),
          description: requireString(
            vignette.description,
            `${location}.intro.vignette.description`,
          ),
          ariaLabel: requireString(
            vignette.ariaLabel,
            `${location}.intro.vignette.ariaLabel`,
          ),
        },
      },
      study: {
        id: requireString(study.id, `${location}.study.id`),
        handoff: {
          id: requireString(handoff.id, `${location}.study.handoff.id`),
          segments: handoffSegments,
        },
        statistic: {
          id: requireString(statistic.id, `${location}.study.statistic.id`),
          source: {
            id: requireString(source.id, `${location}.study.statistic.source.id`),
            before: requireString(
              source.before,
              `${location}.study.statistic.source.before`,
            ),
            linkLabel: requireString(
              source.linkLabel,
              `${location}.study.statistic.source.linkLabel`,
            ),
            afterLink: requireString(
              source.afterLink,
              `${location}.study.statistic.source.afterLink`,
            ),
          },
          qualifier: requireString(
            statistic.qualifier,
            `${location}.study.statistic.qualifier`,
          ),
          value: requireString(statistic.value, `${location}.study.statistic.value`),
          labelLines,
        },
      },
      closing: {
        id: requireString(closing.id, `${location}.closing.id`),
        text: requireString(closing.text, `${location}.closing.text`),
      },
    },
  };
}

const climateReliefStepIds = [
  "start",
  "natural-shade",
  "continuous-shade",
  "rest",
  "water",
  "living-ground",
  "accessibility",
  "complete",
];
const climateReliefPlanBeatIds = [
  "quartiere",
  "buco",
  "costruisce",
  "nonuno",
  "corridoi",
  "portici",
  "rete",
];
const climateReliefPlanBodyIds = {
  quartiere: ["neighborhood-body"],
  buco: ["distance-body"],
  costruisce: ["nature-before", "nature-keyword", "nature-after"],
  nonuno: ["distributed-network-body"],
  corridoi: ["corridor-before", "corridor-keyword", "corridor-after"],
  portici: [
    "porticoes-before",
    "porticoes-keyword",
    "porticoes-middle",
    "shadow-lines-link",
    "porticoes-after",
  ],
  rete: ["connected-network-body"],
};

function validateClimateRelief(document, location) {
  const chapter = requireObject(document.chapter, `${location}.chapter`);
  const opening = requireObject(document.opening, `${location}.opening`);
  const lead = requireObject(opening.lead, `${location}.opening.lead`);
  const term = requireObject(lead.term, `${location}.opening.lead.term`);
  const explainer = requireObject(document.explainer, `${location}.explainer`);
  const figure = requireObject(explainer.figure, `${location}.explainer.figure`);
  const model = requireObject(explainer.model, `${location}.explainer.model`);
  const temperature = requireObject(
    model.temperature,
    `${location}.explainer.model.temperature`,
  );
  const controls = requireObject(
    model.controls,
    `${location}.explainer.model.controls`,
  );
  const sequence = requireObject(explainer.sequence, `${location}.explainer.sequence`);
  const refuges = requireObject(document.refuges, `${location}.refuges`);
  const refugesIntro = requireObject(refuges.intro, `${location}.refuges.intro`);
  const refugesMap = requireObject(refuges.map, `${location}.refuges.map`);
  const hints = requireObject(refugesMap.hints, `${location}.refuges.map.hints`);
  const counts = requireObject(refugesMap.counts, `${location}.refuges.map.counts`);
  const links = requireObject(refugesMap.links, `${location}.refuges.map.links`);
  const search = requireObject(refugesMap.search, `${location}.refuges.map.search`);
  const cards = requireObject(refugesMap.cards, `${location}.refuges.map.cards`);
  const green = requireObject(cards.green, `${location}.refuges.map.cards.green`);
  const official = requireObject(
    cards.official,
    `${location}.refuges.map.cards.official`,
  );
  const nearby = requireObject(cards.nearby, `${location}.refuges.map.cards.nearby`);
  const cityPlan = requireObject(document.cityPlan, `${location}.cityPlan`);
  const bridge = requireObject(cityPlan.bridge, `${location}.cityPlan.bridge`);
  const scene = requireObject(cityPlan.scene, `${location}.cityPlan.scene`);
  const context = requireObject(scene.context, `${location}.cityPlan.scene.context`);
  const legend = requireObject(cityPlan.legend, `${location}.cityPlan.legend`);

  const validateTextItems = (value, expectedIds, itemLocation) =>
    requireOrderedIds(value, expectedIds, itemLocation).map((rawItem, index) => {
      const currentLocation = `${itemLocation}[${index}]`;
      const item = requireObject(rawItem, currentLocation);
      return {
        id: requireString(item.id, `${currentLocation}.id`),
        text: requireString(item.text, `${currentLocation}.text`),
      };
    });

  const temperatureLocations = validateTextItems(
    temperature.locations,
    climateReliefStepIds,
    `${location}.explainer.model.temperature.locations`,
  );

  const steps = requireOrderedIds(
    explainer.steps,
    climateReliefStepIds,
    `${location}.explainer.steps`,
  ).map((rawStep, index) => {
    const stepLocation = `${location}.explainer.steps[${index}]`;
    const step = requireObject(rawStep, stepLocation);
    const shouldHavePiece = index > 0 && index < climateReliefStepIds.length - 1;
    if (shouldHavePiece !== (step.piece !== undefined)) {
      throw new Error(`${stepLocation}.piece has invalid structure`);
    }
    return {
      id: requireString(step.id, `${stepLocation}.id`),
      added: requireString(step.added, `${stepLocation}.added`),
      ...(shouldHavePiece
        ? { piece: requireString(step.piece, `${stepLocation}.piece`) }
        : {}),
      paragraphs: requireArray(step.paragraphs, `${stepLocation}.paragraphs`).map(
        (paragraph, paragraphIndex) =>
          requireString(paragraph, `${stepLocation}.paragraphs[${paragraphIndex}]`),
      ),
    };
  });

  const planBeats = requireOrderedIds(
    cityPlan.beats,
    climateReliefPlanBeatIds,
    `${location}.cityPlan.beats`,
  ).map((rawBeat, index) => {
    const beatLocation = `${location}.cityPlan.beats[${index}]`;
    const beat = requireObject(rawBeat, beatLocation);
    requireOrderedIds(
      beat.body,
      climateReliefPlanBodyIds[beat.id],
      `${beatLocation}.body`,
    );
    const body = validateSegments(beat.body, `${beatLocation}.body`);
    body.forEach((segment) => {
      const expectedKeyword = [
        "nature-keyword",
        "corridor-keyword",
        "porticoes-keyword",
      ].includes(segment.id);
      const expectedLink = segment.id === "shadow-lines-link";
      if (Boolean(segment.kw) !== expectedKeyword) {
        throw new Error(`${beatLocation}.body.${segment.id}.kw has invalid structure`);
      }
      if (
        (expectedLink && segment.linkId !== "shadow-lines-project") ||
        (!expectedLink && segment.linkId !== undefined)
      ) {
        throw new Error(
          `${beatLocation}.body.${segment.id}.linkId has invalid structure`,
        );
      }
      if (segment.keep !== undefined || segment.glossary !== undefined) {
        throw new Error(`${beatLocation}.body.${segment.id} has unsupported metadata`);
      }
    });
    return {
      id: requireString(beat.id, `${beatLocation}.id`),
      lead: requireString(beat.lead, `${beatLocation}.lead`),
      body,
    };
  });

  const annotations = requireOrderedIds(
    cityPlan.annotations,
    ["parking", "new-relief", "corridor", "arcades"],
    `${location}.cityPlan.annotations`,
  ).map((rawAnnotation, index) => {
    const annotationLocation = `${location}.cityPlan.annotations[${index}]`;
    const annotation = requireObject(rawAnnotation, annotationLocation);
    return {
      id: requireString(annotation.id, `${annotationLocation}.id`),
      label: requireString(annotation.label, `${annotationLocation}.label`),
    };
  });

  const legendItems = requireOrderedIds(
    legend.items,
    ["new-green-spaces", "climate-corridors", "porticoes"],
    `${location}.cityPlan.legend.items`,
  ).map((rawItem, index) => {
    const itemLocation = `${location}.cityPlan.legend.items[${index}]`;
    const item = requireObject(rawItem, itemLocation);
    return {
      id: requireString(item.id, `${itemLocation}.id`),
      label: requireString(item.label, `${itemLocation}.label`),
    };
  });

  return {
    climateRelief: {
      id: requireString(chapter.id, `${location}.chapter.id`),
      opening: {
        id: requireString(opening.id, `${location}.opening.id`),
        title: requireString(opening.title, `${location}.opening.title`),
        lead: {
          id: requireString(lead.id, `${location}.opening.lead.id`),
          before: requireString(lead.before, `${location}.opening.lead.before`),
          term: {
            id: requireString(term.id, `${location}.opening.lead.term.id`),
            text: requireString(term.text, `${location}.opening.lead.term.text`),
            glossary: requireString(
              term.glossary,
              `${location}.opening.lead.term.glossary`,
            ),
          },
          after: requireString(lead.after, `${location}.opening.lead.after`),
        },
        body: validateTextItems(
          opening.body,
          ["climate-relief-opening-body"],
          `${location}.opening.body`,
        ),
        close: requireString(opening.close, `${location}.opening.close`),
      },
      explainer: {
        id: requireString(explainer.id, `${location}.explainer.id`),
        figure: {
          id: requireString(figure.id, `${location}.explainer.figure.id`),
          ariaLabel: requireString(
            figure.ariaLabel,
            `${location}.explainer.figure.ariaLabel`,
          ),
          svgAriaLabel: requireString(
            figure.svgAriaLabel,
            `${location}.explainer.figure.svgAriaLabel`,
          ),
        },
        model: {
          id: requireString(model.id, `${location}.explainer.model.id`),
          title: requireString(model.title, `${location}.explainer.model.title`),
          description: requireString(
            model.description,
            `${location}.explainer.model.description`,
          ),
          temperature: {
            id: requireString(
              temperature.id,
              `${location}.explainer.model.temperature.id`,
            ),
            legend: requireString(
              temperature.legend,
              `${location}.explainer.model.temperature.legend`,
            ),
            locations: temperatureLocations,
          },
          controls: {
            id: requireString(controls.id, `${location}.explainer.model.controls.id`),
            panGroup: requireString(
              controls.panGroup,
              `${location}.explainer.model.controls.panGroup`,
            ),
            panUp: requireString(controls.panUp, `${location}.explainer.model.controls.panUp`),
            panLeft: requireString(
              controls.panLeft,
              `${location}.explainer.model.controls.panLeft`,
            ),
            panRight: requireString(
              controls.panRight,
              `${location}.explainer.model.controls.panRight`,
            ),
            panDown: requireString(
              controls.panDown,
              `${location}.explainer.model.controls.panDown`,
            ),
            zoomOut: requireString(
              controls.zoomOut,
              `${location}.explainer.model.controls.zoomOut`,
            ),
            zoomIn: requireString(
              controls.zoomIn,
              `${location}.explainer.model.controls.zoomIn`,
            ),
            hint: requireString(controls.hint, `${location}.explainer.model.controls.hint`),
          },
        },
        steps,
        recipeLabel: requireString(
          explainer.recipeLabel,
          `${location}.explainer.recipeLabel`,
        ),
        sequence: {
          id: requireString(sequence.id, `${location}.explainer.sequence.id`),
          playing: requireString(
            sequence.playing,
            `${location}.explainer.sequence.playing`,
          ),
          done: requireString(sequence.done, `${location}.explainer.sequence.done`),
        },
      },
      refuges: {
        id: requireString(refuges.id, `${location}.refuges.id`),
        intro: {
          id: requireString(refugesIntro.id, `${location}.refuges.intro.id`),
          title: requireString(
            refugesIntro.title,
            `${location}.refuges.intro.title`,
          ),
          body: validateTextItems(
            refugesIntro.body,
            ["bologna-climate-refuges-body"],
            `${location}.refuges.intro.body`,
          ),
          mapInvitation: requireString(
            refugesIntro.mapInvitation,
            `${location}.refuges.intro.mapInvitation`,
          ),
        },
        map: {
          id: requireString(refugesMap.id, `${location}.refuges.map.id`),
          ariaLabel: requireString(
            refugesMap.ariaLabel,
            `${location}.refuges.map.ariaLabel`,
          ),
          hints: {
            id: requireString(hints.id, `${location}.refuges.map.hints.id`),
            invite: requireString(hints.invite, `${location}.refuges.map.hints.invite`),
            return: requireString(hints.return, `${location}.refuges.map.hints.return`),
          },
          counts: {
            id: requireString(counts.id, `${location}.refuges.map.counts.id`),
            officialLabel: requireString(
              counts.officialLabel,
              `${location}.refuges.map.counts.officialLabel`,
            ),
            officialSub: requireString(
              counts.officialSub,
              `${location}.refuges.map.counts.officialSub`,
            ),
            compatibleLabel: requireString(
              counts.compatibleLabel,
              `${location}.refuges.map.counts.compatibleLabel`,
            ),
          },
          links: {
            id: requireString(links.id, `${location}.refuges.map.links.id`),
            municipalLabel: requireString(
              links.municipalLabel,
              `${location}.refuges.map.links.municipalLabel`,
            ),
            taleaLabel: requireString(
              links.taleaLabel,
              `${location}.refuges.map.links.taleaLabel`,
            ),
          },
          loadError: requireString(refugesMap.loadError, `${location}.refuges.map.loadError`),
          search: {
            id: requireString(search.id, `${location}.refuges.map.search.id`),
            promptLead: requireString(
              search.promptLead,
              `${location}.refuges.map.search.promptLead`,
            ),
            promptTail: requireString(
              search.promptTail,
              `${location}.refuges.map.search.promptTail`,
            ),
            placeholder: requireString(
              search.placeholder,
              `${location}.refuges.map.search.placeholder`,
            ),
            ariaLabel: requireString(
              search.ariaLabel,
              `${location}.refuges.map.search.ariaLabel`,
            ),
            submit: requireString(search.submit, `${location}.refuges.map.search.submit`),
            searching: requireString(
              search.searching,
              `${location}.refuges.map.search.searching`,
            ),
            empty: requireString(search.empty, `${location}.refuges.map.search.empty`),
            routeLoading: requireString(
              search.routeLoading,
              `${location}.refuges.map.search.routeLoading`,
            ),
            routeError: requireString(
              search.routeError,
              `${location}.refuges.map.search.routeError`,
            ),
            suggestionLabels: validateStringMap(
              search.suggestionLabels,
              [
                "address",
                "square",
                "street",
                "park",
                "greenArea",
                "place",
                "zone",
                "greenSpace",
                "municipalRefuge",
              ],
              `${location}.refuges.map.search.suggestionLabels`,
            ),
          },
          cards: {
            id: requireString(cards.id, `${location}.refuges.map.cards.id`),
            tapForDetails: requireString(
              cards.tapForDetails,
              `${location}.refuges.map.cards.tapForDetails`,
            ),
            green: {
              id: requireString(green.id, `${location}.refuges.map.cards.green.id`),
              fallbackName: requireString(
                green.fallbackName,
                `${location}.refuges.map.cards.green.fallbackName`,
              ),
              districtPrefix: requireString(
                green.districtPrefix,
                `${location}.refuges.map.cards.green.districtPrefix`,
              ),
              areaTemplate: requireNumberTemplate(
                green.areaTemplate,
                `${location}.refuges.map.cards.green.areaTemplate`,
              ),
              typeLabels: validateStringMap(
                green.typeLabels,
                [
                  "urbanPark",
                  "park",
                  "neighborhoodGarden",
                  "schoolGreen",
                  "sportsGreen",
                  "greenSpace",
                ],
                `${location}.refuges.map.cards.green.typeLabels`,
              ),
              amenities: validateStringMap(
                green.amenities,
                ["fountain", "benches", "picnicTables"],
                `${location}.refuges.map.cards.green.amenities`,
              ),
              standout: requireString(
                green.standout,
                `${location}.refuges.map.cards.green.standout`,
              ),
              streetViewCta: requireString(
                green.streetViewCta,
                `${location}.refuges.map.cards.green.streetViewCta`,
              ),
            },
            official: {
              id: requireString(
                official.id,
                `${location}.refuges.map.cards.official.id`,
              ),
              popupType: requireString(
                official.popupType,
                `${location}.refuges.map.cards.official.popupType`,
              ),
              badge: requireString(
                official.badge,
                `${location}.refuges.map.cards.official.badge`,
              ),
              indoor: requireString(
                official.indoor,
                `${location}.refuges.map.cards.official.indoor`,
              ),
              outdoor: requireString(
                official.outdoor,
                `${location}.refuges.map.cards.official.outdoor`,
              ),
              districtPrefix: requireString(
                official.districtPrefix,
                `${location}.refuges.map.cards.official.districtPrefix`,
              ),
              typeLabels: validateStringMap(
                official.typeLabels,
                [
                  "library",
                  "publicLibrary",
                  "communityCenter",
                  "communityCenterAndPark",
                  "internalCourtyard",
                  "publicGarden",
                  "multifunctionalVenue",
                  "museum",
                  "publicPark",
                  "coveredSquare",
                ],
                `${location}.refuges.map.cards.official.typeLabels`,
              ),
              waterLabel: requireString(
                official.waterLabel,
                `${location}.refuges.map.cards.official.waterLabel`,
              ),
              toiletsLabel: requireString(
                official.toiletsLabel,
                `${location}.refuges.map.cards.official.toiletsLabel`,
              ),
              toiletsFree: requireString(
                official.toiletsFree,
                `${location}.refuges.map.cards.official.toiletsFree`,
              ),
              toiletsNotFree: requireString(
                official.toiletsNotFree,
                `${location}.refuges.map.cards.official.toiletsNotFree`,
              ),
              toiletsUnknown: requireString(
                official.toiletsUnknown,
                `${location}.refuges.map.cards.official.toiletsUnknown`,
              ),
              openingHours: requireString(
                official.openingHours,
                `${location}.refuges.map.cards.official.openingHours`,
              ),
            },
            nearby: {
              id: requireString(nearby.id, `${location}.refuges.map.cards.nearby.id`),
              nearestOfficial: requireString(
                nearby.nearestOfficial,
                `${location}.refuges.map.cards.nearby.nearestOfficial`,
              ),
              greenNearby: requireString(
                nearby.greenNearby,
                `${location}.refuges.map.cards.nearby.greenNearby`,
              ),
              searchedPointFallback: requireString(
                nearby.searchedPointFallback,
                `${location}.refuges.map.cards.nearby.searchedPointFallback`,
              ),
              noneReachable: requireString(
                nearby.noneReachable,
                `${location}.refuges.map.cards.nearby.noneReachable`,
              ),
              routeSource: requireString(
                nearby.routeSource,
                `${location}.refuges.map.cards.nearby.routeSource`,
              ),
              alreadyThere: requireString(
                nearby.alreadyThere,
                `${location}.refuges.map.cards.nearby.alreadyThere`,
              ),
              kilometersTemplate: requireNumberTemplate(
                nearby.kilometersTemplate,
                `${location}.refuges.map.cards.nearby.kilometersTemplate`,
              ),
              metersTemplate: requireNumberTemplate(
                nearby.metersTemplate,
                `${location}.refuges.map.cards.nearby.metersTemplate`,
              ),
              walkMinutesTemplate: requireNumberTemplate(
                nearby.walkMinutesTemplate,
                `${location}.refuges.map.cards.nearby.walkMinutesTemplate`,
              ),
            },
          },
        },
      },
      cityPlan: {
        id: requireString(cityPlan.id, `${location}.cityPlan.id`),
        bridge: {
          id: requireString(bridge.id, `${location}.cityPlan.bridge.id`),
          lead: requireString(bridge.lead, `${location}.cityPlan.bridge.lead`),
        },
        scene: {
          id: requireString(scene.id, `${location}.cityPlan.scene.id`),
          ariaLabel: requireString(scene.ariaLabel, `${location}.cityPlan.scene.ariaLabel`),
          figureAriaLabel: requireString(
            scene.figureAriaLabel,
            `${location}.cityPlan.scene.figureAriaLabel`,
          ),
          svgDescription: requireString(
            scene.svgDescription,
            `${location}.cityPlan.scene.svgDescription`,
          ),
          context: {
            id: requireString(context.id, `${location}.cityPlan.scene.context.id`),
            title: requireString(
              context.title,
              `${location}.cityPlan.scene.context.title`,
            ),
            note: requireString(context.note, `${location}.cityPlan.scene.context.note`),
          },
        },
        beats: planBeats,
        annotations,
        legend: {
          id: requireString(legend.id, `${location}.cityPlan.legend.id`),
          label: requireString(legend.label, `${location}.cityPlan.legend.label`),
          items: legendItems,
        },
        vignetteDescriptions: validateTextItems(
          cityPlan.vignetteDescriptions,
          ["costruire", "corridoio", "portico"],
          `${location}.cityPlan.vignetteDescriptions`,
        ),
      },
    },
  };
}

function validateTalea(document, location) {
  const project = requireObject(document.project, `${location}.project`);
  const chapter = requireObject(project.chapter, `${location}.project.chapter`);
  const header = requireObject(project.header, `${location}.project.header`);
  const logo = requireObject(header.logo, `${location}.project.header.logo`);
  const meaning = requireObject(project.meaning, `${location}.project.meaning`);
  const facts = requireObject(project.facts, `${location}.project.facts`);
  const bridge = requireObject(project.bridge, `${location}.project.bridge`);
  const zones = requireObject(document.zones, `${location}.zones`);
  const zonesLegend = requireObject(zones.legend, `${location}.zones.legend`);
  const zonesIntro = requireObject(zones.intro, `${location}.zones.intro`);
  const participation = requireObject(document.participation, `${location}.participation`);
  const partners = requireObject(document.partners, `${location}.partners`);
  const partnerFunding = requireObject(
    partners.funding,
    `${location}.partners.funding`,
  );
  const closing = requireObject(document.closing, `${location}.closing`);
  const closingFinal = requireObject(closing.final, `${location}.closing.final`);
  const sources = requireObject(closing.sources, `${location}.closing.sources`);
  const footer = requireObject(document.footer, `${location}.footer`);
  const footerBrand = requireObject(footer.brand, `${location}.footer.brand`);
  const footerNavigation = requireObject(
    footer.navigation,
    `${location}.footer.navigation`,
  );
  const footerFunding = requireObject(footer.funding, `${location}.footer.funding`);

  const requireExactString = (value, expected, fieldLocation) => {
    const result = requireString(value, fieldLocation);
    if (result !== expected) throw new Error(`${fieldLocation} must be ${expected}`);
    return result;
  };
  const validateEmphasizedSegments = (
    value,
    expectedIds,
    emphasizedIds,
    fieldLocation,
  ) => {
    requireOrderedIds(value, expectedIds, fieldLocation);
    const segments = validateSegments(value, fieldLocation);
    const emphasized = new Set(emphasizedIds);
    for (const segment of segments) {
      if (Boolean(segment.emphasis) !== emphasized.has(segment.id)) {
        throw new Error(`${fieldLocation}.${segment.id}.emphasis has invalid structure`);
      }
    }
    return segments;
  };

  const chapterId = requireExactString(
    chapter.id,
    "talea-project",
    `${location}.project.chapter.id`,
  );
  requireOrderedIds(
    meaning.lead,
    ["talea-name", "talea-purpose"],
    `${location}.project.meaning.lead`,
  );
  const lead = validateSegments(meaning.lead, `${location}.project.meaning.lead`);
  if (lead[0].glossary !== "talea-project" || lead[1].glossary !== undefined) {
    throw new Error(`${location}.project.meaning.lead has invalid glossary structure`);
  }

  const factItems = requireOrderedIds(
    facts.items,
    ["chi", "quando", "fondi"],
    `${location}.project.facts.items`,
  ).map((rawFact, index) => {
    const factLocation = `${location}.project.facts.items[${index}]`;
    const fact = requireObject(rawFact, factLocation);
    const base = {
      id: requireString(fact.id, `${factLocation}.id`),
      label: requireString(fact.label, `${factLocation}.label`),
      value: requireString(fact.value, `${factLocation}.value`),
    };
    return index === 0
      ? {
          ...base,
          noteTemplate: requireNumberTemplate(
            fact.noteTemplate,
            `${factLocation}.noteTemplate`,
          ),
        }
      : { ...base, note: requireString(fact.note, `${factLocation}.note`) };
  });

  const logoLinkId = requireExactString(
    logo.linkId,
    "talea-platform",
    `${location}.project.header.logo.linkId`,
  );

  const zoneIntroBody = validateEmphasizedSegments(
    zonesIntro.body,
    [
      "zones-intro-before-fossolo",
      "zones-intro-fossolo",
      "zones-intro-between",
      "zones-intro-historic-centre",
      "zones-intro-end",
    ],
    ["zones-intro-fossolo", "zones-intro-historic-centre"],
    `${location}.zones.intro.body`,
  );
  const zoneBodyIds = [
    ["fossolo-before-place", "fossolo-place", "fossolo-after-place"],
    [
      "historic-centre-before-boldrini",
      "historic-centre-boldrini",
      "historic-centre-between-streets",
      "historic-centre-rosselli",
      "historic-centre-after-streets",
    ],
  ];
  const zoneEmphasisIds = [
    ["fossolo-place"],
    ["historic-centre-boldrini", "historic-centre-rosselli"],
  ];
  const zoneItems = requireArray(zones.areas, `${location}.zones.areas`).map(
    (rawZone, index) => {
      const zoneLocation = `${location}.zones.areas[${index}]`;
      const zone = requireObject(rawZone, zoneLocation);
      if (zone.zoneId !== index || !Number.isInteger(zone.zoneId)) {
        throw new Error(`${zoneLocation}.zoneId must be ${index}`);
      }
      return {
        zoneId: zone.zoneId,
        name: requireString(zone.name, `${zoneLocation}.name`),
        body: validateEmphasizedSegments(
          zone.body,
          zoneBodyIds[index] ?? [],
          zoneEmphasisIds[index] ?? [],
          `${zoneLocation}.body`,
        ),
      };
    },
  );
  if (zoneItems.length !== 2) {
    throw new Error(`${location}.zones.areas must contain two areas`);
  }

  const partnerIds = [
    "comune-bologna",
    "universita-bologna",
    "fondazione-iu",
    "fondazione-bruno-kessler",
    "cineca",
    "r2m-solutions",
    "r3gis",
    "cluj-napoca",
    "marseille",
    "riga",
  ];
  const partnerItems = requireArray(partners.items, `${location}.partners.items`).map(
    (rawPartner, index) => {
      const partnerLocation = `${location}.partners.items[${index}]`;
      const partner = requireObject(rawPartner, partnerLocation);
      const partnerId = requireExactString(
        partner.partnerId,
        partnerIds[index],
        `${partnerLocation}.partnerId`,
      );
      return {
        partnerId,
        name: requireString(partner.name, `${partnerLocation}.name`),
        role: requireString(partner.role, `${partnerLocation}.role`),
      };
    },
  );
  if (partnerItems.length !== partnerIds.length) {
    throw new Error(`${location}.partners.items must contain ${partnerIds.length} partners`);
  }

  const sourceIds = ["portale", "historysuhi", "sci", "craf"];
  const sourceLinkIds = [
    "talea-platform",
    "history-suhi",
    "shadow-focus-data",
    "craf-map",
  ];
  const sourceApps = requireOrderedIds(
    sources.apps,
    sourceIds,
    `${location}.closing.sources.apps`,
  ).map((rawApp, index) => {
    const appLocation = `${location}.closing.sources.apps[${index}]`;
    const app = requireObject(rawApp, appLocation);
    return {
      id: requireString(app.id, `${appLocation}.id`),
      name: requireString(app.name, `${appLocation}.name`),
      tag: requireString(app.tag, `${appLocation}.tag`),
      description: requireString(app.description, `${appLocation}.description`),
      linkId: requireExactString(
        app.linkId,
        sourceLinkIds[index],
        `${appLocation}.linkId`,
      ),
    };
  });

  const footerLinkIds = [
    "talea-footer-platform",
    "talea-footer-project",
    "talea-footer-atlas",
  ];
  const footerTargetIds = ["talea-platform", "talea-about", "talea-atlas"];
  const footerLinks = requireOrderedIds(
    footerNavigation.links,
    footerLinkIds,
    `${location}.footer.navigation.links`,
  ).map((rawLink, index) => {
    const linkLocation = `${location}.footer.navigation.links[${index}]`;
    const link = requireObject(rawLink, linkLocation);
    return {
      id: requireString(link.id, `${linkLocation}.id`),
      label: requireString(link.label, `${linkLocation}.label`),
      linkId: requireExactString(
        link.linkId,
        footerTargetIds[index],
        `${linkLocation}.linkId`,
      ),
    };
  });

  return {
    talea: {
      project: {
        chapter: { id: chapterId },
        header: {
          id: requireString(header.id, `${location}.project.header.id`),
          title: requireString(header.title, `${location}.project.header.title`),
          lockup: requireString(header.lockup, `${location}.project.header.lockup`),
          logo: {
            id: requireString(logo.id, `${location}.project.header.logo.id`),
            alt: requireString(logo.alt, `${location}.project.header.logo.alt`),
            linkId: logoLinkId,
          },
        },
        meaning: {
          id: requireString(meaning.id, `${location}.project.meaning.id`),
          lead,
          body: requireString(meaning.body, `${location}.project.meaning.body`),
        },
        facts: {
          id: requireString(facts.id, `${location}.project.facts.id`),
          label: requireString(facts.label, `${location}.project.facts.label`),
          items: factItems,
        },
        bridge: {
          id: requireString(bridge.id, `${location}.project.bridge.id`),
          text: requireString(bridge.text, `${location}.project.bridge.text`),
        },
      },
      zones: {
        id: requireString(zones.id, `${location}.zones.id`),
        ariaLabel: requireString(zones.ariaLabel, `${location}.zones.ariaLabel`),
        legend: {
          id: requireString(zonesLegend.id, `${location}.zones.legend.id`),
          area: requireString(zonesLegend.area, `${location}.zones.legend.area`),
        },
        intro: {
          id: requireString(zonesIntro.id, `${location}.zones.intro.id`),
          title: requireString(zonesIntro.title, `${location}.zones.intro.title`),
          body: zoneIntroBody,
        },
        areas: zoneItems,
        loadError: requireString(zones.loadError, `${location}.zones.loadError`),
      },
      participation: {
        id: requireString(participation.id, `${location}.participation.id`),
        title: requireString(participation.title, `${location}.participation.title`),
        body: requireString(participation.body, `${location}.participation.body`),
      },
      partners: {
        id: requireString(partners.id, `${location}.partners.id`),
        title: requireString(partners.title, `${location}.partners.title`),
        ariaLabel: requireString(partners.ariaLabel, `${location}.partners.ariaLabel`),
        items: partnerItems,
        funding: {
          id: requireString(partnerFunding.id, `${location}.partners.funding.id`),
          text: requireString(partnerFunding.text, `${location}.partners.funding.text`),
          emblemLabel: requireString(
            partnerFunding.emblemLabel,
            `${location}.partners.funding.emblemLabel`,
          ),
          linkId: requireExactString(
            partnerFunding.linkId,
            "european-urban-initiative",
            `${location}.partners.funding.linkId`,
          ),
        },
      },
      closing: {
        id: requireString(closing.id, `${location}.closing.id`),
        final: {
          id: requireString(closingFinal.id, `${location}.closing.final.id`),
          standout: requireString(
            closingFinal.standout,
            `${location}.closing.final.standout`,
          ),
        },
        sources: {
          id: requireString(sources.id, `${location}.closing.sources.id`),
          title: requireString(sources.title, `${location}.closing.sources.title`),
          intro: requireString(sources.intro, `${location}.closing.sources.intro`),
          openLabel: requireString(
            sources.openLabel,
            `${location}.closing.sources.openLabel`,
          ),
          apps: sourceApps,
        },
      },
      footer: {
        id: requireString(footer.id, `${location}.footer.id`),
        brand: {
          id: requireString(footerBrand.id, `${location}.footer.brand.id`),
          label: requireString(footerBrand.label, `${location}.footer.brand.label`),
          alt: requireString(footerBrand.alt, `${location}.footer.brand.alt`),
          linkId: requireExactString(
            footerBrand.linkId,
            "talea-platform",
            `${location}.footer.brand.linkId`,
          ),
        },
        navigation: {
          id: requireString(footerNavigation.id, `${location}.footer.navigation.id`),
          ariaLabel: requireString(
            footerNavigation.ariaLabel,
            `${location}.footer.navigation.ariaLabel`,
          ),
          links: footerLinks,
        },
        funding: {
          id: requireString(footerFunding.id, `${location}.footer.funding.id`),
          emblemAlt: requireString(
            footerFunding.emblemAlt,
            `${location}.footer.funding.emblemAlt`,
          ),
          text: requireString(footerFunding.text, `${location}.footer.funding.text`),
          disclaimer: requireString(
            footerFunding.disclaimer,
            `${location}.footer.funding.disclaimer`,
          ),
          euiLabel: requireString(
            footerFunding.euiLabel,
            `${location}.footer.funding.euiLabel`,
          ),
          linkId: requireExactString(
            footerFunding.linkId,
            "european-urban-initiative",
            `${location}.footer.funding.linkId`,
          ),
        },
      },
    },
  };
}

const methodSectionIds = [
  "periodo",
  "aria-superficie",
  "hotspot",
  "ombra",
  "fragilita",
  "rifugi",
  "aree",
  "limiti",
];
const methodHighlightIds = [
  "observed-summers",
  "hottest-surfaces-threshold",
  "municipal-refuges",
];
const methodSourceIds = ["portale", "historysuhi", "sci", "craf"];
const glossaryTermIds = [
  "surface-temperature",
  "climate-hotspot",
  "climate-refuge",
  "talea-project",
  "green-cell",
];
const progressChapterIds = [
  "hero",
  "trend",
  "hotspot",
  "cause",
  "ombra",
  "persone",
  "sollievo",
  "rifugi",
  "costruire",
  "talea",
  "aree",
  "chiusura",
];

function requireStableString(value, expected, location) {
  const actual = requireString(value, location);
  if (actual !== expected) throw new Error(`${location} must be ${expected}`);
  return actual;
}

function requireBoolean(value, location) {
  if (typeof value !== "boolean") throw new Error(`${location} must be boolean`);
  return value;
}

function requireExactStringList(value, expected, location) {
  const actual = requireArray(value, location).map((item, index) =>
    requireString(item, `${location}[${index}]`),
  );
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${location} must be: ${expected.join(", ")}`);
  }
  return actual;
}

function requireTemplate(value, placeholder, location) {
  const template = requireString(value, location);
  if (!template.includes(placeholder)) {
    throw new Error(`${location} must contain ${placeholder}`);
  }
  return template;
}

function parseMethodMarkdown(body, sectionIds, location) {
  const tokens = marked.lexer(requireString(body, `${location}.body`)).filter(
    (token) => token.type !== "space",
  );
  let cursor = 0;

  const heading = (depth, fieldLocation) => {
    const token = tokens[cursor];
    if (!token || token.type !== "heading" || token.depth !== depth) {
      throw new Error(`${fieldLocation} must be a level-${depth} Markdown heading`);
    }
    cursor += 1;
    return requireString(token.text, fieldLocation);
  };

  const paragraph = (fieldLocation) => {
    const token = tokens[cursor];
    if (!token || token.type !== "paragraph") {
      throw new Error(`${fieldLocation} must be a Markdown paragraph`);
    }
    cursor += 1;
    return requireString(token.text, fieldLocation);
  };

  const title = heading(1, `${location}.title`);
  const intro = paragraph(`${location}.intro`);
  const sections = sectionIds.map((id, index) => ({
    id,
    heading: heading(2, `${location}.sections[${index}].heading`),
    body: paragraph(`${location}.sections[${index}].body`),
  }));

  if (cursor !== tokens.length) {
    throw new Error(`${location}.body contains unsupported Markdown structure`);
  }
  return { title, intro, sections };
}

function validateMethod(document, location) {
  requireStableString(document.id, "method", `${location}.id`);
  const sectionIds = requireExactStringList(
    document.sectionIds,
    methodSectionIds,
    `${location}.sectionIds`,
  );
  const progressive = requireObject(document.progressive, `${location}.progressive`);
  const sources = requireObject(document.sources, `${location}.sources`);
  const markdown = parseMethodMarkdown(document.body, sectionIds, location);

  const highlights = requireOrderedIds(
    document.highlights,
    methodHighlightIds,
    `${location}.highlights`,
  ).map((rawHighlight, index) => {
    const highlightLocation = `${location}.highlights[${index}]`;
    const highlight = requireObject(rawHighlight, highlightLocation);
    const validated = {
      id: requireString(highlight.id, `${highlightLocation}.id`),
      label: requireString(highlight.label, `${highlightLocation}.label`),
    };
    if (highlight.id === "municipal-refuges") {
      validated.dataValue = requireStableString(
        highlight.dataValue,
        "officialRefuges.total",
        `${highlightLocation}.dataValue`,
      );
    } else {
      validated.value = requireString(
        highlight.value,
        `${highlightLocation}.value`,
      );
    }
    return validated;
  });

  return {
    method: {
      id: "method",
      eyebrow: requireString(document.eyebrow, `${location}.eyebrow`),
      title: markdown.title,
      intro: markdown.intro,
      progressive: {
        note: requireString(progressive.note, `${location}.progressive.note`),
        showAll: requireString(progressive.showAll, `${location}.progressive.showAll`),
        showRead: requireString(progressive.showRead, `${location}.progressive.showRead`),
      },
      highlights,
      sections: markdown.sections,
      sources: {
        label: requireString(sources.label, `${location}.sources.label`),
        sourceIds: requireExactStringList(
          sources.sourceIds,
          methodSourceIds,
          `${location}.sources.sourceIds`,
        ),
      },
    },
  };
}

function validateGlossary(document, location) {
  const terms = requireOrderedIds(
    document.terms,
    glossaryTermIds,
    `${location}.terms`,
  ).map((rawTerm, index) => {
    const termLocation = `${location}.terms[${index}]`;
    const term = requireObject(rawTerm, termLocation);
    const shouldBeInTrail = term.id !== "green-cell";
    const trail = requireBoolean(term.trail, `${termLocation}.trail`);
    if (trail !== shouldBeInTrail) {
      throw new Error(`${termLocation}.trail has invalid structure`);
    }
    return {
      id: requireString(term.id, `${termLocation}.id`),
      term: requireString(term.term, `${termLocation}.term`),
      trail,
      definition: requireArray(term.definition, `${termLocation}.definition`).map(
        (paragraph, paragraphIndex) =>
          requireString(paragraph, `${termLocation}.definition[${paragraphIndex}]`),
      ),
    };
  });
  return { glossary: { terms } };
}

function validateUi(document, location) {
  const header = requireObject(document.header, `${location}.header`);
  const menu = requireObject(header.menu, `${location}.header.menu`);
  const exploreData = requireObject(
    header.exploreData,
    `${location}.header.exploreData`,
  );
  const progress = requireObject(document.progress, `${location}.progress`);
  const glossary = requireObject(document.glossary, `${location}.glossary`);
  const map = requireObject(document.map, `${location}.map`);
  const localStory = requireObject(document.localStory, `${location}.localStory`);
  const mobileExperience = requireObject(
    document.mobileExperience,
    `${location}.mobileExperience`,
  );
  const cooperativeGestures = requireObject(
    map.cooperativeGestures,
    `${location}.map.cooperativeGestures`,
  );
  const actions = requireObject(document.actions, `${location}.actions`);

  const chapters = requireOrderedIds(
    progress.chapters,
    progressChapterIds,
    `${location}.progress.chapters`,
  ).map((rawChapter, index) => {
    const chapterLocation = `${location}.progress.chapters[${index}]`;
    const chapter = requireObject(rawChapter, chapterLocation);
    return {
      id: requireString(chapter.id, `${chapterLocation}.id`),
      label: requireString(chapter.label, `${chapterLocation}.label`),
    };
  });

  return {
    ui: {
      header: {
        id: requireStableString(header.id, "global-header", `${location}.header.id`),
        menu: {
          id: requireStableString(menu.id, "global-menu", `${location}.header.menu.id`),
          open: requireString(menu.open, `${location}.header.menu.open`),
          close: requireString(menu.close, `${location}.header.menu.close`),
        },
        exploreData: {
          id: requireStableString(
            exploreData.id,
            "explore-data",
            `${location}.header.exploreData.id`,
          ),
          label: requireString(
            exploreData.label,
            `${location}.header.exploreData.label`,
          ),
        },
      },
      progress: {
        id: requireStableString(
          progress.id,
          "reading-progress",
          `${location}.progress.id`,
        ),
        ariaLabel: requireString(progress.ariaLabel, `${location}.progress.ariaLabel`),
        hint: requireString(progress.hint, `${location}.progress.hint`),
        chapters,
      },
      glossary: {
        id: requireStableString(
          glossary.id,
          "global-glossary",
          `${location}.glossary.id`,
        ),
        eyebrow: requireString(glossary.eyebrow, `${location}.glossary.eyebrow`),
        definitionLabelTemplate: requireTemplate(
          glossary.definitionLabelTemplate,
          "{term}",
          `${location}.glossary.definitionLabelTemplate`,
        ),
        dialogLabelTemplate: requireTemplate(
          glossary.dialogLabelTemplate,
          "{term}",
          `${location}.glossary.dialogLabelTemplate`,
        ),
        closeLabel: requireString(
          glossary.closeLabel,
          `${location}.glossary.closeLabel`,
        ),
        trailAriaLabel: requireString(
          glossary.trailAriaLabel,
          `${location}.glossary.trailAriaLabel`,
        ),
        trailLabel: requireString(
          glossary.trailLabel,
          `${location}.glossary.trailLabel`,
        ),
      },
      map: {
        id: requireStableString(map.id, "global-map-ui", `${location}.map.id`),
        title: requireString(map.title, `${location}.map.title`),
        legend: requireString(map.legend, `${location}.map.legend`),
        hotspotSequenceDone: requireString(
          map.hotspotSequenceDone,
          `${location}.map.hotspotSequenceDone`,
        ),
        toggleAttribution: requireString(
          map.toggleAttribution,
          `${location}.map.toggleAttribution`,
        ),
        cooperativeGestures: {
          windows: requireString(
            cooperativeGestures.windows,
            `${location}.map.cooperativeGestures.windows`,
          ),
          mac: requireString(
            cooperativeGestures.mac,
            `${location}.map.cooperativeGestures.mac`,
          ),
          mobile: requireString(
            cooperativeGestures.mobile,
            `${location}.map.cooperativeGestures.mobile`,
          ),
        },
      },
      localStory: {
        scrollPage: requireString(
          localStory.scrollPage,
          `${location}.localStory.scrollPage`,
        ),
        hotspotToComparison: requireString(
          localStory.hotspotToComparison,
          `${location}.localStory.hotspotToComparison`,
        ),
        hotspotToExit: requireString(
          localStory.hotspotToExit,
          `${location}.localStory.hotspotToExit`,
        ),
        scrollPlan: requireString(
          localStory.scrollPlan,
          `${location}.localStory.scrollPlan`,
        ),
        keepScrollingPage: requireString(
          localStory.keepScrollingPage,
          `${location}.localStory.keepScrollingPage`,
        ),
        mapTwoFingers: requireString(
          localStory.mapTwoFingers,
          `${location}.localStory.mapTwoFingers`,
        ),
        exploreRefuges: requireString(
          localStory.exploreRefuges,
          `${location}.localStory.exploreRefuges`,
        ),
        continuePage: requireString(
          localStory.continuePage,
          `${location}.localStory.continuePage`,
        ),
        modelGesture: requireString(
          localStory.modelGesture,
          `${location}.localStory.modelGesture`,
        ),
        stepLabelTemplate: requireTemplate(
          requireTemplate(
            localStory.stepLabelTemplate,
            "{current}",
            `${location}.localStory.stepLabelTemplate`,
          ),
          "{total}",
          `${location}.localStory.stepLabelTemplate`,
        ),
      },
      mobileExperience: {
        title: requireString(
          mobileExperience.title,
          `${location}.mobileExperience.title`,
        ),
        body: requireString(
          mobileExperience.body,
          `${location}.mobileExperience.body`,
        ),
        continue: requireString(
          mobileExperience.continue,
          `${location}.mobileExperience.continue`,
        ),
        closeLabel: requireString(
          mobileExperience.closeLabel,
          `${location}.mobileExperience.closeLabel`,
        ),
      },
      actions: {
        id: requireStableString(
          actions.id,
          "global-actions",
          `${location}.actions.id`,
        ),
        close: requireString(actions.close, `${location}.actions.close`),
        previousItem: requireString(
          actions.previousItem,
          `${location}.actions.previousItem`,
        ),
        nextItem: requireString(actions.nextItem, `${location}.actions.nextItem`),
      },
    },
  };
}

const contentValidators = new Map([
  ["00-hero.yml", validateHero],
  ["01-summer-trend.yml", validateSummerTrend],
  ["02-hotspot.yml", validateHotspot],
  ["03-physical-drivers.yml", validatePhysicalDrivers],
  ["04-shadow-focus.yml", validateShadowFocus],
  ["05-vulnerability.yml", validateVulnerability],
  ["06-climate-relief.yml", validateClimateRelief],
  ["07-talea.yml", validateTalea],
  ["glossary.yml", validateGlossary],
  ["method.md", validateMethod],
  ["ui.yml", validateUi],
]);

async function readYaml(relativePath) {
  const filePath = path.join(root, relativePath);
  const source = await readFile(filePath, "utf8");
  try {
    return parse(source);
  } catch (error) {
    throw new Error(`Cannot parse ${relativePath}: ${error.message}`, { cause: error });
  }
}

async function readEditorialDocument(relativePath) {
  if (!/\.md$/i.test(relativePath)) return readYaml(relativePath);
  const filePath = path.join(root, relativePath);
  const source = await readFile(filePath, "utf8");
  try {
    const parsed = matter(source);
    return { ...parsed.data, body: parsed.content };
  } catch (error) {
    throw new Error(`Cannot parse ${relativePath}: ${error.message}`, { cause: error });
  }
}

async function listEditorialFiles(locale) {
  const entries = await readdir(path.join(root, "content", locale), {
    withFileTypes: true,
  });
  return entries
    .filter((entry) => entry.isFile() && /\.(?:ya?ml|md)$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

function compareFileLists(referenceFiles, candidateFiles, locale) {
  if (JSON.stringify(referenceFiles) !== JSON.stringify(candidateFiles)) {
    throw new Error(
      `Editorial files for ${locale} must match ${defaultLocale}: ` +
        `${candidateFiles.join(", ")} !== ${referenceFiles.join(", ")}`,
    );
  }
}

function compareStructure(reference, candidate, location, key = "") {
  if (Array.isArray(reference)) {
    if (!Array.isArray(candidate) || reference.length !== candidate.length) {
      throw new Error(`${location} must have the same array length and order`);
    }
    reference.forEach((value, index) => {
      compareStructure(value, candidate[index], `${location}[${index}]`);
    });
    return;
  }

  if (reference && typeof reference === "object") {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new Error(`${location} must be the same block type`);
    }
    const referenceKeys = Object.keys(reference).sort();
    const candidateKeys = Object.keys(candidate).sort();
    if (JSON.stringify(referenceKeys) !== JSON.stringify(candidateKeys)) {
      throw new Error(`${location} must contain the same fields`);
    }
    for (const childKey of referenceKeys) {
      compareStructure(
        reference[childKey],
        candidate[childKey],
        `${location}.${childKey}`,
        childKey,
      );
    }
    return;
  }

  if (typeof reference !== typeof candidate) {
    throw new Error(`${location} must have the same value type`);
  }
  if (
    [
      "id",
      "glossary",
      "topic",
      "flightTarget",
      "emphasisGroup",
      "metricId",
      "linkId",
      "partnerId",
      "zoneId",
    ].includes(key) &&
    reference !== candidate
  ) {
    throw new Error(`${location} must keep the same structural value`);
  }
  if ((typeof reference === "number" || typeof reference === "boolean") && reference !== candidate) {
    throw new Error(`${location} must keep the same structural value`);
  }
}

function requireHttpUrl(value, location) {
  const url = requireString(value, location);
  const parsedUrl = new URL(url);
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error(`${location} must use http or https`);
  }
  return url;
}

function validateSite(raw) {
  const site = requireObject(raw, "site");
  if (site.schemaVersion !== 1) throw new Error("site.schemaVersion must be 1");

  return {
    schemaVersion: 1,
    platformUrl: requireHttpUrl(site.platformUrl, "site.platformUrl"),
  };
}

function validateLinks(raw) {
  const links = requireObject(raw, "links");
  if (links.schemaVersion !== 1) throw new Error("links.schemaVersion must be 1");

  const hotspot = requireObject(links.hotspot, "links.hotspot");
  const shadowFocus = requireObject(links.shadowFocus, "links.shadowFocus");
  const vulnerability = requireObject(links.vulnerability, "links.vulnerability");
  const climateRelief = requireObject(links.climateRelief, "links.climateRelief");
  const talea = requireObject(links.talea, "links.talea");

  return {
    schemaVersion: 1,
    hotspot: {
      data: requireHttpUrl(hotspot.data, "links.hotspot.data"),
    },
    shadowFocus: {
      data: requireHttpUrl(shadowFocus.data, "links.shadowFocus.data"),
    },
    vulnerability: {
      study: requireHttpUrl(vulnerability.study, "links.vulnerability.study"),
    },
    climateRelief: {
      crafMap: requireHttpUrl(climateRelief.crafMap, "links.climateRelief.crafMap"),
      municipalRefugesMap: requireHttpUrl(
        climateRelief.municipalRefugesMap,
        "links.climateRelief.municipalRefugesMap",
      ),
      shadowLinesProject: requireHttpUrl(
        climateRelief.shadowLinesProject,
        "links.climateRelief.shadowLinesProject",
      ),
    },
    talea: {
      historySuhi: requireHttpUrl(talea.historySuhi, "links.talea.historySuhi"),
      europeanUrbanInitiative: requireHttpUrl(
        talea.europeanUrbanInitiative,
        "links.talea.europeanUrbanInitiative",
      ),
    },
  };
}

const fileLists = new Map(
  await Promise.all(
    supportedLocales.map(async (locale) => [locale, await listEditorialFiles(locale)]),
  ),
);
const referenceFiles = fileLists.get(defaultLocale);

for (const locale of supportedLocales) {
  compareFileLists(referenceFiles, fileLists.get(locale), locale);
}
for (const fileName of referenceFiles) {
  if (!contentValidators.has(fileName)) {
    throw new Error(`No content validator registered for ${fileName}`);
  }
}
for (const fileName of contentValidators.keys()) {
  if (!referenceFiles.includes(fileName)) {
    throw new Error(`Missing required editorial file: ${fileName}`);
  }
}

const documents = new Map();
const locales = {};

for (const locale of supportedLocales) {
  const localeDocuments = new Map();
  const localeContent = {};

  for (const fileName of referenceFiles) {
    const document = validateDocument(
      await readEditorialDocument(path.join("content", locale, fileName)),
      locale,
      fileName,
    );
    localeDocuments.set(fileName, document);

    const validate = contentValidators.get(fileName);
    const compiled = validate(document, `${locale}/${fileName}`);
    for (const [key, value] of Object.entries(compiled)) {
      if (Object.hasOwn(localeContent, key)) {
        throw new Error(`Duplicate compiled content key for ${locale}: ${key}`);
      }
      localeContent[key] = value;
    }
  }

  documents.set(locale, localeDocuments);
  locales[locale] = localeContent;
}

function collectGlossaryReferences(value, references = new Set()) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectGlossaryReferences(item, references));
    return references;
  }
  if (!value || typeof value !== "object") return references;
  for (const [key, child] of Object.entries(value)) {
    if (key === "glossary" && typeof child === "string") references.add(child);
    else collectGlossaryReferences(child, references);
  }
  return references;
}

for (const locale of supportedLocales) {
  const localeContent = locales[locale];
  const glossaryIds = new Set(localeContent.glossary.terms.map((term) => term.id));
  for (const glossaryId of collectGlossaryReferences(localeContent)) {
    if (!glossaryIds.has(glossaryId)) {
      throw new Error(`${locale} references unknown glossary term: ${glossaryId}`);
    }
  }

  const closingSourceIds = new Set(
    localeContent.talea.closing.sources.apps.map((source) => source.id),
  );
  for (const sourceId of localeContent.method.sources.sourceIds) {
    if (!closingSourceIds.has(sourceId)) {
      throw new Error(`${locale}/method.md references unknown source: ${sourceId}`);
    }
  }
}

for (const locale of supportedLocales) {
  if (locale === defaultLocale) continue;
  for (const fileName of referenceFiles) {
    compareStructure(
      documents.get(defaultLocale).get(fileName),
      documents.get(locale).get(fileName),
      `${locale}/${fileName}`,
    );
  }
}

const site = validateSite(await readYaml(path.join("config", "site.yml")));
const links = validateLinks(await readYaml(path.join("config", "links.yml")));
const output = {
  schemaVersion: 1,
  defaultLocale,
  supportedLocales,
  locales,
  site,
  links,
};

const outputPath = path.join(root, "src", "generated", "content.json");
await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(
  `Content built for ${supportedLocales.join(", ")}: ${path.relative(root, outputPath)}`,
);
console.log("Structural parity validated: 8 story files + method, glossary, ui per locale");
