import { makeAutoObservable, reaction, runInAction } from "mobx";
import { DashboardElement, type ChartType } from "./DashboardElement";
import { RootStore } from "./RootStore";

interface StoredDashboardData {
    dashboardId: string;
    dashboardName: string;
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
    dashboardName: string;
    widgets: Array<DashboardElement>;

    constructor(dashboardId: string, dashboardName: string, widgets: Array<DashboardElement>) {
        this.dashboardId = dashboardId;
        this.dashboardName = dashboardName;
        this.widgets = widgets;
        makeAutoObservable(this, {
            toJSON: false,
        });
    }

    toJSON(): StoredDashboardData {
        return {
            dashboardId: this.dashboardId,
            dashboardName: this.dashboardName,
            widgets: this.widgets.map((widget) => widget.toJSON())
        };      
    }

}
// TODO: allows exporting the current dashboard configuration
// TODO: allows deleting dashboards

export class DashboardStore {
    private readonly STORAGE_KEY = "dashboardStore_";
    // dashboard is defined by its own id
    activeDashboard: DashboardData | null = null;
    activeDashboardId: string | null = null;
    rootStore: RootStore;
    ready: Promise<void>;


    constructor(rootStore: RootStore) {
        this.rootStore = rootStore;
        makeAutoObservable(this);
        this.ready = Promise.resolve(this.loadFromStorage());
    }

    createNewDashboard(dashboardName: string): string {
        const newDashboardId = crypto.randomUUID();
        this.activeDashboard = new DashboardData(newDashboardId, dashboardName, []);
        this.activeDashboardId = newDashboardId;
        this.saveToStorage();
        reaction(
            () => this.activeDashboard ? JSON.stringify(this.activeDashboard.toJSON()) : null,
            () => this.saveToStorage(),
            { delay: 100 } 
        );
        return newDashboardId;
    }
    
    private saveToStorage() {
    console.log("Saving dashboard to storage");
    if (this.activeDashboard === null) {
        console.warn("No active dashboard to save.");
        return;
    }
    const storageKey = `${this.STORAGE_KEY}${this.activeDashboard.dashboardId}`;
    try {
        localStorage.setItem(storageKey, JSON.stringify(this.activeDashboard.toJSON()));
    } catch (error) {
        console.warn("Failed to save DashboardStore to localStorage:", error);
    }
    }

    private async loadFromStorage(dashboardId?: string) {
    await this.rootStore.indexingStore.ready;
    const targetDashboardId = dashboardId ?? this.rootStore.indexingStore.project?.defaultDashboardId ?? null;

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
            this.activeDashboard = new DashboardData(
                data.dashboardId,
                data.dashboardName,
                widgets
            );
        });
        }
         reaction(
            () => this.activeDashboard ? JSON.stringify(this.activeDashboard.toJSON()) : null,
            () => this.saveToStorage(),
            { delay: 100 } 
        ); 
        console.log("Loaded dashboard from storage:", this.activeDashboard);
    } catch (error) {
        console.warn("Failed to load DashboardStore from localStorage:", error);
    }
    }

    exportActiveDashboard() {
        // TODO: implement export logic
    }

    setActiveDashboard(dashboardId: string) {
        this.activeDashboardId = dashboardId;
        this.loadFromStorage(dashboardId);
    }
    
}
