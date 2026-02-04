import { test, expect, vi, describe, beforeEach } from "vitest";

// Mock StoreContext to prevent circular dependency issues
vi.mock("@/store/StoreContext", () => ({
  rootStore: {
    dbStore: {},
    dashboardStore: {}
  },
  useStores: vi.fn(),
  StoreContext: {
    Provider: ({ children }: any) => children
  }
}));

// universal worker mock
class MockWorker {
  postMessage = vi.fn(() => Promise.resolve());
  terminate = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  onmessage: ((this: MockWorker, ev: MessageEvent) => any) | null = null;
}

Object.defineProperty(global, "Worker", {
  value: MockWorker,
  configurable: true
});

// mocking comlink, especially for the dbWorker
const mockComlinkWorkerInstance = {
  initialize: vi.fn().mockResolvedValue(undefined),
  query: vi.fn().mockResolvedValue([{ value: 1 }]),
  terminate: vi.fn().mockResolvedValue(undefined),
  deleteDatabase: vi.fn().mockResolvedValue(undefined),
  insertIndexerData: vi.fn().mockResolvedValue(undefined)
};
vi.mock("comlink", () => ({
  wrap: vi.fn(() => mockComlinkWorkerInstance),
  transfer: vi.fn((data) => data),
  expose: vi.fn()
}));

import { RootStore } from "../../src/store/RootStore.ts";
import { RepositoryProject } from "../../src/store/IndexingStore.ts";
import {
  ChartType,
  DashboardElement
} from "../../src/store/DashboardElement.ts";
import { DuckDBAccessMode } from "@duckdb/duckdb-wasm";

// Mock localStorage of browser
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null)
  };
})();

Object.defineProperty(global, "localStorage", {
  value: localStorageMock,
  configurable: true
});

describe("Test RootStore and Sub-stores", () => {
  let rootStore: RootStore;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    rootStore = new RootStore();
  });

  test("rootstore initializes all sub-stores", () => {
    expect(rootStore.dbStore).toBeDefined();
    expect(rootStore.dashboardStore).toBeDefined();
    expect(rootStore.indexingStore).toBeDefined();
    expect(rootStore.wasmGitStore).toBeDefined();
    expect(rootStore.wasmGixStore).toBeDefined();
    expect(rootStore.githubAPIStore).toBeDefined();
  });

  // DashboardStore

  test("DashboardStore can create a new dashboard, load it again and delete it", async () => {
    localStorageMock.setItem;
    const dashboardId = rootStore.dashboardStore.createNewDashboard();
    expect(dashboardId).toBeDefined();
    expect(rootStore.dashboardStore.activeDashboard?.dashboardId).toBe(
      dashboardId
    );

    // saved to localStorage by auto-save reaction
    expect(localStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining("dashboardStore_"),
      expect.any(String)
    );

    const dashboardId_other = rootStore.dashboardStore.createNewDashboard();
    expect(dashboardId_other).not.toBe(dashboardId);
    expect(
      rootStore.dashboardStore.activeDashboard?.dashboardId,
      "Active dashboard ID after creating second dashboard"
    ).toBe(dashboardId_other);

    // load first dashboard again
    await rootStore.dashboardStore.setActiveDashboard(dashboardId);
    expect(
      rootStore.dashboardStore.activeDashboard?.dashboardId,
      "Active dashboard ID after loading first dashboard again"
    ).toBe(dashboardId);

    // delete first dashboard
    rootStore.dashboardStore.deleteDashboard(dashboardId);
    expect(localStorage.removeItem).toHaveBeenCalledWith(
      expect.stringContaining(dashboardId)
    );
  });

  test("Dashboard can be exported and imported correctly", async () => {
    // Mock browser download APIs
    let capturedBlob: Blob | null = null;

    global.URL.createObjectURL = vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "mockUrl";
    });
    global.URL.revokeObjectURL = vi.fn();

    const mockAnchor = {
      href: "",
      download: "",
      click: vi.fn()
    };

    // Create dashboard with widget
    vi.stubGlobal("document", {
      createElement: vi.fn(() => mockAnchor),
      body: { appendChild: vi.fn() }
    });
    const dashboardId = rootStore.dashboardStore.createNewDashboard();
    const widget1 = new DashboardElement(
      "widget1",
      "Test Widget 1",
      "Description 1",
      "half",
      ChartType.STACKED_AREA_CHART,
      "SELECT * FROM table1",
      "days",
      null as any,
      null as any
    );
    rootStore.dashboardStore.activeDashboard?.widgets.push(widget1);

    // Export dashboard
    rootStore.dashboardStore.exportActiveDashboard();

    expect(capturedBlob).not.toBeNull();
    const blobText = await capturedBlob!.text();
    const exportedData = JSON.parse(blobText);
    expect(exportedData.widgets).toHaveLength(1);
    expect(exportedData.widgets[0].title).toBe("Test Widget 1");

    // Test import
    rootStore.dashboardStore.importDashboardFromJSON(
      JSON.stringify(exportedData)
    );
    expect(rootStore.dashboardStore.activeDashboard?.widgets).toHaveLength(1);
  });

  test("DashboardStore manages authors selection correctly", () => {
    const authors = new Map([
      ["Alice", true],
      ["Bob", false]
    ]);

    rootStore.dashboardStore.setAvailableAuthors(authors);
    expect(rootStore.dashboardStore.unselectedAuthors).toContain("Bob");
    expect(rootStore.dashboardStore.unselectedAuthors).not.toContain("Alice");

    rootStore.dashboardStore.setAuthorSelected("Bob", true);
    expect(rootStore.dashboardStore.unselectedAuthors).not.toContain("Bob");
  });

  // DatabaseStore

  test("DatabaseStore can run a simple query", async () => {
    rootStore.dbStore.ensureInitialization(
      "test_project",
      DuckDBAccessMode.READ_ONLY
    );
    const result = await rootStore.dbStore.runQuery("SELECT 1 AS value;");
    console.log("Query result:", result);
    expect(result).toBeDefined();
    expect((result as any[])[0].value).toBe(1);
  });

  test("DatabaseStore retrieves table and column names", async () => {
    // only tests flow, not actual db content
    const tableNames = await rootStore.dbStore.getTableAndColumnNames();
    expect(tableNames).toBeDefined();
  });

  test("DB access mode gets propagated and closing connection resets state and cleans up resources", async () => {
    rootStore.dbStore.ensureInitialization(
      "test_project",
      DuckDBAccessMode.READ_ONLY
    );
    expect(mockComlinkWorkerInstance.initialize).toHaveBeenCalled();
    await rootStore.dbStore.ensureInitialization(
      "test_project",
      DuckDBAccessMode.READ_WRITE
    );
    expect(mockComlinkWorkerInstance.initialize).toHaveBeenCalledTimes(2);
    await rootStore.dbStore.ensureInitialization(
      "test_project",
      DuckDBAccessMode.READ_WRITE
    );
    expect(mockComlinkWorkerInstance.initialize).not.toHaveBeenCalledTimes(3);
    await rootStore.dbStore.closeConnection();
    await rootStore.dbStore.ensureInitialization(
      "test_project",
      DuckDBAccessMode.READ_WRITE
    );
    // new instance + initialization called once now
    expect(mockComlinkWorkerInstance.terminate).toHaveBeenCalledTimes(1);
  });

  // IndexingStore
  test("IndexingStore can reload current project from storage", () => {
    localStorageMock.setItem("current_project_identifier", "test_project");
    localStorageMock.setItem(
      "indexingStore_test_project",
      JSON.stringify({
        indexingProgress: 50,
        dataLoadingState: "INDEXING_FINISHED",
        project: new RepositoryProject()
      })
    );
    rootStore.indexingStore.loadFromStorage();
    expect(rootStore.indexingStore.project).not.toBeNull();
    expect(rootStore.indexingStore.dataLoadingState).toBe("INDEXING_FINISHED");
    expect(rootStore.indexingStore.indexingProgress).toBe(50);
  });

  test("IndexingStore reset removes project and resets state", () => {
    rootStore.indexingStore.project = new RepositoryProject();
    rootStore.indexingStore.indexingProgress = 100;
    rootStore.indexingStore.resetIndexingStore();
    expect(rootStore.indexingStore.project).toBeNull();
    expect(rootStore.indexingStore.indexingProgress).toBe(0);
    expect(rootStore.indexingStore.dataLoadingState).toBe("NOT_STARTED");
  });

  test("IndexingStore creates and deletes project data successfully", async () => {
    const projectIdentifier = "test_project";
    await rootStore.indexingStore.createNewProject(
      "Project Name",
      projectIdentifier,
      "dashboard_id"
    );
    // Wait for debounced auto-save reaction (100ms delay)
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(rootStore.indexingStore.project).not.toBeNull();
    expect(
      localStorage.getItem(`indexingStore_${projectIdentifier}`)
    ).toBeDefined();
    rootStore.indexingStore.deleteProjectFromStorage(projectIdentifier);
    rootStore.indexingStore.resetIndexingStore();
    expect(
      localStorage.getItem(`indexingStore_${projectIdentifier}`)
    ).toBeNull();
    expect(rootStore.indexingStore.project).toBeNull();
  });

  test("IndexingStore can update project data and persist to storage", async () => {
    const projectIdentifier = "test_project";
    const indexingStore = rootStore.indexingStore;
    await rootStore.indexingStore.createNewProject(
      "Project Name",
      projectIdentifier,
      "dashboard_id"
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(rootStore.indexingStore.project).not.toBeNull();
    indexingStore.changeProjectName("Updated Project Name");
    indexingStore.setDefaultDashboardId("updated_dashboard_id");
    indexingStore.setLastIndexedSha("updated_sha");
    indexingStore.setIndexingProgress(75);
    await new Promise((resolve) => setTimeout(resolve, 200));
    const storedData = JSON.parse(
      localStorage.getItem(`indexingStore_${projectIdentifier}`) || "{}"
    );
    expect(storedData.project.name).toBe("Updated Project Name");
    expect(storedData.project.defaultDashboardId).toBe("updated_dashboard_id");
    expect(storedData.project.lastIndexedSha).toBe("updated_sha");
    expect(storedData.indexingProgress).toBe(75);
  });

  test("IndexingStore lists all stored projects", async () => {
    await rootStore.indexingStore.createNewProject(
      `Project Name`,
      "project_1",
      "dashboard_id"
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    await rootStore.indexingStore.createNewProject(
      `Project Name`,
      "project_2",
      "dashboard_id"
    );
    await new Promise((resolve) => setTimeout(resolve, 200));
    const storedProjects = rootStore.indexingStore.listAllStoredProjects();
    expect(storedProjects.length).toBe(2);
    const identifiers = storedProjects.map(
      (p) => p.project?.repositoryIdentifier
    );
    expect(identifiers).toContain("project_1");
    expect(identifiers).toContain("project_2");
  });

  // GithubAPIStore, WasmGitStore, WasmGixStore need no tests, only facade for worker
});
