import Button from "../components/button/Button";
import { useStores } from "../store/StoreContext";
import { Progress } from "@/components/ui/progress";
import { observer } from "mobx-react-lite";

const IndexPage = observer(() => {
  const indexingStore = useStores().indexingStore;
  const wasmGixStore = useStores().wasmGixStore;

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
              Respository successfully loaded. X files have been successfully
              loaded into the browser storage.
            </p>
            <p className="text-gray-600">
              You can now proceed to analyze the data.
            </p>
            <div className="mt-4"></div>
            <Button
              text={"Start Indexing"}
              center
              onClick={handleStartIndexingClick}
            />
            <div className="mt-4"></div>
            {indexingStore.indexingProgress > 0 ? (
              <Progress value={indexingStore.indexingProgress} />
            ) : null}
            <div className="mt-6"></div>
            {indexingStore.indexingProgress > 0 ? (
              <Button
                text={"Continue to Data Exploration"}
                onClick={() => {
                  window.location.hash = "#explore-customquery";
                }}
                center
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  function handleStartIndexingClick() {
    // increase indexing progress every second
    const repositoryIdentifier = indexingStore.project!.repositoryIdentifier;

    wasmGixStore.startIndexing(repositoryIdentifier);
    const interval = setInterval(() => {
      if (indexingStore.indexingProgress < 100) {
        indexingStore.setIndexingProgress(indexingStore.indexingProgress + 1);
      } else {
        clearInterval(interval);
      }
    }, 100);
  }
});

export default IndexPage;
