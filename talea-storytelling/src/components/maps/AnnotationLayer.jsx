import { useState, useEffect, useMemo } from "react";
import { hotspotAnnotations } from "../../data/hotspotAnnotations";

// Reveal the hover card when the cursor comes within this many pixels of a zone's
// point — generous enough that the reader "finds" the hot area by sweeping the
// mouse over it, without persistent dots to follow.
const HOVER_RADIUS = 72;

/**
 * Map annotations as HTML overlays positioned via MapLibre's project().
 *
 * - `showNarrative`: the four narrative zones animate in as labelled cards
 *   (staggered via CSS transition-delay). When false (the reader has moved the
 *   slider) they fade out.
 * - Hover: from the moment the flags start animating (`active`), moving over a hot
 *   AREA pops that zone's card — NON-permanent (vanishes on mouse-leave), with a
 *   dot + connector line, no persistent markers. Every zone is hoverable; hovering
 *   a narrative zone simply swaps its auto-card for the hover popup (doc 03 §8).
 */
export function AnnotationLayer({ map, active, showNarrative }) {
  const [positions, setPositions] = useState([]);
  const [narrativeIn, setNarrativeIn] = useState(false);
  const [hoverId, setHoverId] = useState(null);

  const narrativeZones = useMemo(
    () =>
      hotspotAnnotations
        .map((zone, idx) => ({ ...zone, idx }))
        .filter((zone) => zone.narrative),
    [],
  );

  // Project every zone's coords to screen space; keep in sync with the camera.
  useEffect(() => {
    if (!map) return;
    const update = () => {
      setPositions(
        hotspotAnnotations.map((a) => ({
          dot: map.project(a.coord),
          anchor: map.project(a.anchor),
        })),
      );
    };
    update();
    map.on("move", update);
    map.on("zoom", update);
    return () => {
      map.off("move", update);
      map.off("zoom", update);
    };
  }, [map]);

  // Narrative cards: render once hidden, then flip in (CSS transition-delay
  // staggers them). Retire (fade out) once the slider is used.
  useEffect(() => {
    if (!(active && showNarrative)) return;
    const timer = setTimeout(() => setNarrativeIn(true), 60);
    return () => {
      clearTimeout(timer);
      setNarrativeIn(false);
    };
  }, [active, showNarrative]);

  // Hover detection over the map areas, live from the moment the flags animate in.
  // The annotation layer is pointer-events:none, so events reach the map canvas.
  useEffect(() => {
    if (!map || !active) return;
    const onMove = (e) => {
      let best = null;
      let bestDist = HOVER_RADIUS;
      hotspotAnnotations.forEach((zone) => {
        const pt = map.project(zone.coord);
        const dist = Math.hypot(pt.x - e.point.x, pt.y - e.point.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = zone.id;
        }
      });
      setHoverId(best);
    };
    const canvas = map.getCanvas();
    const onLeave = () => setHoverId(null);
    map.on("mousemove", onMove);
    canvas.addEventListener("mouseleave", onLeave);
    return () => {
      map.off("mousemove", onMove);
      canvas.removeEventListener("mouseleave", onLeave);
      setHoverId(null);
    };
  }, [map, active]);

  if (!active || positions.length === 0) return null;

  const hoverIdx = hoverId
    ? hotspotAnnotations.findIndex((z) => z.id === hoverId)
    : -1;
  const hoverZone = hoverIdx >= 0 ? hotspotAnnotations[hoverIdx] : null;
  const hoverPos = hoverIdx >= 0 ? positions[hoverIdx] : null;
  const narrativeShown = narrativeIn && showNarrative;

  // Curved connector from dot → anchor (shared by narrative + hover).
  const linePath = ({ dot, anchor }) => {
    const mx = (dot.x + anchor.x) / 2;
    const my = Math.min(dot.y, anchor.y) - 20;
    return `M${dot.x},${dot.y} Q${mx},${my} ${anchor.x},${anchor.y}`;
  };

  return (
    <div className="annotation-layer" aria-label="Annotazioni hotspot">
      {/* Narrative flags — animate in, then fade out once the slider is used. The
          zone under the cursor yields to its hover popup (no duplicate). */}
      <svg className="annotation-lines">
        {narrativeZones.map((a, i) => {
          const pos = positions[a.idx];
          if (!pos) return null;
          const visible = narrativeShown && a.id !== hoverId;
          return (
            <path
              key={a.id}
              className={`annotation-line annotation-line--priority${visible ? " annotation-line--visible" : ""}`}
              d={linePath(pos)}
              style={{ transitionDelay: `${i * 160}ms` }}
            />
          );
        })}
      </svg>

      {narrativeZones.map((a, i) => {
        const pos = positions[a.idx];
        if (!pos) return null;
        const visible = narrativeShown && a.id !== hoverId;
        return (
          <div
            key={a.id}
            className={`annotation-label annotation-label--priority${visible ? " annotation-label--visible" : ""}`}
            style={{ left: pos.anchor.x, top: pos.anchor.y, transitionDelay: `${i * 160 + 100}ms` }}
          >
            <strong className="annotation-name">{a.name}</strong>
            {a.tag && <span className="annotation-tag">{a.tag}</span>}
            {a.context && <span className="annotation-context">{a.context}</span>}
          </div>
        );
      })}

      {narrativeZones.map((a, i) => {
        const pos = positions[a.idx];
        if (!pos) return null;
        const visible = narrativeShown && a.id !== hoverId;
        return (
          <div
            key={`dot-${a.id}`}
            className={`annotation-dot annotation-dot--priority${visible ? " annotation-dot--visible" : ""}`}
            style={{ left: pos.dot.x, top: pos.dot.y, transitionDelay: `${i * 160}ms` }}
          />
        );
      })}

      {/* Hover popup — non-permanent: dot + connector line + card, shown only while
          hovering the zone's area. */}
      {hoverZone && hoverPos && (
        <div className="annotation-hover" key={`hover-${hoverZone.id}`}>
          <svg className="annotation-lines">
            <path
              className="annotation-line annotation-line--priority annotation-line--visible"
              d={linePath(hoverPos)}
            />
          </svg>
          <span
            className="annotation-hover-dot"
            style={{ left: hoverPos.dot.x, top: hoverPos.dot.y }}
          />
          <div
            className="annotation-hovercard"
            style={{ left: hoverPos.anchor.x, top: hoverPos.anchor.y }}
          >
            <strong className="annotation-hovercard-name">{hoverZone.name}</strong>
            {hoverZone.tag && (
              <span className="annotation-hovercard-tag">{hoverZone.tag}</span>
            )}
            <p className="annotation-hovercard-fact">{hoverZone.context}</p>
          </div>
        </div>
      )}
    </div>
  );
}
