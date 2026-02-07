import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStores } from "../store/StoreContext";
import { Progress } from "@/components/ui/progress";
import { observer } from "mobx-react-lite";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/hooks/useToast";
import { GitHubIssue, GitHubIssueEvent } from "@/workers/dbWorker.d";

/**
 * The main index page component that allows users to start indexing
 * their loaded repository and shows the indexing progress.
 */
const IndexPage = observer(() => {
  const indexingStore = useStores().indexingStore;
  const dbStore = useStores().dbStore;
  const wasmGixStore = useStores().wasmGixStore;
  const githubAPIStore = useStores().githubAPIStore;

  const { showError, showSuccess } = useToast();

  const [indexingProgressMessage, setIndexingProgressMessage] =
    useState<string>("");
  const [githubProgressMessage, setGithubProgressMessage] =
    useState<string>("");

  const hasGitHubConfig = indexingStore.githubApiUrl != "";

  // Callbacks to update indexing progress
  const progressCallbackWasmGix = (progress: number, message: string) => {
    indexingStore.setIndexingProgress(progress).catch(console.error);
    setIndexingProgressMessage(message);
  };
  const progressCallbackGitHub = (progress: number, message: string) => {
    indexingStore.githubIssuesProgress = progress;
    setGithubProgressMessage(message);
  };

  // when the user clicks the start indexing button, worker starts indexing and issues
  // are fetched from GitHub API if configured
  async function handleStartIndexingClick() {
    const indexingPromise = wasmGixStore.startIndexing(
      indexingStore.project!.repositoryIdentifier,
      progressCallbackWasmGix
    );

    // initiailize with empty results for the case that no GitHub config is provided
    let githubPromise: Promise<{
      issues: GitHubIssue[];
      events: GitHubIssueEvent[];
    }> = Promise.resolve({ issues: [], events: [] });

    if (hasGitHubConfig) {
      githubPromise = githubAPIStore
        .fetchGitHubIssuesAndEvents(
          indexingStore.githubApiUrl,
          progressCallbackGitHub,
          indexingStore.githubApiToken
        )
        .catch((e) => {
          console.error("GitHub issues fetch error:", e);
          const errorMessage = e instanceof Error ? e.message : String(e);
          showError("Failed to fetch GitHub issues: " + errorMessage);
          return { issues: [], events: [] };
        });
    }

    const latestSha = await indexingPromise;
    indexingStore.setLastIndexedSha(latestSha);

    const { issues: allIssues, events: allEvents } = await githubPromise;

    await dbStore.insertGitHubIssues(allIssues);
    await dbStore.insertGitHubIssueEvents(allEvents);

    indexingStore.githubIssuesProgress = 100;

    setGithubProgressMessage(
      `Done! ${allIssues.length} issues, ${allEvents.length} events indexed.`
    );
    showSuccess(
      `Fetched ${allIssues.length} issues and ${allEvents.length} issue events.`
    );
  }

  return (
    <div className="p-10 pb-14 mx-0 bg-gradient-to-br from-gray-50 to-gray-200 min-h-screen">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-5xl font-extrabold mb-2 text-blue-900 drop-shadow">
            Start Indexing
          </h1>
        </div>
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <div className="px-6 py-4 border-b bg-blue-50 rounded-t-2xl">
            <h3 className="text-lg font-semibold text-blue-800">
              {indexingStore.project?.name ?? ""}
            </h3>
          </div>
          <div className="p-6">
            <p className="text-lg mb-4">
              Repository successfully loaded into the browser storage.
            </p>
            <p className="text-gray-600">
              You can now proceed to analyze the data.
            </p>
            <div className="mt-4"></div>
            <div className="mt-8 flex justify-center">
              <Button
                onClick={() => {
                  handleStartIndexingClick().catch((e) => {
                    console.error("Indexing error:", e);
                    const errorMessage =
                      e instanceof Error ? e.message : String(e);
                    showError("Indexing failed: " + errorMessage);
                  });
                }}
                disabled={indexingStore.indexingProgress > 0}
              >
                Start Indexing
                {indexingStore.indexingProgress > 0 &&
                  indexingStore.indexingProgress < 100 && <Spinner />}
                {indexingStore.indexingProgress >= 100 && " ✅"}
              </Button>
            </div>

            <div className="mt-4">
              {indexingStore.indexingProgress > 0 && (
                <>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Commit Indexing
                  </p>
                  <Progress value={indexingStore.indexingProgress} />
                  <p className="text-center text-sm text-gray-600 mt-1">
                    {indexingProgressMessage}
                  </p>
                </>
              )}
            </div>

            {hasGitHubConfig && (
              <div className="mt-4">
                {indexingStore.githubIssuesProgress > 0 && (
                  <>
                    <p className="text-sm font-medium text-gray-700 mb-1">
                      GitHub API Issue Data
                    </p>
                    <Progress value={indexingStore.githubIssuesProgress} />
                    <p className="text-center text-sm text-gray-600 mt-1">
                      {githubProgressMessage}
                    </p>
                  </>
                )}
              </div>
            )}

            <div className="mt-6 flex justify-center">
              {indexingStore.indexingProgress > 0 && (
                <Button
                  onClick={() => {
                    globalThis.location.hash = "#explore-customquery";
                  }}
                >
                  Continue to Data Exploration
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default IndexPage;
