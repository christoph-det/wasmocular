import { makeAutoObservable, reaction } from "mobx";
import { RootStore } from "./RootStore";
import { DuckDBAccessMode } from "@duckdb/duckdb-wasm";

/**
 * Enum representing the different states of data loading and indexing.
 */
export enum DataLoadingState {
  NOT_STARTED = "NOT_STARTED",
  REPOSITORY_LOADED = "REPOSITORY_LOADED",
  INDEXING_STARTED = "INDEXING_STARTED",
  INDEXING_FINISHED = "INDEXING_FINISHED"
}

/**
 * Structure for storing indexing data in localStorage.
 */
interface StoredIndexingData {
  indexingProgress?: number;
  dataLoadingState?: DataLoadingState;
  project?: {
    name: string;
    repositoryIdentifier: string;
    defaultDashboardId: string | null;
    lastIndexedSha?: string;
    sourceUrl?: string;
  };
}

/**
 * Class representing a project associated with a repository.
 */
export class RepositoryProject {
  name = "";
  repositoryIdentifier = "";
  defaultDashboardId: string | null = null;
  lastIndexedSha = "";
  sourceUrl = "";

  constructor() {
    makeAutoObservable(this);
  }
}

/**
 * Store managing the indexing state and related data.
 */
export class IndexingStore {
  readonly ready: Promise<void>;
  private rootStore: RootStore;
  indexingProgress = 0; // Percentage of indexing progress
  dataLoadingState = DataLoadingState.NOT_STARTED;

  githubApiUrl = "";
  githubApiToken = "";
  githubIssuesProgress = 0;

  proxyURL = "https://dawn-salad-f180.c-dethloff.workers.dev";

  project: RepositoryProject | null = null;

  private readonly STORAGE_KEY = (projectIdentifier?: string) => {
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
    const project = this.project
      ? {
          name: this.project.name,
          repositoryIdentifier: this.project.repositoryIdentifier,
          defaultDashboardId: this.project.defaultDashboardId,
          lastIndexedSha: this.project.lastIndexedSha,
          sourceUrl: this.project.sourceUrl
        }
      : null;
    return {
      indexingProgress: this.indexingProgress,
      dataLoadingState: this.dataLoadingState,
      project
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

  /**
   * Loads the indexing store data from localStorage.
   */
  async loadFromStorage(projectIdentifier?: string) {
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
          await this.updateDatabaseAccessMode();
        }
      }
    } catch (error) {
      console.warn("Failed to load IndexingStore from localStorage:", error);
    }
  }

  /**
   * Resets the indexing store to its initial state and clears related data.
   */
  async resetIndexingStore() {
    this.project = null;
    this.dataLoadingState = DataLoadingState.NOT_STARTED;
    this.indexingProgress = 0;
    this.githubApiUrl = "";
    this.githubApiToken = "";
    this.githubIssuesProgress = 0;
    await this.rootStore.dbStore.closeConnection();
    this.rootStore.wasmGixStore.reset();
    this.rootStore.wasmGitStore.reset();
    this.rootStore.githubAPIStore.reset();
  }

  /**
   * Deletes the project data from localStorage.
   */
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

  /**
   * Creates a new project and initializes it.
   */
  async createNewProject(
    name: string,
    repositoryIdentifier: string,
    dashboardId: string,
    sourceUrl?: string
  ) {
    await this.ready;
    this.project = new RepositoryProject();
    this.project.name = name;
    this.project.repositoryIdentifier = repositoryIdentifier;
    this.project.defaultDashboardId = dashboardId;
    if (sourceUrl) {
      this.project.sourceUrl = sourceUrl;
    }
    await this.updateDatabaseAccessMode();
  }

  changeProjectName(name: string) {
    if (this.project) {
      this.project.name = name;
    } else {
      console.warn("No project loaded to change name");
    }
  }

  /**
   * Sets the dashboard ID for the current project.
   */
  setDefaultDashboardId(dashboardId: string) {
    if (!this.project) {
      console.warn("No project loaded to set default dashboard ID");
      return;
    }
    this.project.defaultDashboardId = dashboardId;
  }

  /**
   * Sets the last indexed SHA for the current project to use for reindexing.
   */
  setLastIndexedSha(sha: string) {
    if (!this.project) {
      console.warn("No project loaded to set last indexed SHA");
      return;
    }
    this.project.lastIndexedSha = sha;
  }

  /**
   * Sets the indexing progress percentage used for tracking indexing status in the UI and storage.
   */
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

  /**
   * Sets the data loading state and updates database access mode accordingly.
   */
  async setDataLoadingState(state: DataLoadingState) {
    await this.ready;
    this.dataLoadingState = state;
    await this.updateDatabaseAccessMode();
  }

  /**
   * Lists all stored projects in localStorage.
   */
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
