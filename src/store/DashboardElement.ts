import { makeAutoObservable } from "mobx";
import { rootStore } from "./StoreContext";
import type { DatabaseStore } from "./DatabaseStore";
import { DashboardStore } from "./DashboardStore";

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
  dashboardStore: DashboardStore;

  constructor(
    id: string,
    title: string,
    description: string,
    chartWidth: "half" | "full",
    type: ChartType,
    sqlQuery: string,
    dbStore: DatabaseStore = rootStore.dbStore,
    dashboardStore: DashboardStore = rootStore.dashboardStore
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.chartWidth = chartWidth;
    this.type = type;
    this.sqlQuery = sqlQuery;
    this.dbStore = dbStore;
    this.dashboardStore = dashboardStore;

    makeAutoObservable(this, {
      // Keep serialization observable so reactions can track field changes
      toJSON: false
    });
  }

  async loadData(): Promise<void> {
    this.dataLoading = true;
    this.error = null;
    let queryToRun = this.sqlQuery;
    if (
      this.dashboardStore.activeDateFilterFrom ||
      this.dashboardStore.activeDateFilterTo
    ) {
      queryToRun = this.makeCTEQuery(this.sqlQuery);
    }
    const result = await this.dbStore.runQuery(queryToRun).catch((error) => {
      console.error("Failed to load data for DashboardElement:", error);
      this.error = String(error);
      this.dataLoading = false;
      return [];
    });
    this.data = result as object[];
    this.dataLoading = false;
  }

  toggleWidth() {
    this.chartWidth = this.chartWidth === "half" ? "full" : "half";
  }

  // CTE approach to apply date filters, TODO: maybe take care of joins later
  private makeCTEQuery(userQuery: string): string {
    let dateFilter = "";

    const conditions: string[] = [];
    if (this.dashboardStore.activeDateFilterFrom) {
      const fromTimestamp = this.dashboardStore.activeDateFilterFrom.getTime();
      conditions.push(`authored_at >= make_timestamp_ms(${fromTimestamp})`);
    }
    if (this.dashboardStore.activeDateFilterTo) {
      const toTimestamp = this.dashboardStore.activeDateFilterTo.getTime();
      conditions.push(`authored_at <= make_timestamp_ms(${toTimestamp})`);
    }

    if (conditions.length > 0) {
      const whereClause = conditions.join(" AND ");
      dateFilter += ` WHERE ${whereClause}`;
    }

    const cte_query = `WITH commits_filtered AS ( SELECT * FROM commits ${dateFilter} )`;

    return `${cte_query} ${this.replaceTableNamesInQuery(userQuery)}`;
  }

  private replaceTableNamesInQuery(sql: string): string {
    // i = case insensitive, g = global
    const regex = new RegExp("\\bfrom commits\\b", "gi");
    return sql.replaceAll(regex, "from commits_filtered");
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
