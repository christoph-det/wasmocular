import { useEffect, useState, SetStateAction } from "react";
import { Button } from "@/components/ui/button";
import { observer } from "mobx-react-lite";
import { useStores } from "../store/StoreContext";
import { DataLoadingState } from "@/store/IndexingStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/useToast";
import { useNavigate } from "react-router-dom";
import { generateRepoIdentifier } from "@/utils/utils";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";

declare global {
  function showDirectoryPicker({
    mode
  }: {
    mode: "read" | "write";
  }): Promise<FileSystemDirectoryHandle>;
}

const LoadPage = observer(() => {
  const wasmGitStore = useStores().wasmGitStore;
  const wasmGixStore = useStores().wasmGixStore;
  const indexingStore = useStores().indexingStore;
  const dashboardStore = useStores().dashboardStore;
  const { showError, showInfo, showSuccess } = useToast();
  const navigate = useNavigate();
  const [projectName, setProjectName] = useState<string>("");
  const [gitRepoUrl, setGitRepoUrl] = useState<string>("");
  const [localRepoDirHandle, setLocalRepoDirHandle] =
    useState<FileSystemDirectoryHandle | null>(null);
  const [projectCreationError, setProjectCreationError] = useState<string>("");
  const [loadingProgress, setLoadingProgress] = useState<number>(-1);
  const [loadingProgressMessage, setLoadingProgressMessage] =
    useState<string>("");
  const [openProxyUrlDialog, setOpenProxyUrlDialog] = useState<boolean>(false);
  const [proxyUrl, setProxyUrl] = useState<string>(indexingStore.proxyURL);

  const handleprojectNameInputChange = (event: {
    target: { value: SetStateAction<string> };
  }) => {
    setProjectName(event.target.value);
  };

  const handleSaveProxyUrl = () => {
    indexingStore.proxyURL = proxyUrl;
    setOpenProxyUrlDialog(false);
    showSuccess("Proxy URL updated.");
  };

  useEffect(() => {
    if (indexingStore.dataLoadingState === DataLoadingState.INDEXING_FINISHED) {
      globalThis.location.hash = "#explore-customquery";
    }
  }, [indexingStore.dataLoadingState, navigate]);

  return (
    <div className="pt-10 mx-0 bg-gradient-to-br from-gray-50 to-gray-200 min-h-[90vh]">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-extrabold mb-2 text-blue-900 drop-shadow">
            Welcome to <span className="text-blue-700">WasmOcular</span>!
          </h1>
          <h2 className="text-xl mb-6 text-gray-700 font-medium">
            Start by selecting a repository to begin your analysis.
          </h2>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="px-6 py-4 border-b bg-blue-50 rounded-t-2xl">
            <h3 className="text-lg font-semibold text-blue-800">
              Local Repository
            </h3>
          </div>
          <div className="p-6">
            <p className="mb-6 text-gray-600">
              Select the folder containing your Git repository. Your data will
              remain on your device and will not be uploaded to any server.
            </p>
            <Label className="mb-2" htmlFor="text">
              Project Name:
            </Label>
            <Input
              type="text"
              onChange={handleprojectNameInputChange}
              hasError={projectName == "state::Error"}
            />
            <Label className="mt-8 mb-2">
              Select Repository Folder or paste a public GitHub URL:
            </Label>
            <div className="mt-4 flex flex-col md:flex-row md:items-center gap-4">
              <Input
                id="directory-button"
                className="w-full cursor-pointer hover:bg-gray-100 md:flex-1"
                type="button"
                disabled={gitRepoUrl.trim() !== ""}
                placeholder="No directory selected"
                onClick={handleDirectoryPicker}
                value={
                  localRepoDirHandle
                    ? "✅ Local directory selected!"
                    : "Select local repository"
                }
              />
              <span className="text-center text-gray-500 font-semibold">
                OR
              </span>
              <Input
                id="github-url"
                className="w-full md:flex-1"
                type="text"
                placeholder="https://github.com/user/repo"
                value={gitRepoUrl}
                disabled={localRepoDirHandle !== null}
                onChange={(e) => setGitRepoUrl(e.target.value)}
              />
            </div>
            <div className="text-sm text-gray-500 mt-2 mb-8">
              URL Format: https://github.com/user/repo.git | Only public repos.{" "}
              <br />
              Proxy server is used for cloning. You can also deploy your own.{" "}
              <Button
                variant="link"
                size="sm"
                className="text-sm p-0"
                onClick={() => setOpenProxyUrlDialog(true)}
              >
                Change Proxy URL
              </Button>
            </div>
            <Dialog
              open={openProxyUrlDialog}
              onOpenChange={setOpenProxyUrlDialog}
            >
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Change Proxy URL</DialogTitle>
                </DialogHeader>
                <div className="py-4">
                  You can also deploy your own git proxy server to avoid CORS
                  issues when cloning repositories, e.g., using Cloudflare
                  Workers with the provided{" "}
                    <a
                      href="/public/gitProxy.ts"
                      target="_blank"
                      rel="noopener noreferrer"
                    >gitProxy.ts
                    </a>{" "}file.
                  <Input
                    type="text"
                    value={proxyUrl}
                    onChange={(e) => setProxyUrl(e.target.value)}
                  />
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button type="button" onClick={handleSaveProxyUrl}>
                    Save
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {loadingProgress >= 0 ? (
              <>
                <Progress className="" value={loadingProgress} />
                <p className="text-center mb-4"> {loadingProgressMessage}</p>
              </>
            ) : null}

            <Button>Connect API Data (optional)</Button>
            <div className="mt-8 flex justify-center">
              <Button
                onClick={() => {
                  void clickCreateProject().catch((e: Error) => {
                    showError("Error creating project: " + e.message);
                  });
                }}
                disabled={loadingProgress >= 0}
              >
                Create Project
                {loadingProgress >= 0 && <Spinner />}
              </Button>
            </div>
            <p className="text-sm text-red-500 mt-2 text-center">
              {projectCreationError}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  async function clickCreateProject() {
    setProjectCreationError("");
    // Get project name from input
    if (!projectName || projectName.trim() === "") {
      setProjectName("state::Error");
      setProjectCreationError("Please enter a project name before continuing.");
      return;
    }

    // Ensure a repository source is chosen
    if (!localRepoDirHandle && gitRepoUrl.trim() === "") {
      setProjectCreationError(
        "Select a local repository or paste a public GitHub URL."
      );
      return;
    }

    setLoadingProgress(0);
    setLoadingProgressMessage(
      "Counting and compressing objects... (might take a while for large repositories)"
    );

    const repoIdentifier = generateRepoIdentifier(); // Simple unique ID based on timestamp

    // If a GitHub URL is provided, trigger clone in the background
    const trimmedUrl = gitRepoUrl.trim();

    const progressCallback = (progress: number, message: string) => {
      setLoadingProgress(progress);
      setLoadingProgressMessage(message);
    };

    if (trimmedUrl) {
      showInfo("Cloning repository in the background...");
      wasmGitStore
        .cloneRepository(trimmedUrl, repoIdentifier, proxyUrl, progressCallback)
        .then(async () => {
          showInfo("Repository successfully cloned.");
          await wasmGixStore.reloadRepository(repoIdentifier);
          const dashboardId = dashboardStore.createNewDashboard();
          await indexingStore.createNewProject(
            projectName,
            repoIdentifier,
            dashboardId
          );
          await indexingStore.setDataLoadingState(
            DataLoadingState.REPOSITORY_LOADED
          );
          globalThis.location.hash = "#index";
          showSuccess("Project created successfully.");
        })
        .catch((error: Error) => {
          console.error("Error cloning repository:", error.message);
          showError(
            "Failed to clone the repository. Please check the URL and try again. Error: " +
              error.message
          );
          setProjectCreationError(
            "Failed to clone the repository. Please check the URL and try again."
          );
          setLoadingProgress(-1);
          setLoadingProgressMessage("");
        });
    } else {
      showInfo("Loading local repository...");
      await wasmGixStore.loadRepository(
        repoIdentifier,
        localRepoDirHandle!,
        progressCallback
      );
      const dashboardId = dashboardStore.createNewDashboard();
      await indexingStore.createNewProject(
        projectName,
        repoIdentifier,
        dashboardId
      );
      await indexingStore.setDataLoadingState(
        DataLoadingState.REPOSITORY_LOADED
      );
      globalThis.location.hash = "#index";
      showSuccess("Project created successfully.");
    }
  }

  function handleDirectoryPicker() {
    if (typeof globalThis.showDirectoryPicker !== "function") {
      console.error("Directory Picker API is not supported in this browser.");
      showInfo("Directory Picker API is not available in this browser.");
      return;
    }

    globalThis
      .showDirectoryPicker({ mode: "read" })
      .then((dirHandle: FileSystemDirectoryHandle) => {
        setLocalRepoDirHandle(dirHandle);
        showSuccess("Local repository selected.");
      })
      .catch((error: Error) => {
        setLocalRepoDirHandle(null);
        if (error?.name === "AbortError") {
          return;
        }
        console.error("Error during directory selection:", error);
        showError(
          "Failed to open the directory picker. Please try again. Cause: " +
            error.message
        );
      });
  }
});

export default LoadPage;
