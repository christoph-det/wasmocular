import { makeAutoObservable, runInAction } from "mobx";
import { rootStore } from "./StoreContext";
import type { DatabaseStore } from "./DatabaseStore";
import { DashboardStore } from "./DashboardStore";
import { TimeResolution } from "@/lib/chartConverters/BaseChartConverter";

/**
 * Represents the contents single dashboard element.
 */
export enum ChartType {
  TEXT = "text",
  STACKED_AREA_CHART = "stacked_area_chart",
  HEATMAP = "heatmap"
}

/**
 * This class represents a single dashboard element (widget) that can display data
 */
export class DashboardElement {
  id: string;
  title: string;
  description: string;
  chartWidth: "half" | "full";
  dataLoading = false;
  sqlQuery: string;
  data: object[] | undefined = undefined;
  error: string | null = null;
  type: ChartType;
  timeResolution: TimeResolution;
  dbStore: DatabaseStore;
  dashboardStore: DashboardStore;

  constructor(
    id: string,
    title: string,
    description: string,
    chartWidth: "half" | "full",
    type: ChartType,
    sqlQuery: string,
    timeResolution: TimeResolution = "months",
    dbStore: DatabaseStore = rootStore.dbStore,
    dashboardStore: DashboardStore = rootStore.dashboardStore
  ) {
    this.id = id;
    this.title = title;
    this.description = description;
    this.chartWidth = chartWidth;
    this.type = type;
    this.sqlQuery = sqlQuery;
    this.timeResolution = timeResolution;
    this.dbStore = dbStore;
    this.dashboardStore = dashboardStore;

    makeAutoObservable(this, {
      // Keep serialization observable so reactions can track field changes
      toJSON: false
    });
  }

  async loadData(): Promise<void> {
    runInAction(() => {
      this.dataLoading = true;
      this.error = null;
    });
    let queryToRun = this.sqlQuery;
    queryToRun = this.makeCTEQuery(this.sqlQuery);
    const result = await this.dbStore.runQuery(queryToRun).catch((error) => {
      console.error("Failed to load data for DashboardElement:", error);
      runInAction(() => {
        this.error = String(error);
        this.dataLoading = false;
      });
      return [];
    });
    runInAction(() => {
      this.data = result as object[];
      this.dataLoading = false;
    });
  }

  toggleWidth() {
    this.chartWidth = this.chartWidth === "half" ? "full" : "half";
  }

  // CTE approach to apply date filters, TODO: maybe take care of joins later
  private makeCTEQuery(userQuery: string): string {
    const conditions: string[] = [];
    const { activeDateFilterFrom, activeDateFilterTo, unselectedAuthors } =
      this.dashboardStore;
    if (activeDateFilterFrom) {
      const fromTimestamp = activeDateFilterFrom.getTime();
      conditions.push(`authored_at >= make_timestamp_ms(${fromTimestamp})`);
    }
    if (activeDateFilterTo) {
      const toTimestamp = activeDateFilterTo.getTime();
      conditions.push(`authored_at <= make_timestamp_ms(${toTimestamp})`);
    }

    if (unselectedAuthors.length > 0) {
      const authorsList = unselectedAuthors
        .map((author) => `'${author.replace(/'/g, "''")}'`)
        .join(", ");
      conditions.push(`author_signature NOT IN (${authorsList})`);
    }

    if (conditions.length > 0) {
      const whereClause = conditions.join(" AND ");
      const cte_query = `WITH commits_filtered AS ( SELECT * FROM commits WHERE ${whereClause} )`;
      return `${cte_query} ${this.replaceTableNamesInQuery(userQuery)}`;
    } else {
      return userQuery;
    }
  }

  private replaceTableNamesInQuery(sql: string): string {
    // replace CTE in user query with comma because CTE is already defined at the beginning
    if (!sql.toLowerCase().startsWith("with ")) {
      sql = sql.replace("WITH ", ", ");
    }
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
      type: this.type,
      timeResolution: this.timeResolution
    };
  }
}
