import { makeAutoObservable } from "mobx";
import { rootStore } from "./StoreContext";
import type { DatabaseStore } from "./DatabaseStore";
import { reject } from "lodash";

export enum ChartType {
  TEXT = "text",
  STACKED_AREA_CHART = "stacked_area_chart"
}

export class DashboardElement {
  id: string;
  title: string;
  description: string;
  chartWidth: "half" | "full";
  dataLoading = false;
  sqlQuery: string;
  data: object[] = [];
  error: string | null = null;
  type: ChartType;
  dbStore: DatabaseStore;

  constructor(
    id: string,
    title: string,
    description: string,
    chartWidth: "half" | "full",
    type: ChartType,
    sqlQuery: string,
    dbStore: DatabaseStore = rootStore.dbStore
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.chartWidth = chartWidth;
    this.type = type;
    this.sqlQuery = sqlQuery;
    this.dbStore = dbStore;

    makeAutoObservable(this, {
      // Keep serialization observable so reactions can track field changes
      toJSON: false
    });
  }

  async loadData(): Promise<void> {
    this.dataLoading = true;
    const result = await this.dbStore.runQuery(this.sqlQuery).catch((error) => {
      console.error("Failed to load data for DashboardElement:", error);
      this.error = String(error);
      this.dataLoading = false;
      return reject;
    });
    this.data = result as object[];
    this.dataLoading = false;
  }

  toggleWidth() {
    this.chartWidth = this.chartWidth === "half" ? "full" : "half";
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      chartWidth: this.chartWidth,
      sqlQuery: this.sqlQuery,
      type: this.type
    };
  }
}
