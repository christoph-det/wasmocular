import { StoredDashboardData } from "@/store/DashboardStore";
import { DataLoadingState } from "@/store/IndexingStore";

const EXAMPLE_PROJECT_NAME = "[Example] Binocular";
const EXAMPLE_PROJECT_IDENTIFIER = "example_binocular_project";

let loadingInProgress: Promise<void> | null = null;

/**
 * Creates the bundled example project for first-time users if it doesn't already exist.
 */
export function createExampleProjectOnFirstVisit() {
  if (!loadingInProgress) {
    loadingInProgress = loadExampleProject();
  }
}

async function loadExampleProject(): Promise<void> {
  try {
    const [dashboardResponse, databaseResponse] = await Promise.all([
      fetch(EXAMPLE_PROJECT_IDENTIFIER + "/dashboard.json"),
      fetch(EXAMPLE_PROJECT_IDENTIFIER + "/database.db")
    ]);

    if (!dashboardResponse.ok || !databaseResponse.ok) {
      throw new Error(
        `Failed to load example project: dashboard ${dashboardResponse.status}, database ${databaseResponse.status}`
      );
    }

    const dashboardText = await dashboardResponse.text();
    let dashboardData: StoredDashboardData;
    try {
      dashboardData = JSON.parse(dashboardText) as StoredDashboardData;
    } catch {
      throw new Error("Dashboard asset is not valid JSON.");
    }

    const databaseBuffer = await databaseResponse.arrayBuffer();
    await writeDatabaseToOpfs(databaseBuffer, EXAMPLE_PROJECT_IDENTIFIER);

    localStorage.setItem(
      `dashboardStore_${dashboardData.dashboardId}`,
      JSON.stringify(dashboardData)
    );

    localStorage.setItem(
      `indexingStore_${EXAMPLE_PROJECT_IDENTIFIER}`,
      JSON.stringify({
        indexingProgress: 100,
        dataLoadingState: DataLoadingState.INDEXING_FINISHED,
        project: {
          name: EXAMPLE_PROJECT_NAME,
          repositoryIdentifier: EXAMPLE_PROJECT_IDENTIFIER,
          defaultDashboardId: dashboardData.dashboardId,
          lastIndexedSha: "cde506792aaf43feb4fec267cf929b7f809c8bc4",
          sourceUrl: "https://github.com/INSO-World/Binocular.git"
        }
      })
    );
  } catch (error) {
    console.error("Failed to load example project:", error);
  }
}

async function writeDatabaseToOpfs(
  buffer: ArrayBuffer,
  repositoryIdentifier: string
) {
  const databaseFileName = `wasmocular_database_${repositoryIdentifier}.db`;
  const root = await navigator.storage.getDirectory();
  const fileHandle = await root.getFileHandle(databaseFileName, {
    create: true
  });
  const writable = await fileHandle.createWritable();
  await writable.write(new Uint8Array(buffer));
  await writable.close();
}
