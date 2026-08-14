import summerTrendGenerated from "../generated/summer-trend.json";

export const summerTrendFull = summerTrendGenerated.series;

export const summerTrendFocusStartYear = 2013;

export const summerTrendData = summerTrendFull.filter(
  (d) => d.year >= summerTrendFocusStartYear,
);

export const summerTrendCurrentMean =
  summerTrendData.reduce((s, d) => s + d.temp, 0) / summerTrendData.length;

export const summerTrendMean = summerTrendGenerated.mean;
