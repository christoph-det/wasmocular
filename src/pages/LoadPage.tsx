import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { observer } from "mobx-react-lite";
import { useStores } from "../store/StoreContext";
import { DataLoadingState } from "@/store/IndexingStore";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/useToast";
import { generateRepoIdentifier } from "@/lib/utils";
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

// enable types for the Directory Picker API
declare global {
  function showDirectoryPicker({
    mode
  }: {
    mode: "read" | "write";
  }): Promise<FileSystemDirectoryHandle>;
}

/**
 * LoadPage component for creating a new project by selecting a local Git repository
 * or cloning from a public GitHub URL and configuring optional GitHub issue data.
 */
const LoadPage = observer(() => {
  const wasmGitStore = useStores().wasmGitStore;
  const wasmGixStore = useStores().wasmGixStore;
  const indexingStore = useStores().indexingStore;
  const dashboardStore = useStores().dashboardStore;

  const { showError, showInfo, showSuccess } = useToast();

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
  const [openGitHubApiDialog, setOpenGitHubApiDialog] =
    useState<boolean>(false);
  const [githubRepoUrl, setGithubRepoUrl] = useState<string>("");
  const [githubToken, setGithubToken] = useState<string>("");
  const [githubConfigured, setGithubConfigured] = useState<boolean>(false);

  const handleSaveProxyUrl = () => {
    indexingStore.proxyURL = proxyUrl;
    setOpenProxyUrlDialog(false);
    showSuccess("Proxy URL updated.");
  };

  // redirect to explore page when indexing has been done already
  useEffect(() => {
    if (indexingStore.dataLoadingState === DataLoadingState.INDEXING_FINISHED) {
      globalThis.location.hash = "#explore-customquery";
    }
  }, [indexingStore.dataLoadingState]);

  const progressCallback = (progress: number, message: string) => {
    setLoadingProgress(progress);
    setLoadingProgressMessage(message);
  };

  /**
   * Creates a project by either cloning a GitHub repository or loading a local Git repository.
   */
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

    const trimmedUrl = gitRepoUrl.trim();

    // If a GitHub URL is provided, trigger clone from remote
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
            dashboardId,
            trimmedUrl
          );
          await indexingStore.setDataLoadingState(
            DataLoadingState.REPOSITORY_LOADED
          );
          // redirect to index page
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
      // redirect to index page
      globalThis.location.hash = "#index";
      showSuccess("Project created successfully.");
    }
  }

  /**
   * Handles the directory picker for selecting a local Git repository.
   * The API for that is not supported in all browsers. (Only Chromium-based for now)
   */
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

  /**
   * Handles saving the GitHub API configuration for issues.
   */
  function handleSaveGitHubConfig() {
    const trimmedUrl = githubRepoUrl.trim();
    if (!trimmedUrl.startsWith("https://github.com/")) {
      showError("Please enter a GitHub repository URL.");
      return;
    }

    indexingStore.githubApiUrl = trimmedUrl;
    indexingStore.githubApiToken = githubToken.trim();
    setGithubConfigured(true);
    setOpenGitHubApiDialog(false);
    showSuccess(
      "GitHub API configuration saved. Issues will be fetched during indexing."
    );
  }

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
              onChange={(e) => setProjectName(e.target.value)}
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
                  >
                    gitProxy.ts
                  </a>{" "}
                  file.
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

            <Button
              variant={githubConfigured ? "outline" : "default"}
              onClick={() => setOpenGitHubApiDialog(true)}
            >
              {githubConfigured
                ? "✅ GitHub Issues Connected"
                : "Connect GitHub Issue Data (optional)"}
            </Button>

            <Dialog
              open={openGitHubApiDialog}
              onOpenChange={setOpenGitHubApiDialog}
            >
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Connect GitHub Issues API</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-4">
                  <div>
                    <Label htmlFor="github-repo-url">
                      GitHub Repository URL
                    </Label>
                    <Input
                      id="github-repo-url"
                      type="text"
                      placeholder="https://github.com/owner/repo"
                      value={githubRepoUrl}
                      onChange={(e) => setGithubRepoUrl(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="github-token">GitHub Token</Label>
                    <Input
                      type="password"
                      autoComplete="on"
                      id="github-token"
                      value={githubToken}
                      onChange={(e) => setGithubToken(e.target.value)}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Without a token, GitHub strict rate limits apply and only
                      issues are fetched. With a token, issue-commit links are
                      also fetched. Generate one{" "}
                      <a
                        href="https://github.com/settings/personal-access-tokens"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        here
                      </a>
                      .
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </DialogClose>
                  <Button
                    type="button"
                    onClick={handleSaveGitHubConfig}
                    disabled={!githubRepoUrl.trim()}
                  >
                    Save Configuration
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
});

export default LoadPage;
