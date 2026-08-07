import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import {
  summerTrendData,
  summerTrendFull,
  summerTrendMean,
  summerTrendMeanLabel,
  summerTrendMeanPeriod,
  summerTrendSource,
  summerTrendZoomInvite,
  summerTrendChartMeta,
} from "../../data/summerTrend";

const chartHeight = 340;
const chartMargin = { top: 22, right: 24, bottom: 8, left: -4 };
const yAxisWidth = 38;
const xAxisHeight = 30;
const areaAnimationBegin = 250;
const lineAnimationBegin = 350;
const trendAnimationDuration = 1300;
const interactionReadyDelay = lineAnimationBegin + trendAnimationDuration + 120;

// 03 § 3.2 proponeva di legare il disegno della curva allo scroll. Provato e
// scartato: la curva che si disegna da sola all'ingresso è più bella, e chi si
// fermava a metà scroll si trovava davanti un grafico monco. Resta l'animazione
// di recharts, quella di sempre.

const SWAP_FADE_MS = 180;

const tempFormatter = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const deltaFormatter = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatTemp(value) {
  return `${tempFormatter.format(value)} °C`;
}

function getTooltipPlacement(y) {
  return y < 72 ? "below" : "above";
}

// Sparse decade ticks for the full 1961-2025 view (every year would be unreadable).
function decadeTicks(data) {
  const first = data[0].year;
  const last = data.at(-1).year;
  const ticks = [first];
  for (let y = Math.ceil(first / 10) * 10; y < last; y += 10) {
    if (y - first >= 5 && last - y >= 5) ticks.push(y);
  }
  ticks.push(last);
  return ticks;
}

function TrendPointTooltip({ point }) {
  if (!point?.data) return null;
  const d = point.data;
  const delta = d.temp - summerTrendMean;
  return (
    <div
      className={`trend-tooltip trend-tooltip--${point.placement || "above"}`}
      style={{
        "--trend-tooltip-x": `${point.x}px`,
        "--trend-tooltip-y": `${point.y}px`,
      }}
    >
      <strong>{d.year}</strong>
      <span className="trend-tooltip-value">{formatTemp(d.temp)}</span>
      <span className="trend-tooltip-delta">
        {delta > 0 ? "+" : ""}{deltaFormatter.format(delta)}° vs media
      </span>
    </div>
  );
}

export function SummerTrendChart() {
  const ref = useRef(null);
  const plotRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(0);
  const [visible, setVisible] = useState(false);
  const [meanVisible, setMeanVisible] = useState(false);
  const [interactionReady, setInteractionReady] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [activePoint, setActivePoint] = useState(null);
  const swapTimerRef = useRef(null);
  const [reduceMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = null;
    let started = false;

    const startWhenReadable = () => {
      frame = null;
      if (started) return;
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 768;
      const triggerLine = viewportHeight * 0.68;
      const stillReadable = rect.bottom >= viewportHeight * 0.28;

      if (rect.top <= triggerLine && stillReadable) {
        started = true;
        setVisible(true);
        window.removeEventListener("scroll", requestStart);
        window.removeEventListener("resize", requestStart);
      }
    };

    const requestStart = () => {
      if (frame) return;
      frame = requestAnimationFrame(startWhenReadable);
    };

    requestStart();
    window.addEventListener("scroll", requestStart, { passive: true });
    window.addEventListener("resize", requestStart);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", requestStart);
      window.removeEventListener("resize", requestStart);
    };
  }, []);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;

    const updateWidth = () => setChartWidth(el.getBoundingClientRect().width);
    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // The mean reference settles in just before the line draws over it.
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setMeanVisible(true), reduceMotion ? 0 : 200);
    return () => clearTimeout(timer);
  }, [visible, reduceMotion]);

  // Enable hover/keyboard once the initial draw has finished. Toggling the view
  // later keeps interactivity on (the delay only guards the first reveal).
  useEffect(() => {
    if (!visible || interactionReady) return undefined;
    const timer = setTimeout(
      () => setInteractionReady(true),
      reduceMotion ? 0 : interactionReadyDelay,
    );
    return () => clearTimeout(timer);
  }, [visible, interactionReady, reduceMotion]);

  useEffect(() => () => window.clearTimeout(swapTimerRef.current), []);

  const view = useMemo(() => {
    const data = expanded ? summerTrendFull : summerTrendData;
    const temps = data.map((d) => d.temp);
    const maxTemp = Math.max(...temps);
    const minTemp = Math.min(...temps);
    const values = [...temps, summerTrendMean];
    const yMin = Math.floor(Math.min(...values) - 0.5);
    const yMax = Math.ceil(Math.max(...values) + 0.5);
    const ticks = expanded ? decadeTicks(data) : data.map((d) => d.year);
    return { data, maxTemp, minTemp, yMin, yMax, ticks };
  }, [expanded]);

  // Animate the line/area DRAW (recharts built-in). Keying on `visible` +
  // `expanded` remounts the series so the draw replays on scroll-in and on each
  // zoom toggle; the axes + tick numbers always paint with the chart structure.
  const drawAnim = visible && !reduceMotion;
  const activeYear = activePoint?.data?.year;
  const invite = expanded ? summerTrendZoomInvite.expanded : summerTrendZoomInvite.collapsed;
  const dense = expanded;

  const points = useMemo(() => {
    if (chartWidth <= 0) return [];

    const { data, maxTemp, minTemp, yMin, yMax } = view;
    const plotLeft = chartMargin.left + yAxisWidth;
    const plotRight = chartWidth - chartMargin.right;
    const plotTop = chartMargin.top;
    const plotBottom = chartHeight - chartMargin.bottom - xAxisHeight;
    const xSpan = plotRight - plotLeft;
    const ySpan = plotBottom - plotTop;
    const firstYear = data[0].year;
    const lastYear = data.at(-1).year;
    const yearSpan = lastYear - firstYear;
    const tempSpan = yMax - yMin;

    return data.map((d) => {
      const x = plotLeft + ((d.year - firstYear) / yearSpan) * xSpan;
      const y = plotBottom - ((d.temp - yMin) / tempSpan) * ySpan;
      const isMax = d.temp === maxTemp;
      const isMin = d.temp === minTemp;

      return {
        x,
        y,
        data: d,
        placement: getTooltipPlacement(y),
        color: isMax ? "#e05a2b" : isMin ? "var(--talea-blue)" : "var(--talea-dark-green)",
        haloColor: isMax ? "#e05a2b" : isMin ? "var(--talea-blue)" : "var(--talea-green)",
        radius: isMax ? 5.5 : isMin ? 4.4 : dense ? 2 : 3.4,
        hitSize: dense ? 22 : 36,
        isMax,
        isMin,
      };
    });
  }, [chartWidth, view, dense]);

  const activatePoint = useCallback((point) => {
    setActivePoint((current) => (current?.data?.year === point.data.year ? current : point));
  }, []);

  const clearActivePoint = useCallback(() => {
    setActivePoint((current) => (current ? null : current));
  }, []);

  // Cambio di vista: il grafico sfuma, cambia i dati, torna. Senza la sfumata i
  // 13 punti saltano nelle posizioni dei 65 e sembra un errore di rendering.
  // Il tooltip aperto va chiuso: il suo anno non esiste più nella nuova scala.
  const toggleExpanded = useCallback(() => {
    setActivePoint(null);
    setSwapping(true);
    window.clearTimeout(swapTimerRef.current);
    swapTimerRef.current = window.setTimeout(
      () => {
        setExpanded((v) => !v);
        setSwapping(false);
      },
      reduceMotion ? 0 : SWAP_FADE_MS,
    );
  }, [reduceMotion]);

  return (
    <div ref={ref} className={`trend-chart${visible ? " trend-chart--visible" : ""}`}>
      <div className="trend-chart-head">
        <div className="trend-chart-meta">
          <span className="trend-chart-meta-kicker">
            {expanded ? summerTrendChartMeta.expanded : summerTrendChartMeta.collapsed}
          </span>
          <span className="trend-chart-meta-value">{summerTrendChartMeta.value}</span>
          <span className="trend-chart-meta-unit">{summerTrendChartMeta.unit}</span>
        </div>
      </div>

      <div
        ref={plotRef}
        className={`trend-chart-plot${swapping ? " trend-chart-plot--swapping" : ""}`}
      >
        <ResponsiveContainer width="100%" height={chartHeight}>
          <ComposedChart data={view.data} margin={chartMargin}>
            <defs>
              <linearGradient id="trendAreaFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e05a2b" stopOpacity={0.22} />
                <stop offset="60%" stopColor="var(--talea-green)" stopOpacity={0.08} />
                <stop offset="100%" stopColor="var(--talea-green)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="trendLineStroke" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--talea-dark-green)" />
                <stop offset="50%" stopColor="var(--talea-green)" />
                <stop offset="100%" stopColor="#e05a2b" />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="year"
              type="number"
              domain={[view.data[0].year, view.data.at(-1).year]}
              ticks={view.ticks}
              allowDecimals={false}
              tick={{ fontSize: 11, fill: "var(--text-muted)", fontWeight: 500 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border-soft)" }}
              tickMargin={8}
            />
            <YAxis
              domain={[view.yMin, view.yMax]}
              tick={{ fontSize: 11, fill: "var(--text-muted)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}°`}
              width={38}
            />
            {/* 03 § 3.4 — la media era azzurra, un colore che nel resto della
                storia non significa niente. È una nota, non un dato. */}
            {meanVisible && (
              <ReferenceLine
                y={summerTrendMean}
                stroke="var(--ink-soft)"
                strokeDasharray="5 5"
                strokeWidth={1.6}
                className="trend-reference-line"
                label={{
                  /* Virgola decimale: il resto del grafico usa già it-IT. */
                  value: `media ${summerTrendMeanPeriod} · ${deltaFormatter.format(summerTrendMean)}°`,
                  position: "insideTopRight",
                  fill: "var(--ink-soft)",
                  fontSize: 10.5,
                  fontWeight: 600,
                  offset: 8,
                }}
              />
            )}
            <Area
              key={`area-${visible}-${expanded}`}
              type="monotone"
              dataKey="temp"
              stroke="none"
              fill="url(#trendAreaFill)"
              isAnimationActive={drawAnim}
              animationBegin={areaAnimationBegin}
              animationDuration={trendAnimationDuration}
              animationEasing="ease-out"
            />
            <Line
              key={`line-${visible}-${expanded}`}
              type="monotone"
              dataKey="temp"
              stroke="url(#trendLineStroke)"
              strokeWidth={2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              isAnimationActive={drawAnim}
              animationBegin={lineAnimationBegin}
              animationDuration={trendAnimationDuration}
              animationEasing="ease-out"
            />
          </ComposedChart>
        </ResponsiveContainer>
        <div
          className={`trend-chart-hit-layer${interactionReady ? " trend-chart-hit-layer--ready" : ""}${dense ? " trend-chart-hit-layer--dense" : ""}`}
          aria-hidden={interactionReady ? "false" : "true"}
        >
          {points.map((point) => (
            <button
              type="button"
              key={point.data.year}
              className={`trend-chart-point${point.isMax ? " trend-chart-point--max" : ""}${point.isMin ? " trend-chart-point--min" : ""}${point.data.year === activeYear ? " trend-chart-point--active" : ""}`}
              style={{
                "--trend-hit-x": `${point.x}px`,
                "--trend-hit-y": `${point.y}px`,
                "--trend-hit-size": `${point.hitSize}px`,
                "--trend-point-color": point.color,
                "--trend-point-halo-color": point.haloColor,
                "--trend-point-radius": `${point.radius}px`,
              }}
              aria-label={`${point.data.year}: ${formatTemp(point.data.temp)}`}
              tabIndex={interactionReady ? 0 : -1}
              onMouseEnter={() => activatePoint(point)}
              onMouseMove={() => activatePoint(point)}
              onMouseLeave={clearActivePoint}
              onFocus={() => activatePoint(point)}
              onBlur={clearActivePoint}
            >
              <span className="trend-chart-point-halo" aria-hidden="true" />
              <span className="trend-chart-point-mark" aria-hidden="true" />
            </button>
          ))}
        </div>
        <TrendPointTooltip point={activePoint} />
      </div>

      {/* 03 § 3.3 — l'invito sta SOTTO l'asse x, dove l'occhio arriva dopo aver
          letto la curva: è lì che si forma la domanda «e prima?». */}
      <p className="trend-zoom-invite">
        <span className="trend-zoom-invite-lead">{invite.lead}</span>{" "}
        <button
          type="button"
          className="trend-zoom-link"
          onClick={toggleExpanded}
          aria-pressed={expanded}
        >
          {invite.action}
          <span className="trend-zoom-link-arrow" aria-hidden="true">
            →
          </span>
        </button>
      </p>

      <p className="trend-source">
        Fonte: {summerTrendSource.label} · {summerTrendMeanLabel}
      </p>
    </div>
  );
}
