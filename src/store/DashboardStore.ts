import { makeAutoObservable } from "mobx";

export class DashboardStore {
    private readonly STORAGE_KEY = "dashboardStore";

    constructor() {
        makeAutoObservable(this);
    }
    }