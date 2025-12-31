import { makeAutoObservable, reaction } from "mobx";
import { RootStore } from "./RootStore";
import { DuckDBAccessMode } from "@duckdb/duckdb-wasm";

export enum DataLoadingState {
  NOT_STARTED = "NOT_STARTED",
  REPOSITORY_LOADED = "REPOSITORY_LOADED",
  INDEXING_STARTED = "INDEXING_STARTED",
  INDEXING_FINISHED = "INDEXING_FINISHED"
}

interface StoredIndexingData {
  indexingProgress?: number;
  dataLoadingState?: DataLoadingState;
  project?: {
    name: string;
    repositoryIdentifier: string;
    defaultDashboardId: string | null;
  };
}

export class RepositoryProject {
  name = "";
  repositoryIdentifier = "";
  defaultDashboardId: string | null = null;

  constructor() {
    makeAutoObservable(this);
  }
}
export class IndexingStore {
  rootStore: RootStore;
  indexingProgress = 0; // Percentage of indexing progress
  dataLoadingState = DataLoadingState.NOT_STARTED;
  proxyURL = "https://dawn-salad-f180.c-dethloff.workers.dev";
  readonly ready: Promise<void>;

  project: RepositoryProject | null = null;

  STORAGE_KEY = (projectIdentifier?: string) => {
    return (
      "indexingStore_" +
      (projectIdentifier ?? this.project?.repositoryIdentifier ?? "no_project")
    );
  };

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);

    this.ready = Promise.resolve(this.loadFromStorage());

    // trigger auto-save on changes
    reaction(
      () => this.toJSON(),
      () => this.saveToStorage(),
      { delay: 100 } // Debounce saving states
    );
  }

  private toJSON() {
    return {
      indexingProgress: this.indexingProgress,
      dataLoadingState: this.dataLoadingState,
      project: this.project
    };
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY(), JSON.stringify(this.toJSON()));
      localStorage.setItem(
        "current_project_identifier",
        this.project?.repositoryIdentifier ?? ""
      );
    } catch (error) {
      console.warn("Failed to save IndexingStore to localStorage:", error);
    }
  }

  loadFromStorage(projectIdentifier?: string) {
    let stored;

    try {
      if (projectIdentifier) {
        stored = localStorage.getItem(this.STORAGE_KEY(projectIdentifier));
      } else if (!this.project) {
        const currentProject = localStorage
          .getItem("current_project_identifier")
          ?.toString();
        stored = localStorage.getItem(this.STORAGE_KEY(currentProject));
      } else {
        stored = localStorage.getItem(this.STORAGE_KEY());
      }
      if (stored) {
        const data: StoredIndexingData = JSON.parse(
          stored
        ) as StoredIndexingData;
        this.indexingProgress = data.indexingProgress ?? 0;
        this.dataLoadingState =
          data.dataLoadingState ?? DataLoadingState.NOT_STARTED;
        if (data.project) {
          this.project = Object.assign(new RepositoryProject(), data.project);
          this.updateDatabaseAccessMode();
        }
      }
    } catch (error) {
      console.warn("Failed to load IndexingStore from localStorage:", error);
    }
  }

  resetIndexingStore() {
    this.project = null;
    this.dataLoadingState = DataLoadingState.NOT_STARTED;
    this.indexingProgress = 0;
  }

  deleteProjectFromStorage(projectIdentifier: string) {
    try {
      localStorage.removeItem(this.STORAGE_KEY(projectIdentifier));
    } catch (error) {
      console.warn(
        `Failed to delete project ${projectIdentifier} from localStorage:`,
        error
      );
    }
  }

  async createNewProject(
    name: string,
    repositoryIdentifier: string,
    dashboardId: string
  ) {
    await this.ready;
    this.project = new RepositoryProject();
    this.project.name = name;
    this.project.repositoryIdentifier = repositoryIdentifier;
    this.project.defaultDashboardId = dashboardId;
    this.updateDatabaseAccessMode();
  }

  changeProjectName(name: string) {
    if (this.project) {
      this.project.name = name;
      this.saveToStorage();
    } else {
      console.warn("No project loaded to change name");
    }
  }

  setDefaultDashboardId(dashboardId: string) {
    if (!this.project) {
      console.warn("No project loaded to set default dashboard ID");
      return;
    }
    this.project.defaultDashboardId = dashboardId;
    this.saveToStorage();
  }

  async setIndexingProgress(progress: number) {
    await this.ready;
    this.indexingProgress = progress;
    if (progress >= 100) {
      await this.setDataLoadingState(DataLoadingState.INDEXING_FINISHED);
    } else if (
      this.dataLoadingState != DataLoadingState.INDEXING_STARTED &&
      progress > 0
    ) {
      await this.setDataLoadingState(DataLoadingState.INDEXING_STARTED);
    }
  }

  async setDataLoadingState(state: DataLoadingState) {
    await this.ready;
    this.dataLoadingState = state;
    this.updateDatabaseAccessMode();
  }

  listAllStoredProjects(): StoredIndexingData[] {
    const projects: StoredIndexingData[] = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith("indexingStore_")) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const data: StoredIndexingData = JSON.parse(
              stored
            ) as StoredIndexingData;
            if (data.project) {
              projects.push(data);
            }
          }
        }
      }
    } catch (error) {
      console.warn("Failed to list stored projects from localStorage:", error);
    }
    return projects;
  }

  private updateDatabaseAccessMode() {
    if (!this.project) {
      return;
    }

    const mode: DuckDBAccessMode =
      this.dataLoadingState === DataLoadingState.INDEXING_FINISHED
        ? DuckDBAccessMode.READ_ONLY
        : DuckDBAccessMode.READ_WRITE;

    this.rootStore.dbStore.ensureInitialization(
      this.project.repositoryIdentifier,
      mode
    );
  }
}
