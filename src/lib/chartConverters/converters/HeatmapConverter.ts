import ChartError from "@/lib/errors/ChartError";
import {
  BaseChartConverter,
  ChartData,
  GenericDataRow
} from "../BaseChartConverter";

export interface HeatmapData extends ChartData {
  xCategories: string[];
  yCategories: string[];
  formattedData: number[][];
}

export class HeatmapConverter extends BaseChartConverter<HeatmapData> {
  protected requiredColumns: string[] = ["x", "y", "value"];

  convert(rows: GenericDataRow[]): HeatmapData {
    const validationError = this.validateColumns(rows);
    if (validationError) {
      throw new ChartError(validationError);
    }

    const xCategories = [...new Set(rows.map((row) => String(row.x)))];
    const yCategories = [...new Set(rows.map((row) => String(row.y)))];

    const formattedData = rows.map((row) => [
      xCategories.indexOf(String(row.x)),
      yCategories.indexOf(String(row.y)),
      Number(row.value)
    ]);

    return {
      xCategories,
      yCategories,
      formattedData
    };
  }
}
