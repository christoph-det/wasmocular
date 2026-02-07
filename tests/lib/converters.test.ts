import { expect, test } from "vitest";
import {
  HeatmapConverter,
  HeatmapData
} from "../../src/lib/chartConverters/converters/HeatmapConverter";
import { StackedAreaChartConverter } from "../../src/lib/chartConverters/converters/StackedAreaChartConverter";
import { TimeResolution } from "../../src/lib/chartConverters/BaseChartConverter";

test("HeatmapConverter converts rows to heatmap data correctly", () => {
  const converter = new HeatmapConverter();
  const rows = [
    { x: "A", y: "1", value: 10 },
    { x: "A", y: "2", value: 20 },
    { x: "B", y: "1", value: 30 },
    { x: "B", y: "2", value: 40 }
  ];

  const result: HeatmapData = converter.convert(rows);

  expect(result.xCategories).toEqual(["A", "B"]);
  expect(result.yCategories).toEqual(["1", "2"]);
  expect(result.formattedData).toEqual([
    [0, 0, 10],
    [0, 1, 20],
    [1, 0, 30],
    [1, 1, 40]
  ]);
});

test("HeatmapConverter throws error for incomplete data", () => {
  const converter = new HeatmapConverter();
  const rows = [
    { y: "1", value: 10 },
    { y: "2", value: 40 }
  ];

  expect(() => converter.convert(rows)).toThrowError(
    "Missing required columns: x. Found: y, value"
  );
});

test("StackedAreaChartConverter converts rows to stacked area chart data correctly", () => {
  const timeResolution: TimeResolution = "days";
  const converter = new StackedAreaChartConverter(timeResolution);
  const baseDate = new Date("2026-01-01").getTime();
  const rows = [
    { date: baseDate, series: "seriesA", value: 10 },
    { date: baseDate, series: "seriesB", value: 20 },
    { date: baseDate + 86400000, series: "seriesA", value: 15 },
    { date: baseDate + 86400000, series: "seriesB", value: 25 }
  ];

  const result = converter.convert(rows);

  expect(result.keys).toEqual(["seriesA", "seriesB"]);
  expect(result.content.length).toBe(2);
  expect(result.content[0].seriesA).toBe(10);
  expect(result.content[0].seriesB).toBe(20);
  expect(result.content[1].seriesA).toBe(15);
  expect(result.content[1].seriesB).toBe(25);
});

test("StackedAreaChartConverter throws error for incomplete data", () => {
  const timeResolution: TimeResolution = "days";
  const converter = new StackedAreaChartConverter(timeResolution);
  const baseDate = new Date("2026-01-01").getTime();
  const rows = [
    { date: baseDate, value: 10 },
    { date: baseDate + 86400000, series: "seriesB", value: 25 }
  ];

  expect(() => converter.convert(rows)).toThrowError(
    "Missing required columns: series. Found: date, value"
  );
});
