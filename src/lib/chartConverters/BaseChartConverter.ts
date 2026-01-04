export type GenericDataRow = Record<string, unknown>;

export const TIME_RESOLUTIONS = ["days", "weeks", "months", "years"] as const;

export type TimeResolution = (typeof TIME_RESOLUTIONS)[number];

export interface ChartData {
  error?: string;
}

/**
 * Base class for chart converters.
 */
export abstract class BaseChartConverter<T> {
  protected abstract requiredColumns: string[];

  /**
   * Converts SQL result to chart-specific data format.
   */
  abstract convert(rows: GenericDataRow[]): T;

  /**
   * Returns an error result with the given message.
   */
  protected abstract emptyErrorResult(error?: string): T;

  /**
   * Validates that input rows contain the required columns.
   */
  protected validateColumns(rows: GenericDataRow[]): string | undefined {
    if (rows.length === 0) {
      return "No data rows provided.";
    }

    //first row of sql data contains column names
    const firstRow = rows[0];
    const missingColumns = this.requiredColumns.filter(
      (col) => !(col in firstRow)
    );

    if (missingColumns.length > 0) {
      return `Missing required columns: ${missingColumns.join(", ")}. Found: ${Object.keys(firstRow).join(", ")}`;
    }

    return undefined;
  }
}
