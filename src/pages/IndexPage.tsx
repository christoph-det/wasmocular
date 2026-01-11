import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useStores } from "../store/StoreContext";
import { Progress } from "@/components/ui/progress";
import { observer } from "mobx-react-lite";
import { Spinner } from "@/components/ui/spinner";

const IndexPage = observer(() => {
  const indexingStore = useStores().indexingStore;
  const wasmGixStore = useStores().wasmGixStore;
  const [indexingProgressMessage, setIndexingProgressMessage] =
    useState<string>("");

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
              My Repository
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
                  handleStartIndexingClick().catch(console.error);
                }}
                disabled={indexingStore.indexingProgress > 0}
              >
                Start Indexing
                {indexingStore.indexingProgress > 0 &&
                  indexingStore.indexingProgress < 100 && <Spinner />}
                {indexingStore.indexingProgress >= 100 && " ✅"}
              </Button>
            </div>
            <div className="mt-4"></div>
            {indexingStore.indexingProgress > 0 ? (
              <>
                <Progress value={indexingStore.indexingProgress} />
                <p className="text-center mb-4"> {indexingProgressMessage}</p>
              </>
            ) : null}
            <div className="mt-6 flex justify-center">
              {indexingStore.indexingProgress > 0 ? (
                <Button
                  onClick={() => {
                    globalThis.location.hash = "#explore-customquery";
                  }}
                >
                  Continue to Data Exploration
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  async function handleStartIndexingClick() {
    const repositoryIdentifier = indexingStore.project!.repositoryIdentifier;

    const progressCallback = (progress: number, message: string) => {
      indexingStore.setIndexingProgress(progress).catch(console.error);
      setIndexingProgressMessage(message);
    };

    const latestSha = await wasmGixStore.startIndexing(
      repositoryIdentifier,
      progressCallback
    );
    if (latestSha) {
      indexingStore.setLastIndexedSha(latestSha);
    }
  }
});

export default IndexPage;
