import * as d3 from "d3";
import {
  BaseChartConverter,
  ChartData,
  GenericDataRow,
  TimeResolution
} from "../BaseChartConverter";
import ChartError from "@/lib/errors/ChartError";

export interface StackedAreaChartData extends ChartData {
  content: Record<string, number>[];
  yDims: [number, number];
  keys: string[];
}

/**
 * Converter for stacked area charts SQL to stacked area chart data.
 * Expects rows with: date (timestamp), series (string), value (number)
 *
 * Example queries:
 *
 * 1. Additions by author:
 *    SELECT authored_at AS date, author_signature AS series, additions AS value FROM commits
 *
 * 2. Additions and deletions by author (diverging chart):
 *    SELECT authored_at AS date, author_signature || ' (additions)' AS series, CAST(additions AS INTEGER) AS value FROM commits
 *    UNION ALL
 *    SELECT authored_at AS date, author_signature || ' (deletions)' AS series, -CAST(deletions AS INTEGER) AS value FROM commits
 *
 * 3. Commit count by author:
 *    SELECT authored_at AS date, author_signature AS series, 1 AS value FROM commits
 */
export class StackedAreaChartConverter extends BaseChartConverter<StackedAreaChartData> {
  protected requiredColumns = ["date", "series", "value"];
  private resolution: TimeResolution;

  constructor(resolution: TimeResolution) {
    super();
    this.resolution = resolution;
  }

  /**
   * Convert generic data rows to stacked area chart data.
   * @param rows input data rows from SQL query
   * @returns dataset for stacked area chart visualization
   */
  convert(rows: GenericDataRow[]): StackedAreaChartData {
    const validationError = this.validateColumns(rows);
    if (validationError) {
      throw new ChartError(validationError);
    }

    const interval = this.getInterval();
    const { bucketed, seriesKeys } = this.bucketRows(rows, interval);
    this.fillMissingBuckets(bucketed, interval);

    const keys = Array.from(seriesKeys).sort();
    const content = this.buildBucketedSeriesContent(bucketed, keys);

    if (content.length === 0) {
      throw new Error("No data available for the selected chart.");
    }

    const yDims = this.computeYDims(content, keys);

    return {
      content,
      yDims,
      keys
    };
  }

  private getInterval(): d3.CountableTimeInterval {
    const intervals: Record<TimeResolution, d3.CountableTimeInterval> = {
      days: d3.timeDay,
      weeks: d3.timeWeek,
      months: d3.timeMonth,
      years: d3.timeYear
    };

    return intervals[this.resolution] ?? d3.timeDay;
  }

  // Bucket rows by time interval and aggregate values by series
  private bucketRows(
    rows: GenericDataRow[],
    interval: d3.CountableTimeInterval
  ): {
    bucketed: Map<number, Record<string, number>>;
    seriesKeys: Set<string>;
  } {
    const bucketed = new Map<number, Record<string, number>>();
    const seriesKeys = new Set<string>();

    for (const row of rows) {
      const dateValue = Number(row.date);
      const seriesValue = String(row.series);
      const numericValue = Number(row.value);

      const bucket = interval.floor(new Date(dateValue)).getTime();
      const existing = bucketed.get(bucket) ?? {};

      seriesKeys.add(seriesValue);
      existing[seriesValue] = (existing[seriesValue] ?? 0) + numericValue;

      bucketed.set(bucket, existing);
    }

    return { bucketed, seriesKeys };
  }

  // to make the spacing consistent, fill in missing time buckets with zero values
  private fillMissingBuckets(
    bucketed: Map<number, Record<string, number>>,
    interval: d3.CountableTimeInterval
  ): void {
    const sortedBuckets = Array.from(bucketed.keys()).sort((a, b) => a - b);
    if (sortedBuckets.length === 0) {
      return;
    }

    const start = interval.floor(new Date(sortedBuckets[0])).getTime();
    const end = interval
      .floor(new Date(sortedBuckets[sortedBuckets.length - 1]))
      .getTime();

    for (
      let cursor = start;
      cursor <= end;
      cursor = interval.offset(new Date(cursor), 1).getTime()
    ) {
      if (!bucketed.has(cursor)) {
        bucketed.set(cursor, {});
      }
    }
  }

  // Build final array from bucketed data
  private buildBucketedSeriesContent(
    bucketed: Map<number, Record<string, number>>,
    keys: string[]
  ): Record<string, number>[] {
    return Array.from(bucketed.entries())
      .map(([date, totals]) => {
        const entry: Record<string, number> = { date };
        for (const key of keys) {
          entry[key] = totals[key] ?? 0;
        }
        return entry;
      })
      .sort((a, b) => a.date - b.date);
  }

  // Compute Y-axis dimensions for diverging stacked area chart
  private computeYDims(
    content: Record<string, number>[],
    keys: string[]
  ): [number, number] {
    const stacked = d3
      .stack()
      .offset(d3.stackOffsetDiverging)
      .order(d3.stackOrderReverse)
      .keys(keys)(content);

    let minY = 0;
    let maxY = 0;
    for (const series of stacked) {
      for (const [y0, y1] of series) {
        minY = Math.min(minY, y0, y1);
        maxY = Math.max(maxY, y0, y1);
      }
    }

    const maxAbs = Math.max(Math.abs(minY), Math.abs(maxY)) || 1;
    return [-maxAbs, maxAbs];
  }
}
