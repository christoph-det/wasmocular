import { makeAutoObservable, reaction } from "mobx";
import { RootStore } from "./RootStore";

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
  };
}

export class RepminerProject {
  name = "";

  constructor() {
    makeAutoObservable(this);
  }
}
export class IndexingStore {
  rootStore: RootStore;
  indexingProgress = 0; // Percentage of indexing progress
  dataLoadingState = DataLoadingState.NOT_STARTED;

  project: RepminerProject | null = null;

  private readonly STORAGE_KEY = "indexingStore";

  constructor(rootStore: RootStore) {
    this.rootStore = rootStore;
    makeAutoObservable(this);

    this.loadFromStorage();

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

  private loadFromStorage() {
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

  createNewProject(name: string) {
    this.project = new RepminerProject();
    this.project.name = name;
  }

  changeProjectName(name: string) {
    if (this.project) {
      this.project.name = name;
      this.saveToStorage();
    } else {
      console.warn("No project loaded to change name");
    }
  }

  setIndexingProgress(progress: number) {
    this.indexingProgress = progress;
    if (progress >= 100) {
      this.dataLoadingState = DataLoadingState.INDEXING_FINISHED;
    } else if (
      this.dataLoadingState != DataLoadingState.INDEXING_STARTED &&
      progress > 0
    ) {
      this.dataLoadingState = DataLoadingState.INDEXING_STARTED;
    }
  }

  setDataLoadingState(state: DataLoadingState) {
    this.dataLoadingState = state;
  }
}
