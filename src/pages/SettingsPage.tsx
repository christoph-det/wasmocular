import { useStores } from "@/store/StoreContext";
import { observer } from "mobx-react-lite";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/useToast";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { DataLoadingState } from "@/store/IndexingStore";

const SettingsPage = observer(() => {
  const indexingStore = useStores().indexingStore;
  const databaseStore = useStores().dbStore;
  const wasmGixStore = useStores().wasmGixStore;
  const wasmGitStore = useStores().wasmGitStore;
  const dashboardStore = useStores().dashboardStore;
  const [projectName, setProjectName] = useState<string>("");
  const [isReindexing, setIsReindexing] = useState(false);
  const [reindexProgress, setReindexProgress] = useState(0);
  const [reindexMessage, setReindexMessage] = useState("");
  const { showSuccess, showError } = useToast();

  const handleprojectNameInputChange = (event: {
    target: { value: string };
  }) => {
    setProjectName(event.target.value);
  };

  const handleProjectNameSaveClick = () => {
    if (indexingStore.project) {
      indexingStore.changeProjectName(projectName);
      setProjectName(""); // Clear the input after saving
    } else {
      console.warn("No project loaded to change name");
    }
  };

  function handleExportDuckDBClick() {
    exportDuckDB().catch((error) => {
      console.error("Error exporting DuckDB:", error);
    });
  }

  const handleClickDeleteProject = async () => {
    if (
      confirm(
        "Are you sure you want to delete this project? This action cannot be undone."
      )
    ) {
      const repositoryIdentifier = indexingStore.project?.repositoryIdentifier;
      if (!repositoryIdentifier) {
        alert("Cannot delete project: No project loaded/inconsistent state.");
        return;
      }
      try {
        await databaseStore.deleteDatabase(repositoryIdentifier);
        await wasmGixStore.deleteRepositroyData(repositoryIdentifier);
        dashboardStore.deleteDashboard(
          indexingStore.project!.defaultDashboardId ?? ""
        );
        indexingStore.deleteProjectFromStorage(repositoryIdentifier);
        indexingStore.resetIndexingStore();
        showSuccess("Project deleted successfully.");
        globalThis.location.hash = "#/";
      } catch (error) {
        console.error("Failed to delete project:", error);
        alert("Failed to delete project from local storage.");
      }
    }
  };

  const handleReindexClick = async () => {
    const repositoryIdentifier = indexingStore.project!.repositoryIdentifier;
    const lastIndexedSha = indexingStore.project!.lastIndexedSha;
    const sourceUrl = indexingStore.project!.sourceUrl;

    if (!lastIndexedSha) {
      showError(
        "No previous indexing data found. Please do a full index first."
      );
      return;
    }

    setReindexProgress(0);
    setIsReindexing(true);

    const progressCallback = (progress: number, message: string) => {
      setReindexProgress(progress);
      setReindexMessage(message);
    };

    try {
      await indexingStore.setDataLoadingState(
        DataLoadingState.INDEXING_STARTED
      );
      // If we have a source URL, use wasm-git to clone the repository
      if (sourceUrl) {
        await wasmGitStore.cloneRepository(
          sourceUrl,
          repositoryIdentifier,
          indexingStore.proxyURL,
          progressCallback
        );
        await wasmGixStore.reloadRepository(repositoryIdentifier);
      } else {
        // For local repos without source URL, we need to select the folder again
        const dirHandle = await window.showDirectoryPicker({ mode: "read" });
        await wasmGixStore.loadRepository(
          repositoryIdentifier,
          dirHandle,
          progressCallback
        );
      }

      const latestSha = await wasmGixStore.startIndexing(
        repositoryIdentifier,
        progressCallback,
        lastIndexedSha
      );

      if (latestSha) {
        indexingStore.setLastIndexedSha(latestSha);
        showSuccess("Reindexing completed successfully!");
      } else {
        showError("Reindexing failed or no new commits found.");
      }
    } catch (error) {
      console.error("Reindexing failed:", error);
      showError("Reindexing failed. See console for details.");
    } finally {
      await indexingStore.setDataLoadingState(
        DataLoadingState.INDEXING_FINISHED
      );
      setIsReindexing(false);
      setReindexMessage("");
    }
  };

  async function exportDuckDB() {
    const opfsRoot = await navigator.storage.getDirectory();
    const databaseFileName = `wasmocular_database_${indexingStore.project?.repositoryIdentifier}.db`;
    const fileHandle = await opfsRoot.getFileHandle(databaseFileName);
    fileHandle
      .getFile()
      .then((file) => {
        const reader = new FileReader();
        reader.onload = function (event) {
          const arrayBuffer = event.target?.result;
          if (arrayBuffer) {
            const blob = new Blob([arrayBuffer], {
              type: "application/octet-stream"
            });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = databaseFileName;
            document.body.appendChild(a);
            a.click();
            URL.revokeObjectURL(url);
          }
        };
        reader.readAsArrayBuffer(file);
      })
      .catch((error: Error) => {
        return Promise.reject(error);
      });
  }
  if (!indexingStore.project) {
    return "No project loaded.";
  }

  return (
    <div className="p-10 pb-14 mx-0 bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-extrabold mb-2 text-blue-900 drop-shadow">
            Settings
          </h1>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="px-6 py-4 border-b bg-blue-50 rounded-t-2xl">
            <h3 className="text-lg font-semibold text-blue-800">
              Settings for Project {indexingStore.project?.name}
            </h3>
          </div>
          <div className="p-6">
            <p className="mb-6 text-gray-600">
              Project ID: {indexingStore.project?.repositoryIdentifier}
            </p>
            <Label className="mb-2" htmlFor="text">
              Change Project Name:
            </Label>
            <Input
              type="text"
              onChange={handleprojectNameInputChange}
              value={projectName}
              placeholder={indexingStore.project?.name ?? ""}
            />
            <Button className="mt-2" onClick={handleProjectNameSaveClick}>
              Save
            </Button>
            <div className="mt-8 pt-6">
              <h4 className="text-md font-semibold text-gray-800 mb-2">
                Reindex Repository
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                Update the database with new commits since the last indexing.
                {indexingStore.project?.lastIndexedSha && (
                  <span className="block mt-1 text-gray-500">
                    Last indexed commit: {indexingStore.project.lastIndexedSha}
                  </span>
                )}
                {indexingStore.project?.sourceUrl && (
                  <span className="block mt-1 text-gray-500">
                    Source: {indexingStore.project.sourceUrl}
                  </span>
                )}
              </p>
              <Button
                onClick={() => {
                  void handleReindexClick();
                }}
                disabled={
                  isReindexing || !indexingStore.project?.lastIndexedSha
                }
              >
                {isReindexing ? (
                  <>
                    Reindexing... <Spinner />
                  </>
                ) : indexingStore.project?.sourceUrl ? (
                  "Reindex from remote source"
                ) : (
                  "Reindex (Select Folder)"
                )}
              </Button>
              {isReindexing && (
                <div className="mt-4">
                  <Progress value={reindexProgress} />
                  <p className="text-center text-sm text-gray-600 mt-2">
                    {reindexMessage}
                  </p>
                </div>
              )}
            </div>

            <br />
            <Button className="mt-8" onClick={handleExportDuckDBClick}>
              Export Database
            </Button>
            <br />
            <Button
              onClick={() => {
                void handleClickDeleteProject();
              }}
              className="mt-4"
            >
              Delete Project
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default SettingsPage;
