import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const inputPath = path.join(
  projectRoot,
  "public",
  "data",
  "summer-trend",
  "central_air_temperature_1961_2025.csv",
);
const outputPath = path.join(
  projectRoot,
  "src",
  "generated",
  "summer-trend.json",
);

const expectedHeader = [
  "year",
  "summer_mean_daily_tmax",
  "days",
  "source",
  "notes",
];
const firstYear = 1961;
const lastYear = 2025;
const expectedRowCount = lastYear - firstYear + 1;

function dataError(message) {
  return new Error(`SummerTrend CSV validation failed: ${message}`);
}

function parseCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];

    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      if (field.length > 0) {
        throw dataError("unexpected quote in an unquoted field");
      }
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) {
    throw dataError("unterminated quoted field");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function validateRows(rows) {
  if (rows.length === 0) {
    throw dataError("file is empty");
  }

  const [header, ...dataRows] = rows;
  if (
    header.length !== expectedHeader.length ||
    header.some((field, index) => field !== expectedHeader[index])
  ) {
    throw dataError(`expected header: ${expectedHeader.join(",")}`);
  }
  if (dataRows.length !== expectedRowCount) {
    throw dataError(
      `expected ${expectedRowCount} data rows, found ${dataRows.length}`,
    );
  }

  const seenYears = new Set();
  return dataRows.map((fields, index) => {
    const rowNumber = index + 2;
    if (fields.length !== expectedHeader.length) {
      throw dataError(
        `row ${rowNumber}: expected ${expectedHeader.length} fields, found ${fields.length}`,
      );
    }
    if (fields.some((field) => field.trim() === "")) {
      throw dataError(`row ${rowNumber}: missing value`);
    }

    const year = Number(fields[0]);
    const temperature = Number(fields[1]);
    const days = Number(fields[2]);

    if (!Number.isInteger(year)) {
      throw dataError(`row ${rowNumber}: invalid year "${fields[0]}"`);
    }
    if (!Number.isFinite(temperature)) {
      throw dataError(
        `row ${rowNumber}: invalid temperature "${fields[1]}"`,
      );
    }
    if (!Number.isInteger(days) || days !== 92) {
      throw dataError(`row ${rowNumber}: expected 92 days, found "${fields[2]}"`);
    }
    if (seenYears.has(year)) {
      throw dataError(`row ${rowNumber}: duplicate year ${year}`);
    }
    seenYears.add(year);

    const expectedYear = firstYear + index;
    if (year !== expectedYear) {
      throw dataError(
        `row ${rowNumber}: expected year ${expectedYear}, found ${year}`,
      );
    }

    return { year, temp: temperature };
  });
}

const csv = (await readFile(inputPath, "utf8")).replace(/^\uFEFF/, "");
const series = validateRows(parseCsv(csv));
const rawMean =
  series.reduce((sum, observation) => sum + observation.temp, 0) /
  series.length;
const mean = Math.round((rawMean + Number.EPSILON) * 1000) / 1000;
const output = {
  schemaVersion: 1,
  source: "public/data/summer-trend/central_air_temperature_1961_2025.csv",
  metric: "summer_mean_daily_tmax",
  series,
  mean,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

console.log(
  `SummerTrend data built: ${series.length} rows (${series[0].year}-${series.at(-1).year}), mean ${mean.toFixed(3)} °C`,
);
