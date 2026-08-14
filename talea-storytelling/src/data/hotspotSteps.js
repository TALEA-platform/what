export const hotspotStepSpecs = [
  { id: "threshold", minYears: 3, opacity: 0.82 },
  { id: "recurrence", minYears: 5, opacity: 0.9 },
  { id: "persistence", minYears: 9, opacity: 0.98 },
];

const WORDS_OF = (step) =>
  step.paragraphs
    .map((paragraph) => paragraph.segments.map((part) => part.text).join(""))
    .join(" ")
    .trim()
    .split(/\s+/).length;

const READ_MS_BASE = 1500;
const READ_MS_PER_WORD = 100;
const READ_MS_MIN = 3550;
const READ_MS_MAX = 7000;

export function buildHotspotSteps(content) {
  const hotspotStepCopy = new Map(
    content.hotspot.map.steps.map((step) => [step.id, step]),
  );
  const steps = hotspotStepSpecs.map((step) => {
    const copy = hotspotStepCopy.get(step.id);
    if (!copy) throw new Error(`Missing Hotspot step copy: ${step.id}`);
    return { ...step, paragraphs: copy.paragraphs };
  });
  const readMs = steps.map((step) =>
    Math.min(
      READ_MS_MAX,
      Math.max(READ_MS_MIN, READ_MS_BASE + READ_MS_PER_WORD * WORDS_OF(step)),
    ),
  );
  return { steps, readMs };
}

export const BOLOGNA_CENTER = [11.3430, 44.4998];
export const BOLOGNA_ZOOM = 12.35;
export const BOLOGNA_ZOOM_PERSISTENCE = 12.55;
export const BOLOGNA_ZOOM_INTRO = 12.2;

export const NARROW_MAX_WIDTH = 700;
export const NARROW_ZOOM_SHIFT = -0.75;
