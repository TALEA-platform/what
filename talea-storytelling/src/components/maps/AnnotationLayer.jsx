import { useState, useEffect, useMemo } from "react";
import { useContent } from "../../content";
import { buildHotspotAnnotations } from "../../data/hotspotAnnotations";

const HOVER_RADIUS = 72;

export function AnnotationLayer({ map, active, showNarrative, ariaLabel }) {
  const { content } = useContent();
  const hotspotAnnotations = useMemo(
    () => buildHotspotAnnotations(content),
    [content],
  );
  const [positions, setPositions] = useState([]);
  const [narrativeIn, setNarrativeIn] = useState(false);
  const [hoverId, setHoverId] = useState(null);

  const narrativeZones = useMemo(
    () =>
      hotspotAnnotations
        .map((zone, idx) => ({ ...zone, idx }))
        .filter((zone) => zone.narrative),
    [hotspotAnnotations],
  );

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
  }, [map, hotspotAnnotations]);

  useEffect(() => {
    if (!(active && showNarrative)) return;
    const timer = setTimeout(() => setNarrativeIn(true), 60);
    return () => {
      clearTimeout(timer);
      setNarrativeIn(false);
    };
  }, [active, showNarrative]);

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
  }, [map, active, hotspotAnnotations]);

  if (!active || positions.length === 0) return null;

  const hoverIdx = hoverId
    ? hotspotAnnotations.findIndex((z) => z.id === hoverId)
    : -1;
  const hoverZone = hoverIdx >= 0 ? hotspotAnnotations[hoverIdx] : null;
  const hoverPos = hoverIdx >= 0 ? positions[hoverIdx] : null;
  const narrativeShown = narrativeIn && showNarrative;

  const linePath = ({ dot, anchor }) => {
    const mx = (dot.x + anchor.x) / 2;
    const my = Math.min(dot.y, anchor.y) - 20;
    return `M${dot.x},${dot.y} Q${mx},${my} ${anchor.x},${anchor.y}`;
  };

  return (
    <div className="annotation-layer" aria-label={ariaLabel}>
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
