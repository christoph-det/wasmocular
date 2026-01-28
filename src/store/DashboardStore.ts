import { makeAutoObservable, reaction, runInAction } from "mobx";
import { DashboardElement, type ChartType } from "./DashboardElement";
import { RootStore } from "./RootStore";
import { TimeResolution } from "@/lib/chartConverters/BaseChartConverter";

/**
 * Structure for storing data of a whole dashboard in localStorage.
*/
interface StoredDashboardData {
  dashboardId: string;
  widgets: StoredDashboardElement[];
}
/**
 * This class represents one element inside a dashboard.
 */
interface StoredDashboardElement {
  id: string;
  title: string;
  description: string;
  chartWidth: "half" | "full";
  sqlQuery: string;
  type: ChartType;
  timeResolution: TimeResolution;
}

/**
 * This class represents the data of a dashboard.
 */
class DashboardData {
  dashboardId: string;
  widgets: DashboardElement[];

  constructor(dashboardId: string, widgets: DashboardElement[]) {
    this.dashboardId = dashboardId;
    this.widgets = widgets;
    makeAutoObservable(this, {
      toJSON: false
    });
  }

  toJSON(): StoredDashboardData {
    return {
      dashboardId: this.dashboardId,
      widgets: this.widgets.map((widget) => widget.toJSON())
    };
  }
}

/**
 * This store manages the state of dashboards, including loading, saving,
 * creating, deleting, importing, and exporting dashboards.
 */
export class DashboardStore {
  private readonly STORAGE_KEY = "dashboardStore_";
  private readonly rootStore: RootStore;
  private autoSaveDisposer: (() => void) | null = null;
  private availableAuthors: Map<string, boolean> = new Map<string, boolean>();
  activeDashboard: DashboardData | null = null;
  activeDateFilterFrom: Date | undefined = undefined;
  activeDateFilterTo: Date | undefined = undefined;

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);
    void this.loadFromStorage();
  }

  /**
   * Get a list of authors that are currently unselected, i.e., those that should not be displayed.
   */
  get unselectedAuthors(): string[] {
    return Array.from(this.availableAuthors.entries())
      .filter(([, selected]) => !selected)
      .map(([author]) => author);
  }

  setAvailableAuthors(authors: Map<string, boolean>) {
    this.availableAuthors = authors;
  }

  setAuthorSelected(author: string, selected: boolean) {
    this.availableAuthors.set(author, selected);
  }

  createNewDashboard(): string {
    const newDashboardId = crypto.randomUUID();
    this.activeDashboard = new DashboardData(newDashboardId, []);
    this.saveToStorage();
    this.setupAutoSave();
    return newDashboardId;
  }

  /**
   * Deletes the dashboard with the given ID from localStorage.
   */
  deleteDashboard(dashboardId: string) {
    const storageKey = `${this.STORAGE_KEY}${dashboardId}`;
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn(
        `Failed to delete dashboard with ID ${dashboardId} from localStorage:`,
        error
      );
    }
  }

  private saveToStorage() {
    console.log("Saving dashboard to storage");
    if (this.activeDashboard === null) {
      console.warn("No active dashboard to save.");
      return;
    }
    const storageKey = `${this.STORAGE_KEY}${this.activeDashboard.dashboardId}`;
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(this.activeDashboard.toJSON())
      );
    } catch (error) {
      console.warn("Failed to save DashboardStore to localStorage:", error);
    }
  }

  private async loadFromStorage(dashboardId?: string) {
    await this.rootStore.indexingStore.ready;
    const targetDashboardId =
      dashboardId ??
      this.rootStore.indexingStore.project?.defaultDashboardId ??
      null;

    if (targetDashboardId === null) {
      console.warn("No active dashboard ID set for loading.");
      return;
    }

    const storageKey = `${this.STORAGE_KEY}${targetDashboardId}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const data: StoredDashboardData = JSON.parse(
          stored
        ) as StoredDashboardData;
        const widgets = data.widgets.map(
          (widgetData) =>
            new DashboardElement(
              widgetData.id,
              widgetData.title,
              widgetData.description,
              widgetData.chartWidth,
              widgetData.type,
              widgetData.sqlQuery,
              widgetData.timeResolution,
              this.rootStore.dbStore
            )
        );
        runInAction(() => {
          this.activeDashboard = new DashboardData(data.dashboardId, widgets);
        });
      }
      this.setupAutoSave();
      console.log("Loaded dashboard from storage:", this.activeDashboard);
    } catch (error) {
      console.warn("Failed to load DashboardStore from localStorage:", error);
    }
  }

  /**
    * Exports the active dashboard as a JSON file and triggers a download in the browser.
   */
  exportActiveDashboard() {
    if (this.activeDashboard === null) {
      console.warn("No active dashboard to export.");
      return;
    }
    const dataString = JSON.stringify(this.activeDashboard.toJSON(), null, 2);
    const blobElement = new Blob([dataString], { type: "application/json" });
    const url = URL.createObjectURL(blobElement);
    const helperLinkElement = document.createElement("a");
    helperLinkElement.href = url;
    helperLinkElement.download = `dashboard_${this.activeDashboard.dashboardId}.json`;
    document.body.appendChild(helperLinkElement);
    helperLinkElement.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Imports a dashboard from the given JSON data string and sets it as the active dashboard.
   */
  importDashboardFromJSON(jsonData: string) {
    try {
      const data: StoredDashboardData = JSON.parse(
        jsonData
      ) as StoredDashboardData;
      // Generate new IDs for dashboard and widgets to ensure they are unique per project
      const newDashboardId = crypto.randomUUID();
      const widgets = data.widgets.map(
        (widgetData) =>
          new DashboardElement(
            crypto.randomUUID(), // Generate new widget ID
            widgetData.title,
            widgetData.description,
            widgetData.chartWidth,
            widgetData.type,
            widgetData.sqlQuery,
            widgetData.timeResolution,
            this.rootStore.dbStore
          )
      );
      runInAction(() => {
        this.activeDashboard = new DashboardData(newDashboardId, widgets);
      });
      this.rootStore.indexingStore.setDefaultDashboardId(newDashboardId);
      this.saveToStorage();
      this.setupAutoSave();
      console.log("Imported dashboard from JSON:", this.activeDashboard);
    } catch (error) {
      console.warn("Failed to import dashboard from JSON:", error);
    }
  }

  private setupAutoSave() {
    this.autoSaveDisposer?.();
    this.autoSaveDisposer = reaction(
      () =>
        this.activeDashboard
          ? JSON.stringify(this.activeDashboard.toJSON())
          : null,
      () => this.saveToStorage(),
      { delay: 100 }
    );
  }

  /**
   * Sets the active dashboard and syncs it with the IndexingStore project.
   */
  async setActiveDashboard(dashboardId: string) {
    this.rootStore.indexingStore.setDefaultDashboardId(dashboardId);
    await this.loadFromStorage(dashboardId);
  }
}
