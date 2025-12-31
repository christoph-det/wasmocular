import { makeAutoObservable, reaction, runInAction } from "mobx";
import { DashboardElement, type ChartType } from "./DashboardElement";
import { RootStore } from "./RootStore";

interface StoredDashboardData {
  dashboardId: string;
  widgets: StoredDashboardElement[];
}

interface StoredDashboardElement {
  id: string;
  title: string;
  description: string;
  chartWidth: "half" | "full";
  sqlQuery: string;
  type: ChartType;
}

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

export class DashboardStore {
  private readonly STORAGE_KEY = "dashboardStore_";
  // dashboard is defined by its own id
  activeDashboard: DashboardData | null = null;
  activeDashboardId: string | null = null;
  rootStore: RootStore;
  ready: Promise<void>;
  activeDateFilterFrom: Date | undefined = undefined;
  activeDateFilterTo: Date | undefined = undefined;
  availableAuthors: Map<string, boolean> = new Map<string, boolean>();

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);
    this.ready = Promise.resolve(this.loadFromStorage());
  }

  get unselectedAuthors(): string[] {
    return Array.from(this.availableAuthors.entries())
      .filter(([, selected]) => !selected)
      .map(([author]) => author);
  }

  createNewDashboard(): string {
    const newDashboardId = crypto.randomUUID();
    this.activeDashboard = new DashboardData(newDashboardId, []);
    this.activeDashboardId = newDashboardId;
    this.saveToStorage();
    this.setupAutoSave();
    return newDashboardId;
  }

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

    runInAction(() => {
      this.activeDashboardId = targetDashboardId;
    });

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

  importDashboardFromJSON(jsonData: string) {
    try {
      const data: StoredDashboardData = JSON.parse(
        jsonData
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
            this.rootStore.dbStore
          )
      );
      runInAction(() => {
        this.activeDashboard = new DashboardData(data.dashboardId, widgets);
        this.activeDashboardId = data.dashboardId;
      });
      this.rootStore.indexingStore.setDefaultDashboardId(data.dashboardId);
      this.saveToStorage();
      this.setupAutoSave();
      console.log("Imported dashboard from JSON:", this.activeDashboard);
    } catch (error) {
      console.warn("Failed to import dashboard from JSON:", error);
    }
  }

  private setupAutoSave() {
    reaction(
      () =>
        this.activeDashboard
          ? JSON.stringify(this.activeDashboard.toJSON())
          : null,
      () => this.saveToStorage(),
      { delay: 100 }
    );
  }

  async setActiveDashboard(dashboardId: string) {
    this.activeDashboardId = dashboardId;
    this.rootStore.indexingStore.setDefaultDashboardId(dashboardId);
    await this.loadFromStorage(dashboardId);
  }
}
