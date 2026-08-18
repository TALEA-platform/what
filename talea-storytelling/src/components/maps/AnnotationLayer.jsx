import { useState, useEffect, useMemo } from "react";
import { useContent } from "../../content";
import { buildHotspotAnnotations } from "../../data/hotspotAnnotations";

const HOVER_RADIUS = 72;

export function AnnotationLayer({
  map,
  active,
  showNarrative,
  ariaLabel,
  mobile = false,
}) {
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
  const priorityZones = useMemo(
    () => (mobile ? narrativeZones.slice(0, 3) : narrativeZones),
    [mobile, narrativeZones],
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
    const pickNearest = (point) => {
      let best = null;
      let bestDist = HOVER_RADIUS;
      hotspotAnnotations.forEach((zone) => {
        const pt = map.project(zone.coord);
        const dist = Math.hypot(pt.x - point.x, pt.y - point.y);
        if (dist < bestDist) {
          bestDist = dist;
          best = zone.id;
        }
      });
      setHoverId(best);
    };

    const onMove = (event) => pickNearest(event.point);
    const onTap = (event) => pickNearest(event.point);
    const canvas = map.getCanvas();
    const onLeave = () => setHoverId(null);
    if (mobile) {
      map.on("click", onTap);
    } else {
      map.on("mousemove", onMove);
      canvas.addEventListener("mouseleave", onLeave);
    }
    return () => {
      if (mobile) {
        map.off("click", onTap);
      } else {
        map.off("mousemove", onMove);
        canvas.removeEventListener("mouseleave", onLeave);
      }
      setHoverId(null);
    };
  }, [map, active, hotspotAnnotations, mobile]);

  if (!active || positions.length === 0) return null;

  const hoverIdx = hoverId
    ? hotspotAnnotations.findIndex((z) => z.id === hoverId)
    : -1;
  const hoverZone = hoverIdx >= 0 ? hotspotAnnotations[hoverIdx] : null;
  const hoverPos = hoverIdx >= 0 ? positions[hoverIdx] : null;
  const narrativeShown = narrativeIn && showNarrative;
  const canvas = map?.getCanvas();
  const canvasWidth = canvas?.clientWidth ?? 0;
  const canvasHeight = canvas?.clientHeight ?? 0;
  const narrowMobile = mobile && canvasWidth < 600;
  const mobileSideAnchor = Math.min(
    narrowMobile ? 112 : 184,
    Math.max(narrowMobile ? 82 : 132, canvasWidth * 0.25),
  );
  const mobilePriorityAnchors = [
    { x: mobileSideAnchor, y: canvasHeight * 0.21 },
    { x: canvasWidth - mobileSideAnchor, y: canvasHeight * 0.39 },
    { x: mobileSideAnchor, y: canvasHeight * 0.57 },
  ];
  const priorityDisplayZones = priorityZones
    .map((zone, index) => {
      const position = positions[zone.idx];
      if (!position) return null;
      return {
        zone,
        position:
          mobile && mobilePriorityAnchors[index]
            ? { dot: position.dot, anchor: mobilePriorityAnchors[index] }
            : position,
      };
    })
    .filter(Boolean);
  const hoverDisplayPos =
    mobile && hoverPos && map
      ? {
          dot: hoverPos.dot,
          anchor: {
            x: Math.min(
              canvasWidth - 118,
              Math.max(118, hoverPos.anchor.x),
            ),
            y: Math.min(
              canvasHeight - (narrowMobile ? 245 : 210),
              Math.max(narrowMobile ? 150 : 120, hoverPos.anchor.y),
            ),
          },
        }
      : hoverPos;

  const linePath = ({ dot, anchor }) => {
    const mx = (dot.x + anchor.x) / 2;
    const my = Math.min(dot.y, anchor.y) - 20;
    return `M${dot.x},${dot.y} Q${mx},${my} ${anchor.x},${anchor.y}`;
  };

  return (
    <div className="annotation-layer" aria-label={ariaLabel}>
      <svg className="annotation-lines">
        {priorityDisplayZones.map(({ zone, position }, i) => {
          const visible = narrativeShown && !hoverId;
          return (
            <path
              key={zone.id}
              className={`annotation-line annotation-line--priority${visible ? " annotation-line--visible" : ""}`}
              d={linePath(position)}
              style={{ transitionDelay: `${i * 160}ms` }}
            />
          );
        })}
      </svg>

      {priorityDisplayZones.map(({ zone, position }, i) => {
        const visible = narrativeShown && !hoverId;
        return (
          <div
            key={zone.id}
            className={`annotation-label annotation-label--priority${visible ? " annotation-label--visible" : ""}`}
            style={{
              left: position.anchor.x,
              top: position.anchor.y,
              transitionDelay: `${i * 160 + 100}ms`,
            }}
          >
            <strong className="annotation-name annotation-hovercard-name">
              {zone.name}
            </strong>
            {zone.tag && (
              <span className="annotation-tag annotation-hovercard-tag">
                {zone.tag}
              </span>
            )}
            {zone.context && (
              <p className="annotation-context annotation-hovercard-fact">
                {zone.context}
              </p>
            )}
          </div>
        );
      })}

      {priorityDisplayZones.map(({ zone, position }, i) => {
        const visible = narrativeShown && !hoverId;
        return (
          <div
            key={`dot-${zone.id}`}
            className={`annotation-dot annotation-dot--priority${visible ? " annotation-dot--visible" : ""}`}
            style={{
              left: position.dot.x,
              top: position.dot.y,
              transitionDelay: `${i * 160}ms`,
            }}
          />
        );
      })}

      {hoverZone && hoverDisplayPos && (
        <div className="annotation-hover" key={`hover-${hoverZone.id}`}>
          <svg className="annotation-lines">
            <path
              className="annotation-line annotation-line--priority annotation-line--visible"
              d={linePath(hoverDisplayPos)}
            />
          </svg>
          <span
            className="annotation-hover-dot"
            style={{ left: hoverDisplayPos.dot.x, top: hoverDisplayPos.dot.y }}
          />
          <div
            className="annotation-hovercard"
            style={{
              left: hoverDisplayPos.anchor.x,
              top: hoverDisplayPos.anchor.y,
            }}
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
