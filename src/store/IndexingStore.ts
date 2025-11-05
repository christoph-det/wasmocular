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
  };
}

export class RepminerProject {
  name = "";
  repositoryIdentifier = "";

  constructor() {
    makeAutoObservable(this);
  }
}
export class IndexingStore {
  rootStore: RootStore;
  indexingProgress = 0; // Percentage of indexing progress
  dataLoadingState = DataLoadingState.NOT_STARTED;
  readonly ready: Promise<void>;

  project: RepminerProject | null = null;

  private readonly STORAGE_KEY = "indexingStore";

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);

    this.ready = this.loadFromStorage();

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
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.toJSON()));
    } catch (error) {
      console.warn("Failed to save IndexingStore to localStorage:", error);
    }
  }

  private async loadFromStorage() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const data: StoredIndexingData = JSON.parse(
          stored
        ) as StoredIndexingData;
        this.indexingProgress = data.indexingProgress ?? 0;
        this.dataLoadingState =
          data.dataLoadingState ?? DataLoadingState.NOT_STARTED;
        if (data.project) {
          this.project = Object.assign(new RepminerProject(), data.project);
          await this.updateDatabaseAccessMode();
        }
      }
    } catch (error) {
      console.warn("Failed to load IndexingStore from localStorage:", error);
    }
  }

  removeProject() {
    this.project = null;
    this.dataLoadingState = DataLoadingState.NOT_STARTED;
    this.indexingProgress = 0;
  }

  async createNewProject(name: string, repositoryIdentifier: string) {
    await this.ready;
    this.project = new RepminerProject();
    this.project.name = name;
    this.project.repositoryIdentifier = repositoryIdentifier;
    await this.updateDatabaseAccessMode();
  }

  changeProjectName(name: string) {
    if (this.project) {
      this.project.name = name;
      this.saveToStorage();
    } else {
      console.warn("No project loaded to change name");
    }
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
    await this.updateDatabaseAccessMode();
  }

  private async updateDatabaseAccessMode() {
    if (!this.project) {
      return;
    }

    const mode: DuckDBAccessMode =
      this.dataLoadingState === DataLoadingState.INDEXING_FINISHED
        ? DuckDBAccessMode.READ_ONLY
        : DuckDBAccessMode.READ_WRITE;

    await this.rootStore.dbStore.ensureInitialization(
      this.project.repositoryIdentifier,
      mode
    );
  }
}
